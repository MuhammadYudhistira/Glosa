import { describe, expect, it } from "vitest"
import { MAX_WORD_LENGTH, isLookupWord, normalizeWord } from "./normalize"

describe("normalizeWord", () => {
  it("lowers the case and straightens curly apostrophes", () => {
    expect(normalizeWord("Don’t")).toBe("don't")
    expect(normalizeWord("RUNNING")).toBe("running")
  })

  it("drops punctuation at either end and a possessive 's", () => {
    expect(normalizeWord("“Holmes’s,")).toBe("holmes")
    expect(normalizeWord("(Watson)!")).toBe("watson")
    expect(normalizeWord("dogs’")).toBe("dogs")
  })

  it("keeps hyphens and apostrophes inside a word", () => {
    expect(normalizeWord("well-known.")).toBe("well-known")
    expect(normalizeWord("o’clock")).toBe("o'clock")
  })

  it("joins a phrase with single spaces", () => {
    expect(normalizeWord("  Give \n Up ")).toBe("give up")
  })
})

describe("isLookupWord", () => {
  it("accepts Latin words, accented ones too", () => {
    for (const word of ["holmes", "don't", "well-known", "café"]) {
      expect(isLookupWord(word), word).toBe(true)
    }
    expect(isLookupWord("a".repeat(MAX_WORD_LENGTH))).toBe(true)
  })

  it("refuses numbers, other scripts, empty and over-long words", () => {
    for (const word of ["1890", "b2", "москва", "", "a".repeat(65)]) {
      expect(isLookupWord(word), word).toBe(false)
    }
  })
})
