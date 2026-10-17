import { describe, expect, it } from "vitest"
import { ATRIUM, type Point3 } from "./layout"
import {
  MAX_ZOOM,
  MIN_ZOOM,
  SCREEN_RIGHT,
  SCREEN_UP,
  type View,
  type Viewport,
  centerOn,
  clampView,
  halfExtents,
  project,
  startView,
} from "./projection"

const R2 = Math.SQRT2
const R3 = Math.sqrt(3)
const R6 = Math.sqrt(6)
const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const along = (from: Point3, direction: Point3, distance: number): Point3 => [
  from[0] + direction[0] * distance,
  from[1] + direction[1] * distance,
  from[2] + direction[2] * distance,
]

/**
 * The map on screen, shrunk by the safety edge (u right, v up, in metres):
 * the wall ends bound it sideways; the tops of the two back walls meet in a
 * peak above; the front corners of the floor (with the floor in front of the
 * room) meet in a point below. Both slopes are 1/√3 in an isometric view.
 */
function insideMap(u: number, v: number): boolean {
  const { size, height, front, edge } = ATRIUM
  const slack = 1e-9
  return (
    Math.abs(u) <= (size - edge) / R2 + slack &&
    v <= (2 * (height - edge)) / R6 - Math.abs(u) / R3 + slack &&
    v >= (-2 * (size + front - edge)) / R6 + Math.abs(u) / R3 - slack
  )
}

function screenCorners(view: View, viewport: Viewport) {
  const { halfWidth, halfHeight } = halfExtents(view.zoom, viewport)
  const u = dot(SCREEN_RIGHT, view.target)
  const v = dot(SCREEN_UP, view.target)
  return [
    [u - halfWidth, v - halfHeight],
    [u + halfWidth, v - halfHeight],
    [u - halfWidth, v + halfHeight],
    [u + halfWidth, v + halfHeight],
  ] as const
}

/** Deterministic random numbers, so a failure replays. */
function random(seed: number) {
  let state = seed
  return () => (state = (state * 16807) % 2147483647) / 2147483647
}

/** Views anywhere around the atrium, at any zoom, on screens from 9:20 to 21:9. */
function* randomViews(count: number) {
  const next = random(42)
  for (let i = 0; i < count; i++) {
    const aspect = 9 / 20 + next() * (21 / 9 - 9 / 20)
    const viewport: Viewport = { width: 1000 * aspect, height: 1000 }
    const view: View = {
      target: [next() * 80 - 20, next() * 30 - 10, next() * 80 - 20],
      zoom: 0.5 + next() * 3,
    }
    yield { i, view, viewport }
  }
}

describe("project", () => {
  const viewport: Viewport = { width: 1600, height: 900 }
  const view: View = { target: [14, 4, 14], zoom: 1 }

  it("puts the target in the middle of the screen", () => {
    expect(project(view.target, view, viewport)).toEqual({ x: 50, y: 50 })
  })

  it("puts the screen's edges at 0 and 100 percent, also zoomed in", () => {
    for (const zoom of [1, 2]) {
      const zoomed = { ...view, zoom }
      const { halfWidth, halfHeight } = halfExtents(zoom, viewport)
      const right = project(
        along(view.target, SCREEN_RIGHT, halfWidth),
        zoomed,
        viewport
      )
      const top = project(
        along(view.target, SCREEN_UP, halfHeight),
        zoomed,
        viewport
      )
      expect(right.x).toBeCloseTo(100)
      expect(right.y).toBeCloseTo(50)
      expect(top.x).toBeCloseTo(50)
      expect(top.y).toBeCloseTo(0)
    }
  })

  it("shows points on the camera's axis at the same spot", () => {
    const behind = project([24, 14, 24], view, viewport)
    expect(behind.x).toBeCloseTo(50)
    expect(behind.y).toBeCloseTo(50)
  })
})

describe("clampView", () => {
  it("keeps every corner of the screen inside the map", () => {
    for (const { i, view, viewport } of randomViews(5000)) {
      const clamped = clampView(view, viewport)
      expect(clamped.zoom).toBeGreaterThanOrEqual(MIN_ZOOM)
      expect(clamped.zoom).toBeLessThanOrEqual(MAX_ZOOM)
      for (const [u, v] of screenCorners(clamped, viewport)) {
        expect(insideMap(u, v), `view ${i}`).toBe(true)
      }
    }
  })

  it("leaves a view that already fits as it is", () => {
    for (const { i, view, viewport } of randomViews(2000)) {
      const once = clampView(view, viewport)
      const twice = clampView(once, viewport)
      expect(twice.zoom).toBe(once.zoom)
      for (let k = 0; k < 3; k++) {
        expect(twice.target[k], `view ${i}`).toBeCloseTo(once.target[k], 9)
      }
    }
  })

  it("leaves a view strictly inside the map exactly where it is", () => {
    const { size, height, front, edge } = ATRIUM
    // The hexagon from insideMap, as its limits on u and on the v band.
    const sideLimit = (size - edge) / R2
    const top = (2 * (height - edge)) / R6
    const bottom = (2 * (size + front - edge)) / R6
    const midV = (top + bottom) / 2
    const next = random(7)
    for (let i = 0; i < 2000; i++) {
      const aspect = 9 / 20 + next() * (21 / 9 - 9 / 20)
      const viewport: Viewport = { width: 1000 * aspect, height: 1000 }
      const zoom = MIN_ZOOM + next() * (MAX_ZOOM - MIN_ZOOM)
      const { halfWidth, halfHeight } = halfExtents(zoom, viewport)
      // The widest u whose corners stay inside, then a point well within it.
      const uLimit = Math.min(sideLimit, R3 * (midV - halfHeight)) - halfWidth
      const u = (2 * next() - 1) * 0.5 * uLimit
      // The v band the corners allow at this u, and a point in its middle.
      const reach = (Math.abs(u) + halfWidth) / R3 + halfHeight
      const low = -bottom + reach
      const high = top - reach
      const v = (low + high) / 2 + (2 * next() - 1) * 0.5 * ((high - low) / 2)
      const target: Point3 = [
        u * SCREEN_RIGHT[0] + v * SCREEN_UP[0],
        u * SCREEN_RIGHT[1] + v * SCREEN_UP[1],
        u * SCREEN_RIGHT[2] + v * SCREEN_UP[2],
      ]
      const view: View = { target, zoom }
      for (const [cu, cv] of screenCorners(view, viewport)) {
        expect(insideMap(cu, cv), `view ${i} precondition`).toBe(true)
      }
      const clamped = clampView(view, viewport)
      expect(clamped.zoom, `view ${i}`).toBe(view.zoom)
      for (let k = 0; k < 3; k++) {
        expect(clamped.target[k], `view ${i}`).toBeCloseTo(target[k], 9)
      }
    }
  })
})

describe("startView", () => {
  it("opens wide screens on the whole atrium and tall ones closer in", () => {
    const wide = { width: 1600, height: 900 }
    const tall = { width: 390, height: 780 }
    expect(startView(wide).zoom).toBe(1)
    expect(startView(tall).zoom).toBe(1.6)
    for (const viewport of [wide, tall]) {
      const view = startView(viewport)
      const again = clampView(view, viewport)
      for (let k = 0; k < 3; k++) {
        expect(again.target[k]).toBeCloseTo(view.target[k], 9)
      }
    }
  })
})

describe("centerOn", () => {
  it("brings a point to the middle of the screen", () => {
    const viewport = { width: 1200, height: 800 }
    const point: Point3 = [19.5, 2.2, 26]
    const centred = centerOn({ target: [14, 4, 14], zoom: 2 }, point)
    const at = project(point, centred, viewport)
    expect(at.x).toBeCloseTo(50)
    expect(at.y).toBeCloseTo(50)
  })
})
