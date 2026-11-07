import { beforeEach, describe, expect, it } from "vitest"
import type { HabitDay } from "@/lib/habit/types"
import { recapBubbleFor, readShownBubbles, rememberBubble } from "./bubble"

const read = (day: string): HabitDay => ({
  day,
  seconds: 600,
  goalMinutes: null,
})

describe("recapBubbleFor", () => {
  const october = [read("2026-10-12")]

  it("shows on days 1-7 when last month has reading", () => {
    expect(recapBubbleFor("2026-11-01", october, [])).toEqual({
      key: "2026-10",
      label: "Kilas balik Oktober sudah siap",
    })
    expect(recapBubbleFor("2026-11-07", october, [])?.key).toBe("2026-10")
    expect(recapBubbleFor("2026-11-08", october, [])).toBeNull()
  })

  it("shows once per period", () => {
    expect(recapBubbleFor("2026-11-02", october, ["2026-10"])).toBeNull()
  })

  it("needs the cache and reading last month", () => {
    expect(recapBubbleFor("2026-11-02", null, [])).toBeNull()
    expect(recapBubbleFor("2026-11-02", [read("2026-09-12")], [])).toBeNull()
    expect(
      recapBubbleFor(
        "2026-11-02",
        [{ day: "2026-10-12", seconds: 0, goalMinutes: null }],
        []
      )
    ).toBeNull()
  })

  it("becomes the year's in January", () => {
    expect(recapBubbleFor("2027-01-03", [read("2026-12-30")], [])).toEqual({
      key: "2026",
      label: "Kilas balik 2026 sudah siap",
    })
    expect(recapBubbleFor("2027-01-03", [read("2026-03-01")], [])?.key).toBe(
      "2026"
    )
  })
})

describe("remembered bubbles", () => {
  beforeEach(() => localStorage.clear())

  it("keeps the periods shown on this device", () => {
    expect(readShownBubbles()).toEqual([])
    rememberBubble("2026-10")
    rememberBubble("2026-10")
    rememberBubble("2026")
    expect(readShownBubbles()).toEqual(["2026-10", "2026"])
  })

  it("survives broken storage", () => {
    localStorage.setItem("glosa:recap-bubble", "{")
    expect(readShownBubbles()).toEqual([])
  })
})
