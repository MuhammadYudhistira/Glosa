import { describe, expect, it } from "vitest"
import type { HabitDay } from "@/lib/habit/types"
import { NEUTRAL_SIGNALS, fireLevel, roomSignals } from "./room-signals"

const TODAY = "2026-11-13"
const read = (day: string): HabitDay => ({ day, seconds: 600, goalMinutes: 5 })
const short = (day: string): HabitDay => ({ day, seconds: 60, goalMinutes: 5 })

describe("fireLevel", () => {
  it("is embers without a reading day in the last 7 days", () => {
    expect(fireLevel([], TODAY)).toBe("bara")
    expect(fireLevel([short(TODAY), read("2026-11-06")], TODAY)).toBe("bara")
  })
  it("is small for 1–2 reading days and big from 3", () => {
    expect(fireLevel([read("2026-11-07")], TODAY)).toBe("kecil")
    expect(fireLevel([read(TODAY), read("2026-11-12")], TODAY)).toBe("kecil")
    expect(
      fireLevel([read(TODAY), read("2026-11-12"), read("2026-11-10")], TODAY)
    ).toBe("besar")
  })
  it("counts a day once and ignores days after today", () => {
    expect(
      fireLevel([read(TODAY), read(TODAY), read("2026-11-14")], TODAY)
    ).toBe("kecil")
  })
})

describe("roomSignals", () => {
  const base = {
    days: [],
    today: TODAY,
    meetingsTotal: 10,
    vocabSeen: 10,
    trolley: 0,
  }
  it("lights the desk lamp only when words met again since Kosakata was opened", () => {
    expect(roomSignals(base).deskLamp).toBe(false)
    expect(roomSignals({ ...base, meetingsTotal: 12 }).deskLamp).toBe(true)
    expect(roomSignals({ ...base, meetingsTotal: null }).deskLamp).toBe(false)
    expect(roomSignals({ ...base, vocabSeen: null }).deskLamp).toBe(false)
  })
  it("opens the parcel box when a book has no genre", () => {
    expect(roomSignals(base).parcelOpen).toBe(false)
    expect(roomSignals({ ...base, trolley: 2 }).parcelOpen).toBe(true)
  })
  it("has neutral signals for the still image", () => {
    expect(NEUTRAL_SIGNALS).toEqual({
      fire: "kecil",
      deskLamp: false,
      parcelOpen: false,
    })
  })
})
