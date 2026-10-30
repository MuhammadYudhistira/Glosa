import { describe, expect, it } from "vitest"
import { mergeDictionary } from "./dict-merge"

const forms = [
  { form: "made", headword: "make", pos: "verb" as const },
  { form: "cases", headword: "case", pos: "noun" as const },
  { form: "sang", headword: "sing", pos: "verb" as const },
]

describe("mergeDictionary", () => {
  it("takes Wiktionary first, then WordNet, then the AI, per word and part of speech", () => {
    const merged = mergeDictionary({
      wiktionary: [{ headword: "run", pos: "verb", meanings: ["berlari"] }],
      wordnet: [
        { headword: "run", pos: "verb", meanings: ["lari"] },
        { headword: "run", pos: "noun", meanings: ["larian"] },
        { headword: "case", pos: "noun", meanings: ["kasus"] },
      ],
      generated: [
        { headword: "case", pos: "noun", meanings: ["perkara"] },
        { headword: "make", pos: "verb", meanings: ["membuat"] },
      ],
      forms,
    })
    expect(merged.entries).toEqual([
      {
        headword: "run",
        pos: "verb",
        meanings: ["berlari"],
        source: "wiktionary",
      },
      { headword: "run", pos: "noun", meanings: ["larian"], source: "wordnet" },
      { headword: "case", pos: "noun", meanings: ["kasus"], source: "wordnet" },
      { headword: "make", pos: "verb", meanings: ["membuat"], source: "ai" },
    ])
    expect(merged.counts).toEqual({ wiktionary: 1, wordnet: 2, ai: 1 })
  })

  it("keeps the forms of headwords that got meanings from any source", () => {
    const merged = mergeDictionary({
      wiktionary: [],
      wordnet: [{ headword: "case", pos: "noun", meanings: ["kasus"] }],
      generated: [{ headword: "make", pos: "verb", meanings: ["membuat"] }],
      forms,
    })
    expect(merged.forms).toEqual([
      { form: "made", headword: "make", pos: "verb" },
      { form: "cases", headword: "case", pos: "noun" },
    ])
  })

  it("skips AI rows without meanings and keeps at most eight", () => {
    const many = Array.from({ length: 10 }, (_, i) => `arti${i}`)
    const merged = mergeDictionary({
      wiktionary: [],
      wordnet: [],
      generated: [
        { headword: "it", pos: "pron", meanings: [] },
        { headword: "case", pos: "noun", meanings: many },
      ],
      forms: [],
    })
    expect(merged.entries).toEqual([
      {
        headword: "case",
        pos: "noun",
        meanings: many.slice(0, 8),
        source: "ai",
      },
    ])
  })
})
