import { describe, expect, it } from "vitest"
import { SHELF, WALL_SECTIONS } from "./layout"
import { SECTION_CAPACITY, sectionBooks } from "./shelf-books"

const section = WALL_SECTIONS[2]
const hues = (n: number) => Array.from({ length: n }, (_, i) => (i * 37) % 360)

describe("sectionBooks", () => {
  it("stands one book per cover, newest first, up to the capacity", () => {
    expect(sectionBooks(section, [])).toHaveLength(0)
    expect(sectionBooks(section, hues(5))).toHaveLength(5)
    expect(sectionBooks(section, hues(5))[0].hue).toBe(0)
    expect(sectionBooks(section, hues(SECTION_CAPACITY + 40))).toHaveLength(
      SECTION_CAPACITY
    )
  })

  it("keeps every book inside its section and between the lowest and highest shelf", () => {
    for (const book of sectionBooks(section, hues(SECTION_CAPACITY))) {
      expect(book.position[0]).toBeGreaterThan(0)
      expect(book.position[0]).toBeLessThanOrEqual(SHELF.depth)
      expect(book.position[2] - book.size[2] / 2).toBeGreaterThanOrEqual(
        section.z - section.width / 2 - 1e-9
      )
      expect(book.position[2] + book.size[2] / 2).toBeLessThanOrEqual(
        section.z + section.width / 2 + 1e-9
      )
      expect(book.position[1] - book.size[1] / 2).toBeGreaterThanOrEqual(
        SHELF.bottom - 1e-9
      )
      expect(book.position[1] + book.size[1] / 2).toBeLessThanOrEqual(
        SHELF.top + 1e-9
      )
    }
  })

  it("is the same every time", () => {
    expect(sectionBooks(section, hues(30))).toEqual(
      sectionBooks(section, hues(30))
    )
  })
})
