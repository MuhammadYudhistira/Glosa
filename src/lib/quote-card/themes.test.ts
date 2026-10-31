import { describe, expect, it } from "vitest"
import {
  CARD_THEMES,
  THEMES,
  coverPalette,
  luminance,
  starField,
} from "./themes"

const rgbOf = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
]
/** Contrast of white text on the colour. */
const contrast = (hex: string) => 1.05 / (luminance(rgbOf(hex)) + 0.05)

/** An image `rows` tall and 4 wide, one colour per row. */
function image(rows: Array<[number, number, number]>): Uint8ClampedArray {
  return Uint8ClampedArray.from(
    rows.flatMap((rgb) => Array.from({ length: 4 }, () => [...rgb, 255]).flat())
  )
}

describe("THEMES", () => {
  it("has Sampul, Kertas and Malam", () => {
    expect(CARD_THEMES.map((id) => THEMES[id].label)).toEqual([
      "Sampul",
      "Kertas",
      "Malam",
    ])
  })
})

describe("coverPalette", () => {
  it("takes the cover's colours from top to bottom", () => {
    const palette = coverPalette(
      image([
        [150, 20, 20],
        [150, 20, 20],
        [20, 120, 20],
        [20, 120, 20],
        [20, 20, 150],
        [20, 20, 150],
      ]),
      4,
      6
    )
    expect(palette).toHaveLength(3)
    const [top, middle, bottom] = (palette ?? []).map(rgbOf)
    expect(top[0]).toBeGreaterThan(top[2])
    expect(middle[1]).toBeGreaterThan(middle[0])
    expect(bottom[2]).toBeGreaterThan(bottom[0])
  })

  it("darkens a light cover until white text reads on it", () => {
    const palette = coverPalette(image(Array(6).fill([250, 250, 245])), 4, 6)
    for (const color of palette ?? [])
      expect(contrast(color)).toBeGreaterThanOrEqual(4.5)
  })

  it("has none without pixels", () => {
    expect(coverPalette([], 0, 0)).toBeNull()
  })
})

describe("starField", () => {
  it("places the same stars for the same book, others for another", () => {
    const one = starField("book-1", 1080, 1920)
    expect(starField("book-1", 1080, 1920)).toEqual(one)
    expect(starField("book-2", 1080, 1920)).not.toEqual(one)
    for (const star of one) {
      expect(star.x).toBeGreaterThanOrEqual(0)
      expect(star.x).toBeLessThan(1080)
      expect(star.y).toBeLessThan(1920)
    }
  })
})
