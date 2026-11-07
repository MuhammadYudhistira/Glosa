import { describe, expect, it } from "vitest"
import type { HabitDay } from "@/lib/habit/types"
import { longestStreak, parseRecap, recapView } from "./recap"

const day = (d: string, seconds = 600): HabitDay => ({
  day: d,
  seconds,
  goalMinutes: null,
})
const OCTOBER = { from: "2026-10-01", to: "2026-10-31" }

describe("longestStreak", () => {
  it("counts reading days with the free days of the habit, the longest run", () => {
    // 5, 6, 9 Oct: two free days in between keep it going (3); then 20-23 is 4.
    const days = [
      "2026-10-05",
      "2026-10-06",
      "2026-10-09",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
    ].map((d) => day(d))
    expect(longestStreak(days, OCTOBER, "2026-11-07")).toBe(4)
  })

  it("counts only days inside the period", () => {
    const days = [day("2026-09-29"), day("2026-09-30"), day("2026-10-01")]
    expect(longestStreak(days, OCTOBER, "2026-11-07")).toBe(1)
  })

  it("counts today in a period that is not over", () => {
    const days = [day("2026-10-19"), day("2026-10-20"), day("2026-10-21")]
    expect(longestStreak(days, OCTOBER, "2026-10-21")).toBe(3)
    expect(longestStreak([day("2026-10-21", 100)], OCTOBER, "2026-10-21")).toBe(
      0
    )
  })

  it("is 0 without reading", () => {
    expect(longestStreak([], OCTOBER, "2026-11-07")).toBe(0)
  })
})

describe("recapView", () => {
  const recap = {
    days: [
      day("2026-10-05", 3600),
      day("2026-10-06", 1800),
      day("2026-10-07", 0),
    ],
    books: [{ id: "a", finishedAt: "2026-10-20T00:00:00Z" }],
    lookedUp: 12,
    saved: 3,
    topMeeting: { headword: "ominous", meetings: 5 },
    firstDay: "2026-10-05",
  }

  it("adds the period up", () => {
    const view = recapView(recap, OCTOBER, "2026-11-07")
    expect(view).toMatchObject({
      seconds: 5400,
      readingDays: 2,
      streak: 2,
      lookedUp: 12,
      saved: 3,
      empty: false,
    })
    expect(view.finished).toEqual(recap.books)
    expect(view.topMeeting).toEqual({ headword: "ominous", meetings: 5 })
  })

  it("is empty with no time, books or words", () => {
    const empty = {
      ...recap,
      days: [],
      books: [],
      lookedUp: 0,
      saved: 0,
      topMeeting: null,
      firstDay: null,
    }
    expect(recapView(empty, OCTOBER, "2026-11-07").empty).toBe(true)
    expect(recapView({ ...empty, saved: 1 }, OCTOBER, "2026-11-07").empty).toBe(
      false
    )
  })
})

describe("parseRecap", () => {
  it("reads the server answer", () => {
    expect(
      parseRecap({
        days: [{ day: "2026-10-05", seconds: 60, goal_minutes: 10 }],
        books: [{ id: "a", finished_at: "2026-10-20T00:00:00Z" }],
        looked_up: 1,
        saved: 2,
        top_meeting: null,
        first_day: "2026-10-05",
      })
    ).toEqual({
      days: [{ day: "2026-10-05", seconds: 60, goalMinutes: 10 }],
      books: [{ id: "a", finishedAt: "2026-10-20T00:00:00Z" }],
      lookedUp: 1,
      saved: 2,
      topMeeting: null,
      firstDay: "2026-10-05",
    })
    expect(parseRecap({ days: "x" })).toBeNull()
  })
})
