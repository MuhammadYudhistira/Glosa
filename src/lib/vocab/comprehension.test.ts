import { describe, expect, it } from "vitest"
import { MIN_WORDS_READ, comprehension } from "./comprehension"

describe("comprehension", () => {
  it("waits for 200 words read", () => {
    expect(MIN_WORDS_READ).toBe(200)
    expect(comprehension({ read: 199, lookedUp: 0 })).toBeNull()
    expect(comprehension({ read: 200, lookedUp: 0 })).toBe(100)
  })

  it("rounds down, so a word looked up never shows 100%", () => {
    expect(comprehension({ read: 1000, lookedUp: 1 })).toBe(99)
    expect(comprehension({ read: 850, lookedUp: 34 })).toBe(96)
    expect(comprehension({ read: 300, lookedUp: 300 })).toBe(0)
  })
})
