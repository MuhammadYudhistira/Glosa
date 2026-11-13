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
import { FURNITURE, HOTSPOT_SPOTS, ROOM, footprint } from "./layout"

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
