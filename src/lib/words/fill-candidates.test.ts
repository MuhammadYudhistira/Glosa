import { describe, expect, it } from "vitest"
import type { DictPos } from "./types"
import { chunk, pickCandidates } from "./fill-candidates"

const partsOfSpeech = new Map<string, Set<DictPos>>([
  ["make", new Set<DictPos>(["verb", "noun"])],
  ["like", new Set<DictPos>(["verb", "prep", "noun"])],
  ["run", new Set<DictPos>(["verb"])],
  ["kick the bucket", new Set<DictPos>(["phrase"])],
])
const forms = [
  { form: "made", headword: "make", pos: "verb" as const },
  { form: "makes", headword: "make", pos: "verb" as const },
]

describe("pickCandidates", () => {
  it("asks each headword's parts of speech that no source fills, in the words' order", () => {
    const requests = pickCandidates({
      words: ["like", "made", "make", "run"],
      partsOfSpeech,
      forms,
      filled: new Set(["like\tverb", "run\tverb"]),
      generated: new Set(["make\tnoun"]),
    })
    expect(requests).toEqual([
      { headword: "like", pos: ["prep", "noun"], from: ["like"] },
      { headword: "make", pos: ["verb"], from: ["made", "make"] },
    ])
  })

  it("asks a word Wiktionary does not know as it is, for the AI to pick its part of speech", () => {
    const requests = pickCandidates({
      words: ["Gonna", "gonna", "blorp"],
      partsOfSpeech,
      forms,
      filled: new Set(["blorp\tnoun"]),
      generated: new Set(),
    })
    expect(requests).toEqual([{ headword: "gonna", pos: [], from: ["gonna"] }])
  })

  it("skips what the reader would not look up, and phrases", () => {
    expect(
      pickCandidates({
        words: ["42", "", "e-mail-", "kick the bucket", "naïve’s"],
        partsOfSpeech,
        forms,
        filled: new Set(),
        generated: new Set(),
      })
    ).toEqual([
      { headword: "e-mail", pos: [], from: ["e-mail"] },
      { headword: "naïve", pos: [], from: ["naïve"] },
    ])
  })

  it("never asks a word already asked, even with no meaning", () => {
    expect(
      pickCandidates({
        words: ["gonna"],
        partsOfSpeech,
        forms,
        filled: new Set(),
        generated: new Set(["gonna\tverb"]),
      })
    ).toEqual([])
  })
})

describe("chunk", () => {
  it("cuts a list into pieces of a size, the last one shorter", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})
