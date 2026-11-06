import { describe, expect, it } from "vitest"
import { type HabitState, NO_GOALS, habitView } from "./habit-view"

const TODAY = "2026-11-06"
const cache = {
  days: [{ day: TODAY, seconds: 100, goalMinutes: null }],
  goals: { dailyGoalMinutes: 10 as const, yearlyGoalBooks: null },
  sentAtFetch: { [TODAY]: 100 },
}
const state = (changes: Partial<HabitState>): HabitState => ({
  cache: null,
  local: {},
  status: "loading",
  ...changes,
})

describe("habitView", () => {
  it("waits while nothing is known", () => {
    const view = habitView(state({}), TODAY)
    expect(view.status).toBe("loading")
    expect(view.goals).toEqual(NO_GOALS)
    expect(view.canEditGoals).toBe(false)
  })

  it("adds this device's unsent time to the server's", () => {
    const view = habitView(
      state({
        cache,
        status: "ready",
        local: { [TODAY]: { seconds: 700, goalMinutes: 10 } },
      }),
      TODAY
    )
    expect(view.summary.todaySeconds).toBe(700)
    expect(view.summary.todayGoalSeconds).toBe(600)
    expect(view.summary.todayDone).toBe(true)
    expect(view.canEditGoals).toBe(true)
  })

  it("is stale with a cache and failed without one", () => {
    expect(habitView(state({ cache, status: "failed" }), TODAY).status).toBe(
      "stale"
    )
    expect(habitView(state({ status: "failed" }), TODAY).status).toBe("failed")
  })
})
