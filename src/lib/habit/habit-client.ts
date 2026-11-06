import { useEffect, useMemo, useSyncExternalStore } from "react"
import type { ActionResult } from "@/lib/action-result"
import { localDay } from "@/lib/dates"
import { deviceId, onMemberDataWiped } from "@/lib/local/device"
import {
  addReadingTime,
  loadHabitCache,
  localDayTotals,
  localReadingTimeStore,
  localSentTotals,
  pruneReadingTime,
  readingTimeKey,
  saveHabitCache,
  setTodayGoal,
} from "@/lib/local/reading-time"
import type { ClockPiece } from "@/lib/reading-clock"
import { type QueueSync, createQueueSync } from "@/lib/sync/queue-sync"
import { loadHabitFn, recordReadingTimeFn, updateGoalsFn } from "@/server/habit"
import { type HabitState, type HabitView, habitView } from "./habit-view"
import {
  type HabitGoals,
  MAX_READING_TIME_BATCH,
  type ReadingTimeEntry,
} from "./types"

const keepaliveFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, keepalive: true })

let state: HabitState = { cache: null, local: {}, status: "loading" }
const listeners = new Set<() => void>()

function setState(next: Partial<HabitState>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

/** For tests: the state the hook reads. */
export const habitStateForTests = (): HabitState => state

let engine: QueueSync | null = null

/** The one reading time queue of this tab (browser only). */
export function habitSync(): QueueSync {
  engine ??= createQueueSync<ReadingTimeEntry>({
    store: localReadingTimeStore,
    isOnline: () => navigator.onLine,
    keyOf: readingTimeKey,
    batchSize: MAX_READING_TIME_BATCH,
    // Often sent as the tab hides or the reader closes (plan 3B, decision 8).
    send: async (entries) =>
      recordReadingTimeFn({
        data: { deviceId: await deviceId(), entries },
        fetch: keepaliveFetch,
      }),
    onRefused: (refused) =>
      console.error("the server refused reading time", refused.length),
    debounceMs: 10_000,
  })
  return engine
}

async function reloadLocal() {
  setState({ local: await localDayTotals() })
}

let cacheRead: Promise<void> | null = null
/** Bumped by every refresh and every reset; an older refresh drops its answer. */
let refreshSeq = 0
/** Bumped when saving goals starts; `savedGoals` are the ones being or last saved. */
let goalsEpoch = 0
let savedGoals: HabitGoals | null = null
let savesInFlight = 0

// A sign-out, account deletion or another member's claim wipes the device:
// the previous member's streak and goals must not outlive it.
onMemberDataWiped(() => {
  refreshSeq++
  goalsEpoch++
  savedGoals = null
  cacheRead = null
  setState({ cache: null, local: {}, status: "loading" })
})

/** Reads this device's copy once per tab, so views show numbers offline. */
function readCache(): Promise<void> {
  cacheRead ??= (async () => {
    const [cache, local] = await Promise.all([
      loadHabitCache(),
      localDayTotals(),
    ])
    // A refresh that finished first already has the newer answer.
    setState({ cache: state.cache ?? cache, local })
  })().catch((error: unknown) => {
    // Let the next call try again.
    cacheRead = null
    console.error("reading the reading habit on this device failed", error)
  })
  return cacheRead
}

/** Stores time the reader's clock handed over, then sends it after a pause. */
export async function recordReadingTime(
  bookId: string,
  pieces: ReadonlyArray<ClockPiece>
): Promise<void> {
  if (pieces.length === 0) return
  await readCache()
  await addReadingTime(
    bookId,
    pieces,
    state.cache?.goals.dailyGoalMinutes ?? null
  )
  await reloadLocal()
  habitSync().later()
}

/**
 * Sends the waiting time, then fetches every day and the goals (plan 3B,
 * decision 10). Never rejects: a failure keeps the last answer.
 */
export async function refreshHabit(): Promise<void> {
  const seq = ++refreshSeq
  try {
    await readCache()
    await habitSync().flush()
    const sentAtFetch = await localSentTotals()
    const epochAtFetch = goalsEpoch
    const answer = await loadHabitFn()
    if (seq !== refreshSeq) return
    if (!answer.ok) {
      console.error("loading the reading habit was refused", answer.code)
      setState({ status: "failed" })
      return
    }
    // Goals saved while this answer was on its way are newer than it.
    const goals =
      savedGoals && (savesInFlight > 0 || goalsEpoch !== epochAtFetch)
        ? savedGoals
        : answer.goals
    const cache = { days: answer.days, goals, sentAtFetch }
    // A wipe since the answer came must not get the old member's copy back.
    if (seq !== refreshSeq) return
    await saveHabitCache(cache)
    await pruneReadingTime(localDay())
    if (seq !== refreshSeq) return
    setState({ cache, local: await localDayTotals(), status: "ready" })
  } catch (error) {
    console.error("refreshing the reading habit failed", error)
    setState({ status: "failed" })
  }
}

/** Saves both goals; shown at once, put back when the server refuses. */
export async function saveGoals(goals: HabitGoals): Promise<ActionResult> {
  const before = state.cache
  const today = localDay()
  if (!before) return { ok: false, code: "offline" }
  setState({ cache: { ...before, goals } })
  goalsEpoch++
  savedGoals = goals
  savesInFlight++
  let result: ActionResult
  try {
    result = await updateGoalsFn({ data: { ...goals, today } })
  } catch {
    result = { ok: false, code: "unknown" }
  } finally {
    savesInFlight--
  }
  if (!result.ok) {
    if (savedGoals === goals) savedGoals = null
    // Only the goals go back: a refresh may have landed new days meanwhile.
    if (state.cache?.goals === goals) {
      setState({ cache: { ...state.cache, goals: before.goals } })
    }
    return result
  }
  // The new daily goal applies to today too: on this device and in the cache.
  try {
    await setTodayGoal(today, goals.dailyGoalMinutes)
    await reloadLocal()
  } catch (error) {
    console.error("updating today's goal on this device failed", error)
  }
  if (state.cache) {
    setState({
      cache: {
        ...state.cache,
        days: state.cache.days.map((day) =>
          day.day === today
            ? { ...day, goalMinutes: goals.dailyGoalMinutes }
            : day
        ),
      },
    })
  }
  // A refresh that began before the save landed may have put old goals back.
  if (savedGoals === goals && state.cache && state.cache.goals !== goals) {
    setState({ cache: { ...state.cache, goals } })
  }
  if (state.cache) await saveHabitCache(state.cache)
  return result
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const SERVER_STATE: HabitState = { cache: null, local: {}, status: "loading" }

/** Streak, goals and days for the lobby, the reader and the member card. */
export function useReadingHabit(): HabitView {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE
  )
  useEffect(() => {
    void readCache()
  }, [])
  const today = localDay()
  return useMemo(() => habitView(snapshot, today), [snapshot, today])
}
