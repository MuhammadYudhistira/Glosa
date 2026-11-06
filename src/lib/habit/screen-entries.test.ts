import { describe, expect, it } from "vitest"
import { screenEntries } from "./screen-entries"

const good = {
  day: "2026-11-06",
  bookId: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  seconds: 40,
  goalMinutes: null,
}

describe("screenEntries", () => {
  it("sends only the valid entries and answers the bad ones invalid, in order", () => {
    const { valid, merge } = screenEntries([
      good,
      { ...good, seconds: -1 },
      { ...good, seconds: 50 },
      "junk",
    ])
    expect(valid.map((entry) => entry.seconds)).toEqual([40, 50])
    expect(merge(["ok", "invalid"])).toEqual([
      "ok",
      "invalid",
      "invalid",
      "invalid",
    ])
  })

  it("passes every answer through when all are valid", () => {
    const { valid, merge } = screenEntries([good, good])
    expect(valid).toHaveLength(2)
    expect(merge(["ok", "ok"])).toEqual(["ok", "ok"])
  })
})
