import { describe, expect, it } from "vitest"
import { AnnotationSyncSchema, isValidAnnotation } from "./schemas"
import type { Annotation } from "./types"

const highlight: Annotation = {
  id: "8b1f7c2e-4a5d-4c3b-9e2f-1a2b3c4d5e6f",
  bookId: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  kind: "highlight",
  cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  color: "yellow",
  note: "",
  excerpt: "To Sherlock Holmes",
  createdAt: "2026-10-24T08:00:00.000Z",
  updatedAt: "2026-10-24T08:00:00.000Z",
  deletedAt: null,
}
const bookmark: Annotation = {
  ...highlight,
  kind: "bookmark",
  cfi: "epubcfi(/6/4!/4/2/1:0)",
  color: null,
}

describe("isValidAnnotation", () => {
  it("takes a highlight and a bookmark as the table does", () => {
    expect(isValidAnnotation(highlight)).toBe(true)
    expect(isValidAnnotation(bookmark)).toBe(true)
    expect(
      isValidAnnotation({ ...highlight, deletedAt: highlight.updatedAt })
    ).toBe(true)
  })

  it("refuses what the table would refuse", () => {
    expect(isValidAnnotation({ ...highlight, color: null })).toBe(false)
    expect(isValidAnnotation({ ...bookmark, color: "blue" })).toBe(false)
    expect(isValidAnnotation({ ...bookmark, note: "Catatan" })).toBe(false)
    expect(isValidAnnotation({ ...highlight, note: "x".repeat(2001) })).toBe(
      false
    )
    expect(isValidAnnotation({ ...highlight, excerpt: "x".repeat(1001) })).toBe(
      false
    )
    expect(isValidAnnotation({ ...highlight, cfi: "" })).toBe(false)
    expect(isValidAnnotation({ ...highlight, note: "a\u0000b" })).toBe(false)
    expect(isValidAnnotation({ ...highlight, id: "not-a-uuid" })).toBe(false)
  })
})

describe("AnnotationSyncSchema", () => {
  it("takes 1 to 50 entries", () => {
    expect(AnnotationSyncSchema.safeParse({ entries: [] }).success).toBe(false)
    expect(
      AnnotationSyncSchema.safeParse({
        entries: Array.from({ length: 50 }, () => highlight),
      }).success
    ).toBe(true)
    expect(
      AnnotationSyncSchema.safeParse({
        entries: Array.from({ length: 51 }, () => highlight),
      }).success
    ).toBe(false)
  })
})
