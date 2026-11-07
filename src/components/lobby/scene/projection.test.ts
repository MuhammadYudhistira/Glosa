import { describe, expect, it } from "vitest"
import { ROOM, type Point3 } from "./layout"
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

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }
const dot = (a: readonly number[], b: readonly number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const along = (from: Point3, direction: Point3, distance: number): Point3 => [
  from[0] + direction[0] * distance,
  from[1] + direction[1] * distance,
  from[2] + direction[2] * distance,
]
const corners = [0, ROOM.width].flatMap((x) =>
  [0, ROOM.height].flatMap((y) =>
    [0, ROOM.depth].map((z) => [x, y, z] as const)
  )
)

/** Deterministic random numbers, so a failure replays. */
function random(seed: number) {
  let state = seed
  return () => (state = (state * 16807) % 2147483647) / 2147483647
}

/** Views anywhere around the room, at any zoom, on screens from 9:20 to 21:9. */
function* randomViews(count: number) {
  const next = random(42)
  for (let i = 0; i < count; i++) {
    const aspect = 9 / 20 + next() * (21 / 9 - 9 / 20)
    const viewport: Viewport = { width: 1000 * aspect, height: 1000 }
    const view: View = {
      target: [next() * 60 - 20, next() * 30 - 10, next() * 60 - 20],
      zoom: 0.5 + next() * 3,
    }
    yield { i, view, viewport }
  }
}

describe("project", () => {
  const viewport: Viewport = { width: 1600, height: 900 }
  const view: View = { target: [6, 2, 6], zoom: 1 }

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
    const behind = project([16, 12, 16], view, viewport)
    expect(behind.x).toBeCloseTo(50)
    expect(behind.y).toBeCloseTo(50)
  })
})

describe("diorama camera", () => {
  it.each([PHONE, DESKTOP])(
    "shows the whole room at the start view (%o)",
    (viewport) => {
      const view = startView(viewport)
      expect(view.zoom).toBe(1)
      for (const corner of corners) {
        const { x, y } = project(corner, view, viewport)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(100)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(100)
      }
    }
  )

  it("keeps the room on screen however far it is panned", () => {
    for (const viewport of [PHONE, DESKTOP]) {
      const far = clampView(
        { target: [500, 0, -500], zoom: MAX_ZOOM },
        viewport
      )
      const { halfWidth, halfHeight } = halfExtents(far.zoom, viewport)
      const u = dot(SCREEN_RIGHT, far.target)
      const umax = ROOM.width / Math.SQRT2
      // The edge of the screen never goes past the room's edge.
      expect(Math.abs(u) - halfWidth).toBeLessThanOrEqual(umax + 1e-6)
      expect(halfHeight).toBeGreaterThan(0)
      expect(dot(SCREEN_UP, far.target)).toBeLessThan(1e3)
    }
  })

  it("centres an axis the room does not fill, and never changes the zoom within limits", () => {
    const view = clampView({ target: [3, 1, 9], zoom: 1 }, PHONE)
    expect(view).toEqual(startView(PHONE))
    expect(clampView({ target: [6, 2, 6], zoom: 9 }, DESKTOP).zoom).toBe(
      MAX_ZOOM
    )
  })

  it("keeps the zoom within its limits", () => {
    for (const { view, viewport } of randomViews(500)) {
      const clamped = clampView(view, viewport)
      expect(clamped.zoom).toBeGreaterThanOrEqual(MIN_ZOOM)
      expect(clamped.zoom).toBeLessThanOrEqual(MAX_ZOOM)
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
})

describe("centerOn", () => {
  it("brings a point to the middle of the screen", () => {
    const viewport = { width: 1200, height: 800 }
    const point: Point3 = [3.8, 1.9, 2.2]
    const centred = centerOn({ target: [6, 2, 6], zoom: 2 }, point)
    const at = project(point, centred, viewport)
    expect(at.x).toBeCloseTo(50)
    expect(at.y).toBeCloseTo(50)
  })
})
