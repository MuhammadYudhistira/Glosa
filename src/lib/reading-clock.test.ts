import { describe, expect, it } from "vitest"
import { type DayFns, PAGE_READ_MS, createReadingClock } from "./reading-clock"

const DAY_MS = 86_400_000
/** UTC days, so the test does not depend on the machine's time zone. */
const UTC_DAYS: DayFns = {
  dayOf: (ms) => new Date(ms).toISOString().slice(0, 10),
  nextDayAt: (ms) => Math.floor(ms / DAY_MS) * DAY_MS + DAY_MS,
}
const T0 = Date.UTC(2026, 10, 6, 8, 0)
const s = (seconds: number) => seconds * 1000
const TODAY = "2026-11-06"
const clock = () => createReadingClock(UTC_DAYS)

describe("createReadingClock", () => {
  it("counts a page read between two turns", () => {
    const c = clock()
    expect(c.show(T0)).toEqual([])
    expect(c.show(T0 + s(40))).toEqual([{ day: TODAY, ms: s(40) }])
  })

  it("drops a page turned within five seconds", () => {
    const c = clock()
    c.show(T0)
    expect(c.show(T0 + s(4))).toEqual([])
    expect(c.show(T0 + s(14))).toEqual([{ day: TODAY, ms: s(10) }])
  })

  it("counts at most ten minutes of one page", () => {
    const c = clock()
    c.show(T0)
    expect(c.show(T0 + s(25 * 60))).toEqual([
      { day: TODAY, ms: PAGE_READ_MS.max },
    ])
  })

  it("stops while paused and goes on with the same page", () => {
    const c = clock()
    c.show(T0)
    expect(c.pause(T0 + s(20))).toEqual([{ day: TODAY, ms: s(20) }])
    c.resume(T0 + s(300))
    expect(c.show(T0 + s(310))).toEqual([{ day: TODAY, ms: s(10) }])
  })

  it("lets a short page count once it passes five seconds in all", () => {
    const c = clock()
    c.show(T0)
    expect(c.pause(T0 + s(3))).toEqual([])
    c.resume(T0 + s(60))
    expect(c.show(T0 + s(63))).toEqual([{ day: TODAY, ms: s(6) }])
  })

  it("hands over the time so far on a tick, without counting it twice", () => {
    const c = clock()
    c.show(T0)
    expect(c.tick(T0 + s(30))).toEqual([{ day: TODAY, ms: s(30) }])
    expect(c.tick(T0 + s(60))).toEqual([{ day: TODAY, ms: s(30) }])
    expect(c.show(T0 + s(70))).toEqual([{ day: TODAY, ms: s(10) }])
  })

  it("keeps the cap across ticks", () => {
    const c = clock()
    c.show(T0)
    expect(c.tick(T0 + s(9 * 60))).toEqual([{ day: TODAY, ms: s(9 * 60) }])
    expect(c.tick(T0 + s(12 * 60))).toEqual([{ day: TODAY, ms: s(60) }])
    expect(c.show(T0 + s(15 * 60))).toEqual([])
  })

  it("splits a page read across midnight", () => {
    const c = clock()
    const late = Date.UTC(2026, 10, 6, 23, 59, 40)
    c.show(late)
    expect(c.show(late + s(50))).toEqual([
      { day: "2026-11-06", ms: s(20) },
      { day: "2026-11-07", ms: s(30) },
    ])
  })

  it("does not run for a page shown while paused, until it resumes", () => {
    const c = clock()
    expect(c.pause(T0)).toEqual([])
    expect(c.show(T0 + s(1))).toEqual([])
    expect(c.tick(T0 + s(100))).toEqual([])
    c.resume(T0 + s(100))
    expect(c.show(T0 + s(120))).toEqual([{ day: TODAY, ms: s(20) }])
  })

  it("ignores a clock that went back", () => {
    const c = clock()
    c.show(T0)
    expect(c.show(T0 - s(30))).toEqual([])
  })

  describe("touch (activity on the same page)", () => {
    it("keeps counting while activity goes on", () => {
      const c = clock()
      c.show(T0)
      let total = 0
      for (let t = 3; t <= 60; t += 3) {
        for (const piece of c.touch(T0 + s(t))) total += piece.ms
      }
      for (const piece of c.show(T0 + s(63))) total += piece.ms
      expect(total).toBe(s(63))
    })

    it("caps the time since the last activity, not the whole page", () => {
      const c = clock()
      c.show(T0)
      let total = 0
      for (const piece of c.touch(T0 + s(30))) total += piece.ms
      for (const piece of c.show(T0 + s(30 + 25 * 60))) total += piece.ms
      expect(total).toBe(s(30) + PAGE_READ_MS.max)
    })

    it("still needs five seconds in all for a page", () => {
      const c = clock()
      c.show(T0)
      expect(c.touch(T0 + s(2))).toEqual([])
      expect(c.show(T0 + s(4))).toEqual([])
    })

    it("does not start the clock while paused", () => {
      const c = clock()
      c.show(T0)
      c.pause(T0 + s(10))
      expect(c.touch(T0 + s(100))).toEqual([])
      expect(c.show(T0 + s(200))).toEqual([])
    })

    it("splits days when midnight passes between touches", () => {
      const c = clock()
      const late = Date.UTC(2026, 10, 6, 23, 59, 40)
      c.show(late)
      expect(c.touch(late + s(50))).toEqual([
        { day: "2026-11-06", ms: s(20) },
        { day: "2026-11-07", ms: s(30) },
      ])
    })
  })
})
