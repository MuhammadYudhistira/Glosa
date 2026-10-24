import type { Genre } from "@/lib/genre"

/**
 * The lobby's world, in metres (spec 1D §4). X runs along the glass wall
 * (Z = 0), Z along the left shelf wall (X = 0), Y up. The camera looks from
 * +X +Z. Pure data: no three.js, so tests and the hotspot layer can use it.
 */
export type Point2 = readonly [number, number]
export type Point3 = readonly [number, number, number]

/**
 * `front`: how far the floor in front of the open room counts as part of the
 * map. `edge`: how far the screen stays from the map's edges.
 */
export const ATRIUM = { size: 34, height: 13.5, front: 6, edge: 0.25 } as const
export const GLASS = { x0: 17, x1: 34, y0: 0, y1: ATRIUM.height } as const
/** The box of shelves floating above the stairs. */
export const BOX = {
  x0: 1.5,
  x1: 9.5,
  z0: 1.5,
  z1: 9.5,
  y0: 8.4,
  y1: 12.9,
} as const
/** Bleacher stairs rising toward the glass wall. */
export const STAIRS = {
  x0: 1.5,
  x1: 9.5,
  z1: 10.2,
  steps: 10,
  rise: 0.46,
  run: 0.92,
} as const
export const TOWER = { width: 2.4, height: 5.4 } as const

/** One shelf tower per genre, in the order of GENRE_VALUES (spec 1D §4). */
export const ZONES: ReadonlyArray<{ genre: Genre; at: Point2 }> = [
  { genre: "fiksi_sastra", at: [13, 6.5] },
  { genre: "fantasi_petualangan", at: [6.5, 14.5] },
  { genre: "misteri_thriller", at: [13, 12.5] },
  { genre: "anak_remaja", at: [6.5, 20] },
  { genre: "sains_teknologi", at: [13, 18.5] },
  { genre: "sejarah_budaya", at: [19.5, 14] },
  { genre: "bisnis_pengembangan_diri", at: [24.5, 18] },
  { genre: "lainnya", at: [19.5, 20.5] },
]
export const READING_TABLE: Point2 = [19.5, 26]
export const ADMIN_DESK: Point2 = [5.5, 25.5]
export const TROLLEY: Point2 = [9, 26.8]

/**
 * The card catalogue that opens Kosakata (spec 2 §6.4), against the left wall
 * by the admin desk: nothing tall stands between it and the camera.
 */
export const CARD_CATALOG: Point2 = [1.0, 22.5]
/** Readers seated at the long table, facing along +Z (0) or −Z (π). */
export const READERS: ReadonlyArray<{ at: Point2; facing: number }> = [
  { at: [18.4, 25], facing: 0 },
  { at: [21.2, 27], facing: Math.PI },
  { at: [16.6, 27], facing: Math.PI },
]
export const LIBRARIAN: Point2 = [4.9, 24.7]
/** Two lounges at the front of the atrium (spec 1D §2, decision 9). */
export const LOUNGES: ReadonlyArray<{ at: Point2; color: string }> = [
  { at: [16.5, 31], color: "#d9c2a3" },
  { at: [27.5, 30.2], color: "#9c6b5a" },
]
/** Where "Anda" stands on a first visit. */
export const ANDA_START: Point2 = [11.5, 29.5]

/** Walkers loop through these points: [x, z, seconds to pause there]. */
export const WALKER_ROUTES: ReadonlyArray<{
  points: ReadonlyArray<readonly [number, number, number]>
  speed: number
}> = [
  {
    points: [
      [16, 9.5, 2],
      [16, 23, 0],
      [23, 23, 2.5],
      [23, 9.5, 0],
    ],
    speed: 0.9,
  },
  {
    points: [
      [10, 16, 1.5],
      [16.3, 16, 0],
      [16.3, 22, 2],
      [10, 22, 0],
    ],
    speed: 0.75,
  },
  {
    points: [
      [21.5, 2.2, 3],
      [28, 2.2, 0],
      [28, 11.5, 2],
      [21.5, 11.5, 0],
    ],
    speed: 0.7,
  },
  {
    points: [
      [3, 12, 0],
      [3, 23, 2],
      [9.8, 23, 0],
      [9.8, 12.5, 1.5],
    ],
    speed: 0.8,
  },
  {
    points: [
      [26.5, 15, 0],
      [26.5, 28, 2.5],
      [21.5, 28.2, 0],
      [21.5, 33, 2],
      [12, 33, 0],
      [12, 23.5, 1],
      [26.5, 23.2, 0],
    ],
    speed: 0.85,
  },
]

/**
 * A wall of glowing cubbies. `origin` is its bottom-left corner on the wall,
 * `along` the horizontal direction along it, `into` the direction into the room.
 */
export type ShelfFace = {
  origin: Point3
  along: Point3
  into: Point3
  width: number
  height: number
  glow: number
}

const PLUS_X: Point3 = [1, 0, 0]
const PLUS_Z: Point3 = [0, 0, 1]
const MINUS_Z: Point3 = [0, 0, -1]

export const SHELF_FACES: ReadonlyArray<ShelfFace> = [
  // Left wall (X = 0): cubbies the whole way.
  {
    origin: [0, 0, ATRIUM.size],
    along: MINUS_Z,
    into: PLUS_X,
    width: ATRIUM.size,
    height: ATRIUM.height,
    glow: 0.8,
  },
  // Right wall (Z = 0): cubbies up to the glass curtain wall.
  {
    origin: [0, 0, 0],
    along: PLUS_X,
    into: PLUS_Z,
    width: GLASS.x0 - 0.4,
    height: ATRIUM.height,
    glow: 0.8,
  },
  // The two visible sides of the floating box.
  {
    origin: [BOX.x1, BOX.y0, BOX.z1],
    along: MINUS_Z,
    into: PLUS_X,
    width: BOX.z1 - BOX.z0,
    height: BOX.y1 - BOX.y0,
    glow: 0.9,
  },
  {
    origin: [BOX.x0, BOX.y0, BOX.z1],
    along: PLUS_X,
    into: PLUS_Z,
    width: BOX.x1 - BOX.x0,
    height: BOX.y1 - BOX.y0,
    glow: 0.9,
  },
  // The two visible sides of every tower.
  ...ZONES.flatMap(({ at: [x, z] }): Array<ShelfFace> => {
    const half = TOWER.width / 2
    const height = TOWER.height - 0.2
    return [
      {
        origin: [x + half, 0.1, z + half],
        along: MINUS_Z,
        into: PLUS_X,
        width: TOWER.width,
        height,
        glow: 0.9,
      },
      {
        origin: [x - half, 0.1, z + half],
        along: PLUS_X,
        into: PLUS_Z,
        width: TOWER.width,
        height,
        glow: 0.9,
      },
    ]
  }),
]

export type HotspotId = Genre | "meja-baca" | "meja-admin" | "troli" | "katalog"
/** `label`: where the hotspot's label floats. `stand`: where "Anda" walks to. */
export type HotspotSpot = { id: HotspotId; label: Point3; stand: Point2 }

/** In tab order (spec 1D §6): reading table, zones, trolley, admin desk, card catalogue. */
export const HOTSPOT_SPOTS: ReadonlyArray<HotspotSpot> = [
  { id: "meja-baca", label: [19.5, 2.2, 26], stand: [19.5, 28.2] },
  ...ZONES.map(({ genre, at: [x, z] }): HotspotSpot => ({
    id: genre,
    label: [x, TOWER.height + 0.7, z],
    stand: [x + 1.9, z + 1.9],
  })),
  { id: "troli", label: [9, 1.9, 26.8], stand: [10.5, 28.3] },
  { id: "meja-admin", label: [5.5, 2.8, 25.5], stand: [7.5, 27.8] },
  { id: "katalog", label: [1.0, 2.1, 22.5], stand: [2.8, 23.4] },
]

export function spotOf(id: HotspotId): HotspotSpot {
  const spot = HOTSPOT_SPOTS.find((candidate) => candidate.id === id)
  if (!spot) throw new Error(`No hotspot ${id}`)
  return spot
}
