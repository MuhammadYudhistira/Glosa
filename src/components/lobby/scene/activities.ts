import type { Genre } from "@/lib/genre"
import { GENRE_VALUES } from "@/lib/genre"
import {
  FURNITURE,
  type HotspotId,
  PLANT,
  type Point2,
  ROOM_PARTS,
  SHOWCASE,
  WALL_SECTIONS,
} from "./layout"

export type ActivityId =
  | "duduk-baca"
  | "ambil-buku"
  | "bungkuk"
  | "menulis"
  | "mengetik"
  | "buka-lemari"
  | "menyiram"
  | "buka-katalog"
  | "hangatkan"
  | "lihat-papan"
  | "pegang-pintu"

export const WALK_SPEED = 1.4
export const WALK_MAX_SECONDS = 0.9
export const ACTIVITY_SECONDS = 0.6

/** Long paths speed up so the walk ends within 0.9 s (spec 3F §4A.1). */
export function walkSpeed(length: number): number {
  return Math.max(WALK_SPEED, length / WALK_MAX_SECONDS)
}

const GENRES = Object.fromEntries(
  GENRE_VALUES.map((genre) => [genre, "ambil-buku"])
) as Record<Genre, ActivityId>

export const ACTIVITY_OF: Record<HotspotId, ActivityId> = {
  ...GENRES,
  "meja-baca": "duduk-baca",
  troli: "bungkuk",
  katalog: "menulis",
  "meja-admin": "mengetik",
  lemari: "buka-lemari",
  tanaman: "menyiram",
  toko: "buka-katalog",
  perapian: "hangatkan",
  papan: "lihat-papan",
  pintu: "pegang-pintu",
}

const at = (id: string): Point2 => {
  const piece = FURNITURE.find((f) => f.id === id)
  if (!piece) throw new Error(`No furniture ${id}`)
  return piece.at
}

export function facingOf(id: HotspotId): Point2 {
  switch (id) {
    case "meja-baca":
      return at("armchair")
    case "troli":
      return at("parcelBox")
    case "katalog":
      return at("notebook")
    case "meja-admin":
      return at("laptop")
    case "lemari":
      return SHOWCASE
    case "tanaman":
      return PLANT
    case "toko":
      return at("catalogue")
    case "perapian":
      return at("fireplace")
    case "papan":
      return [ROOM_PARTS.corkboard.x, 0]
    case "pintu":
      return [0, ROOM_PARTS.door.z]
    default: {
      const section = WALL_SECTIONS.find(({ genre }) => genre === id)
      if (!section) throw new Error(`No section ${id}`)
      return [0, section.z]
    }
  }
}

export type Pose = {
  drop: number
  lean: number
  head: number
  arms: readonly [number, number]
  hips: readonly [number, number]
  knees: readonly [number, number]
}

export const STAND: Pose = {
  drop: 0,
  lean: 0,
  head: 0,
  arms: [0, 0],
  hips: [0, 0],
  knees: [0, 0],
}

/** Starting values; tune by eye in the harness (Task 2), the tests only check the shape. */
export const POSES: Record<ActivityId, Pose> = {
  "duduk-baca": {
    drop: 0.42,
    lean: -0.15,
    head: 0.35,
    arms: [0.9, 0.9],
    hips: [1.5, 1.5],
    knees: [1.5, 1.5],
  },
  "ambil-buku": {
    drop: 0,
    lean: -0.1,
    head: -0.35,
    arms: [0, 2.6],
    hips: [0, 0],
    knees: [0, 0],
  },
  bungkuk: {
    drop: 0.1,
    lean: 0.8,
    head: 0.3,
    arms: [1.0, 1.0],
    hips: [0.4, 0.4],
    knees: [0.3, 0.3],
  },
  menulis: {
    drop: 0.42,
    lean: 0.25,
    head: 0.5,
    arms: [0.7, 1.1],
    hips: [1.5, 1.5],
    knees: [1.5, 1.5],
  },
  mengetik: {
    drop: 0.42,
    lean: 0.2,
    head: 0.35,
    arms: [1.1, 1.1],
    hips: [1.5, 1.5],
    knees: [1.5, 1.5],
  },
  "buka-lemari": {
    drop: 0,
    lean: 0.05,
    head: 0,
    arms: [0.2, 1.4],
    hips: [0, 0],
    knees: [0, 0],
  },
  menyiram: {
    drop: 0,
    lean: 0.35,
    head: 0.4,
    arms: [0.3, 1.2],
    hips: [0.1, 0.1],
    knees: [0.1, 0.1],
  },
  "buka-katalog": {
    drop: 0,
    lean: 0.1,
    head: 0.45,
    arms: [1.0, 1.0],
    hips: [0, 0],
    knees: [0, 0],
  },
  hangatkan: {
    drop: 0.3,
    lean: 0.3,
    head: 0.1,
    arms: [1.3, 1.3],
    hips: [1.2, 1.2],
    knees: [2.0, 2.0],
  },
  "lihat-papan": {
    drop: 0,
    lean: 0,
    head: -0.2,
    arms: [0, 1.8],
    hips: [0, 0],
    knees: [0, 0],
  },
  "pegang-pintu": {
    drop: 0,
    lean: 0.05,
    head: 0,
    arms: [0, 1.3],
    hips: [0, 0],
    knees: [0, 0],
  },
}

export const HELD: Partial<Record<ActivityId, "buku" | "kaleng" | "katalog">> =
  {
    "duduk-baca": "buku",
    "ambil-buku": "buku",
    menyiram: "kaleng",
    "buka-katalog": "katalog",
  }

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)
const mix = (a: number, b: number, k: number) => a + (b - a) * k
const pair = (
  a: readonly [number, number],
  b: readonly [number, number],
  k: number
) => [mix(a[0], b[0], k), mix(a[1], b[1], k)] as const

export function poseAt(activity: ActivityId, t: number): Pose {
  const target = POSES[activity]
  if (t <= 0) return STAND
  if (t >= 1) return target
  const k = ease(t)
  return {
    drop: mix(STAND.drop, target.drop, k),
    lean: mix(STAND.lean, target.lean, k),
    head: mix(STAND.head, target.head, k),
    arms: pair(STAND.arms, target.arms, k),
    hips: pair(STAND.hips, target.hips, k),
    knees: pair(STAND.knees, target.knees, k),
  }
}
