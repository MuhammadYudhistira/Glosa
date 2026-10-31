import { afterEach, describe, expect, it, vi } from "vitest"
import { HAND, SERIF, cardFontsReady, font } from "./fonts"

afterEach(() => {
  Reflect.deleteProperty(document, "fonts")
})

describe("font", () => {
  it("writes a canvas font", () => {
    expect(font(76, SERIF, { bold: true })).toBe(
      '700 76px "Libre Caslon Text", Georgia, serif'
    )
    expect(font(30.04, HAND, { italic: true })).toBe(
      'italic 400 30px "Caveat Variable", cursive'
    )
  })
})

describe("cardFontsReady", () => {
  it("is ready at once without the Font Loading API", async () => {
    await expect(cardFontsReady()).resolves.toBeUndefined()
  })

  it("waits for the card's fonts", async () => {
    const load = vi.fn(async () => [])
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { load },
    })
    await cardFontsReady()
    expect(load).toHaveBeenCalled()
  })

  it("stops waiting after the time given", async () => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { load: () => new Promise(() => undefined) },
    })
    await expect(cardFontsReady(10)).resolves.toBeUndefined()
  })
})
