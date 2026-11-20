import { afterEach, describe, expect, it, vi } from "vitest"
import { PLACE_HINT_KEY } from "@/lib/local/keys"
import { readPlaceHintSeen, rememberPlaceHint } from "./place-hint"

describe("place hint memory", () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("is unseen until remembered, then seen", () => {
    expect(readPlaceHintSeen()).toBe(false)
    rememberPlaceHint()
    expect(localStorage.getItem(PLACE_HINT_KEY)).toBe("1")
    expect(readPlaceHintSeen()).toBe(true)
  })

  it("shows again where storage fails, and never throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(readPlaceHintSeen()).toBe(false)
    expect(() => rememberPlaceHint()).not.toThrow()
  })
})
