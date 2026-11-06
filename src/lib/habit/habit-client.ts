import { useEffect, useMemo, useSyncExternalStore } from "react"
import type { ActionResult } from "@/lib/action-result"
import { localDay } from "@/lib/dates"
import { deviceId } from "@/lib/local/device"
import {
  addReadingTime,
  loadHabitCache,
  localDayTotals,
  localReadingTimeStore,
  localSentTotals,
  pruneReadingTime,
  readingTimeKey,
  saveHabitCache,
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

/** Reads this device's copy once per tab, so views show numbers offline. */
function readCache(): Promise<void> {
  cacheRead ??= (async () => {
    const [cache, local] = await Promise.all([
      loadHabitCache(),
      localDayTotals(),
    ])
    // A refresh that finished first already has the newer answer.
    setState({ cache: state.cache ?? cache, local })
  })().catch((error: unknown) =>
    console.error("reading the reading habit on this device failed", error)
  )
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
  try {
    await readCache()
    await habitSync().flush()
    const sentAtFetch = await localSentTotals()
    const answer = await loadHabitFn()
    if (!answer.ok) {
      setState({ status: "failed" })
      return
    }
    const cache = { days: answer.days, goals: answer.goals, sentAtFetch }
    await saveHabitCache(cache)
    await pruneReadingTime(localDay())
    setState({ cache, local: await localDayTotals(), status: "ready" })
  } catch (error) {
    console.error("refreshing the reading habit failed", error)
    setState({ status: "failed" })
  }
}

/** Saves both goals; shown at once, put back when the server refuses. */
export async function saveGoals(goals: HabitGoals): Promise<ActionResult> {
  const before = state.cache
  if (!before) return { ok: false, code: "offline" }
  setState({ cache: { ...before, goals } })
  let result: ActionResult
  try {
    result = await updateGoalsFn({ data: goals })
  } catch {
    result = { ok: false, code: "unknown" }
  }
  if (!result.ok) {
    if (state.cache?.goals === goals) setState({ cache: before })
    return result
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
