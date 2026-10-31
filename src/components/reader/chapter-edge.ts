/**
 * Moving to the next or the previous section by scrolling on past its end or
 * its start, in the scrolled flow (spec pindah bab §3). Pure: the reader feeds
 * it the wheel and the finger, and where the scroll stands.
 */

export type EdgeSide = "start" | "end"
/** Whether the scroll stands at the section's start and at its end. */
export type AtEdge = { start: boolean; end: boolean }
/** How far the member has pulled past an edge, 0–1. */
export type Pull = { side: EdgeSide; progress: number }
/** The pull now, or the move it has just made. */
export type PullStep = Pull | "next" | "prev" | null

/** How far a finger travels past the edge to move on. */
export const TOUCH_PULL = 96
/** How far the wheel scrolls past the edge to move on: a little more, for inertia. */
export const WHEEL_PULL = 320
/** A pause this long between wheel events starts a new gesture. */
export const WHEEL_GAP_MS = 200
/** A wheel that rests this long lets the pull go. */
export const WHEEL_IDLE_MS = 700
/** A wheel line, in pixels. */
export const WHEEL_LINE = 16

type Gesture = { startedAt: AtEdge; done: boolean }

/**
 * The pull past either edge. A gesture counts only when it starts at the edge
 * it pulls past: the scroll that reached the edge, and its inertia, never move
 * on (spec §3.1). After a move the rest of its gesture does nothing.
 */
export function createEdgePull() {
  let gesture: Gesture | null = null
  let side: EdgeSide | null = null
  let pulled = 0
  let lastWheel = Number.NEGATIVE_INFINITY
  let lastY: number | null = null

  const current = (threshold: number): Pull | null =>
    side && pulled > 0
      ? { side, progress: Math.min(1, pulled / threshold) }
      : null

  const letGo = () => {
    side = null
    pulled = 0
  }

  /** `delta` is positive toward the end of the section. */
  const pull = (delta: number, at: AtEdge, threshold: number): PullStep => {
    if (!gesture || gesture.done || delta === 0) return null
    const toward: EdgeSide = delta > 0 ? "end" : "start"
    const distance = Math.abs(delta)
    if (side && toward !== side) {
      pulled = Math.max(0, pulled - distance)
      if (pulled === 0) side = null
      return current(threshold)
    }
    if (!gesture.startedAt[toward] || !at[toward]) return current(threshold)
    side = toward
    pulled += distance
    if (pulled < threshold) return current(threshold)
    gesture.done = true
    letGo()
    return toward === "end" ? "next" : "prev"
  }

  return {
    /**
     * The browser scrolls before the reader hears the wheel, so `at` may
     * already be the edge this very wheel scrolled to: a gesture starts from
     * `before`, where the scroll stood before it.
     */
    wheel(delta: number, before: AtEdge, at: AtEdge, time: number): PullStep {
      const pause = time - lastWheel
      lastWheel = time
      if (pause > WHEEL_IDLE_MS) letGo()
      if (pause > WHEEL_GAP_MS) gesture = { startedAt: before, done: false }
      return pull(delta, at, WHEEL_PULL)
    },
    touchStart(y: number, at: AtEdge) {
      letGo()
      lastY = y
      gesture = { startedAt: at, done: false }
    },
    touchMove(y: number, at: AtEdge): PullStep {
      if (lastY === null) return null
      // The finger moving up reads on.
      const delta = lastY - y
      lastY = y
      return pull(delta, at, TOUCH_PULL)
    },
    touchEnd(): null {
      lastY = null
      gesture = null
      letGo()
      return null
    },
    /** A new section: the pull is over, and so is the gesture under way. */
    reset() {
      if (gesture) gesture.done = true
      letGo()
    },
  }
}

/**
 * The section reached by moving one way from `index`, as foliate moves:
 * sections out of the reading order (linear="no") are passed over. Null past
 * either end of the book.
 */
export function adjacentSection(
  linear: ReadonlyArray<string | undefined>,
  index: number,
  dir: 1 | -1
): number | null {
  for (let next = index + dir; next >= 0 && next < linear.length; next += dir)
    if (linear[next] !== "no") return next
  return null
}

/**
 * The contents' name for the place a move lands on (spec §3.3): the first
 * entry of the next section, the last one of the section before, where the
 * member lands at its end. Null when the section has none, or when it goes on
 * with the chapter read now (one chapter split over several files).
 */
export function chapterLabel(
  entries: ReadonlyArray<{ label: string; index: number }>,
  target: number,
  dir: 1 | -1,
  current: string | null
): string | null {
  const inTarget = entries.filter((entry) => entry.index === target)
  const entry = dir === 1 ? inTarget[0] : inTarget.at(-1)
  const label = entry?.label.trim()
  if (!label || label === current?.trim()) return null
  return label
}
