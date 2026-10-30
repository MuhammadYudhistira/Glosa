import { describe, expect, it } from "vitest"
import {
  PAGE_MS,
  SPEED_SAMPLES,
  addSample,
  finiteTime,
  formatDuration,
  pageSample,
  parseSamples,
  speedRatio,
} from "./reading-speed"

const mark = (at: number, minutesLeft: number) => ({ at, minutesLeft })
const sample = (expected: number, actual: number) => ({ expected, actual })

describe("pageSample", () => {
  it("measures a page read forwards, in foliate's minutes and real ones", () => {
    expect(pageSample(mark(0, 5), mark(60_000, 4))).toEqual(sample(1, 1))
    expect(pageSample(mark(0, 5), mark(PAGE_MS.min, 4.5))).toEqual(
      sample(0.5, PAGE_MS.min / 60_000)
    )
    expect(pageSample(mark(0, 5), mark(PAGE_MS.max, 4))).toEqual(sample(1, 10))
  })

  it("ignores pages skimmed, left open, read backwards or not left", () => {
    expect(pageSample(mark(0, 5), mark(PAGE_MS.min - 1, 4))).toBeNull()
    expect(pageSample(mark(0, 5), mark(PAGE_MS.max + 1, 4))).toBeNull()
    expect(pageSample(mark(0, 4), mark(60_000, 5))).toBeNull()
    expect(pageSample(mark(0, 4), mark(60_000, 4))).toBeNull()
  })
})

describe("speedRatio", () => {
  it("keeps foliate's speed until ten pages are measured", () => {
    expect(speedRatio([])).toBe(1)
    expect(speedRatio(Array.from({ length: 9 }, () => sample(1, 3)))).toBe(1)
  })

  it("compares the time taken with foliate's over the pages kept", () => {
    const slow = Array.from({ length: 10 }, () => sample(1, 2))
    expect(speedRatio(slow)).toBe(2)
    expect(speedRatio([...slow, sample(10, 0)])).toBeCloseTo(20 / 20)
  })
})

describe("addSample", () => {
  it("keeps the newest pages only", () => {
    let samples = Array.from({ length: SPEED_SAMPLES }, (_, index) =>
      sample(1, index + 1)
    )
    samples = addSample(samples, sample(1, 99))
    expect(samples).toHaveLength(SPEED_SAMPLES)
    expect(samples[0]).toEqual(sample(1, 2))
    expect(samples.at(-1)).toEqual(sample(1, 99))
  })
})

describe("formatDuration", () => {
  it("says minutes, then hours and minutes", () => {
    expect(formatDuration(0.4)).toBe("<1 mnt")
    expect(formatDuration(0.6)).toBe("±1 mnt")
    expect(formatDuration(8.4)).toBe("±8 mnt")
    expect(formatDuration(59.6)).toBe("±1 j")
    expect(formatDuration(80)).toBe("±1 j 20 mnt")
    expect(formatDuration(120)).toBe("±2 j")
  })

  it("says nothing for a time that is not a number or is negative", () => {
    for (const bad of [NaN, Infinity, -Infinity, -3])
      expect(formatDuration(bad)).toBe("")
  })
})

describe("finiteTime", () => {
  it("keeps a time whose two values are finite and not negative", () => {
    expect(finiteTime({ section: 3, total: 40 })).toEqual({
      section: 3,
      total: 40,
    })
    expect(finiteTime({ section: 0, total: 0 })).toEqual({
      section: 0,
      total: 0,
    })
  })

  it("drops a time with a NaN, infinite or negative value, or none", () => {
    expect(finiteTime({ section: NaN, total: 4 })).toBeNull()
    expect(finiteTime({ section: 4, total: NaN })).toBeNull()
    expect(finiteTime({ section: Infinity, total: 4 })).toBeNull()
    expect(finiteTime({ section: 4, total: -1 })).toBeNull()
    expect(finiteTime(null)).toBeNull()
    expect(finiteTime(undefined)).toBeNull()
  })
})

describe("parseSamples", () => {
  it("keeps the valid samples of what was stored, the newest ones", () => {
    expect(parseSamples(undefined)).toEqual([])
    expect(parseSamples("fast")).toEqual([])
    expect(
      parseSamples([
        sample(1, 2),
        null,
        { expected: "1", actual: 2 },
        sample(0, 2),
        sample(1, Number.POSITIVE_INFINITY),
        sample(2, 1),
      ])
    ).toEqual([sample(1, 2), sample(2, 1)])
    expect(
      parseSamples(Array.from({ length: 60 }, () => sample(1, 1)))
    ).toHaveLength(SPEED_SAMPLES)
  })
})
