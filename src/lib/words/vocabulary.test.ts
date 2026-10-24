import { describe, expect, it } from "vitest"
import type { SavedWord } from "./types"
import {
  ALL_BOOKS,
  bookOptions,
  filterWords,
  sentenceParts,
} from "./vocabulary"

const word = (
  headword: string,
  changes: Partial<SavedWord> = {}
): SavedWord => ({
  headword,
  pos: "verb",
  meanings: ["berlari"],
  bookId: "b1",
  bookTitle: "Sherlock",
  sentence: "",
  cfi: null,
  createdAt: "2026-10-24T08:00:00.000Z",
  ...changes,
})

const words = [
  word("run"),
  word("walk", { meanings: ["berjalan"], bookId: "b2", bookTitle: "Alice" }),
  word("flee", { bookId: null, bookTitle: "Buku Lama" }),
  word("hum", { bookId: null, bookTitle: null }),
]

describe("filterWords", () => {
  const headwords = (q: string, book = ALL_BOOKS) =>
    filterWords(words, { q, book }).map((w) => w.headword)

  it("finds a word by itself or by a meaning, in any case", () => {
    expect(headwords("BERJALAN")).toEqual(["walk"])
    expect(headwords("ru")).toEqual(["run"])
    expect(headwords("  ")).toEqual(["run", "walk", "flee", "hum"])
  })

  it("keeps one book's words, a deleted book's by its title", () => {
    expect(headwords("", "b2")).toEqual(["walk"])
    expect(headwords("", "judul:Buku Lama")).toEqual(["flee"])
    expect(headwords("", "tanpa-buku")).toEqual(["hum"])
  })
})

describe("bookOptions", () => {
  it("lists every book once, by title", () => {
    expect(bookOptions(words)).toEqual([
      { key: "b2", title: "Alice" },
      { key: "judul:Buku Lama", title: "Buku Lama" },
      { key: "b1", title: "Sherlock" },
      { key: "tanpa-buku", title: "Tanpa buku" },
    ])
  })
})

describe("sentenceParts", () => {
  it("picks out every form of the word", () => {
    expect(sentenceParts("He ran away. Ran!", ["run", "ran"])).toEqual([
      { text: "He ", bold: false },
      { text: "ran", bold: true },
      { text: " away. ", bold: false },
      { text: "Ran", bold: true },
      { text: "!", bold: false },
    ])
  })

  it("picks out a phrasal verb only where its words stand together", () => {
    expect(sentenceParts("She gave up.", ["give up", "gave up"])).toEqual([
      { text: "She ", bold: false },
      { text: "gave up", bold: true },
      { text: ".", bold: false },
    ])
    expect(sentenceParts("She gave it up.", ["give up", "gave up"])).toEqual([
      { text: "She gave it up.", bold: false },
    ])
  })
})
