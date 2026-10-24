import { describe, expect, it } from "vitest"
import { HIGHLIGHT_FILL, drawHighlight } from "./draw"
import { HIGHLIGHT_COLORS } from "./types"

/** A line's box as layout would give it (jsdom has no layout). */
const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
  }) as DOMRect

describe("drawHighlight", () => {
  it("fills every line in the highlight's colour", () => {
    const drawn = drawHighlight([rect(10, 20, 100, 18), rect(10, 40, 60, 18)], {
      color: HIGHLIGHT_FILL.green,
      note: false,
    })
    expect(drawn.getAttribute("fill")).toBe(HIGHLIGHT_FILL.green)
    expect(drawn.querySelectorAll("rect")).toHaveLength(2)
  })

  it("adds a small mark after the last line when there is a note", () => {
    const drawn = drawHighlight([rect(10, 20, 100, 18), rect(10, 40, 60, 18)], {
      color: HIGHLIGHT_FILL.blue,
      note: true,
    })
    const mark = drawn.querySelector(".glosa-note-mark")
    expect(mark).not.toBeNull()
    expect(Number(mark?.getAttribute("x"))).toBeGreaterThanOrEqual(70)
    expect(Number(mark?.getAttribute("y"))).toBe(40)
  })

  it("has a fill for every colour", () => {
    for (const color of HIGHLIGHT_COLORS) {
      expect(HIGHLIGHT_FILL[color]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
