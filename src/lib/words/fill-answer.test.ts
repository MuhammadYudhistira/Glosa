import { describe, expect, it } from "vitest"
import { FILL_SCHEMA, batchCost, fillPrompt, readAnswer } from "./fill-answer"
import type { FillRequest } from "./fill-candidates"

const requests: Array<FillRequest> = [
  { headword: "make", pos: ["verb", "noun"], from: ["made"] },
  { headword: "gonna", pos: [], from: ["gonna"] },
]
const answer = (words: unknown) => JSON.stringify({ words })

describe("fillPrompt", () => {
  it("lists one word per line with the parts of speech asked", () => {
    expect(fillPrompt(requests)).toBe(
      'Words:\n{"word":"make","pos":["verb","noun"]}\n{"word":"gonna","pos":[]}'
    )
  })
})

describe("FILL_SCHEMA", () => {
  it("offers every part of speech but phrase", () => {
    const pos =
      FILL_SCHEMA.properties.words.items.properties.entries.items.properties.pos
    expect(pos.enum).not.toContain("phrase")
    expect(pos.enum).toContain("particle")
  })
})

describe("readAnswer", () => {
  it("gives a row per part of speech asked, and the one the AI picked", () => {
    const result = readAnswer(
      requests,
      answer([
        {
          word: "make",
          entries: [
            { pos: "verb", meanings: ["membuat", " menjadikan ", "membuat"] },
            { pos: "noun", meanings: [] },
          ],
        },
        { word: "Gonna", entries: [{ pos: "verb", meanings: ["akan"] }] },
      ])
    )
    expect(result).toEqual({
      rows: [
        { headword: "make", pos: "verb", meanings: ["membuat", "menjadikan"] },
        { headword: "make", pos: "noun", meanings: [] },
        { headword: "gonna", pos: "verb", meanings: ["akan"] },
      ],
      answered: ["make", "gonna"],
      problems: [],
    })
  })

  it("keeps the first eight meanings", () => {
    const many = Array.from({ length: 10 }, (_, i) => `arti${i}`)
    const result = readAnswer(
      [requests[1]],
      answer([{ word: "gonna", entries: [{ pos: "verb", meanings: many }] }])
    )
    expect(result.rows[0].meanings).toEqual(many.slice(0, 8))
  })

  it("leaves out a word without an answer, with other parts of speech, or with a bad meaning", () => {
    const result = readAnswer(
      [
        ...requests,
        { headword: "run", pos: ["verb"], from: ["run"] },
        { headword: "like", pos: ["prep"], from: ["like"] },
      ],
      answer([
        { word: "make", entries: [{ pos: "verb", meanings: ["membuat"] }] },
        {
          word: "gonna",
          entries: [
            { pos: "verb", meanings: ["akan"] },
            { pos: "noun", meanings: [] },
          ],
        },
        {
          word: "run",
          entries: [{ pos: "verb", meanings: ["x".repeat(101)] }],
        },
        {
          word: "like",
          entries: [{ pos: "prep", meanings: ["seperti\u0007"] }],
        },
      ])
    )
    expect(result.rows).toEqual([])
    expect(result.answered).toEqual([])
    expect(result.problems).toHaveLength(4)
  })

  it("names every word when the answer cannot be read", () => {
    const result = readAnswer(requests, "{not json")
    expect(result.rows).toEqual([])
    expect(result.problems).toEqual(["unreadable answer for make, gonna"])
  })
})

describe("batchCost", () => {
  it("prices tokens at half the Opus 5.5 rate", () => {
    expect(batchCost({ input: 1_000_000, output: 1_000_000 })).toBeCloseTo(12)
  })
})
