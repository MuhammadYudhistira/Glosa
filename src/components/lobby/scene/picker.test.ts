import { describe, expect, it } from "vitest"
import { HOTSPOT_SPOTS, type Point3 } from "./layout"
import { PICK_VOLUMES, type PickVolume, anchorOf } from "./pick-volumes"
import { pickAt } from "./picker"
import {
  SCREEN_OUT,
  type View,
  type Viewport,
  clampView,
  project,
  startView,
} from "./projection"

const DESKTOP: Viewport = { width: 1440, height: 900 }
const PHONE: Viewport = { width: 390, height: 844 }

const toPixels = (point: Point3, view: View, viewport: Viewport) => {
  const { x, y } = project(point, view, viewport)
  return { x: (x / 100) * viewport.width, y: (y / 100) * viewport.height }
}

/** The whole room in sight: the desktop's start view, and a phone at its zoom limit. */
const WHOLE_ROOM: Array<[string, View, Viewport]> = [
  ["desktop", startView(DESKTOP), DESKTOP],
  [
    "phone, whole room",
    clampView({ target: startView(PHONE).target, zoom: 1 }, PHONE),
    PHONE,
  ],
]

describe("pickAt", () => {
  it.each(WHOLE_ROOM)(
    "picks every place at its anchor (%s)",
    (_name, view, viewport) => {
      for (const { id } of HOTSPOT_SPOTS) {
        const at = toPixels(anchorOf(id), view, viewport)
        expect(pickAt(at, view, viewport), id).toBe(id)
      }
    }
  )

  it("picks nothing in the empty corners of the screen", () => {
    const view = startView(DESKTOP)
    expect(pickAt({ x: 2, y: 2 }, view, DESKTOP)).toBeNull()
    expect(pickAt({ x: DESKTOP.width - 2, y: 2 }, view, DESKTOP)).toBeNull()
  })

  it("picks nothing outside the screen", () => {
    const view = startView(DESKTOP)
    const at = toPixels(anchorOf("pintu"), view, DESKTOP)
    expect(pickAt({ x: -1, y: at.y }, view, DESKTOP)).toBeNull()
    expect(pickAt({ x: at.x, y: DESKTOP.height + 1 }, view, DESKTOP)).toBeNull()
  })

  it("lets the box nearer the camera win, whatever the order", () => {
    const view: View = { target: [5, 2, 5], zoom: 1 }
    const viewport: Viewport = { width: 100, height: 100 }
    const near: PickVolume = {
      id: "meja-baca",
      min: [4.5, 1.5, 4.5],
      max: [5.5, 2.5, 5.5],
      main: true,
    }
    // The same box 2 m further from the camera: the two overlap on screen.
    const shift = 2 * SCREEN_OUT[0]
    const far: PickVolume = {
      id: "pintu",
      min: near.min.map((v) => v - shift) as unknown as Point3,
      max: near.max.map((v) => v - shift) as unknown as Point3,
      main: true,
    }
    const centre = { x: 50, y: 50 }
    expect(pickAt(centre, view, viewport, [near, far])).toBe("meja-baca")
    expect(pickAt(centre, view, viewport, [far, near])).toBe("meja-baca")
    expect(pickAt(centre, view, viewport, [far])).toBe("pintu")
  })

  it("is the picker the stage uses: the real volumes by default", () => {
    const view = startView(DESKTOP)
    const at = toPixels(anchorOf("troli"), view, DESKTOP)
    expect(pickAt(at, view, DESKTOP)).toBe(
      pickAt(at, view, DESKTOP, PICK_VOLUMES)
    )
  })
})
