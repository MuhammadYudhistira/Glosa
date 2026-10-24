import { describe, expect, it } from "vitest"
import { LookupRequestSchema, isValidWordOp } from "./schemas"
import type { WordOp } from "./types"

const save: WordOp = {
  kind: "save",
  headword: "run",
  pos: "verb",
  meanings: ["berlari"],
  bookId: "0f9f5c1e-8a4b-4c2e-9d3a-1b2c3d4e5f60",
  sentence: "He ran.",
  cfi: "epubcfi(/6/4!/4/2/1:0)",
}

describe("isValidWordOp", () => {
  it("accepts a save and a delete the server will take", () => {
    expect(isValidWordOp(save)).toBe(true)
    expect(isValidWordOp({ ...save, pos: null, bookId: null, cfi: null })).toBe(
      true
    )
    expect(isValidWordOp({ kind: "delete", headword: "run" })).toBe(true)
  })

  it("refuses what the database would refuse", () => {
    expect(isValidWordOp({ ...save, headword: "" })).toBe(false)
    expect(isValidWordOp({ ...save, headword: "a".repeat(65) })).toBe(false)
    expect(isValidWordOp({ ...save, sentence: "a".repeat(501) })).toBe(false)
    expect(isValidWordOp({ ...save, meanings: Array(9).fill("arti") })).toBe(
      false
    )
    expect(isValidWordOp({ ...save, cfi: "c".repeat(2001) })).toBe(false)
    expect(isValidWordOp({ ...save, bookId: "bukan-uuid" })).toBe(false)
  })

  it("refuses NUL, which a Postgres text cannot hold", () => {
    expect(isValidWordOp({ ...save, headword: "ru\u0000n" })).toBe(false)
    expect(isValidWordOp({ ...save, meanings: ["ber\u0000lari"] })).toBe(false)
    expect(isValidWordOp({ ...save, sentence: "He\u0000 ran." })).toBe(false)
    expect(isValidWordOp({ kind: "delete", headword: "ru\u0000n" })).toBe(false)
  })
})

describe("LookupRequestSchema", () => {
  it("takes a word and at most two next words", () => {
    expect(
      LookupRequestSchema.safeParse({ word: "gave", next: ["up", "on"] })
        .success
    ).toBe(true)
    expect(
      LookupRequestSchema.safeParse({ word: "gave", next: ["up", "on", "it"] })
        .success
    ).toBe(false)
    expect(LookupRequestSchema.safeParse({ word: "", next: [] }).success).toBe(
      false
    )
  })
})
