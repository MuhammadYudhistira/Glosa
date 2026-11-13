import { describe, expect, it } from "vitest"
import { GENRE_VALUES } from "@/lib/genre"
import { SLOT_IDS } from "@/lib/shop/catalog"
import { MODEL_KEYS } from "./model-manifest"
import {
  ANDA_START,
  ANDA_RADIUS,
  DECOR_SIZES,
  DECOR_SLOTS,
  FURNITURE,
  HOTSPOT_SPOTS,
  PLANT,
  PLANT_POT,
  PLANT_SHAPES,
  ROOM,
  SHOWCASE,
  SHOWCASE_SIZE,
  SHOWCASE_SLOTS,
  WALK_BOUNDS,
  WALL_SECTIONS,
  footprint,
  showcaseSlots,
  walkBlockers,
  type Point2,
} from "./layout"
import { isInView, project, startView } from "./projection"
import { type Box2, findPath, walkable } from "./walk"

const inRoom = ([x, z]: Point2, m = 0) =>
  x >= m && x <= ROOM.width - m && z >= m && z <= ROOM.depth - m
const overlap = (a: Box2, b: Box2) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]

describe("room layout", () => {
  it("lists the hotspots in tab order, once each", () => {
    expect(HOTSPOT_SPOTS.map(({ id }) => id)).toEqual([
      "meja-baca",
      ...GENRE_VALUES,
      "troli",
      "meja-admin",
      "katalog",
      "lemari",
      "tanaman",
      "toko",
      "perapian",
      "papan",
      "pintu",
    ])
  })

  it("gives every piece of base furniture the hotspot it serves (spec 3F §3.6)", () => {
    const ids = new Set<string>(HOTSPOT_SPOTS.map(({ id }) => id))
    for (const f of FURNITURE) expect(ids.has(f.serves), f.id).toBe(true)
  })

  it("keeps nothing without a use in the room", () => {
    const ids = FURNITURE.map(({ id }) => id)
    for (const gone of ["baseRug", "doorPlant"]) {
      expect(ids, gone).not.toContain(gone)
    }
    expect(MODEL_KEYS).not.toContain("baseRug")
  })

  it("gives every genre one wall section, side by side inside the room", () => {
    expect(WALL_SECTIONS.map(({ genre }) => genre)).toEqual([...GENRE_VALUES])
    const last = WALL_SECTIONS.at(-1)!
    expect(last.z + last.width / 2).toBeLessThanOrEqual(ROOM.depth)
  })

  it.each(VIEWPORTS)(
    "has every hotspot inside the room and on screen (%o)",
    (viewport) => {
      const view = startView(viewport)
      for (const { id, label, stand } of HOTSPOT_SPOTS) {
        expect(label[0], id).toBeGreaterThanOrEqual(0)
        expect(label[0], id).toBeLessThanOrEqual(ROOM.width)
        expect(label[1], id).toBeGreaterThan(0)
        expect(label[1], id).toBeLessThanOrEqual(ROOM.height)
        expect(inRoom([label[0], label[2]]), id).toBe(true)
        expect(inRoom(stand), id).toBe(true)
        expect(isInView(label, view, viewport), id).toBe(true)
        const { x, y } = project(label, view, viewport)
        expect(x + y, id).toBeGreaterThan(0)
      }
    }
  )

  it("keeps the hotspot labels apart on a desktop screen", () => {
    // A label is an HTML pill about 110 × 26 px around its projected point.
    const viewport = { width: 1440, height: 900 }
    const view = startView(viewport)
    const points = HOTSPOT_SPOTS.map(({ id, label }) => {
      const { x, y } = project(label, view, viewport)
      return {
        id,
        x: (x / 100) * viewport.width,
        y: (y / 100) * viewport.height,
      }
    })
    points.forEach((a, i) =>
      points.slice(i + 1).forEach((b) => {
        const apart = Math.abs(a.y - b.y) >= 26 || Math.abs(a.x - b.x) >= 110
        expect(apart, `${a.id} / ${b.id}`).toBe(true)
      })
    )
  })

  it("lets Anda stand at every hotspot and reach it from the start", () => {
    const blocked = walkBlockers()
    expect(walkable(ANDA_START, WALK_BOUNDS, blocked, ANDA_RADIUS)).toBe(true)
    for (const { id, stand } of HOTSPOT_SPOTS) {
      expect(walkable(stand, WALK_BOUNDS, blocked, ANDA_RADIUS), id).toBe(true)
      expect(
        findPath(ANDA_START, stand, WALK_BOUNDS, blocked, ANDA_RADIUS).length,
        id
      ).toBeGreaterThan(0)
    }
  })

  it("keeps the base furniture inside the room and apart from each other", () => {
    const solid = FURNITURE.filter((f) => f.solid)
    for (const f of FURNITURE) {
      const box = footprint(f)
      expect(box.x0, f.id).toBeGreaterThanOrEqual(0)
      expect(box.x1, f.id).toBeLessThanOrEqual(ROOM.width)
      expect(box.z0, f.id).toBeGreaterThanOrEqual(0)
      expect(box.z1, f.id).toBeLessThanOrEqual(ROOM.depth)
      expect(MODEL_KEYS, f.id).toContain(f.model)
      const quarters = f.turn / (Math.PI / 2)
      expect(Math.abs(quarters - Math.round(quarters)), f.id).toBeLessThan(1e-9)
    }
    solid.forEach((a, i) =>
      solid
        .slice(i + 1)
        .forEach((b) =>
          expect(overlap(footprint(a), footprint(b)), `${a.id} / ${b.id}`).toBe(
            false
          )
        )
    )
  })

  it("puts every decor slot inside the room and clear of the solid furniture", () => {
    const solid = walkBlockers()
    for (const slot of SLOT_IDS) {
      const { at, flat } = DECOR_SLOTS[slot]
      expect(inRoom([at[0], at[2]]), slot).toBe(true)
      expect(at[1], slot).toBeGreaterThanOrEqual(0)
      expect(at[1], slot).toBeLessThanOrEqual(ROOM.height)
      if (flat) continue
      const box = footprint({
        at: [at[0], at[2]],
        size: DECOR_SIZES[slot],
        turn: DECOR_SLOTS[slot].turn,
      })
      expect(
        solid.some((other) => overlap(box, other)),
        slot
      ).toBe(false)
    }
  })

  it("stands the cabinet, its covers and the plant inside the room", () => {
    expect(SHOWCASE_SLOTS).toBe(12)
    expect(showcaseSlots()).toHaveLength(12)
    for (const [x, y, z] of showcaseSlots()) {
      expect(inRoom([x, z])).toBe(true)
      expect(y).toBeLessThan(SHOWCASE_SIZE.height)
    }
    expect(inRoom(SHOWCASE)).toBe(true)
    expect(inRoom(PLANT, PLANT_POT.width / 2)).toBe(true)
    expect(Object.keys(PLANT_SHAPES)).toHaveLength(6)
  })
})
