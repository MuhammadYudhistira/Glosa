import { addDays, localDay, mondayOf } from "./dates"
import {
  type HabitDay,
  type LocalDayTotals,
  WHOLE_DAY_SECONDS,
} from "./habit/types"

/** A reading day without a goal: five minutes (spec 3B §3.2). */
export const DEFAULT_DAY_SECONDS = 300
/** Days a week may go without reading before the streak ends (spec 3B §3.3). */
export const FREE_GAPS_PER_WEEK = 2

export type PlantStage =
  "biji" | "tunas" | "daun" | "rimbun" | "kuncup" | "berbunga"

export const PLANT_STAGE_LABELS: Record<PlantStage, string> = {
  biji: "Biji",
  tunas: "Tunas",
  daun: "Daun",
  rimbun: "Rimbun",
  kuncup: "Kuncup",
  berbunga: "Berbunga",
}

/** The plant grows with the streak and never wilts (spec 3B §3.5). */
export function plantStage(streak: number): PlantStage {
  if (streak >= 50) return "berbunga"
  if (streak >= 21) return "kuncup"
  if (streak >= 7) return "rimbun"
  if (streak >= 3) return "daun"
  if (streak >= 1) return "tunas"
  return "biji"
}

export const goalSeconds = (goalMinutes: number | null): number =>
  goalMinutes === null ? DEFAULT_DAY_SECONDS : goalMinutes * 60

export type HabitSummary = {
  /** Reading days in the current streak; 0 without one. */
  streak: number
  record: number
  /** Free days left this week. */
  gapsLeft: number
  todaySeconds: number
  todayGoalSeconds: number
  todayDone: boolean
  stage: PlantStage
  /** The member read at some point, even for a minute. */
  hasHistory: boolean
}

/**
 * The streak with free days (spec 3B §3.3): weeks run Monday to Sunday, and
 * a streak ends when the third day of a week without reading is over. Past
 * days keep their own goal; today uses the goal set now.
 */
export function habitSummary(
  days: ReadonlyArray<HabitDay>,
  today: string,
  goalMinutes: number | null
): HabitSummary {
  const byDay = new Map(days.map((entry) => [entry.day, entry]))
  const isReadingDay = (day: string) => {
    const entry = byDay.get(day)
    return (
      entry !== undefined && entry.seconds >= goalSeconds(entry.goalMinutes)
    )
  }
  const todaySeconds = byDay.get(today)?.seconds ?? 0
  const todayGoalSeconds = goalSeconds(goalMinutes)
  const todayDone = todaySeconds >= todayGoalSeconds

  const firstDay = days
    .map((entry) => entry.day)
    .filter((day) => day < today && isReadingDay(day))
    .sort()[0] as string | undefined

  let streak = 0
  let record = 0
  let active = false
  let gaps = 0
  let week = ""
  if (firstDay !== undefined) {
    for (let day = firstDay; day < today; day = addDays(day, 1)) {
      const monday = mondayOf(day)
      if (!active) {
        if (isReadingDay(day)) {
          active = true
          streak = 1
          gaps = 0
          week = monday
        }
        continue
      }
      if (monday !== week) {
        week = monday
        gaps = 0
      }
      if (isReadingDay(day)) {
        streak += 1
      } else {
        gaps += 1
        if (gaps > FREE_GAPS_PER_WEEK) {
          record = Math.max(record, streak)
          active = false
          streak = 0
        }
      }
    }
  }
  if (todayDone) {
    if (active) {
      streak += 1
    } else {
      active = true
      streak = 1
      gaps = 0
      week = mondayOf(today)
    }
  }
  record = Math.max(record, streak)
  const gapsLeft =
    active && week === mondayOf(today)
      ? FREE_GAPS_PER_WEEK - gaps
      : FREE_GAPS_PER_WEEK

  return {
    streak,
    record,
    gapsLeft,
    todaySeconds,
    todayGoalSeconds,
    todayDone,
    stage: plantStage(streak),
    hasHistory: days.some((entry) => entry.seconds > 0),
  }
}

export type CalendarCell = {
  day: string
  seconds: number
  /** read: a reading day; some: read, under the goal; future: after today. */
  state: "read" | "some" | "none" | "future"
}

/** The last `weeks` weeks, Monday first, this week last (spec 3B §4.2). */
export function calendarCells(
  days: ReadonlyArray<HabitDay>,
  today: string,
  goalMinutes: number | null,
  weeks = 5
): Array<Array<CalendarCell>> {
  const byDay = new Map(days.map((entry) => [entry.day, entry]))
  const start = addDays(mondayOf(today), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (__, weekday): CalendarCell => {
      const day = addDays(start, week * 7 + weekday)
      if (day > today) return { day, seconds: 0, state: "future" }
      const entry = byDay.get(day)
      const seconds = entry?.seconds ?? 0
      const goal =
        day === today
          ? goalSeconds(goalMinutes)
          : goalSeconds(entry?.goalMinutes ?? null)
      const state = seconds >= goal ? "read" : seconds > 0 ? "some" : "none"
      return { day, seconds, state }
    })
  )
}

/** Books marked finished (Tahap 3A) in today's year, by local date. */
export function booksThisYear(
  books: ReadonlyArray<{ finishedAt: string | null }>,
  today: string
): number {
  const year = today.slice(0, 4)
  return books.filter(
    (book) =>
      book.finishedAt !== null &&
      localDay(Date.parse(book.finishedAt)).slice(0, 4) === year
  ).length
}

/**
 * The server's days plus what this device read since it fetched them
 * (spec 3B §5.4): its totals minus what it had sent by then. A day only this
 * device knows takes the goal stored with it.
 */
export function mergeDays(
  server: ReadonlyArray<HabitDay>,
  local: LocalDayTotals,
  sentAtFetch: Readonly<Record<string, number>>
): Array<HabitDay> {
  const byDay = new Map(server.map((entry) => [entry.day, { ...entry }]))
  for (const [day, { seconds, goalMinutes }] of Object.entries(local)) {
    const extra = seconds - (sentAtFetch[day] ?? 0)
    if (extra <= 0) continue
    const entry = byDay.get(day)
    if (entry) {
      entry.seconds = Math.min(WHOLE_DAY_SECONDS, entry.seconds + extra)
    } else {
      byDay.set(day, {
        day,
        seconds: Math.min(WHOLE_DAY_SECONDS, extra),
        goalMinutes,
      })
    }
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}
