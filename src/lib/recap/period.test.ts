import { describe, expect, it } from "vitest"
import {
  currentPeriod,
  isOngoing,
  parsePeriod,
  periodKey,
  periodLabel,
  periodList,
  periodRange,
} from "./period"

const TODAY = "2026-11-07"

describe("parsePeriod", () => {
  it("reads a month and a year", () => {
    expect(parsePeriod("2026-10", TODAY)).toEqual({
      kind: "month",
      year: 2026,
      month: 10,
    })
    expect(parsePeriod("2025", TODAY)).toEqual({ kind: "year", year: 2025 })
  })

  it("falls back to this month for anything else, also for the future", () => {
    const now = currentPeriod(TODAY)
    expect(now).toEqual({ kind: "month", year: 2026, month: 11 })
    for (const raw of [
      undefined,
      null,
      5,
      "",
      "abc",
      "2026-13",
      "2026-00",
      "2026-1",
      "2027",
      "2026-12",
      "1999",
    ]) {
      expect(parsePeriod(raw, TODAY)).toEqual(now)
    }
  })
})

describe("period helpers", () => {
  it("gives the key, the label and the days of a period", () => {
    const october = parsePeriod("2026-10", TODAY)
    expect(periodKey(october)).toBe("2026-10")
    expect(periodLabel(october)).toBe("Oktober 2026")
    expect(periodRange(october)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    })
    expect(periodRange(parsePeriod("2024-02", TODAY))).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    })
    const year = parsePeriod("2025", TODAY)
    expect(periodKey(year)).toBe("2025")
    expect(periodLabel(year)).toBe("2025")
    expect(periodRange(year)).toEqual({ from: "2025-01-01", to: "2025-12-31" })
  })

  it("knows a period that is not over", () => {
    expect(isOngoing(currentPeriod(TODAY), TODAY)).toBe(true)
    expect(isOngoing(parsePeriod("2026-10", TODAY), TODAY)).toBe(false)
    expect(isOngoing(parsePeriod("2026", TODAY), TODAY)).toBe(true)
    expect(isOngoing(parsePeriod("2025", TODAY), TODAY)).toBe(false)
  })
})

describe("periodList", () => {
  it("runs from the first month with reading to now, newest first", () => {
    const keys = periodList("month", "2026-09-14", TODAY).map(periodKey)
    expect(keys).toEqual(["2026-11", "2026-10", "2026-09"])
    expect(periodList("year", "2024-03-02", TODAY).map(periodKey)).toEqual([
      "2026",
      "2025",
      "2024",
    ])
  })

  it("is only the current period without any reading", () => {
    expect(periodList("month", null, TODAY).map(periodKey)).toEqual(["2026-11"])
    expect(periodList("year", null, TODAY).map(periodKey)).toEqual(["2026"])
    expect(periodList("month", "2030-01-01", TODAY).map(periodKey)).toEqual([
      "2026-11",
    ])
  })
})
