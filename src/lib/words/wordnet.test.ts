import { describe, expect, it } from "vitest"
import { type WordnetQuality, createWordnetReader } from "./wordnet"

// wn-msa-all.tab: synset, language, quality, lemma.
const BAHASA = [
  "01234567-v\tI\tY\tmembuat",
  "01234567-v\tB\tO\tmenghasilkan",
  "01234567-v\tM\tY\tbikin",
  "01234567-v\tI\tL\tmencipta",
  "01234567-v\tI\tX\tsalah",
  "07654321-v\tI\tY\tmenjadikan",
  "00011111-a\tI\tY\tcepat",
  "00022222-n\tI\tY\tes_krim",
]
// index.sense: sense key, synset offset, sense number, tag count.
const SENSES = [
  "make%2:36:00:: 01234567 2 5",
  "make%2:30:00:: 07654321 1 40",
  "quick%5:00:00:fast:01 00011111 1 3",
  "ice_cream%1:13:00:: 00022222 1 2",
  "cream%1:13:00:: 00022222 2 0",
]

function read(
  bahasa: Array<string>,
  senses: Array<string>,
  qualities?: Array<WordnetQuality>
) {
  const reader = createWordnetReader(qualities)
  for (const line of bahasa) reader.addBahasa(line)
  for (const line of senses) reader.addSense(line)
  return reader.result()
}

describe("createWordnetReader", () => {
  it("keeps Indonesian lemmas marked Y or O, the most tagged sense first", () => {
    expect(read(BAHASA, SENSES)).toEqual([
      {
        headword: "make",
        pos: "verb",
        meanings: ["menjadikan", "membuat", "menghasilkan"],
      },
      { headword: "quick", pos: "adj", meanings: ["cepat"] },
      { headword: "cream", pos: "noun", meanings: ["es krim"] },
    ])
  })

  it("takes L as well when asked, and never Malay only (M) or wrong (X)", () => {
    const [make] = read(BAHASA, SENSES, ["Y", "O", "L"])
    expect(make.meanings).toEqual([
      "menjadikan",
      "membuat",
      "menghasilkan",
      "mencipta",
    ])
  })

  it("takes each sense's first equivalent before any second one", () => {
    const bahasa = [
      "00000001-n\tI\tY\tsatu",
      "00000001-n\tI\tY\tesa",
      "00000002-n\tI\tY\tdua",
    ]
    const senses = ["one%1:23:00:: 00000001 1 9", "one%1:09:00:: 00000002 2 1"]
    expect(read(bahasa, senses)[0].meanings).toEqual(["satu", "dua", "esa"])
  })

  it("keeps at most eight meanings, without repeats", () => {
    const bahasa = [
      ...Array.from({ length: 10 }, (_, i) => `00000003-n\tI\tY\tarti${i}`),
      "00000004-n\tI\tY\tarti0",
    ]
    const senses = [
      "word%1:10:00:: 00000003 1 5",
      "word%1:10:01:: 00000004 2 1",
    ]
    const [word] = read(bahasa, senses)
    expect(word.meanings).toHaveLength(8)
    expect(new Set(word.meanings).size).toBe(8)
  })

  it("leaves out phrases, senses without Indonesian, and lines it cannot read", () => {
    const entries = read(
      ["00000005-n\tI\tY\tkata"],
      [
        "kick_the_bucket%2:30:00:: 00000005 1 0",
        "lonely%1:00:00:: 09999999 1 0",
        "broken line",
        "odd%9:00:00:: 00000005 1 0",
      ]
    )
    expect(entries).toEqual([])
  })
})
