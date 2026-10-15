import { describe, expect, it } from "vitest"
import { formatLongDate } from "./dates"

describe("formatLongDate", () => {
  it("writes the date the way a guest book would, in Jakarta time", () => {
    expect(formatLongDate(new Date("2026-10-15T03:00:00Z"))).toBe(
      "Kamis, 15 Oktober 2026"
    )
  })
})
