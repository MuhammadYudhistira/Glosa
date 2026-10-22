export type ReaderMove = "left" | "right" | "prev" | "next"
export type TapAction = "left" | "right" | "menu"

/** Taps in the outer 30% turn the page; the middle shows or hides the frame (spec §9). */
export function tapAction(x: number, left: number, width: number): TapAction {
  const position = (x - left) / width
  if (position < 0.3) return "left"
  if (position > 0.7) return "right"
  return "menu"
}

/** A finger must travel this far across the page for its swipe to turn it. */
const SWIPE_DISTANCE = 30

/**
 * foliate judges a swipe by the speed of its last touchmove only, and a
 * finger slows down before it lifts, so most swipes fell back to the same
 * page. Judged by the whole swipe instead: the velocity foliate's snap takes
 * (positive is forward, foliate mirrors it for RTL books), or null to leave
 * a short or vertical move to foliate.
 */
export function swipeVelocity(dx: number, dy: number): number | null {
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) <= Math.abs(dy)) return null
  return dx < 0 ? 1 : -1
}

/** Wheel travel, in pixels, that counts as a deliberate move. */
const WHEEL_DISTANCE = 40
/** A gesture ends once the wheel has been still this long. */
const WHEEL_REST_MS = 200

/**
 * The mouse wheel and a trackpad turn the paginated book one page per
 * gesture: after a turn the rest of the gesture, trackpad inertia included,
 * is ignored until the wheel rests. Deltas are in pixels; `now` in ms.
 */
export function createWheelPager() {
  let total = 0
  let axis: "x" | "y" = "y"
  let turned = false
  let last = Number.NEGATIVE_INFINITY

  return (deltaX: number, deltaY: number, now: number): ReaderMove | null => {
    if (now - last > WHEEL_REST_MS) {
      total = 0
      turned = false
    }
    last = now
    if (turned) return null
    const nextAxis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y"
    const delta = nextAxis === "x" ? deltaX : deltaY
    if (nextAxis !== axis || Math.sign(delta) !== Math.sign(total)) total = 0
    axis = nextAxis
    total += delta
    if (Math.abs(total) < WHEEL_DISTANCE) return null
    turned = true
    if (axis === "x") return total > 0 ? "right" : "left"
    return total > 0 ? "next" : "prev"
  }
}

/**
 * Arrow keys follow the page direction (RTL books too); PageUp/PageDown and
 * Space (Shift+Space back) follow reading order.
 */
export function keyMove(key: string, shift = false): ReaderMove | null {
  switch (key) {
    case "ArrowLeft":
      return "left"
    case "ArrowRight":
      return "right"
    case "PageUp":
      return "prev"
    case "PageDown":
      return "next"
    case " ":
      return shift ? "prev" : "next"
    default:
      return null
  }
}

/** Space presses a focused button or link instead of turning the page. */
export function isControlTarget(target: EventTarget | null): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null
  return (
    typeof element?.closest === "function" &&
    element.closest(
      "button, a[href], summary, [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']"
    ) !== null
  )
}

/**
 * Keys typed into a field or used inside a dialog never turn pages. Duck-typed:
 * events from the book's iframe carry elements from another window.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null
  return (
    typeof element?.closest === "function" &&
    element.closest(
      "input, select, textarea, [contenteditable], [role='dialog']"
    ) !== null
  )
}
