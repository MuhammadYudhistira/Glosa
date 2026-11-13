import type { View } from "./projection"

/** The longest step one frame may take, in seconds: a slow frame does not jump. */
export const MAX_STEP = 0.05

/**
 * Below this (metres of pan, or zoom) a camera move is out of sight: the
 * damping's last steps are not worth a frame.
 */
const VIEW_EPS = 1e-4

/**
 * What may still change on screen after a frame. Nothing in the room moves
 * on its own (spec 3F §3.6), so without one of these no frame is drawn.
 */
export type Activity = {
  /** Anda is walking. */
  walking: boolean
  /** The camera is still gliding after a pan or zoom (damping). */
  panning: boolean
  /** The light is blending into a new mood. */
  blending: boolean
  /** The frame rate is being measured for the automatic quality step-down. */
  measuring: boolean
  /** A shop item is in its few seconds of motion after being placed. */
  decor: boolean
  /** Anda is on the way to a hotspot or doing its activity (spec 3F §4A.1). */
  acting: boolean
}

export function moving(activity: Activity): boolean {
  return (
    activity.walking ||
    activity.panning ||
    activity.blending ||
    activity.measuring ||
    activity.decor ||
    activity.acting
  )
}

/** Whether the camera moved visibly from `a` to `b`. */
export function viewMoved(a: View, b: View): boolean {
  return (
    Math.abs(a.zoom - b.zoom) > VIEW_EPS ||
    a.target.some((value, i) => Math.abs(value - b.target[i]) > VIEW_EPS)
  )
}

export type FrameLoop = {
  /**
   * Draws on the next frame, and starts the loop when it stopped. Several
   * calls before that frame draw it once; a call from inside `step` is drawn
   * by the frame under way.
   */
  invalidate: () => void
  /** Like invalidate, without counting the time since the last frame (a tab shown again). */
  resume: () => void
  dispose: () => void
}

/**
 * Draws only when something changed (plan 3F-R1 final review, I1): a frame
 * runs `step`, draws, and asks for the next one only while `step` says
 * something still moves. Idle, no frames run at all.
 */
export function createFrameLoop({
  step,
  draw,
  canRun,
  request = (run) => requestAnimationFrame(run),
  cancel = (id) => cancelAnimationFrame(id),
}: {
  /** Moves what moves by dt seconds (0 on a frame after a stop); true while something still moves. */
  step: (now: number, dt: number) => boolean
  draw: () => void
  /** False where no frame may run (a hidden tab): the loop stops until invalidated again. */
  canRun: () => boolean
  request?: (run: (now: number) => void) => number
  cancel?: (id: number) => void
}): FrameLoop {
  let frame = 0
  let disposed = false
  let stepping = false
  /** The last frame's time; null when the loop stopped since. */
  let last: number | null = null

  function tick(now: number) {
    frame = 0
    if (disposed || !canRun()) {
      last = null
      return
    }
    const dt = last === null ? 0 : Math.min(MAX_STEP, (now - last) / 1000)
    stepping = true
    let more = false
    try {
      more = step(now, dt)
    } finally {
      stepping = false
    }
    draw()
    if (more) {
      last = now
      frame = request(tick)
    } else {
      last = null
    }
  }

  function invalidate() {
    if (frame !== 0 || stepping || disposed || !canRun()) return
    frame = request(tick)
  }

  return {
    invalidate,
    resume() {
      last = null
      invalidate()
    },
    dispose() {
      disposed = true
      cancel(frame)
      frame = 0
    },
  }
}
