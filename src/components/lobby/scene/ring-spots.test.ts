import { describe, expect, it } from "vitest"
import { HOTSPOT_SPOTS, WALK_BOUNDS, walkBlockers } from "./layout"
import { PICK_VOLUMES } from "./pick-volumes"
import { RING_OUTER, RING_SPOTS, RING_STRONG_SCALE, ringOf } from "./ring-spots"
import { walkable } from "./walk"

/** How far the brightest ring reaches from its centre. */
const REACH = RING_OUTER * RING_STRONG_SCALE

describe("ring spots", () => {
  it("give every place exactly one, in the hotspots' order", () => {
    expect(RING_SPOTS.map((spot) => spot.id)).toEqual(
      HOTSPOT_SPOTS.map((spot) => spot.id)
    )
  })

  it("lie on walkable floor, clear of the furniture, even as the bright ring", () => {
    const blocked = walkBlockers()
    for (const { id } of HOTSPOT_SPOTS) {
      expect(walkable(ringOf(id), WALK_BOUNDS, blocked, REACH), id).toBe(true)
    }
  })

  it("never lie inside the box of another place", () => {
    for (const { id } of HOTSPOT_SPOTS) {
      const [x, z] = ringOf(id)
      const hit = PICK_VOLUMES.filter(
        (v) =>
          v.id !== id &&
          // Only what stands on the floor can hide a ring there.
          v.min[1] <= 0.3 &&
          x >= v.min[0] &&
          x <= v.max[0] &&
          z >= v.min[2] &&
          z <= v.max[2]
      ).map((v) => v.id)
      expect(hit, id).toEqual([])
    }
  })

  it("keep the rings apart, so a bright ring never swallows its neighbour", () => {
    for (const a of RING_SPOTS) {
      for (const b of RING_SPOTS) {
        if (a.id >= b.id) continue
        const apart = Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1])
        expect(apart, `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(2 * REACH)
      }
    }
  })

  it("stay near their own object, so the ring reads as that object's", () => {
    for (const { id, at } of RING_SPOTS) {
      const near = Math.min(
        ...PICK_VOLUMES.filter((v) => v.id === id).map((v) =>
          Math.hypot(
            Math.max(v.min[0] - at[0], 0, at[0] - v.max[0]),
            Math.max(v.min[2] - at[1], 0, at[1] - v.max[2])
          )
        )
      )
      expect(near, id).toBeLessThanOrEqual(2.2)
    }
  })
})
