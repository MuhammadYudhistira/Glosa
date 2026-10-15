import { describe, expect, it } from "vitest"
import { normalizeUsername, validateUsername } from "./username"

describe("normalizeUsername", () => {
  it("lowercases and strips characters outside a-z, 0-9 and _", () => {
    expect(normalizeUsername("@Yudhis.Dev")).toBe("yudhisdev")
    expect(normalizeUsername("ani_baca 2")).toBe("ani_baca2")
  })

  it("cuts to 20 characters", () => {
    expect(normalizeUsername("a".repeat(25))).toBe("a".repeat(20))
  })
})

describe("validateUsername", () => {
  it("accepts 3-20 lowercase letters, digits and underscores", () => {
    expect(validateUsername("ani_baca2")).toBeNull()
  })

  it("reports each problem", () => {
    expect(validateUsername("ab")).toBe("too_short")
    expect(validateUsername("a".repeat(21))).toBe("too_long")
    expect(validateUsername("Ani")).toBe("invalid_chars")
    expect(validateUsername("ani baca")).toBe("invalid_chars")
  })
})
