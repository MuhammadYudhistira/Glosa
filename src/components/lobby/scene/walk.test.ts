import { describe, expect, it } from "vitest"
import { type Box2, findPath, walkable } from "./walk"

const bounds: Box2 = { x0: 0, x1: 10, z0: 0, z1: 10 }
const wall: Box2 = { x0: 4, x1: 5, z0: 0, z1: 8 }

function crosses(
  path: Array<readonly [number, number]>,
  from: readonly [number, number],
  box: Box2
) {
  const points = [from, ...path]
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1]
    const [bx, bz] = points[i]
    for (let t = 0; t <= 1; t += 0.02) {
      const x = ax + (bx - ax) * t
      const z = az + (bz - az) * t
      if (x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1) return true
    }
  }
  return false
}

/** Every leg of from -> path stays off the radius-inflated boxes and in bounds. */
function expectLegsClear(
  from: readonly [number, number],
  path: Array<readonly [number, number]>,
  boxes: Array<Box2>,
  radius: number
) {
  const points = [from, ...path]
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1]
    const [bx, bz] = points[i]
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const p: [number, number] = [ax + (bx - ax) * t, az + (bz - az) * t]
      expect(walkable(p, bounds, boxes, radius - 1e-6)).toBe(true)
    }
  }
}

describe("walkable", () => {
  it("keeps the walker's radius off furniture and walls", () => {
    expect(walkable([2, 2], bounds, [wall], 0.3)).toBe(true)
    expect(walkable([3.8, 2], bounds, [wall], 0.3)).toBe(false)
    expect(walkable([0.1, 5], bounds, [wall], 0.3)).toBe(false)
    expect(walkable([11, 5], bounds, [wall], 0.3)).toBe(false)
  })
})

describe("findPath", () => {
  it("goes straight when nothing is in the way", () => {
    expect(findPath([1, 1], [3, 3], bounds, [wall], 0.3)).toEqual([[3, 3]])
  })

  it("walks around furniture and ends at the target", () => {
    const path = findPath([2, 2], [7, 2], bounds, [wall], 0.3)
    expect(path.length).toBeGreaterThan(1)
    expect(path.at(-1)).toEqual([7, 2])
    expect(crosses(path, [2, 2], wall)).toBe(false)
  })

  it("gives no path to a blocked or unreachable target", () => {
    expect(findPath([2, 2], [4.5, 4], bounds, [wall], 0.3)).toEqual([])
    const closed: Array<Box2> = [{ x0: 4, x1: 5, z0: -1, z1: 11 }]
    expect(findPath([2, 2], [7, 2], bounds, closed, 0.3)).toEqual([])
  })

  it("reaches a target just outside a furniture margin", () => {
    // 5.31 is walkable (5 + 0.3 margin) but rounds onto the blocked cell 5.25.
    const to: [number, number] = [5.31, 2]
    expect(walkable(to, bounds, [wall], 0.3)).toBe(true)
    const path = findPath([2, 2], to, bounds, [wall], 0.3)
    expect(path.length).toBeGreaterThan(0)
    expect(path.at(-1)).toEqual(to)
    expectLegsClear([2, 2], path, [wall], 0.3)
  })

  it("starts from a point just outside a furniture margin", () => {
    const from: [number, number] = [5.31, 2]
    const path = findPath(from, [2, 2], bounds, [wall], 0.3)
    expect(path.length).toBeGreaterThan(0)
    expect(path.at(-1)).toEqual([2, 2])
    expectLegsClear(from, path, [wall], 0.3)
  })

  it("keeps every waypoint walkable and every leg clear when walking around", () => {
    const from: [number, number] = [2, 2]
    const path = findPath(from, [7, 2], bounds, [wall], 0.3)
    expect(path.length).toBeGreaterThan(1)
    for (const p of path) expect(walkable(p, bounds, [wall], 0.3)).toBe(true)
    expectLegsClear(from, path, [wall], 0.3)
  })

  it("does not cut a diagonal between two touching boxes", () => {
    const boxes: Array<Box2> = [
      { x0: 2, x1: 3, z0: 2, z1: 3 },
      { x0: 3, x1: 4, z0: 3, z1: 4 },
    ]
    const from: [number, number] = [3.25, 2.75]
    const to: [number, number] = [2.75, 3.25]
    const path = findPath(from, to, bounds, boxes, 0.1)
    expect(path.length).toBeGreaterThan(1)
    expectLegsClear(from, path, boxes, 0.1)
  })
})
