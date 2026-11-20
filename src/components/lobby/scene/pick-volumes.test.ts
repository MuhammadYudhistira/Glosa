import { describe, expect, it } from "vitest"
import {
  HOTSPOT_SPOTS,
  ROOM,
  SHELF,
  WALL_SECTIONS,
  type Point3,
} from "./layout"
import {
  PICK_VOLUMES,
  type PickVolume,
  anchorOf,
  volumesOf,
} from "./pick-volumes"

const inside = (point: Point3, v: PickVolume) =>
  [0, 1, 2].every((k) => point[k] >= v.min[k] && point[k] <= v.max[k])
const contains = (a: PickVolume, b: PickVolume) =>
  [0, 1, 2].every((k) => a.min[k] <= b.min[k] && a.max[k] >= b.max[k])

describe("pick volumes", () => {
  it("give every place a box, and one main box at least", () => {
    for (const { id } of HOTSPOT_SPOTS) {
      expect(volumesOf(id).length, id).toBeGreaterThan(0)
      expect(volumesOf(id).filter((v) => v.main).length, id).toBeGreaterThan(0)
    }
  })

  it("follow the genre sections of the shelf wall, one each", () => {
    for (const { genre, z, width } of WALL_SECTIONS) {
      const boxes = volumesOf(genre)
      expect(boxes).toHaveLength(1)
      expect(boxes[0].min).toEqual([0, SHELF.bottom, z - width / 2])
      expect(boxes[0].max).toEqual([SHELF.depth, SHELF.top, z + width / 2])
    }
  })

  it("stay inside the room, to within the tap padding", () => {
    for (const v of PICK_VOLUMES) {
      expect(v.min[0], v.id).toBeGreaterThanOrEqual(-0.2)
      expect(v.min[1], v.id).toBeGreaterThanOrEqual(0)
      expect(v.min[2], v.id).toBeGreaterThanOrEqual(-0.2)
      expect(v.max[0], v.id).toBeLessThanOrEqual(ROOM.width + 0.2)
      expect(v.max[1], v.id).toBeLessThanOrEqual(ROOM.height)
      expect(v.max[2], v.id).toBeLessThanOrEqual(ROOM.depth + 0.2)
    }
  })

  it("never hide a place of one kind wholly inside another's box", () => {
    const hidden = PICK_VOLUMES.flatMap((a) =>
      PICK_VOLUMES.filter((b) => a.id !== b.id && contains(a, b)).map(
        (b) => `${b.id} in ${a.id}`
      )
    )
    expect(hidden).toEqual([])
  })

  it("anchor each place inside one of its own boxes", () => {
    for (const { id } of HOTSPOT_SPOTS) {
      expect(
        volumesOf(id).some((v) => inside(anchorOf(id), v)),
        id
      ).toBe(true)
    }
  })
})
