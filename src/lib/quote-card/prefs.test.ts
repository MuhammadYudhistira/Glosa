import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QUOTE_CARD_KEY } from "@/lib/local/keys"
import { DEFAULT_CARD_PREFS, loadCardPrefs, saveCardPrefs } from "./prefs"

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe("card prefs", () => {
  it("starts with Kutipan, Sampul, Story", () => {
    expect(loadCardPrefs()).toEqual({
      layout: "kutipan",
      theme: "sampul",
      size: "story",
    })
  })

  it("remembers the last choice", () => {
    saveCardPrefs({ layout: "glosa", theme: "malam", size: "square" })
    expect(loadCardPrefs()).toEqual({
      layout: "glosa",
      theme: "malam",
      size: "square",
    })
  })

  it("falls back per field on values it does not know", () => {
    localStorage.setItem(
      QUOTE_CARD_KEY,
      JSON.stringify({ layout: "glosa", theme: "neon", size: 3 })
    )
    expect(loadCardPrefs()).toEqual({ ...DEFAULT_CARD_PREFS, layout: "glosa" })
    localStorage.setItem(QUOTE_CARD_KEY, "{broken")
    expect(loadCardPrefs()).toEqual(DEFAULT_CARD_PREFS)
    localStorage.setItem(QUOTE_CARD_KEY, "null")
    expect(loadCardPrefs()).toEqual(DEFAULT_CARD_PREFS)
  })

  it("works without storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(loadCardPrefs()).toEqual(DEFAULT_CARD_PREFS)
    expect(() => saveCardPrefs(DEFAULT_CARD_PREFS)).not.toThrow()
  })
})
