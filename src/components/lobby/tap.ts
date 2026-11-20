/** A finger that moves this far (px) is a drag of the camera, not a tap (spec 3G §3.1). */
export const TAP_SLOP_PX = 10
/** A finger held this long (ms) is not a tap. */
export const TAP_MAX_MS = 300

export type PointerSample = {
  id: number
  x: number
  y: number
  /** `event.timeStamp`, in ms. */
  time: number
  /** `event.pointerType`. */
  type: string
  /** `event.button`: 0 is the main one (a mouse's left button, a finger). */
  button: number
}

/**
 * Tells a tap from a drag or a pinch of the camera (spec 3G §3.1). Pure: the
 * scene feeds it its pointer events. A mouse click is held to the distance
 * only, so a slow click on desktop still opens; only the main button taps,
 * though any button drags the camera.
 */
export function createTapTracker() {
  let start: PointerSample | null = null
  let spoiled = false
  return {
    /** "gesture" when this is a second finger: the camera is being pinched. */
    down(sample: PointerSample): "gesture" | null {
      if (start) {
        spoiled = true
        return "gesture"
      }
      start = sample
      spoiled = false
      return null
    },
    /** "gesture" the first time the press moves far enough to be a drag. */
    move(sample: PointerSample): "gesture" | null {
      if (!start || spoiled || sample.id !== start.id) return null
      if (Math.hypot(sample.x - start.x, sample.y - start.y) < TAP_SLOP_PX) {
        return null
      }
      spoiled = true
      return "gesture"
    },
    /** Where the tap began, or null when it was not one. */
    up(sample: PointerSample): { x: number; y: number } | null {
      if (!start || sample.id !== start.id) return null
      const began = start
      start = null
      if (spoiled) return null
      if (began.type === "mouse" && began.button !== 0) return null
      const quick =
        began.type === "mouse" || sample.time - began.time < TAP_MAX_MS
      return quick ? { x: began.x, y: began.y } : null
    },
    cancel() {
      start = null
      spoiled = false
    },
  }
}
