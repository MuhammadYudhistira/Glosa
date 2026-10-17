import { describe, expect, it } from "vitest"
import { ATRIUM, SHELF_FACES } from "./layout"
import { shelfFaceInstances } from "./shelves"

function random(seed = 7) {
  let state = seed
  return () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646
}

describe("shelfFaceInstances", () => {
  it("fills every wall with at most 15,000 books in all (spec 1D §10)", () => {
    const next = random()
    const books = SHELF_FACES.reduce(
      (sum, face) => sum + shelfFaceInstances(face, next).books.length,
      0
    )
    expect(books).toBeGreaterThan(6000)
    expect(books).toBeLessThanOrEqual(15000)
  })

  it("keeps the books of the left wall inside it", () => {
    const wall = SHELF_FACES[0]
    for (const book of shelfFaceInstances(wall, random()).books) {
      expect(book.position[0]).toBeCloseTo(0.19)
      expect(book.position[2]).toBeGreaterThanOrEqual(0)
      expect(book.position[2]).toBeLessThanOrEqual(ATRIUM.size)
      expect(book.position[1] + book.scale[1] / 2).toBeLessThanOrEqual(
        wall.height
      )
    }
  })
})
