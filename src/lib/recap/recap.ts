import { z } from "zod"
import { addDays } from "@/lib/dates"
import type { HabitDay } from "@/lib/habit/types"
import { habitSummary } from "@/lib/reading-habit"
import type { RecapData } from "./types"

export type { RecapData }

const RecapRow = z.object({
  days: z.array(
    z.object({
      day: z.string(),
      seconds: z.number(),
      goal_minutes: z.number().nullable(),
    })
  ),
  books: z.array(z.object({ id: z.string(), finished_at: z.string() })),
  looked_up: z.number(),
  saved: z.number(),
  top_meeting: z
    .object({ headword: z.string(), meetings: z.number() })
    .nullable(),
  first_day: z.string().nullable(),
})

export function parseRecap(raw: unknown): RecapData | null {
  const parsed = RecapRow.safeParse(raw)
  if (!parsed.success) return null
  const row = parsed.data
  return {
    days: row.days.map((d) => ({
      day: d.day,
      seconds: d.seconds,
      goalMinutes: d.goal_minutes,
    })),
    books: row.books.map((b) => ({ id: b.id, finishedAt: b.finished_at })),
    lookedUp: row.looked_up,
    saved: row.saved,
    topMeeting: row.top_meeting,
    firstDay: row.first_day,
  }
}

/**
 * The longest streak of reading days inside the period (spec 3E §5.2), by the
 * habit's rules (3B). Days outside the period do not count. A period that is
 * over is read as if "today" were the day after it, with nothing read.
 */
export function longestStreak(
  days: ReadonlyArray<HabitDay>,
  range: { from: string; to: string },
  today: string
): number {
  const inside = days.filter(
    (entry) => entry.day >= range.from && entry.day <= range.to
  )
  if (inside.length === 0) return 0
  const last = range.to < today ? addDays(range.to, 1) : today
  const goal = inside.find((entry) => entry.day === last)?.goalMinutes ?? null
  return habitSummary(inside, last, goal).record
}

export type RecapView = {
  seconds: number
  readingDays: number
  streak: number
  /** Newest finished first, as the server sends them. */
  finished: RecapData["books"]
  lookedUp: number
  saved: number
  topMeeting: RecapData["topMeeting"]
  /** No time, no finished book and no word: "Belum ada bacaan di …". */
  empty: boolean
}

export function recapView(
  recap: RecapData,
  range: { from: string; to: string },
  today: string
): RecapView {
  const seconds = recap.days.reduce((sum, entry) => sum + entry.seconds, 0)
  const empty =
    seconds === 0 &&
    recap.books.length === 0 &&
    recap.lookedUp === 0 &&
    recap.saved === 0
  return {
    seconds,
    readingDays: recap.days.filter((entry) => entry.seconds > 0).length,
    streak: longestStreak(recap.days, range, today),
    finished: recap.books,
    lookedUp: recap.lookedUp,
    saved: recap.saved,
    topMeeting: recap.topMeeting,
    empty,
  }
}
