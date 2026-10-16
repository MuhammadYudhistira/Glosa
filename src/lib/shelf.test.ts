import { describe, expect, it } from "vitest"
import type { ShelfBook } from "./book-types"
import { countBooks, parseShelfSearch, shelfBooks } from "./shelf"

function book(overrides: Partial<ShelfBook>): ShelfBook {
  return {
    id: overrides.title ?? "x",
    title: "Judul",
    author: "",
    description: null,
    language: null,
    genre: null,
    genreSource: null,
    sizeBytes: 1,
    createdAt: "2026-10-01T00:00:00+00:00",
    lastOpenedAt: null,
    coverUrl: null,
    progress: null,
    ...overrides,
  }
}

const books = [
  book({
    title: "Émile",
    author: "Rousseau",
    genre: "sejarah_budaya",
    genreSource: "auto",
    createdAt: "2026-10-03T00:00:00+00:00",
  }),
  book({
    title: "Alice",
    author: "Lewis Carroll",
    genre: "anak_remaja",
    genreSource: "auto",
    createdAt: "2026-10-01T00:00:00+00:00",
    lastOpenedAt: "2026-10-10T00:00:00+00:00",
  }),
  book({
    title: "Catatan",
    author: "Anonim",
    createdAt: "2026-10-02T00:00:00+00:00",
  }),
  book({
    title: "Dracula",
    author: "Bram Stoker",
    genre: "misteri_thriller",
    genreSource: "user",
    createdAt: "2026-10-04T00:00:00+00:00",
    lastOpenedAt: "2026-10-12T00:00:00+00:00",
  }),
]
const titles = (list: Array<ShelfBook>) => list.map((b) => b.title)

describe("parseShelfSearch", () => {
  it("keeps valid values and drops the rest", () => {
    expect(
      parseShelfSearch({ genre: "troli", q: "  alice ", sort: "title" })
    ).toEqual({
      genre: "troli",
      q: "alice",
      sort: "title",
    })
    expect(parseShelfSearch({ genre: "misteri_thriller" })).toEqual({
      genre: "misteri_thriller",
    })
    expect(
      parseShelfSearch({ genre: "horor", q: "   ", sort: "opened" })
    ).toEqual({})
    expect(parseShelfSearch({ sort: "random", q: 5 })).toEqual({})
  })

  it("caps the query length", () => {
    expect(parseShelfSearch({ q: "a".repeat(150) }).q).toHaveLength(100)
  })
})

describe("shelfBooks", () => {
  it("sorts by last opened, then newest added", () => {
    expect(titles(shelfBooks(books, {}))).toEqual([
      "Dracula",
      "Alice",
      "Émile",
      "Catatan",
    ])
  })

  it("sorts by title and by date added", () => {
    expect(titles(shelfBooks(books, { sort: "title" }))).toEqual([
      "Alice",
      "Catatan",
      "Dracula",
      "Émile",
    ])
    expect(titles(shelfBooks(books, { sort: "added" }))).toEqual([
      "Dracula",
      "Émile",
      "Catatan",
      "Alice",
    ])
  })

  it("filters by genre and by the trolley", () => {
    expect(titles(shelfBooks(books, { genre: "anak_remaja" }))).toEqual([
      "Alice",
    ])
    expect(titles(shelfBooks(books, { genre: "troli" }))).toEqual(["Catatan"])
  })

  it("searches titles and authors, ignoring case and accents", () => {
    expect(titles(shelfBooks(books, { q: "emile" }))).toEqual(["Émile"])
    expect(titles(shelfBooks(books, { q: "STOKER" }))).toEqual(["Dracula"])
    expect(shelfBooks(books, { q: "tidak ada" })).toEqual([])
  })

  it("does not reorder the input", () => {
    const input = [...books]
    shelfBooks(input, { sort: "title" })
    expect(input).toEqual(books)
  })
})

describe("countBooks", () => {
  it("counts every filter, including empty ones", () => {
    const counts = countBooks(books)
    expect(counts.semua).toBe(4)
    expect(counts.troli).toBe(1)
    expect(counts.misteri_thriller).toBe(1)
    expect(counts.fiksi_sastra).toBe(0)
  })
})
