/** The daily reading goals in minutes (spec 3B). */
export const DAILY_GOALS = [5, 10, 15, 20, 30, 45, 60] as const
/** One of the allowed daily reading goals, in minutes. */
export type DailyGoal = (typeof DAILY_GOALS)[number]
/** The most reading-time entries a device sends in one batch. */
export const MAX_READING_TIME_BATCH = 50
/** Seconds in a whole day, the most a day can hold. */
export const WHOLE_DAY_SECONDS = 86_400
/** One day of reading on every device and book. */
export type HabitDay = {
  day: string
  seconds: number
  goalMinutes: number | null
}
/** The member's habit goals: a daily reading goal and a yearly book goal. */
export type HabitGoals = {
  dailyGoalMinutes: DailyGoal | null
  yearlyGoalBooks: number | null
}
/** What a device sends for one day and book: its running total. */
export type ReadingTimeEntry = {
  day: string
  bookId: string
  seconds: number
  goalMinutes: DailyGoal | null
}
/** The answer to a habit load: the days and goals, or an error code. */
export type HabitAnswer =
  | { ok: true; days: Array<HabitDay>; goals: HabitGoals }
  | { ok: false; code: string }
/** This device's totals per day, as stored on it. */
export type LocalDayTotals = Record<
  string,
  { seconds: number; goalMinutes: number | null }
>
