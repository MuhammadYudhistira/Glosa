import { describe, expect, it } from "vitest"
import { measureCoverage } from "./coverage"

describe("measureCoverage", () => {
  it("counts the words as they occur and the distinct words, spelled the reader's way", () => {
    const known = new Set(["the", "ran"])
    expect(
      measureCoverage("The cat ran. The dog's bone -- RAN! 42", (word) =>
        known.has(word)
      )
    ).toEqual({ tokens: 7, coveredTokens: 4, words: 5, coveredWords: 2 })
  })
})
