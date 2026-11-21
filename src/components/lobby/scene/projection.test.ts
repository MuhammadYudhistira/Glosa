import { describe, expect, it } from "vitest"
import { ANDA_START, ROOM, type Point3, spotOf } from "./layout"
import {
  MAX_ZOOM,
  MIN_ZOOM,
  SCREEN_RIGHT,
  SCREEN_UP,
  type View,
  type Viewport,
  centerOn,
  clampView,
  SCREEN_OUT,
  halfExtents,
  movedOnScreen,
  panBy,
  project,
  resizeView,
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
  it.each([DESKTOP])(
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
    // The room's box on screen, with its pad: the screen's edges stay inside it.
    const us = corners.map((corner) => dot(SCREEN_RIGHT, corner))
    const vs = corners.map((corner) => dot(SCREEN_UP, corner))
    const u0 = Math.min(...us) - ROOM.pad
    const u1 = Math.max(...us) + ROOM.pad
    const v0 = Math.min(...vs) - ROOM.pad
    const v1 = Math.max(...vs) + ROOM.pad
    const pushes: Array<Point3> = [
      [500, 0, -500],
      [-500, 0, 500],
      [0, 500, 0],
      [0, -500, 0],
      [500, 500, 500],
      [-500, -500, -500],
    ]
    for (const viewport of [PHONE, DESKTOP]) {
      for (const target of pushes) {
        const far = clampView({ target, zoom: MAX_ZOOM }, viewport)
        const { halfWidth, halfHeight } = halfExtents(far.zoom, viewport)
        const u = dot(SCREEN_RIGHT, far.target)
        const v = dot(SCREEN_UP, far.target)
        const label = `${viewport.width}x${viewport.height} ${target}`
        // An axis the room fills keeps the screen's edges inside the room;
        // one it does not fill (a phone's height) stays centred on it.
        const axes = [
          [u, halfWidth, u0, u1],
          [v, halfHeight, v0, v1],
        ] as const
        for (const [at, half, min, max] of axes) {
          if (max - min <= 2 * half) {
            expect(at, label).toBeCloseTo((min + max) / 2, 6)
          } else {
            expect(at - half, label).toBeGreaterThanOrEqual(min - 1e-6)
            expect(at + half, label).toBeLessThanOrEqual(max + 1e-6)
          }
        }
      }
    }
  })

  it("centres an axis the room does not fill, and never changes the zoom within limits", () => {
    const view = clampView({ target: [3, 1, 9], zoom: 1 }, PHONE)
    expect(view).toEqual(clampView({ target: [5, 2.3, 5], zoom: 1 }, PHONE))
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

describe("the phone held upright (spec 3G §3.7)", () => {
  const aspects: Array<Viewport> = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 600, height: 700 },
  ]

  it.each(aspects)(
    "fills the screen's height with the room (%o)",
    (viewport) => {
      const view = startView(viewport)
      expect(view.zoom).toBeGreaterThan(1)
      expect(view.zoom).toBeLessThanOrEqual(MAX_ZOOM)
      const ys = corners.map((corner) => project(corner, view, viewport).y)
      // The room's top and bottom corners reach to within a tenth of the height of each edge.
      expect(Math.min(...ys)).toBeLessThan(10)
      expect(Math.max(...ys)).toBeGreaterThan(90)
    }
  )

  it.each(aspects)(
    "is centred on Anda and the reading chair (%o)",
    (viewport) => {
      const view = startView(viewport)
      for (const point of [ANDA_START, spotOf("meja-baca").stand]) {
        const { x } = project([point[0], 0, point[1]], view, viewport)
        expect(x, `${point}`).toBeGreaterThan(0)
        expect(x, `${point}`).toBeLessThan(100)
      }
    }
  )

  it.each(aspects)(
    "never zooms out to a room narrower than the screen (%o)",
    (viewport) => {
      const out = clampView({ target: [5, 2, 5], zoom: 0.05 }, viewport)
      expect(out.zoom).toBe(MIN_ZOOM)
      const { halfWidth } = halfExtents(out.zoom, viewport)
      const room = (ROOM.width + ROOM.depth) / Math.SQRT2 + 2 * ROOM.pad
      expect(2 * halfWidth).toBeLessThanOrEqual(room + 1e-9)
    }
  )

  it("leaves landscape and square screens as they were: the whole room", () => {
    for (const viewport of [
      DESKTOP,
      { width: 800, height: 800 },
      { width: 844, height: 390 },
      // A narrow desktop window, wider than the phone's CSS (max-width: 1023px).
      { width: 1100, height: 1300 },
    ]) {
      expect(startView(viewport).zoom).toBe(1)
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

describe("movedOnScreen (spec 3G §3.7)", () => {
  const start = startView(PHONE)
  /** The start view panned by a number of CSS pixels to the right. */
  const panned = (px: number) => panBy(start, px / PHONE.width, 0, PHONE)

  it("takes a finger's jitter, under the tap slop, as no move", () => {
    expect(movedOnScreen(panned(3), start, PHONE)).toBe(false)
    expect(
      movedOnScreen(panBy(start, 0, 9 / PHONE.height, PHONE), start, PHONE)
    ).toBe(false)
  })

  it("takes a pan of the tap slop or more as a move", () => {
    expect(movedOnScreen(panned(12), start, PHONE)).toBe(true)
    expect(
      movedOnScreen(panBy(start, 0, 12 / PHONE.height, PHONE), start, PHONE)
    ).toBe(true)
  })

  it("takes a zoom of more than 1% as a move, and less as none", () => {
    expect(
      movedOnScreen({ ...start, zoom: start.zoom * 1.005 }, start, PHONE)
    ).toBe(false)
    expect(
      movedOnScreen({ ...start, zoom: start.zoom * 1.02 }, start, PHONE)
    ).toBe(true)
  })

  it("ignores a move along the camera's axis, which the screen does not show", () => {
    const deeper = { ...start, target: along(start.target, SCREEN_OUT, 3) }
    expect(movedOnScreen(deeper, start, PHONE)).toBe(false)
  })
})

describe("resizeView", () => {
  const short = { width: 390, height: 700 }

  it("follows the start view when the camera had not left it", () => {
    expect(resizeView(startView(short), short, PHONE)).toEqual(startView(PHONE))
    // Turned on its side: the landscape start view, the whole room.
    const side = { width: 844, height: 390 }
    expect(resizeView(startView(PHONE), PHONE, side)).toEqual(startView(side))
  })

  it("still follows it after a tap's jitter", () => {
    const jittered = panBy(startView(short), 3 / short.width, 0, short)
    expect(resizeView(jittered, short, PHONE)).toEqual(startView(PHONE))
  })

  it("keeps a view the member moved, only clamped", () => {
    const moved = panBy(startView(short), 0.2, 0, short)
    expect(resizeView(moved, short, PHONE)).toEqual(clampView(moved, PHONE))
  })

  it("leaves the view as it was when the size did not change", () => {
    const jittered = panBy(startView(PHONE), 3 / PHONE.width, 0, PHONE)
    expect(resizeView(jittered, PHONE, PHONE)).toEqual(
      clampView(jittered, PHONE)
    )
  })

  it("keeps the desktop's start view as it was", () => {
    const wide = { width: 1280, height: 720 }
    expect(resizeView(startView(DESKTOP), DESKTOP, wide)).toEqual(
      startView(wide)
    )
    expect(startView(wide)).toEqual(clampView(startView(DESKTOP), wide))
  })
})
