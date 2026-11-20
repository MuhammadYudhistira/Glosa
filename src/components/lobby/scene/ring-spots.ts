import { HOTSPOT_SPOTS, type HotspotId, type Point2, spotOf } from "./layout"

/** The glow ring on the floor (spec 3G §3.4): thin, so its band is this wide. */
export const RING_INNER = 0.13
export const RING_OUTER = 0.22
/** The picked or hovered place's ring is this much wider than the others. */
export const RING_STRONG_SCALE = 1.2

/**
 * A ring's centre is where Anda stands for that place (`stand`: clear floor,
 * and where the walk ends), except for the three places at the writing desk,
 * whose stands crowd the first shelf section's (0.17 m apart): their rings
 * lie on the floor in front of the desk instead, chair and fireplace clear.
 */
const RING_AT: Partial<Record<HotspotId, Point2>> = {
  katalog: [0.8, 1.2],
  "meja-admin": [2.05, 1.2],
  papan: [1.55, 2.15],
}

export function ringOf(id: HotspotId): Point2 {
  return RING_AT[id] ?? spotOf(id).stand
}

/** One ring per place, in the hotspots' order. */
export const RING_SPOTS: ReadonlyArray<{ id: HotspotId; at: Point2 }> =
  HOTSPOT_SPOTS.map(({ id }) => ({ id, at: ringOf(id) }))
