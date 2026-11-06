import { describe, expect, it } from "vitest"
import type { HabitDay } from "./habit/types"
import {
  booksThisYear,
  calendarCells,
  habitSummary,
  mergeDays,
  plantStage,
} from "./reading-habit"

// Friday 6 November 2026; its week starts on Monday 2 November.
const TODAY = "2026-11-06"
const read = (
  day: string,
  seconds = 600,
  goalMinutes: number | null = null
): HabitDay => ({
  day,
  seconds,
  goalMinutes,
})

describe("habitSummary", () => {
  it("starts with a seed and two gaps for a member who never read", () => {
    expect(habitSummary([], TODAY, null)).toEqual({
      streak: 0,
      record: 0,
      gapsLeft: 2,
      todaySeconds: 0,
      todayGoalSeconds: 300,
      todayDone: false,
      stage: "biji",
      hasHistory: false,
    })
  })

  it("counts today once it reaches five minutes", () => {
    const summary = habitSummary([read(TODAY, 300)], TODAY, null)
    expect(summary).toMatchObject({
      streak: 1,
      todayDone: true,
      stage: "tunas",
    })
  })

  it("does not count a short day, but knows there is history", () => {
    const summary = habitSummary([read(TODAY, 200)], TODAY, null)
    expect(summary).toMatchObject({
      streak: 0,
      todayDone: false,
      hasHistory: true,
    })
  })

  it("lets a weekend off keep the streak", () => {
    const days = [
      ...["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"],
      ...["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"],
    ].map((day) => read(day))
    expect(habitSummary(days, TODAY, null)).toMatchObject({
      streak: 9,
      record: 9,
      gapsLeft: 2,
      stage: "rimbun",
    })
  })

  it("breaks the streak when the third empty day of a week ends", () => {
    const days = [read("2026-11-02")]
    // Tuesday, Wednesday and Thursday empty.
    expect(habitSummary(days, TODAY, null)).toMatchObject({
      streak: 0,
      record: 1,
      gapsLeft: 2,
      stage: "biji",
    })
    expect(habitSummary([...days, read(TODAY)], TODAY, null)).toMatchObject({
      streak: 1,
      record: 1,
    })
  })

  it("counts the gaps used this week", () => {
    const days = [read("2026-11-02"), read("2026-11-05")]
    expect(habitSummary(days, TODAY, null)).toMatchObject({
      streak: 2,
      gapsLeft: 0,
    })
  })

  it("does not count the days before a streak began as gaps", () => {
    const days = [read("2026-11-05"), read(TODAY)]
    expect(habitSummary(days, TODAY, null)).toMatchObject({
      streak: 2,
      gapsLeft: 2,
    })
  })

  it("keeps each past day's own goal, and uses today's goal for today", () => {
    const days = [read("2026-11-05", 600, 5), read(TODAY, 600)]
    expect(habitSummary(days, TODAY, 20)).toMatchObject({
      streak: 1,
      todayDone: false,
      todayGoalSeconds: 1200,
    })
    // A past day under its own goal was not a reading day.
    expect(
      habitSummary([read("2026-11-05", 600, 20)], TODAY, null)
    ).toMatchObject({ streak: 0 })
  })

  it("remembers the longest streak", () => {
    const old = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"].map(
      (day) => read(day)
    )
    const now = [read("2026-11-05"), read(TODAY)]
    expect(habitSummary([...old, ...now], TODAY, null)).toMatchObject({
      streak: 2,
      record: 4,
    })
  })
})

describe("plantStage", () => {
  it("grows with the streak", () => {
    const stages = [0, 1, 2, 3, 6, 7, 20, 21, 49, 50, 300].map(plantStage)
    expect(stages).toEqual([
      "biji",
      "tunas",
      "tunas",
      "daun",
      "daun",
      "rimbun",
      "rimbun",
      "kuncup",
      "kuncup",
      "berbunga",
      "berbunga",
    ])
  })
})

describe("calendarCells", () => {
  it("lays out five weeks from Monday, with the days after today left out", () => {
    const weeks = calendarCells(
      [
        read("2026-11-04", 900),
        read("2026-11-05", 120),
        read("2026-10-05", 400),
      ],
      TODAY,
      null
    )
    expect(weeks).toHaveLength(5)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks[0][0]).toEqual({
      day: "2026-10-05",
      seconds: 400,
      state: "read",
    })
    const last = weeks[4]
    expect(last.map((cell) => cell.day)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ])
    expect(last.map((cell) => cell.state)).toEqual([
      "none",
      "none",
      "read",
      "some",
      "none",
      "future",
      "future",
    ])
  })

  it("judges today by the goal set now", () => {
    const [cell] = calendarCells([read(TODAY, 600)], TODAY, 20)[4].slice(4)
    expect(cell.state).toBe("some")
  })
})

describe("booksThisYear", () => {
  it("counts the books finished in this year", () => {
    expect(
      booksThisYear(
        [
          { finishedAt: "2026-06-01T10:00:00Z" },
          { finishedAt: "2026-02-11T10:00:00Z" },
          { finishedAt: "2025-12-15T10:00:00Z" },
          { finishedAt: null },
        ],
        TODAY
      )
    ).toBe(2)
  })
})

describe("mergeDays", () => {
  it("adds what this device has not sent yet, once", () => {
    const merged = mergeDays(
      [read("2026-11-05", 600, 5), read(TODAY, 100)],
      {
        "2026-11-04": { seconds: 30, goalMinutes: null },
        [TODAY]: { seconds: 160, goalMinutes: 10 },
        "2026-11-05": { seconds: 50, goalMinutes: 5 },
      },
      { [TODAY]: 100, "2026-11-05": 50 }
    )
    expect(merged).toEqual([
      read("2026-11-04", 30, null),
      read("2026-11-05", 600, 5),
      read(TODAY, 160, null),
    ])
  })

  it("never goes past a whole day", () => {
    const merged = mergeDays(
      [read(TODAY, 86_000)],
      { [TODAY]: { seconds: 1_000, goalMinutes: null } },
      {}
    )
    expect(merged[0].seconds).toBe(86_400)
  })
})
