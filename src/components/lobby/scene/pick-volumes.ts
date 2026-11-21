import {
  FURNITURE,
  type Furnishing,
  type HotspotId,
  PLANT,
  PLANT_POT,
  type Point3,
  ROOM_PARTS,
  SHELF,
  WALL_SECTIONS,
  footprint,
  pointOf,
} from "./layout"

/**
 * One box that answers a tap (spec 3G §4): the place it belongs to, and
 * whether it is a main box (a small piece is only part of a place's hit
 * area, and never where the button or the dot sits).
 */
export type PickVolume = {
  id: HotspotId
  min: Point3
  max: Point3
  main: boolean
}

/** A piece whose largest side is below this gets TAP_PAD all round: a finger is wider than a mug. */
const SMALL_PIECE = 0.6
const TAP_PAD = 0.15
/** A piece smaller than this in every side is not a main box. */
const MAIN_MIN = 0.35
/** How thick the door and the corkboard are as boxes in their wall. */
const WALL_DEPTH = 0.15
const PLANT_HEIGHT = 1.6

function furnishingVolume(piece: Furnishing): PickVolume {
  const { x0, x1, z0, z1 } = footprint(piece)
  const base = piece.y ?? 0
  const largest = Math.max(...piece.size)
  const pad = largest < SMALL_PIECE ? TAP_PAD : 0
  return {
    id: piece.serves,
    min: [x0 - pad, Math.max(0, base - pad), z0 - pad],
    max: [x1 + pad, base + piece.size[1] + pad, z1 + pad],
    main: largest >= MAIN_MIN,
  }
}

const { door, corkboard } = ROOM_PARTS
const [plantX, plantZ] = PLANT
const plantHalf = PLANT_POT.width / 2

export const PICK_VOLUMES: ReadonlyArray<PickVolume> = [
  // The furniture, each piece for the place it serves (layout.ts: `serves`).
  ...FURNITURE.map(furnishingVolume),
  // One box per genre section of the shelf wall.
  ...WALL_SECTIONS.map(({ genre, z, width }): PickVolume => ({
    id: genre,
    min: [0, SHELF.bottom, z - width / 2],
    max: [SHELF.depth, SHELF.top, z + width / 2],
    main: true,
  })),
  // The door in the shelf wall (X = 0).
  {
    id: "pintu",
    min: [0, 0, door.z - door.width / 2],
    max: [WALL_DEPTH, door.height, door.z + door.width / 2],
    main: true,
  },
  // The corkboard on the window wall (Z = 0).
  {
    id: "papan",
    min: [
      corkboard.x - corkboard.width / 2,
      corkboard.y - corkboard.size / 2,
      0,
    ],
    max: [
      corkboard.x + corkboard.width / 2,
      corkboard.y + corkboard.size / 2,
      WALL_DEPTH,
    ],
    main: true,
  },
  // The habit plant and its pot.
  {
    id: "tanaman",
    min: [plantX - plantHalf, 0, plantZ - plantHalf],
    max: [plantX + plantHalf, PLANT_HEIGHT, plantZ + plantHalf],
    main: true,
  },
]

export function volumesOf(id: HotspotId): Array<PickVolume> {
  return PICK_VOLUMES.filter((volume) => volume.id === id)
}

const sizeOf = (v: PickVolume) =>
  (v.max[0] - v.min[0]) * (v.max[1] - v.min[1]) * (v.max[2] - v.min[2])

/**
 * Where a place's invisible button and its still-image dot sit: the middle of
 * its biggest main box, which always lies inside the place's hit area.
 */
export function anchorOf(id: HotspotId): Point3 {
  const boxes = volumesOf(id).filter((volume) => volume.main)
  const biggest = boxes.reduce((a, b) => (sizeOf(b) > sizeOf(a) ? b : a))
  return pointOf((k) => (biggest.min[k] + biggest.max[k]) / 2)
}
