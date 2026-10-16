import { describe, expect, it } from "vitest"
import { keyMove, tapAction } from "./reader-input"

describe("tapAction", () => {
  it("turns pages from the outer 30% and opens the frame from the middle", () => {
    expect(tapAction(10, 0, 100)).toBe("left")
    expect(tapAction(50, 0, 100)).toBe("menu")
    expect(tapAction(80, 0, 100)).toBe("right")
  })

  it("measures from the reader's own left edge", () => {
    expect(tapAction(110, 100, 100)).toBe("left")
    expect(tapAction(190, 100, 100)).toBe("right")
  })
})

describe("keyMove", () => {
  it("maps arrows to the page direction and PageUp/PageDown to reading order", () => {
    expect(keyMove("ArrowLeft")).toBe("left")
    expect(keyMove("ArrowRight")).toBe("right")
    expect(keyMove("PageUp")).toBe("prev")
    expect(keyMove("PageDown")).toBe("next")
    expect(keyMove("a")).toBeNull()
  })
})
