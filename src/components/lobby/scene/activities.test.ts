import { describe, expect, it } from "vitest"
import { GENRE_VALUES } from "@/lib/genre"
import {
  ACTIVITY_OF,
  ACTIVITY_SECONDS,
  POSES,
  STAND,
  WALK_MAX_SECONDS,
  WALK_SPEED,
  facingOf,
  poseAt,
  seatOf,
  walkSpeed,
} from "./activities"
import {
  ANDA_RADIUS,
  ANDA_START,
  FURNITURE,
  HOTSPOT_SPOTS,
  type HotspotId,
  PLANT,
  type Point2,
  ROOM,
  ROOM_PARTS,
  SHELF,
  SHOWCASE,
  WALK_BOUNDS,
  WALL_SECTIONS,
  footprint,
  spotOf,
  walkBlockers,
} from "./layout"
import { findPath, walkable } from "./walk"

describe("activities", () => {
  it("gives every hotspot an activity (spec 3F §4A.1)", () => {
    for (const { id } of HOTSPOT_SPOTS)
      expect(ACTIVITY_OF[id], id).toBeDefined()
    for (const genre of GENRE_VALUES)
      expect(ACTIVITY_OF[genre]).toBe("ambil-buku")
    expect(ACTIVITY_OF["meja-baca"]).toBe("duduk-baca")
    expect(ACTIVITY_OF.tanaman).toBe("menyiram")
    expect(ACTIVITY_OF.perapian).toBe("hangatkan")
    expect(ACTIVITY_OF.papan).toBe("lihat-papan")
    expect(ACTIVITY_OF.pintu).toBe("pegang-pintu")
  })

  it("faces a point inside the room, away from where Anda stands", () => {
    for (const { id, stand } of HOTSPOT_SPOTS) {
      const [x, z] = facingOf(id)
      expect(x, id).toBeGreaterThanOrEqual(0)
      expect(x, id).toBeLessThanOrEqual(ROOM.width)
      expect(z, id).toBeGreaterThanOrEqual(0)
      expect(z, id).toBeLessThanOrEqual(ROOM.depth)
      expect(Math.hypot(x - stand[0], z - stand[1]), id).toBeGreaterThan(0.2)
    }
  })

  it("walks at least at 1.4 m/s and never longer than 0.9 s", () => {
    expect(walkSpeed(0.5)).toBe(WALK_SPEED)
    expect(walkSpeed(9) * WALK_MAX_SECONDS).toBeCloseTo(9)
    for (const length of [0.1, 1, 3, 12]) {
      expect(length / walkSpeed(length)).toBeLessThanOrEqual(
        WALK_MAX_SECONDS + 1e-9
      )
    }
    expect(WALK_MAX_SECONDS + ACTIVITY_SECONDS).toBeLessThanOrEqual(1.5)
  })

  it("blends from standing to the pose", () => {
    expect(poseAt("menyiram", 0)).toEqual(STAND)
    expect(poseAt("menyiram", 1)).toEqual(POSES.menyiram)
    const half = poseAt("duduk-baca", 0.5)
    expect(half.drop).toBeGreaterThan(0)
    expect(half.drop).toBeLessThan(POSES["duduk-baca"].drop)
    expect(poseAt("duduk-baca", 2)).toEqual(POSES["duduk-baca"])
  })

  it("sits lower than it crouches, and stands for the door", () => {
    expect(POSES["duduk-baca"].drop).toBeGreaterThan(0.3)
    expect(POSES.hangatkan.drop).toBeGreaterThan(0.2)
    expect(POSES["pegang-pintu"].drop).toBe(0)
  })

  it("sits in the armchair and on the desk chair, everywhere else at the stand point", () => {
    const inside = (
      id: "meja-baca" | "katalog" | "meja-admin",
      chair: string
    ) => {
      const seat = seatOf(id)
      const piece = FURNITURE.find((f) => f.id === chair)
      expect(seat, id).not.toBeNull()
      const box = footprint(piece!)
      expect(seat![0], id).toBeGreaterThan(box.x0)
      expect(seat![0], id).toBeLessThan(box.x1)
      expect(seat![1], id).toBeGreaterThan(box.z0)
      expect(seat![1], id).toBeLessThan(box.z1)
    }
    inside("meja-baca", "armchair")
    inside("katalog", "deskChair")
    inside("meja-admin", "deskChair")
    for (const { id } of HOTSPOT_SPOTS) {
      if (id === "meja-baca" || id === "katalog" || id === "meja-admin")
        continue
      expect(seatOf(id), id).toBeNull()
    }
    // The armchair faces the room: seated in it, so does Anda.
    expect(facingOf("meja-baca")[1]).toBeGreaterThan(seatOf("meja-baca")![1])
  })
})

describe("where Anda stands for each hotspot", () => {
  const piece = (id: string) => FURNITURE.find((f) => f.id === id)!
  const angle = (a: Point2, b: Point2) => {
    const turn = Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0])
    return Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn)))
  }
  const toward = (from: Point2, to: Point2): Point2 => [
    to[0] - from[0],
    to[1] - from[1],
  ]
  const DEG = Math.PI / 180

  /** What each standing activity is done to: its centre and, against a wall, its front. */
  const OBJECTS: Partial<Record<HotspotId, { at: Point2; front?: Point2 }>> = {
    ...Object.fromEntries(
      WALL_SECTIONS.map(({ genre, z }) => [
        genre,
        { at: [SHELF.depth, z] as Point2, front: [1, 0] as Point2 },
      ])
    ),
    troli: { at: piece("parcelBox").at },
    lemari: { at: SHOWCASE, front: [0, 1] },
    tanaman: { at: PLANT },
    toko: { at: piece("catalogue").at },
    perapian: { at: piece("fireplace").at, front: [0, 1] },
    papan: { at: [ROOM_PARTS.corkboard.x, 0], front: [0, 1] },
    pintu: { at: [0, ROOM_PARTS.door.z], front: [1, 0] },
  }

  it("covers every hotspot Anda stands at (the seated ones sit in their chair)", () => {
    for (const { id } of HOTSPOT_SPOTS) {
      if (seatOf(id)) continue
      expect(OBJECTS[id], id).toBeDefined()
    }
  })

  it("stands on clear, walkable floor: off the furniture and off what lies on the floor", () => {
    const blocked = walkBlockers()
    // Things on the floor or the hearth that Anda may not walk around
    // (the log basket): standing on one is the bug the owner saw.
    const low = FURNITURE.filter((f) => !f.solid && (f.y ?? 0) < 0.3)
    for (const { id, stand } of HOTSPOT_SPOTS) {
      expect(walkable(stand, WALK_BOUNDS, blocked, ANDA_RADIUS), id).toBe(true)
      expect(
        findPath(ANDA_START, stand, WALK_BOUNDS, blocked, ANDA_RADIUS).length,
        id
      ).toBeGreaterThan(0)
      for (const f of low) {
        expect(
          walkable(stand, WALK_BOUNDS, [footprint(f)], 0.2),
          `${id} on ${f.id}`
        ).toBe(true)
      }
    }
  })

  it("faces the hotspot's object, and faces a wall's object from its front", () => {
    for (const { id, stand } of HOTSPOT_SPOTS) {
      const object = OBJECTS[id]
      if (!object) continue
      const facing = toward(stand, facingOf(id))
      expect(angle(facing, toward(stand, object.at)), id).toBeLessThan(15 * DEG)
      if (object.front) {
        // Not from the side (the review note "perapian is faced from the side").
        expect(angle(object.front, toward(object.at, stand)), id).toBeLessThan(
          40 * DEG
        )
      }
    }
  })

  it("reaches each shelf section across nothing taller than the waist, a step from it", () => {
    const tall = FURNITURE.filter(
      (f) => f.solid && (f.y ?? 0) + f.size[1] > 0.6
    )
    for (const { genre, z } of WALL_SECTIONS) {
      const { stand } = spotOf(genre)
      expect(stand[1], genre).toBe(z)
      expect(stand[0] - SHELF.depth, genre).toBeLessThanOrEqual(1)
      for (let t = 0; t <= 1; t += 0.02) {
        const p: Point2 = [stand[0] + (SHELF.depth - stand[0]) * t, stand[1]]
        for (const f of tall) {
          expect(
            walkable(p, { x0: 0, x1: 10, z0: 0, z1: 10 }, [footprint(f)], 0),
            `${genre} across ${f.id}`
          ).toBe(true)
        }
      }
    }
  })
})
