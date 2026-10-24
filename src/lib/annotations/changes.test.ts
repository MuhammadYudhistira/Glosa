import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  deleted,
  edited,
  excerptOf,
  newBookmark,
  newHighlight,
  stamp,
} from "./changes"
import { isValidAnnotation } from "./schemas"

const BOOK = "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e"

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-24T08:00:00.000Z"))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("stamp", () => {
  it("never gives the same time twice", () => {
    const first = stamp()
    const second = stamp()
    expect(Date.parse(second)).toBeGreaterThan(Date.parse(first))
  })
})

describe("excerptOf", () => {
  it("keeps the text on one line, without control characters", () => {
    expect(excerptOf("  To  Sherlock\n\tHolmes\u0007 ")).toBe(
      "To Sherlock Holmes"
    )
  })

  it("cuts a long text with an ellipsis, inside the limit", () => {
    const cut = excerptOf("word ".repeat(400), 20)
    expect(cut.length).toBeLessThanOrEqual(20)
    expect(cut.endsWith("…")).toBe(true)
  })

  it("does not leave half of an emoji behind", () => {
    const cut = excerptOf(`${"a".repeat(18)}😀😀`, 20)
    // No lone surrogate: a high half not followed by a low, or a low alone.
    expect(cut).not.toMatch(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
    )
  })
})

describe("excerptOf lone surrogates", () => {
  it("drops a lone surrogate from the book text", () => {
    expect(excerptOf("a\uD83Db \uDE00c")).toBe("ab c")
    expect(excerptOf("a😀b")).toBe("a😀b")
  })
})

describe("annotation changes", () => {
  it("cuts a long note without half an emoji", () => {
    const highlight = newHighlight({
      bookId: BOOK,
      cfi: "epubcfi(/6/4)",
      text: "a",
    })
    const note = edited(highlight, { note: `${"a".repeat(1999)}😀` }).note
    expect(note.length).toBeLessThanOrEqual(2000)
    expect(note).toBe("a".repeat(1999))
    expect(isValidAnnotation({ ...highlight, note })).toBe(true)
  })

  it("gives a bookmark no colour and no note", () => {
    const bookmark = newBookmark({
      bookId: BOOK,
      cfi: "epubcfi(/6/4)",
      text: "a",
    })
    const same = edited(bookmark, { color: "green", note: "Catatan" })
    expect(same).toMatchObject({ color: null, note: "" })
    expect(Date.parse(same.updatedAt)).toBeGreaterThan(
      Date.parse(bookmark.updatedAt)
    )
    expect(isValidAnnotation(same)).toBe(true)
  })

  it("makes a valid yellow highlight from a selection", () => {
    const highlight = newHighlight({
      bookId: BOOK,
      cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
      text: " To Sherlock ",
    })
    expect(highlight).toMatchObject({
      bookId: BOOK,
      kind: "highlight",
      color: "yellow",
      note: "",
      excerpt: "To Sherlock",
      deletedAt: null,
    })
    expect(highlight.createdAt).toBe(highlight.updatedAt)
    expect(isValidAnnotation(highlight)).toBe(true)
  })

  it("makes a valid bookmark with the start of the page as its excerpt", () => {
    const bookmark = newBookmark({
      bookId: BOOK,
      cfi: "epubcfi(/6/4!/4/2/1:0)",
      text: "x".repeat(500),
    })
    expect(bookmark).toMatchObject({ kind: "bookmark", color: null, note: "" })
    expect(bookmark.excerpt.length).toBeLessThanOrEqual(200)
    expect(isValidAnnotation(bookmark)).toBe(true)
  })

  it("stamps every change, and an empty note is no note", () => {
    const highlight = newHighlight({
      bookId: BOOK,
      cfi: "epubcfi(/6/4)",
      text: "a",
    })
    const green = edited(highlight, { color: "green" })
    expect(green.color).toBe("green")
    expect(Date.parse(green.updatedAt)).toBeGreaterThan(
      Date.parse(highlight.updatedAt)
    )
    expect(edited(green, { note: "  Penting  " }).note).toBe("Penting")
    expect(edited(green, { note: "   " }).note).toBe("")

    const gone = deleted(green)
    expect(gone.deletedAt).toBe(gone.updatedAt)
    expect(Date.parse(gone.updatedAt)).toBeGreaterThan(
      Date.parse(green.updatedAt)
    )
  })
})
