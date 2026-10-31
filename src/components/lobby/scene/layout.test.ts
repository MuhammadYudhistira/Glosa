import { describe, expect, it } from "vitest"
import { GENRE_VALUES } from "@/lib/genre"
import {
  ATRIUM,
  HOTSPOT_SPOTS,
  SHOWCASE,
  SHOWCASE_SIZE,
  SHOWCASE_SLOTS,
  TOWER,
  WALKER_ROUTES,
  ZONES,
  showcaseSlots,
  type Point2,
} from "./layout"

/** Distance from a floor point to the nearest tower's footprint. */
function towerClearance([x, z]: Point2): number {
  return Math.min(
    ...ZONES.map(({ at: [cx, cz] }) =>
      Math.hypot(
        Math.max(Math.abs(x - cx) - TOWER.width / 2, 0),
        Math.max(Math.abs(z - cz) - TOWER.width / 2, 0)
      )
    )
  )
}

const onFloor = ([x, z]: Point2) =>
  x >= 0 && x <= ATRIUM.size && z >= 0 && z <= ATRIUM.size

describe("lobby layout", () => {
  it("gives every genre exactly one zone", () => {
    expect(ZONES.map(({ genre }) => genre)).toEqual([...GENRE_VALUES])
  })

  it("lists unique hotspots in tab order", () => {
    expect(HOTSPOT_SPOTS.map(({ id }) => id)).toEqual([
      "meja-baca",
      ...GENRE_VALUES,
      "troli",
      "meja-admin",
      "katalog",
      "lemari",
    ])
  })

  it("stands twelve covers inside the display cabinet", () => {
    const slots = showcaseSlots()
    expect(slots).toHaveLength(SHOWCASE_SLOTS)
    const [cx, cz] = SHOWCASE
    for (const [x, y, z] of slots) {
      expect(Math.abs(x - cx)).toBeLessThan(SHOWCASE_SIZE.depth / 2)
      expect(Math.abs(z - cz)).toBeLessThan(SHOWCASE_SIZE.width / 2)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(SHOWCASE_SIZE.height)
    }
    // The newest book first: top shelf, then down.
    expect(slots[0][1]).toBeGreaterThan(slots[11][1])
  })

  it("lets 'Anda' stand on the floor, clear of the towers", () => {
    for (const { id, stand } of HOTSPOT_SPOTS) {
      expect(onFloor(stand), id).toBe(true)
      expect(towerClearance(stand), id).toBeGreaterThan(0.25)
    }
  })

  it("keeps walkers on the floor and out of the towers", () => {
    for (const [index, { points }] of WALKER_ROUTES.entries()) {
      points.forEach(([x, z], i) => {
        const [nx, nz] = points[(i + 1) % points.length]
        for (let t = 0; t <= 1; t += 0.01) {
          const at: Point2 = [x + (nx - x) * t, z + (nz - z) * t]
          expect(onFloor(at), `route ${index}`).toBe(true)
          expect(towerClearance(at), `route ${index}`).toBeGreaterThanOrEqual(
            0.25
          )
        }
      })
    }
  })
})
