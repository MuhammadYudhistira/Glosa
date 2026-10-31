import { describe, expect, it } from "vitest"
import { savedFormsOf } from "@/lib/words/saved-marks"
import {
  MAX_QUOTE_LENGTH,
  defaultWord,
  prepareQuote,
  quoteTokens,
} from "./quote-text"

describe("prepareQuote", () => {
  it("keeps a short quote on one line, without the outer quotation marks", () => {
    expect(prepareQuote("  “It is a capital\n mistake.”  ")).toEqual({
      text: "It is a capital mistake.",
      cut: false,
    })
  })

  it("cuts a long quote at a word, with an ellipsis", () => {
    const { text, cut } = prepareQuote("word, ".repeat(80))
    expect(cut).toBe(true)
    expect(text.length).toBeLessThanOrEqual(MAX_QUOTE_LENGTH)
    expect(text.endsWith("word…")).toBe(true)
    expect(
      text
        .slice(0, -1)
        .split(", ")
        .every((piece) => piece === "word")
    ).toBe(true)
  })

  it("cuts inside a word only when the quote has no space near the end", () => {
    const { text, cut } = prepareQuote("a".repeat(400))
    expect(cut).toBe(true)
    expect(text).toBe(`${"a".repeat(MAX_QUOTE_LENGTH - 1)}…`)
  })
})

describe("quoteTokens", () => {
  it("splits at spaces and gives each word its lookup form", () => {
    expect(quoteTokens("“It's Holmes's data—really, 1891.")).toEqual([
      { text: "“It's", word: "it" },
      { text: "Holmes's", word: "holmes" },
      { text: "data—really,", word: null },
      { text: "1891.", word: null },
    ])
  })
})

describe("defaultWord", () => {
  const tokens = quoteTokens("Some hundreds of times, he said.")

  it("picks the first word saved in Kosakata, inflected forms too", () => {
    const saved = savedFormsOf({
      hundred: ["hundred", "hundreds"],
      say: ["said"],
    })
    expect(defaultWord(tokens, saved)).toBe(1)
  })

  it("picks none when no word is saved", () => {
    expect(defaultWord(tokens, savedFormsOf({}))).toBeNull()
  })
})
