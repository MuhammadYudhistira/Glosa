import { TAP_SLOP_PX } from "../tap"
import { ANDA_START, ROOM, type Point3, pointOf, spotOf } from "./layout"

/** What the camera looks at (any point on its axis) and how far it zooms in. */
export type View = { target: Point3; zoom: number }
/** The scene's size on screen, in CSS pixels. */
export type Viewport = { width: number; height: number }

export const MIN_ZOOM = 1
export const MAX_ZOOM = 2.6
/** The camera sits at target + CAMERA_OFFSET, looking back along it: isometric. */
export const CAMERA_OFFSET: Point3 = [40, 40, 40]

const R2 = Math.SQRT2
const R3 = Math.sqrt(3)
const R6 = Math.sqrt(6)
/** The world directions of screen-right and screen-up for that camera. */
export const SCREEN_RIGHT: Point3 = [1 / R2, 0, -1 / R2]
export const SCREEN_UP: Point3 = [-1 / R6, 2 / R6, -1 / R6]
/** Toward the camera; with the two above, an orthonormal frame. */
export const SCREEN_OUT: Point3 = [1 / R3, 1 / R3, 1 / R3]

const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))
const minus = (a: Point3, b: Point3): Point3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
]

/** Moves a point along the screen: `right` metres right, `up` metres up. */
function slide(point: Point3, right: number, up: number): Point3 {
  return [
    point[0] + SCREEN_RIGHT[0] * right + SCREEN_UP[0] * up,
    point[1] + SCREEN_RIGHT[1] * right + SCREEN_UP[1] * up,
    point[2] + SCREEN_RIGHT[2] * right + SCREEN_UP[2] * up,
  ]
}

/** The room's box on screen: u (right) and v (up) ranges over its 8 corners. */
const EXTENT = (() => {
  const us: Array<number> = []
  const vs: Array<number> = []
  for (const x of [0, ROOM.width])
    for (const y of [0, ROOM.height])
      for (const z of [0, ROOM.depth]) {
        us.push(dot(SCREEN_RIGHT, [x, y, z]))
        vs.push(dot(SCREEN_UP, [x, y, z]))
      }
  return {
    u0: Math.min(...us) - ROOM.pad,
    u1: Math.max(...us) + ROOM.pad,
    v0: Math.min(...vs) - ROOM.pad,
    v1: Math.max(...vs) + ROOM.pad,
  }
})()

/** Half the view's height in metres at zoom 1: the whole room (with its pad) just fits. */
export function baseHalfHeight(aspect: number): number {
  return Math.max(
    (EXTENT.v1 - EXTENT.v0) / 2,
    (EXTENT.u1 - EXTENT.u0) / 2 / aspect
  )
}

/** Half the view's width and height in metres. */
export function halfExtents(
  zoom: number,
  viewport: Viewport
): { halfWidth: number; halfHeight: number } {
  const aspect = viewport.width / viewport.height
  const halfHeight = baseHalfHeight(aspect) / zoom
  return { halfWidth: halfHeight * aspect, halfHeight }
}

/** How far toward the camera a clamped target lies: the room's centre's depth. */
const DEPTH = dot(SCREEN_OUT, [ROOM.width / 2, ROOM.height / 2, ROOM.depth / 2])

/** One axis: centred when the room is narrower than the screen, otherwise kept inside the room. */
function fitAxis(
  value: number,
  min: number,
  max: number,
  half: number
): number {
  // The slack keeps an axis the room fills exactly (to rounding) centred.
  return max - min <= 2 * half + 1e-9
    ? (min + max) / 2
    : clamp(value, min + half, max - half)
}

/**
 * Keeps the room on screen (spec 3F §3.1; plan 3F-R1, decision 1): the room
 * floats in a dark void, so the screen may show the void around it, but it
 * never pans the room away. u/v are screen-right/screen-up distances in metres.
 */
export function clampView(view: View, viewport: Viewport): View {
  const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM)
  const { halfWidth, halfHeight } = halfExtents(zoom, viewport)
  const u0 = dot(SCREEN_RIGHT, view.target)
  const v0 = dot(SCREEN_UP, view.target)
  const u = fitAxis(u0, EXTENT.u0, EXTENT.u1, halfWidth)
  const v = fitAxis(v0, EXTENT.v0, EXTENT.v1, halfHeight)
  // The target moves along the camera's axis to the room's depth, which the
  // orthographic view does not show: one screen position, one target.
  const target = pointOf(
    (k) => SCREEN_RIGHT[k] * u + SCREEN_UP[k] * v + SCREEN_OUT[k] * DEPTH
  )
  return { target, zoom }
}

/** Where a world point appears, in percent of the viewport from its top left. */
export function project(
  point: Point3,
  view: View,
  viewport: Viewport
): { x: number; y: number } {
  const { halfWidth, halfHeight } = halfExtents(view.zoom, viewport)
  const relative = minus(point, view.target)
  return {
    x: 50 + (50 * dot(SCREEN_RIGHT, relative)) / halfWidth,
    y: 50 - (50 * dot(SCREEN_UP, relative)) / halfHeight,
  }
}

/** Where a phone held upright looks: between Anda's start and the reading chair (spec 3G §3.7). */
const PORTRAIT_FOCUS: Point3 = [
  (ANDA_START[0] + spotOf("meja-baca").stand[0]) / 2,
  ROOM.height / 2,
  (ANDA_START[1] + spotOf("meja-baca").stand[1]) / 2,
]

/**
 * The widest phone, in CSS pixels. Keep in sync with the phone's CSS in
 * styles.css (`@media (max-width: 1023px) and (max-aspect-ratio: 1/1)`, the
 * scene ending above the sheet), which names this function.
 */
export const PHONE_MAX_WIDTH = 1023

/**
 * A phone held upright (spec 3G §3.7): taller than wide, and no wider than
 * a phone. A narrow desktop window wider than that keeps the desktop's view.
 */
export function uprightPhone(viewport: Viewport): boolean {
  return viewport.height > viewport.width && viewport.width <= PHONE_MAX_WIDTH
}

/**
 * The first view. Wide and square screens, and desktops: the whole room. A
 * phone held upright: the room fills the screen's height and the sides are
 * cropped (the camera pans to them); it never zooms out to less than the
 * screen's width (MIN_ZOOM), which is the old whole-room view.
 */
export function startView(viewport: Viewport): View {
  if (!uprightPhone(viewport)) {
    return clampView(
      {
        target: [ROOM.width / 2, ROOM.height / 2, ROOM.depth / 2],
        zoom: 1,
      },
      viewport
    )
  }
  const aspect = viewport.width / viewport.height
  const fill = baseHalfHeight(aspect) / ((EXTENT.v1 - EXTENT.v0) / 2)
  return clampView(
    { target: PORTRAIT_FOCUS, zoom: Math.min(MAX_ZOOM, fill) },
    viewport
  )
}

/** A zoom that changed by more than this share shows on screen as a move. */
const ZOOM_SLOP = 0.01

/**
 * Whether the camera visibly moved from `b` to `a` (spec 3G §3.7): a pan of
 * the tap slop or more on screen, or a zoom of more than 1%. A finger's
 * jitter during a tap pans the camera by a few pixels; that is no move.
 */
export function movedOnScreen(a: View, b: View, viewport: Viewport): boolean {
  if (Math.abs(a.zoom / b.zoom - 1) > ZOOM_SLOP) return true
  const { halfWidth, halfHeight } = halfExtents(b.zoom, viewport)
  const relative = minus(a.target, b.target)
  const x = (dot(SCREEN_RIGHT, relative) / halfWidth) * (viewport.width / 2)
  const y = (dot(SCREEN_UP, relative) / halfHeight) * (viewport.height / 2)
  return Math.hypot(x, y) >= TAP_SLOP_PX
}

/**
 * The view after the screen changed size (a phone turned, its address bar
 * or the sheet resized): a camera still at its first view gets the new
 * screen's first view, so the room keeps filling it; a moved one stays,
 * kept inside the room.
 */
export function resizeView(view: View, from: Viewport, to: Viewport): View {
  const same = from.width === to.width && from.height === to.height
  if (!same && !movedOnScreen(view, startView(from), from)) {
    return startView(to)
  }
  return clampView(view, to)
}

/** The view moved by a share of the screen (arrow keys). Not clamped yet. */
export function panBy(
  view: View,
  right: number,
  up: number,
  viewport: Viewport
): View {
  const { halfWidth, halfHeight } = halfExtents(view.zoom, viewport)
  return {
    target: slide(view.target, right * 2 * halfWidth, up * 2 * halfHeight),
    zoom: view.zoom,
  }
}

/** The view with a point in the middle of the screen. Not clamped yet. */
export function centerOn(view: View, point: Point3): View {
  const relative = minus(point, view.target)
  return {
    target: slide(
      view.target,
      dot(SCREEN_RIGHT, relative),
      dot(SCREEN_UP, relative)
    ),
    zoom: view.zoom,
  }
}

/** Whether a point shows well inside the screen, clear of its edges. */
export function isInView(
  point: Point3,
  view: View,
  viewport: Viewport
): boolean {
  const { x, y } = project(point, view, viewport)
  return x >= 8 && x <= 92 && y >= 12 && y <= 92
}
