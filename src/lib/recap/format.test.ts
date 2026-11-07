import { describe, expect, it } from "vitest"
import { formatReadTime } from "./format"

describe("formatReadTime", () => {
  it("writes hours and minutes, dropping what is zero", () => {
    expect(formatReadTime(6 * 3600 + 20 * 60)).toBe("6 jam 20 menit")
    expect(formatReadTime(2 * 3600)).toBe("2 jam")
    expect(formatReadTime(45 * 60 + 29)).toBe("45 menit")
  })

  it("never says zero", () => {
    expect(formatReadTime(0)).toBe("Kurang dari 1 menit")
    expect(formatReadTime(59)).toBe("Kurang dari 1 menit")
  })
})
