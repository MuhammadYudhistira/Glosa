import type { HabitCache } from "@/lib/local/reading-time"
import { type HabitSummary, habitSummary, mergeDays } from "@/lib/reading-habit"
import type { HabitDay, HabitGoals, LocalDayTotals } from "./types"

export type HabitState = {
  cache: HabitCache | null
  local: LocalDayTotals
  /** failed: the last refresh did not reach the server. */
  status: "loading" | "ready" | "failed"
}

export type HabitView = {
  today: string
  days: Array<HabitDay>
  goals: HabitGoals
  summary: HabitSummary
  /** stale: an older answer from this device; failed: nothing to show. */
  status: "loading" | "ready" | "stale" | "failed"
  /** Goals change only once the server's goals are known. */
  canEditGoals: boolean
}

export const NO_GOALS: HabitGoals = {
  dailyGoalMinutes: null,
  yearlyGoalBooks: null,
}

export function habitView(state: HabitState, today: string): HabitView {
  const { cache } = state
  const days = mergeDays(
    cache?.days ?? [],
    state.local,
    cache?.sentAtFetch ?? {}
  )
  const goals = cache?.goals ?? NO_GOALS
  const status =
    state.status === "failed"
      ? cache
        ? "stale"
        : "failed"
      : state.status === "loading" && !cache
        ? "loading"
        : "ready"
  return {
    today,
    days,
    goals,
    summary: habitSummary(days, today, goals.dailyGoalMinutes),
    status,
    canEditGoals: cache !== null,
  }
}
