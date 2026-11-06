import { describe, expect, it } from "vitest"
import { GENRE_VALUES } from "@/lib/genre"
import { SLOT_IDS } from "@/lib/shop/catalog"
import {
  ATRIUM,
  DECOR_SLOTS,
  HOTSPOT_SPOTS,
  KIOSK,
  LOUNGES,
  PLANT,
  PLANT_POT,
  PLANT_SHAPES,
  READERS,
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
      "tanaman",
      "toko",
    ])
  })

  it("stands the plant on open floor, clear of walkers, readers and the cabinet", () => {
    expect(onFloor(PLANT)).toBe(true)
    expect(towerClearance(PLANT)).toBeGreaterThan(1)
    const distance = (a: Point2, b: Point2) =>
      Math.hypot(a[0] - b[0], a[1] - b[1])
    for (const { at } of READERS) {
      expect(distance(PLANT, at)).toBeGreaterThan(1.2)
    }
    expect(distance(PLANT, SHOWCASE)).toBeGreaterThan(3)
    for (const [index, { points }] of WALKER_ROUTES.entries()) {
      points.forEach(([x, z], i) => {
        const [nx, nz] = points[(i + 1) % points.length]
        for (let t = 0; t <= 1; t += 0.01) {
          const at: Point2 = [x + (nx - x) * t, z + (nz - z) * t]
          expect(distance(PLANT, at), `route ${index}`).toBeGreaterThan(
            PLANT_POT.width / 2 + 0.6
          )
        }
      })
    }
  })

  it("grows the plant at every stage", () => {
    const order = [
      "biji",
      "tunas",
      "daun",
      "rimbun",
      "kuncup",
      "berbunga",
    ] as const
    const shapes = order.map((stage) => PLANT_SHAPES[stage])
    expect(shapes[0]).toEqual({ stem: 0, leaves: 0, buds: 0, flowers: 0 })
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].stem).toBeGreaterThanOrEqual(shapes[i - 1].stem)
      expect(shapes[i].leaves).toBeGreaterThanOrEqual(shapes[i - 1].leaves)
    }
    expect(shapes[4].buds).toBeGreaterThan(0)
    expect(shapes[5].flowers).toBeGreaterThan(0)
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

  it("gives every shop slot a place, and keeps standing items clear", () => {
    const distance = (a: Point2, b: Point2) =>
      Math.hypot(a[0] - b[0], a[1] - b[1])
    expect(Object.keys(DECOR_SLOTS).sort()).toEqual([...SLOT_IDS].sort())
    const standing: Array<[string, Point2]> = [
      ...Object.entries(DECOR_SLOTS)
        .filter(([, slot]) => !slot.flat)
        .map(([id, { at }]): [string, Point2] => [id, [at[0], at[2]]]),
      ["kiosk", KIOSK],
    ]
    for (const [id, at] of standing) {
      expect(onFloor(at), id).toBe(true)
      expect(towerClearance(at), id).toBeGreaterThan(1)
      expect(distance(at, PLANT), id).toBeGreaterThan(2)
      expect(distance(at, SHOWCASE), id).toBeGreaterThan(2.5)
      for (const { at: seat } of READERS) {
        expect(distance(at, seat), id).toBeGreaterThan(1.5)
      }
      for (const { at: lounge } of LOUNGES) {
        expect(distance(at, lounge), id).toBeGreaterThan(2)
      }
      for (const [index, { points }] of WALKER_ROUTES.entries()) {
        points.forEach(([x, z], i) => {
          const [nx, nz] = points[(i + 1) % points.length]
          for (let t = 0; t <= 1; t += 0.01) {
            const on: Point2 = [x + (nx - x) * t, z + (nz - z) * t]
            expect(distance(at, on), `${id} route ${index}`).toBeGreaterThan(
              1.5
            )
          }
        })
      }
    }
  })
})
