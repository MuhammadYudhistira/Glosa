import { afterEach, describe, expect, it } from "vitest"
import { VOCAB_SEEN_KEY } from "@/lib/local/keys"
import { meetingsTotal, readVocabSeen, rememberVocabSeen } from "./vocab-seen"

describe("vocab seen", () => {
  afterEach(() => localStorage.clear())
  it("adds up every saved word's meetings", () => {
    expect(meetingsTotal({})).toBe(0)
    expect(
      meetingsTotal({
        run: { meetings: 3, books: 1 },
        keen: { meetings: 4, books: 2 },
      })
    ).toBe(7)
  })
  it("remembers the total on this device and ignores a broken value", () => {
    expect(readVocabSeen()).toBeNull()
    rememberVocabSeen(12)
    expect(readVocabSeen()).toBe(12)
    localStorage.setItem(VOCAB_SEEN_KEY, "lots")
    expect(readVocabSeen()).toBeNull()
  })
})
