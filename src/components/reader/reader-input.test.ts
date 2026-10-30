import { describe, expect, it } from "vitest"
import {
  createWheelPager,
  isControlTarget,
  isTurn,
  isTypingTarget,
  keyMove,
  selectionAction,
  swipeVelocity,
  tapAction,
} from "./reader-input"

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

  it("reads on with Space and goes back with Shift+Space", () => {
    expect(keyMove(" ")).toBe("next")
    expect(keyMove(" ", true)).toBe("prev")
    expect(keyMove("ArrowRight", true)).toBe("right")
  })
})

describe("isControlTarget", () => {
  it("is true for buttons and links, which Space presses", () => {
    const target = {
      closest: (s: string) => (s.includes("button") ? {} : null),
    }
    expect(isControlTarget(target as unknown as EventTarget)).toBe(true)
  })

  it("is false for the text and for objects without closest", () => {
    const plain = { closest: () => null }
    expect(isControlTarget(plain as unknown as EventTarget)).toBe(false)
    expect(isControlTarget(null)).toBe(false)
  })
})

describe("swipeVelocity", () => {
  it("turns forward when the finger travels left, however slowly it ends", () => {
    expect(swipeVelocity(-40, 5)).toBe(1)
    expect(swipeVelocity(-150, 0)).toBe(1)
  })

  it("turns back when the finger travels right", () => {
    expect(swipeVelocity(40, -5)).toBe(-1)
  })

  it("leaves short or mostly vertical moves to foliate", () => {
    expect(swipeVelocity(-20, 0)).toBeNull()
    expect(swipeVelocity(-40, 60)).toBeNull()
  })
})

describe("createWheelPager", () => {
  it("turns once per gesture, then waits for the wheel to rest", () => {
    const wheel = createWheelPager()
    expect(wheel(0, 100, 0)).toBe("next")
    // The rest of the same flick, trackpad inertia included.
    expect(wheel(0, 100, 50)).toBeNull()
    expect(wheel(0, 30, 150)).toBeNull()
    // A new gesture after a pause turns again.
    expect(wheel(0, 100, 500)).toBe("next")
  })

  it("adds up small deltas until they are a deliberate move", () => {
    const wheel = createWheelPager()
    expect(wheel(0, 15, 0)).toBeNull()
    expect(wheel(0, 15, 16)).toBeNull()
    expect(wheel(0, 15, 32)).toBe("next")
  })

  it("goes back on wheel up and sideways on a horizontal swipe", () => {
    const wheel = createWheelPager()
    expect(wheel(0, -100, 0)).toBe("prev")
    expect(wheel(100, 0, 1000)).toBe("right")
    expect(wheel(-100, 0, 2000)).toBe("left")
  })

  it("starts afresh when the direction changes before a turn", () => {
    const wheel = createWheelPager()
    expect(wheel(0, 30, 0)).toBeNull()
    expect(wheel(0, -30, 16)).toBeNull()
    expect(wheel(0, -15, 32)).toBe("prev")
  })
})

describe("isTypingTarget", () => {
  it("is true when the target sits inside a field or dialog", () => {
    const target = { closest: (s: string) => (s.includes("input") ? {} : null) }
    expect(isTypingTarget(target as unknown as EventTarget)).toBe(true)
  })

  it("is false for other elements, null and objects without closest", () => {
    const plain = { closest: () => null }
    expect(isTypingTarget(plain as unknown as EventTarget)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
    expect(isTypingTarget({} as EventTarget)).toBe(false)
  })
})

describe("selectionAction", () => {
  it("shows the menu for a selection that has a CFI", () => {
    expect(selectionAction(true, true, false)).toBe("show")
    expect(selectionAction(true, true, true)).toBe("show")
  })

  it("clears an open menu when the selection is gone", () => {
    expect(selectionAction(false, false, true)).toBe("clear")
    expect(selectionAction(false, false, false)).toBe("none")
  })

  it("treats a selection without a CFI as no selection", () => {
    expect(selectionAction(true, false, true)).toBe("clear")
    expect(selectionAction(true, false, false)).toBe("none")
  })
})

describe("isTurn", () => {
  it("counts foliate's turn reasons and scrolled-flow key turns (null)", () => {
    for (const reason of ["page", "snap", "scroll", null])
      expect(isTurn(reason, false)).toBe(true)
  })

  it("counts a navigation only while the reader's own turn is in flight", () => {
    expect(isTurn("navigation", true)).toBe(true)
    expect(isTurn("navigation", false)).toBe(false)
  })

  it("never counts jumps or an unknown reason", () => {
    for (const reason of ["anchor", "selection", undefined]) {
      expect(isTurn(reason, false)).toBe(false)
      expect(isTurn(reason, true)).toBe(false)
    }
  })
})
