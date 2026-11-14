import { describe, expect, it } from "vitest"
import { GENRE_VALUES } from "@/lib/genre"
import type { ShelfFilter } from "@/lib/shelf"
import { STILL_SIZE, STILL_VIEW } from "./LobbyStill"
import {
  type PlacedLabel,
  labelRect,
  labelSize,
  layoutLabels,
  overlaps,
  placeLabels,
  stillFrame,
} from "./label-layout"
import { lobbyHotspots } from "./lobby-data"
import { spotOf } from "./scene/layout"
import { type Viewport, project, startView } from "./scene/projection"

const at = (
  id: PlacedLabel["id"],
  x: number,
  y: number,
  rank = 0
): PlacedLabel => ({ id, x, y, width: 100, height: 30, rank })

describe("layoutLabels", () => {
  it("keeps labels that meet nothing as pills, where they are", () => {
    const placed = layoutLabels([
      at("katalog", 100, 100),
      at("papan", 300, 100),
    ])
    expect(placed.get("katalog")).toEqual({ look: "full", x: 100, y: 100 })
    expect(placed.get("papan")).toEqual({ look: "full", x: 300, y: 100 })
  })

  it("moves a colliding pill a little when that makes room", () => {
    const placed = layoutLabels([
      at("katalog", 100, 100),
      at("papan", 100, 120, 1),
    ])
    expect(placed.get("katalog")).toEqual({ look: "full", x: 100, y: 100 })
    // Down half a pill: 135, clear of the first (70..100) by the gap.
    expect(placed.get("papan")).toEqual({ look: "full", x: 100, y: 135 })
  })

  it("moves a pill back inside the screen's width when it can", () => {
    const placed = layoutLabels([at("pintu", 40, 100)], 390)
    expect(placed.get("pintu")).toEqual({ look: "full", x: 65, y: 100 })
  })

  it("shrinks a label to a mark when no move makes room, and hides one with no room for a mark", () => {
    // A pill hemmed in above and below, and wide ones beside.
    const crowd = [
      { ...at("katalog", 100, 100), width: 400 },
      { ...at("papan", 100, 40), width: 400 },
      { ...at("pintu", 100, 160), width: 400 },
    ]
    const marked = layoutLabels([
      ...crowd,
      { ...at("meja-admin", 100, 100, 1), height: 10, width: 400 },
    ])
    expect(marked.get("meja-admin")?.look).toBe("hidden")
    // A pill too wide to clear its neighbour, whose spot itself is free.
    const roomy = layoutLabels([
      { ...at("katalog", 500, 100), width: 200 },
      { ...at("papan", 100, 100, 1), width: 2000 },
    ])
    expect(roomy.get("papan")?.look).toBe("mark")
  })

  it("sizes a pill by its text, its count and its badge", () => {
    const plain = labelSize({ label: "Sorotan", count: null, badge: null }, 14)
    const counted = labelSize({ label: "Sorotan", count: 3, badge: null }, 14)
    const badged = labelSize({ label: "Sorotan", count: null, badge: 2 }, 14)
    expect(counted.width).toBeGreaterThan(plain.width)
    expect(badged.width).toBeGreaterThan(plain.width)
    expect(
      labelSize({ label: "Sorotan", count: null, badge: null }, 12).width
    ).toBeLessThan(plain.width)
  })
})

const EMPTY = Object.fromEntries(
  [...GENRE_VALUES, "semua", "troli"].map((key) => [key, 0])
) as Record<ShelfFilter, number>
const FULL = Object.fromEntries(
  [...GENRE_VALUES, "semua", "troli"].map((key) => [key, 12])
) as Record<ShelfFilter, number>
const STATES = [
  { state: "empty", hotspots: lobbyHotspots(EMPTY, 0) },
  { state: "full", hotspots: lobbyHotspots(FULL, 12) },
]
const DESKTOP: Viewport = { width: 1440, height: 900 }
/** A 390 × 844 phone: the tab bar (3.5rem) takes the bottom. */
const PHONE: Viewport = { width: 390, height: 844 - 56 }
const SCREENS = [
  // The live room: the canvas fills the scene.
  {
    name: "1440 3D",
    view: startView(DESKTOP),
    viewport: DESKTOP,
    frame: DESKTOP,
    font: 14,
  },
  {
    name: "390 3D",
    view: startView(PHONE),
    viewport: PHONE,
    frame: PHONE,
    font: 12,
  },
  // The still image (no WebGL, and while the room loads), cropped to cover.
  {
    name: "1440 still",
    view: STILL_VIEW,
    viewport: STILL_SIZE,
    frame: stillFrame(DESKTOP),
    font: 14,
  },
  {
    name: "390 still",
    view: STILL_VIEW,
    viewport: STILL_SIZE,
    frame: stillFrame(PHONE),
    font: 12,
  },
]

describe("the room's labels (owner, 2026-11-13)", () => {
  for (const { name, view, viewport, frame, font } of SCREENS) {
    for (const { state, hotspots } of STATES) {
      it(`never overlap: ${name}, ${state} shelf`, () => {
        const labels = placeLabels(hotspots, view, viewport, frame, font)
        const looks = layoutLabels(labels)
        const shown = labels.flatMap((label) => {
          const rect = labelRect(label, looks.get(label.id)!)
          return rect ? [{ id: label.id, rect }] : []
        })
        shown.forEach((a, i) =>
          shown.slice(i + 1).forEach((b) => {
            expect(overlaps(a.rect, b.rect, 0), `${a.id} / ${b.id}`).toBe(false)
          })
        )
      })
    }
  }

  // The owner's screen: every label keeps its full name there.
  for (const { name, view, viewport, frame, font } of SCREENS.filter((screen) =>
    screen.name.startsWith("1440")
  )) {
    for (const { state, hotspots } of STATES) {
      it(`shows every label in full: ${name}, ${state} shelf`, () => {
        const looks = layoutLabels(
          placeLabels(hotspots, view, viewport, frame, font)
        )
        const short = [...looks].filter(([, { look }]) => look !== "full")
        expect(short).toEqual([])
      })
    }
  }

  // Other desktop windows: the room's places keep their names, and no label
  // hides; on shorter ones a few of the lowest shelf labels become marks.
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1536, height: 864 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
  ]) {
    for (const { state, hotspots } of STATES) {
      it(`keeps every place named: ${size.width}x${size.height}, ${state} shelf`, () => {
        const looks = layoutLabels(
          placeLabels(hotspots, startView(size), size, size, 14)
        )
        for (const hotspot of hotspots) {
          const { look } = looks.get(hotspot.id)!
          expect(look, hotspot.id).not.toBe("hidden")
          if (hotspot.count === null) expect(look, hotspot.id).toBe("full")
        }
      })
    }
  }

  it("never pushes a shelf label more than a pill's height from its spot", () => {
    const phone = { width: 390, height: 788 }
    const view = startView(phone)
    const natural = placeLabels(STATES[1].hotspots, view, phone, phone, 12)
    for (const label of natural) {
      const { y } = project(spotOf(label.id).label, view, phone)
      const spot = (y / 100) * phone.height
      expect(label.y - spot, label.id).toBeLessThanOrEqual(label.height + 1e-9)
      expect(label.y - spot, label.id).toBeGreaterThanOrEqual(-1e-9)
    }
  })
})
