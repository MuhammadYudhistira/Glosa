import { addDays } from "@/lib/dates"
import type {
  DailyGoal,
  HabitDay,
  HabitGoals,
  LocalDayTotals,
  ReadingTimeEntry,
} from "@/lib/habit/types"
import { WHOLE_DAY_SECONDS } from "@/lib/habit/types"
import type { ClockPiece } from "@/lib/reading-clock"
import type { QueueStore } from "@/lib/sync/queue-sync"
import { type LocalReadingTime, localDb } from "./db"

const CACHE_KEY = "habit"
/** Sent rows older than this many days leave the device. */
const KEEP_DAYS = 40

export const readingTimeKey = (entry: { day: string; bookId: string }) =>
  `${entry.day} ${entry.bookId}`

const secondsOf = (row: LocalReadingTime) =>
  Math.min(WHOLE_DAY_SECONDS, Math.floor(row.ms / 1000))

/** Adds the clock's pieces to this device's totals, with the goal set now. */
export async function addReadingTime(
  bookId: string,
  pieces: ReadonlyArray<ClockPiece>,
  goalMinutes: DailyGoal | null
): Promise<void> {
  if (pieces.length === 0) return
  const db = localDb()
  await db.transaction("rw", db.readingTime, async () => {
    for (const piece of pieces) {
      const key = readingTimeKey({ day: piece.day, bookId })
      const row = await db.readingTime.get(key)
      await db.readingTime.put({
        key,
        day: piece.day,
        bookId,
        ms: (row?.ms ?? 0) + piece.ms,
        sentSeconds: row?.sentSeconds ?? 0,
        goalMinutes,
      })
    }
  })
}

async function markSent(entries: ReadonlyArray<ReadingTimeEntry>) {
  const db = localDb()
  await db.transaction("rw", db.readingTime, async () => {
    for (const entry of entries) {
      const row = await db.readingTime.get(readingTimeKey(entry))
      if (row && row.sentSeconds < entry.seconds) {
        await db.readingTime.put({ ...row, sentSeconds: entry.seconds })
      }
    }
  })
}

/** The queue's view: a row waits while it holds more whole seconds than were sent. */
export const localReadingTimeStore: QueueStore<ReadingTimeEntry> = {
  async pending() {
    const rows = await localDb().readingTime.orderBy("day").toArray()
    return rows
      .filter((row) => secondsOf(row) > row.sentSeconds)
      .map((row) => ({
        day: row.day,
        bookId: row.bookId,
        seconds: secondsOf(row),
        goalMinutes: row.goalMinutes,
      }))
  },
  confirm: markSent,
  // A refused entry would be refused again: it is not sent any more.
  revert: (entry) => markSent([entry]),
}

/** This device's whole seconds per day, with the goal of the row written last. */
export async function localDayTotals(): Promise<LocalDayTotals> {
  const totals: LocalDayTotals = {}
  const rows = await localDb().readingTime.orderBy("day").toArray()
  for (const row of rows) {
    const day = totals[row.day] ?? { seconds: 0, goalMinutes: null }
    totals[row.day] = {
      seconds: day.seconds + secondsOf(row),
      goalMinutes: row.goalMinutes,
    }
  }
  return totals
}

/** What the server had confirmed per day: the base the next fetch is read against. */
export async function localSentTotals(): Promise<Record<string, number>> {
  const sent: Record<string, number> = {}
  for (const row of await localDb().readingTime.toArray()) {
    sent[row.day] = (sent[row.day] ?? 0) + row.sentSeconds
  }
  return sent
}

/** Drops sent rows older than 40 days; unsent ones wait for the queue. */
export async function pruneReadingTime(today: string): Promise<void> {
  const before = addDays(today, -KEEP_DAYS)
  const db = localDb()
  const old = await db.readingTime.where("day").below(before).toArray()
  const done = old.filter((row) => row.sentSeconds >= secondsOf(row))
  await db.readingTime.bulkDelete(done.map((row) => row.key))
}

/** The server's last answer, kept for offline (spec 3B §5.4). */
export type HabitCache = {
  days: Array<HabitDay>
  goals: HabitGoals
  sentAtFetch: Record<string, number>
}

export async function loadHabitCache(): Promise<HabitCache | null> {
  const stored = await localDb().meta.get(CACHE_KEY)
  return (stored?.value as HabitCache | undefined) ?? null
}

export async function saveHabitCache(cache: HabitCache): Promise<void> {
  await localDb().meta.put({ key: CACHE_KEY, value: cache })
}
