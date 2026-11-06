import { describe, expect, it } from "vitest"
import {
  addDays,
  formatDayLabel,
  formatLongDate,
  localDay,
  mondayOf,
  nextDayAt,
} from "./dates"

describe("formatLongDate", () => {
  it("writes the date the way a guest book would, in Jakarta time", () => {
    expect(formatLongDate(new Date("2026-10-15T03:00:00Z"))).toBe(
      "Kamis, 15 Oktober 2026"
    )
  })
})

describe("local days", () => {
  it("names the device's local date", () => {
    expect(localDay(new Date(2026, 10, 6, 23, 59).getTime())).toBe("2026-11-06")
    expect(localDay(new Date(2026, 0, 1, 0, 0).getTime())).toBe("2026-01-01")
  })

  it("finds the next local midnight", () => {
    expect(nextDayAt(new Date(2026, 10, 6, 15, 30).getTime())).toBe(
      new Date(2026, 10, 7).getTime()
    )
    expect(nextDayAt(new Date(2026, 11, 31, 0, 0).getTime())).toBe(
      new Date(2027, 0, 1).getTime()
    )
  })

  it("adds days across months and years", () => {
    expect(addDays("2026-11-06", 1)).toBe("2026-11-07")
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
    expect(addDays("2026-11-06", -28)).toBe("2026-10-09")
  })

  it("starts a week on Monday", () => {
    expect(mondayOf("2026-11-06")).toBe("2026-11-02") // Friday
    expect(mondayOf("2026-11-02")).toBe("2026-11-02") // Monday
    expect(mondayOf("2026-11-08")).toBe("2026-11-02") // Sunday
    expect(mondayOf("2027-01-01")).toBe("2026-12-28")
  })

  it("labels a day in Indonesian", () => {
    expect(formatDayLabel("2026-11-04")).toBe("Rabu, 4 November")
  })
})
