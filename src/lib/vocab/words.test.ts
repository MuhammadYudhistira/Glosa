import { describe, expect, it } from "vitest"
import { MAX_WORDS_PER_PART, sectionWords, textOfDocument, wordParts } from "./words"

describe("section words", () => {
  it("keeps each word once, as the reader looks it up", () => {
    expect(
      sectionWords("The cat's mat — the CAT sat. 42 well-known “words”!")
    ).toEqual(["cat", "mat", "sat", "the", "well-known", "words"].sort())
  })

  it("splits a long list into parts of 5,000 and keeps one part for none", () => {
    const words = Array.from({ length: 12_001 }, (_, i) => `w${i}`)
    const parts = wordParts(words)
    expect(parts.map((part) => part.length)).toEqual([5000, 5000, 2001])
    expect(parts.flat()).toEqual(words)
    expect(wordParts([])).toEqual([[]])
    expect(MAX_WORDS_PER_PART).toBe(5000)
  })

  it("reads a document's text, without scripts and styles", () => {
    const doc = new DOMParser().parseFromString(
      "<html><head><style>p{}</style></head><body><p>One</p><script>var two</script><p>three</p></body></html>",
      "text/html"
    )
    expect(textOfDocument(doc).split(/\s+/).filter(Boolean)).toEqual(["One", "three"])
  })
})
