import { ATRIUM, type Point3 } from "./layout"

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

const { size: SIZE, height: HEIGHT, front: FRONT, edge: EDGE } = ATRIUM
/** The floor counts as map up to FRONT metres in front of the room. */
const FLOOR = SIZE + FRONT
/** Half the map's height on screen, from the wall tops' peak to the floor's front point. */
const FIT_V = (HEIGHT + FLOOR - 2 * EDGE) / R6

/** Half the view's height in metres at zoom 1: the widest view that fits the map. */
export function baseHalfHeight(aspect: number): number {
  return Math.min(FIT_V / (1 + aspect / R3), (SIZE - EDGE) / R2 / aspect) * 0.96
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

/**
 * Keeps the whole screen inside the map (spec 1D §3.1). On screen the atrium
 * is a hexagon: the tops of the two back walls above, the wall ends at the
 * sides, the floor's front corners below. u/v are screen-right/screen-up
 * distances in metres.
 */
export function clampView(view: View, viewport: Viewport): View {
  const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM)
  const { halfWidth, halfHeight } = halfExtents(zoom, viewport)
  const u0 = dot(SCREEN_RIGHT, view.target)
  const v0 = dot(SCREEN_UP, view.target)
  // Sideways, the view stops at the wall ends, and also where the space
  // between the wall tops and the floor's edge is no longer as tall as the
  // screen; past that point the top and the bottom would both show the void.
  const umax = Math.max(
    0,
    Math.min(
      (SIZE - EDGE) / R2 - halfWidth,
      R3 * (FIT_V - halfHeight) - halfWidth
    )
  )
  const u = clamp(u0, -umax, umax)
  const slope = (Math.abs(u) + halfWidth) / R3
  const vmax = (2 * (HEIGHT - EDGE)) / R6 - slope - halfHeight
  const vmin = (-2 * (FLOOR - EDGE)) / R6 + slope + halfHeight
  const v = vmin > vmax ? (vmin + vmax) / 2 : clamp(v0, vmin, vmax)
  return { target: slide(view.target, u - u0, v - v0), zoom }
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

/** The first view: the whole atrium on wide screens, the reading table on tall ones. */
export function startView(viewport: Viewport): View {
  const tall = viewport.width < viewport.height
  return clampView(
    tall
      ? { target: [17, 3, 19], zoom: 1.6 }
      : { target: [14, 4, 14], zoom: 1 },
    viewport
  )
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
