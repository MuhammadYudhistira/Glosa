import { type HotspotId, type Point3, pointOf } from "./layout"
import { PICK_VOLUMES, type PickVolume } from "./pick-volumes"
import {
  SCREEN_OUT,
  SCREEN_RIGHT,
  SCREEN_UP,
  type View,
  type Viewport,
  halfExtents,
} from "./projection"

/** The camera's rays run against its axis: away from the camera. */
const AWAY: Point3 = [-SCREEN_OUT[0], -SCREEN_OUT[1], -SCREEN_OUT[2]]

/**
 * Where a ray enters a box (slab test), as a distance along `AWAY` from the
 * ray's origin (negative: behind it, toward the camera); null on a miss.
 */
function enter(origin: Point3, volume: PickVolume): number | null {
  let from = Number.NEGATIVE_INFINITY
  let to = Number.POSITIVE_INFINITY
  for (let k = 0; k < 3; k++) {
    const a = (volume.min[k] - origin[k]) / AWAY[k]
    const b = (volume.max[k] - origin[k]) / AWAY[k]
    from = Math.max(from, Math.min(a, b))
    to = Math.min(to, Math.max(a, b))
  }
  return from <= to ? from : null
}

/**
 * The place under a point of the scene (spec 3G §4): a ray through the
 * orthographic camera, the box nearest the camera wins. `point` is in CSS
 * pixels from the scene's top left, like `project`'s inverse. Pure: no
 * three.js, so it runs in tests and on the server.
 */
export function pickAt(
  point: { x: number; y: number },
  view: View,
  viewport: Viewport,
  volumes: ReadonlyArray<PickVolume> = PICK_VOLUMES
): HotspotId | null {
  if (
    point.x < 0 ||
    point.y < 0 ||
    point.x > viewport.width ||
    point.y > viewport.height
  ) {
    return null
  }
  const { halfWidth, halfHeight } = halfExtents(view.zoom, viewport)
  const right = (2 * point.x) / viewport.width - 1
  const up = 1 - (2 * point.y) / viewport.height
  const origin = pointOf(
    (k) =>
      view.target[k] +
      SCREEN_RIGHT[k] * right * halfWidth +
      SCREEN_UP[k] * up * halfHeight
  )
  let best: { id: HotspotId; at: number } | null = null
  for (const volume of volumes) {
    const at = enter(origin, volume)
    if (at !== null && (best === null || at < best.at)) {
      best = { id: volume.id, at }
    }
  }
  return best?.id ?? null
}
