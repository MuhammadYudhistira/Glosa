import { describe, expect, it } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import { pinnedHighlights } from "./pinned"
import type { Highlight } from "./types"

const mark = (id: string, bookId = sherlock.id): Highlight => ({
  id,
  bookId,
  cfi: "epubcfi(/6/4)",
  color: "yellow",
  note: "",
  excerpt: id,
  createdAt: "2026-10-24T08:00:00.000Z",
})

describe("pinnedHighlights", () => {
  it("skips a highlight of a removed book and lets the next older one in", () => {
    const list = [mark("a", "gone"), mark("b"), mark("c"), mark("d"), mark("e")]
    const pinned = pinnedHighlights(list, [sherlock])
    expect(pinned.map(({ highlight }) => highlight.id)).toEqual(["b", "c", "d"])
    expect(pinned[0].book).toBe(sherlock)
  })

  it("stops at the count", () => {
    const list = [mark("a"), mark("b"), mark("c")]
    expect(pinnedHighlights(list, [sherlock], 2)).toHaveLength(2)
    expect(pinnedHighlights(list, [], 2)).toEqual([])
  })
})
