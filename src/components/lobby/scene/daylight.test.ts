import { describe, expect, it } from "vitest"
import { RIGS, daylight, mixRig, msUntilNextMood } from "./daylight"

const at = (h: number, m = 0) => new Date(2026, 10, 7, h, m)

describe("daylight", () => {
  it.each([
    [4, 59, "night"],
    [5, 0, "day"],
    [15, 59, "day"],
    [16, 0, "dusk"],
    [18, 59, "dusk"],
    [19, 0, "night"],
    [0, 0, "night"],
    [12, 0, "day"],
  ] as const)("%i:%i is %s", (h, m, mood) => {
    expect(daylight(at(h, m))).toBe(mood)
  })
})

describe("msUntilNextMood", () => {
  it("counts to the next boundary, also past midnight", () => {
    expect(msUntilNextMood(at(15, 59))).toBe(60_000)
    expect(msUntilNextMood(at(18, 0))).toBe(3_600_000)
    expect(msUntilNextMood(at(23, 0))).toBe(6 * 3_600_000)
    expect(msUntilNextMood(at(4, 30))).toBe(30 * 60_000)
  })
})

describe("mixRig", () => {
  it("returns the ends at k = 0 and k = 1 and blends in between", () => {
    expect(mixRig(RIGS.day, RIGS.night, 0)).toEqual(RIGS.day)
    expect(mixRig(RIGS.day, RIGS.night, 1)).toEqual(RIGS.night)
    const half = mixRig(RIGS.day, RIGS.night, 0.5)
    expect(half.lamps).toBeCloseTo((RIGS.day.lamps + RIGS.night.lamps) / 2)
    expect(half.background).toMatch(/^#[0-9a-f]{6}$/)
  })

  it("has lamps off by day and on at dusk and night", () => {
    expect(RIGS.day.lamps).toBe(0)
    expect(RIGS.dusk.lamps).toBeGreaterThan(0)
    expect(RIGS.night.lamps).toBeGreaterThan(0)
  })
})
