import { describe, expect, it } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { Highlight } from "./types"
import { highlightBooks, highlightRows } from "./highlights"

const h = (
  id: string,
  bookId: string,
  color: Highlight["color"],
  createdAt: string
): Highlight => ({
  id,
  bookId,
  cfi: `epubcfi(/6/2!/4/${id})`,
  color,
  note: "",
  excerpt: `kutipan ${id}`,
  createdAt,
})
const list = [
  h("a", sherlock.id, "yellow", "2026-11-10T10:00:00Z"),
  h("b", "gone", "blue", "2026-11-12T10:00:00Z"),
  h("c", sherlock.id, "pink", "2026-11-13T10:00:00Z"),
]

describe("highlightRows", () => {
  it("keeps highlights of books on the shelf, newest first, with their book", () => {
    const rows = highlightRows(list, [sherlock], { bookId: null, color: null })
    expect(rows.map((row) => row.id)).toEqual(["c", "a"])
    expect(rows[0].book.title).toBe(sherlock.title)
  })
  it("filters by book and by colour", () => {
    expect(
      highlightRows(list, [sherlock], {
        bookId: sherlock.id,
        color: "yellow",
      }).map((r) => r.id)
    ).toEqual(["a"])
    expect(
      highlightRows(list, [sherlock], { bookId: "gone", color: null })
    ).toEqual([])
  })
})

describe("highlightBooks", () => {
  it("lists the books that have highlights, with their counts", () => {
    expect(highlightBooks(list, [sherlock])).toEqual([
      { id: sherlock.id, title: sherlock.title, count: 2 },
    ])
  })
})
