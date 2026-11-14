import { describe, expect, it, vi } from "vitest"
import {
  type Activity,
  MAX_STEP,
  createFrameLoop,
  moving,
  viewMoved,
} from "./frame-loop"

/** A requestAnimationFrame that runs only when the test says so. */
function fakeFrames() {
  let queue: Array<{ id: number; run: (now: number) => void }> = []
  let next = 1
  let now = 1000
  return {
    request: (run: (now: number) => void) => {
      const id = next++
      queue.push({ id, run })
      return id
    },
    cancel: (id: number) => {
      queue = queue.filter((frame) => frame.id !== id)
    },
    /** How many frames are waiting. */
    pending: () => queue.length,
    /** Runs the frames waiting now, `ms` after the last. */
    flush: (ms = 16) => {
      now += ms
      const due = queue
      queue = []
      for (const frame of due) frame.run(now)
    },
  }
}

function setup(step: (now: number, dt: number) => boolean = () => false) {
  const frames = fakeFrames()
  const draw = vi.fn()
  const stepSpy = vi.fn(step)
  let runs = true
  const loop = createFrameLoop({
    step: stepSpy,
    draw,
    canRun: () => runs,
    request: frames.request,
    cancel: frames.cancel,
  })
  return {
    frames,
    draw,
    step: stepSpy,
    loop,
    hide: (hidden: boolean) => {
      runs = !hidden
    },
  }
}

const IDLE: Activity = {
  walking: false,
  panning: false,
  blending: false,
  measuring: false,
  decor: false,
  acting: false,
  moment: false,
}

describe("what keeps the frames coming (spec 3F §3.6)", () => {
  it("nothing moving: no more frames", () => {
    expect(moving(IDLE)).toBe(false)
  })

  it.each(Object.keys(IDLE) as Array<keyof Activity>)(
    "%s alone keeps them coming",
    (reason) => {
      expect(moving({ ...IDLE, [reason]: true })).toBe(true)
    }
  )
})

describe("viewMoved", () => {
  const view = { target: [5, 0, 5] as [number, number, number], zoom: 1.5 }

  it("sees a pan or a zoom", () => {
    expect(viewMoved(view, { ...view, target: [5.01, 0, 5] })).toBe(true)
    expect(viewMoved(view, { ...view, zoom: 1.6 })).toBe(true)
  })

  it("ignores the damping's last, invisible steps", () => {
    expect(viewMoved(view, view)).toBe(false)
    expect(viewMoved(view, { ...view, target: [5.00005, 0, 4.99995] })).toBe(
      false
    )
  })
})

describe("createFrameLoop", () => {
  it("draws nothing until asked", () => {
    const { frames, draw } = setup()
    expect(frames.pending()).toBe(0)
    expect(draw).not.toHaveBeenCalled()
  })

  it("idle: one invalidate draws exactly one frame, then the loop stops", () => {
    const { frames, draw, loop } = setup()
    loop.invalidate()
    loop.invalidate()
    loop.invalidate()
    expect(frames.pending()).toBe(1)
    frames.flush()
    expect(draw).toHaveBeenCalledTimes(1)
    expect(frames.pending()).toBe(0)
    frames.flush()
    expect(draw).toHaveBeenCalledTimes(1)
  })

  it("keeps drawing while something moves, and the frame it stops in too", () => {
    let left = 3
    const { frames, draw, loop } = setup(() => --left > 0)
    loop.invalidate()
    frames.flush()
    frames.flush()
    expect(frames.pending()).toBe(1)
    frames.flush()
    expect(draw).toHaveBeenCalledTimes(3)
    expect(frames.pending()).toBe(0)
  })

  it("a change made while stepping is drawn by that frame, not one more", () => {
    let loop: ReturnType<typeof createFrameLoop> | null = null
    const set = setup(() => {
      loop?.invalidate()
      return false
    })
    loop = set.loop
    loop.invalidate()
    set.frames.flush()
    expect(set.draw).toHaveBeenCalledTimes(1)
    expect(set.frames.pending()).toBe(0)
  })

  it("steps by the time between frames, at most MAX_STEP, and by 0 after a stop", () => {
    let left = 3
    const { frames, step, loop } = setup(() => --left > 0)
    loop.invalidate()
    frames.flush(500)
    frames.flush(20)
    frames.flush(200)
    expect(step.mock.calls.map(([, dt]) => dt)).toEqual([0, 0.02, MAX_STEP])
    // Stopped: the time that passed since does not count.
    left = 1
    frames.flush(5000)
    loop.invalidate()
    frames.flush(16)
    expect(step.mock.calls.at(-1)?.[1]).toBe(0)
  })

  it("resume: the next frame does not count the time since the last one", () => {
    const { frames, step, loop } = setup(() => true)
    loop.invalidate()
    frames.flush()
    frames.flush(30)
    expect(step.mock.calls.at(-1)?.[1]).toBeCloseTo(0.03)
    loop.resume()
    frames.flush(40)
    expect(step.mock.calls.at(-1)?.[1]).toBe(0)
    expect(frames.pending()).toBe(1)
  })

  it("stops where it may not run (a hidden tab) and starts again when asked", () => {
    const { frames, draw, loop, hide } = setup(() => true)
    loop.invalidate()
    frames.flush()
    hide(true)
    frames.flush()
    expect(draw).toHaveBeenCalledTimes(1)
    expect(frames.pending()).toBe(0)
    loop.invalidate()
    expect(frames.pending()).toBe(0)
    hide(false)
    loop.invalidate()
    frames.flush()
    expect(draw).toHaveBeenCalledTimes(2)
  })

  it("dispose cancels the waiting frame and ignores later requests", () => {
    const { frames, draw, loop } = setup(() => true)
    loop.invalidate()
    loop.dispose()
    expect(frames.pending()).toBe(0)
    loop.invalidate()
    expect(frames.pending()).toBe(0)
    expect(draw).not.toHaveBeenCalled()
  })
})
