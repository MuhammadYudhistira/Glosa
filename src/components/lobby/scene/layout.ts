import { GENRE_VALUES, type Genre } from "@/lib/genre"
import type { PlantStage } from "@/lib/reading-habit"
import type { SlotId } from "@/lib/shop/catalog"
import type { ModelKey } from "./model-manifest"
import type { Box2 } from "./walk"

/**
 * The study room, in metres (spec 3F §3.1). X runs along the window wall
 * (Z = 0), Z along the shelf wall (X = 0), Y up. The camera looks from
 * +X +Z, so those two walls are the back of a diorama with no front walls
 * and no roof. Pure data: no three.js, so tests and the hotspot layer can use
 * it. Positions are starting values; the tests decide them (plan 3F-R1,
 * decision 3), and every size here is the source of truth for the models
 * fitted to it (decision 4).
 */
export type Point2 = readonly [number, number]
export type Point3 = readonly [number, number, number]

/** The floor is width × depth; `pad` is the margin the camera keeps around the room. */
export const ROOM = { width: 10, depth: 10, height: 4.6, pad: 0.9 } as const

/**
 * Parts of the walls rather than furniture (room.ts builds them): the window
 * in the Z = 0 wall (x0..x1, sill y0 to head y1), the door in the X = 0 wall
 * (centred on z) and the corkboard on the Z = 0 wall (centred on x, y).
 * The door serves the `pintu` hotspot, the corkboard serves `papan` and the window tells the time of day (spec 3F §3.6).
 */
export const ROOM_PARTS = {
  window: { x0: 4.5, x1: 7.2, y0: 1.0, y1: 3.4 },
  door: { z: 9.1, width: 1.3, height: 2.1 },
  corkboard: { x: 1.15, y: 2.3, size: 1.0 },
} as const

/**
 * One piece of the base furniture. `at`: centre of its footprint; `y`: what
 * it stands on (0 = the floor); `size`: width (X), height, depth (Z) before
 * its `turn` about Y (a multiple of π/2; models face +Z); `solid`: whether
 * Anda walks around it.
 */
export type Furnishing = {
  id: string
  model: ModelKey
  at: Point2
  y?: number
  size: Point3
  turn: number
  solid: boolean
  /** The hotspot this piece belongs to: nothing in the room is without a use. */
  serves: HotspotId
}

const DESK_TOP = 0.78
const SIDE_TOP = 0.6
/** The top of the armchair's seat cushion, where its cushions rest. */
const SEAT_TOP = 0.37

export const FURNITURE: ReadonlyArray<Furnishing> = [
  // The reading corner: the armchair faces the room, the fire behind it.
  {
    id: "armchair",
    model: "armchair",
    at: [3.65, 2.0],
    size: [1.3, 0.9, 1.15],
    turn: 0,
    solid: true,
    serves: "meja-baca",
  },
  // Two cushions leaning on its back: part of the chair, not on their own.
  {
    id: "cushion",
    model: "cushion",
    at: [3.49, 1.876],
    y: SEAT_TOP,
    size: [0.4, 0.33, 0.262],
    turn: 0,
    solid: false,
    serves: "meja-baca",
  },
  {
    id: "cushionSmall",
    model: "cushion",
    at: [3.86, 1.881],
    y: SEAT_TOP,
    size: [0.325, 0.267, 0.212],
    turn: 0,
    solid: false,
    serves: "meja-baca",
  },
  {
    id: "fireplace",
    model: "fireplace",
    at: [3.0, 0.3],
    size: [1.8, 1.6, 0.6],
    turn: 0,
    solid: true,
    serves: "perapian",
  },
  // Firewood beside the hearth (the mantel already holds the candles).
  {
    id: "logBasket",
    model: "logBasket",
    at: [1.47, 0.4],
    size: [0.5, 0.42, 0.4],
    turn: 0,
    solid: false,
    serves: "perapian",
  },
  {
    id: "sideTable",
    model: "sideTable",
    at: [4.75, 1.9],
    size: [0.7, SIDE_TOP, 0.7],
    turn: 0,
    solid: true,
    serves: "toko",
  },
  {
    id: "readingLamp",
    model: "readingLamp",
    at: [4.9, 1.75],
    y: SIDE_TOP,
    size: [0.36, 0.38, 0.36],
    turn: 0,
    solid: false,
    serves: "meja-baca",
  },
  {
    id: "catalogue",
    model: "catalogue",
    at: [4.63, 2.08],
    y: SIDE_TOP,
    size: [0.34, 0.2, 0.15],
    turn: 0,
    solid: false,
    serves: "toko",
  },
  // The writing desk against the shelf wall, with what a desk in use holds.
  {
    id: "desk",
    model: "desk",
    at: [1.1, 5.6],
    size: [1.8, DESK_TOP, 0.9],
    turn: Math.PI / 2,
    solid: true,
    serves: "katalog",
  },
  {
    id: "deskChair",
    model: "deskChair",
    at: [1.95, 5.6],
    size: [0.6, 1.0, 0.67],
    turn: -Math.PI / 2,
    solid: true,
    serves: "katalog",
  },
  {
    id: "laptop",
    model: "laptop",
    at: [1.1, 5.4],
    y: DESK_TOP,
    size: [0.4, 0.26, 0.3],
    turn: Math.PI / 2,
    solid: false,
    serves: "meja-admin",
  },
  {
    id: "notebook",
    model: "notebook",
    at: [1.15, 5.95],
    y: DESK_TOP,
    size: [0.24, 0.04, 0.3],
    turn: Math.PI / 2,
    solid: false,
    serves: "katalog",
  },
  {
    id: "deskLamp",
    model: "readingLamp",
    at: [0.88, 6.25],
    y: DESK_TOP,
    size: [0.3, 0.32, 0.3],
    turn: 0,
    solid: false,
    serves: "katalog",
  },
  {
    id: "deskBooks",
    model: "deskBooks",
    at: [0.8, 4.95],
    y: DESK_TOP,
    size: [0.3, 0.2, 0.14],
    turn: Math.PI / 2,
    solid: false,
    serves: "katalog",
  },
  {
    id: "mug",
    model: "mug",
    at: [1.36, 4.95],
    y: DESK_TOP,
    size: [0.12, 0.1, 0.09],
    turn: Math.PI / 2,
    solid: false,
    serves: "katalog",
  },
  {
    id: "papers",
    model: "papers",
    at: [1.25, 6.28],
    y: DESK_TOP,
    size: [0.34, 0.03, 0.26],
    turn: Math.PI / 2,
    solid: false,
    serves: "katalog",
  },
  // The parcel box by the door: new books (the trolley hotspot).
  {
    id: "parcelBox",
    model: "parcelBox",
    at: [0.8, 7.7],
    size: [0.72, 0.48, 0.5],
    turn: Math.PI / 2,
    solid: true,
    serves: "troli",
  },
  {
    id: "glassCabinet",
    model: "glassCabinet",
    at: [8.8, 0.3],
    size: [2.2, 2.2, 0.5],
    turn: 0,
    solid: true,
    serves: "lemari",
  },
]

/** A footprint on the floor, from the centre, size and quarter turn. */
export function footprint(f: { at: Point2; size: Point3; turn: number }): Box2 {
  const odd = Math.round(f.turn / (Math.PI / 2)) % 2 !== 0
  const width = odd ? f.size[2] : f.size[0]
  const depth = odd ? f.size[0] : f.size[2]
  return {
    x0: f.at[0] - width / 2,
    x1: f.at[0] + width / 2,
    z0: f.at[1] - depth / 2,
    z1: f.at[1] + depth / 2,
  }
}

/** The wall of shelves on X = 0: `rows` shelves from `bottom` to `top`, sections from z0. */
export const SHELF = {
  depth: 0.45,
  bottom: 0.15,
  top: 3.6,
  rows: 5,
  z0: 0.5,
} as const
const SECTION_WIDTH = 0.95

/** One shelf section per genre, in the order of GENRE_VALUES (spec 3F §3.2). */
export const WALL_SECTIONS: ReadonlyArray<{
  genre: Genre
  z: number
  width: number
}> = GENRE_VALUES.map((genre, i) => ({
  genre,
  z: SHELF.z0 + SECTION_WIDTH * (i + 0.5),
  width: SECTION_WIDTH,
}))

/**
 * The glass cabinet of finished books (spec Tahap 3 §4.5), against the
 * window wall. Its local front faces +Z before SHOWCASE_TURN.
 */
export const SHOWCASE: Point2 = [8.8, 0.3]
export const SHOWCASE_SIZE = { width: 2.2, height: 2.2, depth: 0.5 } as const
export const SHOWCASE_TURN = 0
/** The top of each shelf a cover stands on, from the floor up. */
export const SHOWCASE_SHELVES = [0.12, 0.8, 1.48] as const
export const SHOWCASE_SLOTS = 12
/** A finished book on display: its cover, or a coloured face without one. */
export type ShowcaseBook = { id: string; coverUrl: string | null; hue: number }

/**
 * Where each cover stands, the newest first: top shelf, left to right. World
 * points; the covers stand inside the cabinet, behind its glass. Pure.
 */
export function showcaseSlots(): Array<Point3> {
  const [cx, cz] = SHOWCASE
  const dz = SHOWCASE_SIZE.depth / 2 - 0.12
  const cos = Math.cos(SHOWCASE_TURN)
  const sin = Math.sin(SHOWCASE_TURN)
  return [...SHOWCASE_SHELVES].reverse().flatMap((y) =>
    [0, 1, 2, 3].map((i): Point3 => {
      const dx = (i - 1.5) * 0.5
      // A turn about Y: local +Z goes to (sin, cos).
      return [cx + dx * cos + dz * sin, y, cz - dx * sin + dz * cos]
    })
  )
}

/** The habit plant (spec 3B §4.1): a pot under the window. */
export const PLANT: Point2 = [6.2, 0.8]
export const PLANT_POT = { width: 0.7, height: 0.6 } as const

/** What grows on the stem at each stage, in metres before the plant's scale. */
export const PLANT_SHAPES: Record<
  PlantStage,
  { stem: number; leaves: number; buds: number; flowers: number }
> = {
  biji: { stem: 0, leaves: 0, buds: 0, flowers: 0 },
  tunas: { stem: 0.18, leaves: 2, buds: 0, flowers: 0 },
  daun: { stem: 0.4, leaves: 4, buds: 0, flowers: 0 },
  rimbun: { stem: 0.6, leaves: 8, buds: 0, flowers: 0 },
  kuncup: { stem: 0.7, leaves: 9, buds: 3, flowers: 0 },
  berbunga: { stem: 0.75, leaves: 10, buds: 0, flowers: 4 },
}

const raised = (at: Point3, y: number): Point3 => [at[0], y, at[2]]

const SLOT_AT: Record<SlotId, Point3> = {
  rug: [5.6, 0, 5.6],
  lamp: [9.25, 0, 3.4],
  // The lounge seat in the room, apart from the reading armchair.
  seat: [7.6, 0, 3.4],
  // Above the mantelpiece.
  wall: [3.0, 2.7, 0.06],
  // In front of the reading corner, where the seat does not hide it.
  pet: [5.6, 0, 3.2],
  ceiling: [5.4, 3.9, 5.4],
}

/**
 * The shop's slots (spec 3C §4, 3F §3.3). `at`: the item's origin, on the
 * floor, the wall or under the ceiling; `turn`: its turn about Y (items are
 * built facing +Z); `flat`: lies or hangs out of Anda's way; `focus`: where
 * the camera looks for a preview.
 */
export const DECOR_SLOTS: Record<
  SlotId,
  { at: Point3; turn: number; flat: boolean; focus: Point3 }
> = {
  rug: {
    at: SLOT_AT.rug,
    turn: 0,
    flat: true,
    focus: raised(SLOT_AT.rug, 0.3),
  },
  lamp: {
    at: SLOT_AT.lamp,
    turn: 0,
    flat: false,
    focus: raised(SLOT_AT.lamp, 1.0),
  },
  seat: {
    at: SLOT_AT.seat,
    turn: 0,
    flat: false,
    focus: raised(SLOT_AT.seat, 0.5),
  },
  wall: { at: SLOT_AT.wall, turn: 0, flat: true, focus: SLOT_AT.wall },
  pet: {
    at: SLOT_AT.pet,
    turn: 0,
    flat: false,
    focus: raised(SLOT_AT.pet, 0.4),
  },
  ceiling: {
    at: SLOT_AT.ceiling,
    turn: 0,
    flat: true,
    focus: SLOT_AT.ceiling,
  },
}

/** The largest footprint an item in each slot takes (for the collision tests). */
export const DECOR_SIZES: Record<SlotId, Point3> = {
  rug: [2, 0.02, 1.4],
  lamp: [0.5, 1.7, 0.5],
  seat: [2, 0.9, 0.9],
  wall: [1.2, 1, 0.1],
  pet: [0.8, 0.8, 0.8],
  ceiling: [0.8, 0.8, 0.8],
}

/** How far right the camera moves past a slot, so it shows beside the shop panel. */
export const PREVIEW_SHIFT = 0.16

/** Where "Anda" stands on a first visit, and how much room they take. */
export const ANDA_START: Point2 = [6.6, 7.8]
export const ANDA_RADIUS = 0.3

/** The laptop on the writing desk; the sign-in pages zoom the still image here. */
export const ADMIN_DESK: Point2 = [1.1, 5.4]

/** Where Anda may walk: the floor, clear of the shelf wall. */
export const WALK_BOUNDS: Box2 = { x0: 0.5, x1: 10, z0: 0.5, z1: 10 }

/** The base furniture (the cabinet included) and the plant pot. Never the decor. */
export function walkBlockers(): Array<Box2> {
  const [px, pz] = PLANT
  const half = PLANT_POT.width / 2
  return [
    ...FURNITURE.filter((f) => f.solid).map(footprint),
    { x0: px - half, x1: px + half, z0: pz - half, z1: pz + half },
  ]
}

/** The decor slots that stand on the floor (Task 6 adds them when filled). */
export function decorBlockers(): Array<Box2> {
  return (Object.keys(DECOR_SLOTS) as Array<SlotId>)
    .filter((slot) => !DECOR_SLOTS[slot].flat)
    .map((slot) => {
      const { at, turn } = DECOR_SLOTS[slot]
      return footprint({ at: [at[0], at[2]], size: DECOR_SIZES[slot], turn })
    })
}

export type HotspotId =
  | Genre
  | "meja-baca"
  | "meja-admin"
  | "troli"
  | "katalog"
  | "lemari"
  | "tanaman"
  | "toko"
  | "perapian"
  | "papan"
  | "pintu"
/** `label`: where the hotspot's label floats. `stand`: where "Anda" walks to. */
export type HotspotSpot = { id: HotspotId; label: Point3; stand: Point2 }

/** In tab order (spec 1D §6): reading chair, shelf sections, parcel box, laptop, notebook, cabinet, plant, catalogue, fireplace, corkboard, door. */
export const HOTSPOT_SPOTS: ReadonlyArray<HotspotSpot> = [
  { id: "meja-baca", label: [3.65, 1.9, 2.0], stand: [3.65, 3.3] },
  ...WALL_SECTIONS.map(({ genre, z }): HotspotSpot => ({
    id: genre,
    label: [0.4, 3.9, z],
    stand: [2.65, z],
  })),
  { id: "troli", label: [0.8, 1.0, 7.7], stand: [1.9, 7.7] },
  { id: "meja-admin", label: [1.1, 1.4, 5.3], stand: [2.65, 5.1] },
  { id: "katalog", label: [1.1, 1.4, 6.3], stand: [2.65, 6.4] },
  { id: "lemari", label: [8.8, 2.5, 0.3], stand: [8.8, 1.9] },
  { id: "tanaman", label: [6.2, 1.9, 0.8], stand: [6.2, 2.0] },
  { id: "toko", label: [4.75, 1.2, 1.9], stand: [4.75, 3.0] },
  { id: "perapian", label: [3.0, 2.4, 0.35], stand: [4.5, 0.95] },
  {
    id: "papan",
    label: [ROOM_PARTS.corkboard.x, ROOM_PARTS.corkboard.y + 0.7, 0.1],
    stand: [ROOM_PARTS.corkboard.x, 1.6],
  },
  {
    id: "pintu",
    label: [0.1, 2.4, ROOM_PARTS.door.z],
    stand: [1.4, ROOM_PARTS.door.z],
  },
]

export function spotOf(id: HotspotId): HotspotSpot {
  const spot = HOTSPOT_SPOTS.find((candidate) => candidate.id === id)
  if (!spot) throw new Error(`No hotspot ${id}`)
  return spot
}
