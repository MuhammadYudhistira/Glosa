import { describe, expect, it } from "vitest"
import { TAP_MAX_MS, TAP_SLOP_PX, createTapTracker } from "./tap"

const touch = (x: number, y: number, time: number, id = 1) => ({
  id,
  x,
  y,
  time,
  type: "touch",
  button: 0,
})

describe("createTapTracker", () => {
  it("calls a short press that hardly moved a tap, at where it began", () => {
    const tracker = createTapTracker()
    tracker.down(touch(100, 200, 0))
    expect(tracker.move(touch(104, 203, 50))).toBeNull()
    expect(tracker.up(touch(104, 203, 120))).toEqual({ x: 100, y: 200 })
  })

  it("calls a press that moved 10 px or more a drag, once", () => {
    const tracker = createTapTracker()
    tracker.down(touch(0, 0, 0))
    expect(tracker.move(touch(TAP_SLOP_PX, 0, 20))).toBe("gesture")
    expect(tracker.move(touch(40, 0, 30))).toBeNull()
    expect(tracker.up(touch(40, 0, 60))).toBeNull()
  })

  it("does not take a drag that came back as a tap", () => {
    const tracker = createTapTracker()
    tracker.down(touch(0, 0, 0))
    tracker.move(touch(30, 0, 20))
    expect(tracker.up(touch(0, 0, 60))).toBeNull()
  })

  it("calls a touch held for 300 ms or more a press, not a tap", () => {
    const tracker = createTapTracker()
    tracker.down(touch(5, 5, 0))
    expect(tracker.up(touch(5, 5, TAP_MAX_MS))).toBeNull()
  })

  it("lets a mouse click take as long as it likes", () => {
    const tracker = createTapTracker()
    tracker.down({ id: 1, x: 5, y: 6, time: 0, type: "mouse", button: 0 })
    expect(
      tracker.up({ id: 1, x: 5, y: 6, time: 5000, type: "mouse", button: 0 })
    ).toEqual({
      x: 5,
      y: 6,
    })
  })

  it("takes only the main mouse button's click as a tap, but any button's drag as the camera", () => {
    const tracker = createTapTracker()
    for (const button of [1, 2]) {
      const mouse = { id: 1, x: 5, y: 6, type: "mouse", button }
      tracker.down({ ...mouse, time: 0 })
      expect(tracker.up({ ...mouse, time: 50 })).toBeNull()
    }
    const right = { id: 1, type: "mouse", button: 2 }
    tracker.down({ ...right, x: 0, y: 0, time: 0 })
    expect(tracker.move({ ...right, x: 30, y: 0, time: 20 })).toBe("gesture")
  })

  it("takes a second finger as a camera gesture and no tap comes of it", () => {
    const tracker = createTapTracker()
    tracker.down(touch(0, 0, 0, 1))
    expect(tracker.down(touch(50, 50, 10, 2))).toBe("gesture")
    expect(tracker.up(touch(50, 50, 40, 2))).toBeNull()
    expect(tracker.up(touch(0, 0, 60, 1))).toBeNull()
  })

  it("starts afresh after a cancel", () => {
    const tracker = createTapTracker()
    tracker.down(touch(0, 0, 0))
    tracker.cancel()
    expect(tracker.up(touch(0, 0, 10))).toBeNull()
    tracker.down(touch(1, 2, 100))
    expect(tracker.up(touch(1, 2, 150))).toEqual({ x: 1, y: 2 })
  })
})
