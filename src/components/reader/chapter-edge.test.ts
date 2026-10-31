import { describe, expect, it } from "vitest"
import {
  TOUCH_PULL,
  WHEEL_GAP_MS,
  WHEEL_IDLE_MS,
  WHEEL_PULL,
  adjacentSection,
  chapterLabel,
  createEdgePull,
} from "./chapter-edge"

const MIDDLE = { start: false, end: false }
const END = { start: false, end: true }
const START = { start: true, end: false }
const BOTH = { start: true, end: true }

describe("createEdgePull, wheel", () => {
  it("does not count the wheel that brought the reader to the end", () => {
    const pull = createEdgePull()
    expect(pull.wheel(100, MIDDLE, MIDDLE, 0)).toBeNull()
    // The same flick goes on, inertia included, now at the end.
    for (let time = 16; time < 2000; time += 16)
      expect(pull.wheel(100, END, END, time)).toBeNull()
  })

  it("does not count a wheel that scrolls to the end itself", () => {
    const pull = createEdgePull()
    // The browser scrolls before the reader hears the wheel: it was not at
    // the end before this event, though it is now.
    expect(pull.wheel(100, MIDDLE, END, 0)).toBeNull()
    expect(pull.wheel(100, END, END, 16)).toBeNull()
  })

  it("fills with a new wheel gesture at the end, then turns", () => {
    const pull = createEdgePull()
    pull.wheel(100, MIDDLE, MIDDLE, 0)
    const start = WHEEL_GAP_MS + 1
    expect(pull.wheel(WHEEL_PULL / 4, END, END, start)).toEqual({
      side: "end",
      progress: 0.25,
    })
    expect(pull.wheel(WHEEL_PULL / 2, END, END, start + 16)).toEqual({
      side: "end",
      progress: 0.75,
    })
    expect(pull.wheel(WHEEL_PULL / 4, END, END, start + 32)).toBe("next")
    // The rest of that gesture does nothing.
    expect(pull.wheel(WHEEL_PULL, END, END, start + 48)).toBeNull()
  })

  it("keeps the pull across slow wheel notches, and empties when idle", () => {
    const pull = createEdgePull()
    expect(pull.wheel(100, END, END, 0)).toEqual({
      side: "end",
      progress: 100 / WHEEL_PULL,
    })
    expect(pull.wheel(100, END, END, WHEEL_GAP_MS + 50)).toEqual({
      side: "end",
      progress: 200 / WHEEL_PULL,
    })
    expect(
      pull.wheel(100, END, END, WHEEL_GAP_MS + 50 + WHEEL_IDLE_MS + 1)
    ).toEqual({ side: "end", progress: 100 / WHEEL_PULL })
  })

  it("goes back at the start", () => {
    const pull = createEdgePull()
    expect(pull.wheel(-WHEEL_PULL / 2, START, START, 0)).toEqual({
      side: "start",
      progress: 0.5,
    })
    expect(pull.wheel(-WHEEL_PULL / 2, START, START, 16)).toBe("prev")
  })

  it("lets go when the wheel turns away from the edge", () => {
    const pull = createEdgePull()
    pull.wheel(WHEEL_PULL / 2, END, END, 0)
    expect(pull.wheel(-WHEEL_PULL / 4, MIDDLE, MIDDLE, 16)).toEqual({
      side: "end",
      progress: 0.25,
    })
    expect(pull.wheel(-WHEEL_PULL, MIDDLE, MIDDLE, 32)).toBeNull()
  })

  it("pulls either way in a section shorter than the screen", () => {
    const pull = createEdgePull()
    expect(pull.wheel(WHEEL_PULL, BOTH, BOTH, 0)).toBe("next")
    expect(pull.wheel(-WHEEL_PULL, BOTH, BOTH, WHEEL_GAP_MS + 1)).toBe("prev")
  })

  it("lets the rest of a wheel gesture pass a short section after a reset", () => {
    const pull = createEdgePull()
    pull.wheel(WHEEL_PULL / 2, END, END, 0)
    // A new section, shorter than the screen, while the wheel still spins.
    pull.reset()
    expect(pull.wheel(WHEEL_PULL, BOTH, BOTH, 16)).toBeNull()
    expect(pull.wheel(WHEEL_PULL, BOTH, BOTH, 32 + WHEEL_GAP_MS)).toBe("next")
  })

  it("ignores sideways wheels", () => {
    const pull = createEdgePull()
    expect(pull.wheel(0, END, END, 0)).toBeNull()
  })
})

describe("createEdgePull, touch", () => {
  it("counts a touch that starts at the end, finger moving up", () => {
    const pull = createEdgePull()
    pull.touchStart(500, END)
    expect(pull.touchMove(500 - TOUCH_PULL / 2, END)).toEqual({
      side: "end",
      progress: 0.5,
    })
    expect(pull.touchMove(500 - TOUCH_PULL, END)).toBe("next")
    expect(pull.touchMove(500 - 2 * TOUCH_PULL, END)).toBeNull()
  })

  it("does not count the touch that scrolled to the end", () => {
    const pull = createEdgePull()
    pull.touchStart(500, MIDDLE)
    expect(pull.touchMove(300, END)).toBeNull()
    expect(pull.touchMove(100, END)).toBeNull()
  })

  it("empties when the finger lifts", () => {
    const pull = createEdgePull()
    pull.touchStart(500, END)
    pull.touchMove(450, END)
    expect(pull.touchEnd()).toBeNull()
    pull.touchStart(500, END)
    expect(pull.touchMove(450, END)).toEqual({
      side: "end",
      progress: 50 / TOUCH_PULL,
    })
  })

  it("goes back with the finger moving down at the start", () => {
    const pull = createEdgePull()
    pull.touchStart(100, START)
    expect(pull.touchMove(100 + TOUCH_PULL, START)).toBe("prev")
  })

  it("forgets the pull on reset", () => {
    const pull = createEdgePull()
    pull.touchStart(500, END)
    pull.touchMove(450, END)
    pull.reset()
    expect(pull.touchMove(400, END)).toBeNull()
  })
})

describe("adjacentSection", () => {
  const linear = [undefined, "no", "yes", undefined, "no"]

  it("skips sections out of the reading order", () => {
    expect(adjacentSection(linear, 0, 1)).toBe(2)
    expect(adjacentSection(linear, 2, -1)).toBe(0)
  })

  it("is null past either end of the book", () => {
    expect(adjacentSection(linear, 3, 1)).toBeNull()
    expect(adjacentSection(linear, 0, -1)).toBeNull()
  })
})

describe("chapterLabel", () => {
  const entries = [
    { label: "Bab 1", index: 1 },
    { label: "Bab 2", index: 2 },
    { label: "Bab 2.1", index: 2 },
    { label: "Bab 3", index: 4 },
  ]

  it("names the first entry of the next section", () => {
    expect(chapterLabel(entries, 2, 1, "Bab 1")).toBe("Bab 2")
  })

  it("names the last entry of the section before, where the reader lands", () => {
    expect(chapterLabel(entries, 2, -1, "Bab 3")).toBe("Bab 2.1")
  })

  it("has no name for a section missing from the contents", () => {
    expect(chapterLabel(entries, 3, 1, "Bab 2.1")).toBeNull()
  })

  it("has no name when the next file goes on with the same chapter", () => {
    expect(chapterLabel(entries, 4, 1, " Bab 3 ")).toBeNull()
  })

  it("trims labels and drops empty ones", () => {
    expect(chapterLabel([{ label: "  Bab 9 ", index: 0 }], 0, 1, null)).toBe(
      "Bab 9"
    )
    expect(chapterLabel([{ label: "  ", index: 0 }], 0, 1, null)).toBeNull()
  })
})
