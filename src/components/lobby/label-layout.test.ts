import { describe, expect, it } from "vitest"
import { GENRE_VALUES } from "@/lib/genre"
import type { ShelfFilter } from "@/lib/shelf"
import { STILL_SIZE, STILL_VIEW } from "./LobbyStill"
import {
  type LabelPlacement,
  MARK_SIZE,
  type PlacedLabel,
  SETTLE_MARGIN,
  labelRect,
  labelSize,
  layoutLabels,
  onScreen,
  overlaps,
  placeLabels,
  stillFrame,
} from "./label-layout"
import { lobbyHotspots } from "./lobby-data"
import { spotOf } from "./scene/layout"
import { type Viewport, project, startView } from "./scene/projection"

/** A 390 px wide phone screen, in its own pixels. */
const SCREEN = { x0: 0, x1: 390, y0: 0, y1: 788 }
const FRAME = { width: 390, height: 788 }

const at = (
  id: PlacedLabel["id"],
  x: number,
  y: number,
  rank = 0
): PlacedLabel => ({ id, x, y, width: 100, height: 30, rank })

describe("layoutLabels", () => {
  it("finds the part of a frame on screen: all of it, or the middle of a cropped still", () => {
    expect(
      onScreen({ width: 390, height: 788 }, { width: 390, height: 788 })
    ).toEqual({ x0: 0, x1: 390, y0: 0, y1: 788 })
    expect(onScreen(stillFrame(PHONE), PHONE)).toEqual({
      x0: (stillFrame(PHONE).width - 390) / 2,
      x1: (stillFrame(PHONE).width + 390) / 2,
      y0: 0,
      y1: 788,
    })
  })

  it("keeps labels that meet nothing as pills, where they are", () => {
    const placed = layoutLabels([
      at("katalog", 100, 100),
      at("papan", 300, 100),
    ])
    expect(placed.get("katalog")).toMatchObject({
      look: "full",
      x: 100,
      y: 100,
    })
    expect(placed.get("papan")).toMatchObject({ look: "full", x: 300, y: 100 })
  })

  it("moves a colliding pill a little when that makes room", () => {
    const placed = layoutLabels([
      at("katalog", 100, 100),
      at("papan", 100, 120, 1),
    ])
    expect(placed.get("katalog")).toMatchObject({
      look: "full",
      x: 100,
      y: 100,
    })
    // Down half a pill: 135, clear of the first (70..100) by the gap.
    expect(placed.get("papan")).toMatchObject({ look: "full", x: 100, y: 135 })
  })

  it("moves a pill back inside the screen's width when it can", () => {
    const placed = layoutLabels([at("pintu", 40, 100)], { bounds: SCREEN })
    expect(placed.get("pintu")).toMatchObject({ look: "full", x: 65, y: 100 })
  })

  it("never lets the screen's edge cut a pill: with no move inside, it becomes a mark", () => {
    // 380 + 50 runs past 390; a quarter aside (25 px) is not enough.
    const placed = layoutLabels([at("lemari", 380, 100)], { bounds: SCREEN })
    expect(placed.get("lemari")).toMatchObject({
      look: "mark",
      x: 380,
      y: 100,
    })
    // The same at the top: a pill whose top would be cut.
    const high = layoutLabels([{ ...at("pintu", 200, 10), height: 60 }], {
      bounds: SCREEN,
    })
    expect(high.get("pintu")).toMatchObject({ look: "full", x: 200, y: 70 })
  })

  it("shrinks a label to a mark when no move makes room, and never hides one", () => {
    // A pill hemmed in above and below, and wide ones beside.
    const crowd = [
      { ...at("katalog", 100, 100), width: 400 },
      { ...at("papan", 100, 40), width: 400 },
      { ...at("pintu", 100, 160), width: 400 },
    ]
    const hemmed = { ...at("meja-admin", 100, 100, 1), height: 10, width: 400 }
    const marked = layoutLabels([...crowd, hemmed], { frame: FRAME })
    expect(marked.get("meja-admin")?.look).toBe("mark")
    // Beside the pills, not over them.
    const markRect = labelRect(hemmed, marked.get("meja-admin")!)
    for (const pill of crowd) {
      expect(overlaps(markRect, labelRect(pill, marked.get(pill.id)!), 0)).toBe(
        false
      )
    }
    // A pill too wide to clear its neighbour, whose spot itself is free.
    const roomy = layoutLabels([
      { ...at("katalog", 500, 100), width: 200 },
      { ...at("papan", 100, 100, 1), width: 2000 },
    ])
    expect(roomy.get("papan")?.look).toBe("mark")
  })

  it("keeps every crowded label as a mark inside the frame, touching the others at most", () => {
    // Six labels on one spot of a frame too small for any pill.
    const ids = [
      "katalog",
      "papan",
      "pintu",
      "toko",
      "tanaman",
      "lemari",
    ] as const
    const pile = ids.map((id) => ({ ...at(id, 30, 40, 1), width: 500 }))
    const small = { width: 120, height: 90 }
    const looks = layoutLabels(pile, {
      bounds: onScreen(small, small),
      frame: small,
    })
    const marks = pile.map((label) => {
      const placement = looks.get(label.id)!
      expect(placement.look, label.id).toBe("mark")
      const rect = labelRect(label, placement)
      expect(rect.x0, label.id).toBeGreaterThanOrEqual(0)
      expect(rect.x1, label.id).toBeLessThanOrEqual(small.width)
      expect(rect.y0, label.id).toBeGreaterThanOrEqual(0)
      expect(rect.y1, label.id).toBeLessThanOrEqual(small.height)
      return placement
    })
    marks.forEach((a, i) =>
      marks.slice(i + 1).forEach((b) => {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(
          MARK_SIZE / 2
        )
      })
    )
  })

  it("holds a label's look until a better one clears by a margin, so a moving camera does not flicker", () => {
    // B sits right of A, `gap` px clear of it; C on the right leaves B no
    // room to step aside. B's pill fits from a 4 px gap (LABEL_GAP).
    const scene = (gap: number) => [
      at("katalog", 100, 100),
      at("pintu", 328, 100),
      at("papan", 200 + gap, 100, 1),
    ]
    const gaps = [6, 3, 6, 5, 14]
    // Laid out afresh each time, B flips: full, mark, full, full, full.
    expect(
      gaps.map((gap) => layoutLabels(scene(gap)).get("papan")?.look)
    ).toEqual(["full", "mark", "full", "full", "full"])
    // Each from the one before: once a mark, B waits for a clear margin
    // (LABEL_GAP + SETTLE_MARGIN) before its pill comes back.
    let previous: Map<PlacedLabel["id"], LabelPlacement> | undefined
    const held = gaps.map((gap) => {
      previous = layoutLabels(scene(gap), { previous })
      return previous.get("papan")?.look
    })
    expect(held).toEqual(["full", "mark", "mark", "mark", "full"])
    expect(SETTLE_MARGIN).toBeGreaterThan(0)
  })

  it("keeps a moved pill where it was while that still fits, rather than flip back by a pixel", () => {
    // B was moved down half a pill; its spot is now free, but only just.
    const first = layoutLabels([
      at("katalog", 100, 100),
      at("papan", 100, 120, 1),
    ])
    expect(first.get("papan")).toMatchObject({ y: 135 })
    const crowded = [
      { ...at("katalog", 100, 100), width: 100 },
      // A's pill ends at 150; B's would start at 155: clear by 5 px.
      at("papan", 205, 100, 1),
    ]
    expect(layoutLabels(crowded).get("papan")).toMatchObject({ x: 205 })
    const moved = layoutLabels(crowded, { previous: first })
    // Down half a pill, as before: the spot is not clear by the margin.
    expect(moved.get("papan")).toMatchObject({ look: "full", x: 205, y: 115 })
  })

  it("lays out with the pill sizes it is given, and estimates only the others", () => {
    const hotspots = lobbyHotspots(FULL, 12)
    const view = startView(PHONE)
    const wide = { width: 333, height: 41 }
    const placed = placeLabels(
      hotspots,
      view,
      PHONE,
      PHONE,
      12,
      new Map([["bisnis_pengembangan_diri", wide]])
    )
    const bisnis = placed.find(
      (label) => label.id === "bisnis_pengembangan_diri"
    )!
    expect({ width: bisnis.width, height: bisnis.height }).toEqual(wide)
    const sorotan = placed.find((label) => label.id === "papan")!
    expect({ width: sorotan.width, height: sorotan.height }).toEqual(
      labelSize(
        hotspots.find((hotspot) => hotspot.id === "papan")!,
        12
      )
    )
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
    device: DESKTOP,
  },
  {
    name: "390 3D",
    view: startView(PHONE),
    viewport: PHONE,
    frame: PHONE,
    font: 12,
    device: PHONE,
  },
  // The still image (no WebGL, and while the room loads), cropped to cover.
  {
    name: "1440 still",
    view: STILL_VIEW,
    viewport: STILL_SIZE,
    frame: stillFrame(DESKTOP),
    font: 14,
    device: DESKTOP,
  },
  {
    name: "390 still",
    view: STILL_VIEW,
    viewport: STILL_SIZE,
    frame: stillFrame(PHONE),
    font: 12,
    device: PHONE,
  },
]

describe("the room's labels (owner, 2026-11-13)", () => {
  for (const { name, view, viewport, frame, font, device } of SCREENS) {
    for (const { state, hotspots } of STATES) {
      it(`never overlap, no edge cuts a pill, and none hides: ${name}, ${state} shelf`, () => {
        const labels = placeLabels(hotspots, view, viewport, frame, font)
        const bounds = onScreen(frame, device)
        const looks = layoutLabels(labels, { bounds, frame })
        const shown = labels.map((label) => {
          const placement = looks.get(label.id)!
          // Every label is a pill or a mark: none waits unseen (owner, J6).
          expect(["full", "mark"], label.id).toContain(placement.look)
          return { label, placement, rect: labelRect(label, placement) }
        })
        shown.forEach((a, i) =>
          shown.slice(i + 1).forEach((b) => {
            const pair = `${a.label.id} / ${b.label.id}`
            if (a.placement.look === "mark" && b.placement.look === "mark") {
              // Marks may touch, but never cover each other.
              expect(
                Math.hypot(
                  a.placement.x - b.placement.x,
                  a.placement.y - b.placement.y
                ),
                pair
              ).toBeGreaterThanOrEqual(MARK_SIZE / 2)
            } else {
              expect(overlaps(a.rect, b.rect, 0), pair).toBe(false)
            }
          })
        )
        for (const { label, rect } of shown) {
          // A pill or a mark shows wholly on the visible screen (owner, K1).
          const box = bounds
          expect(rect.x0, label.id).toBeGreaterThanOrEqual(box.x0)
          expect(rect.x1, label.id).toBeLessThanOrEqual(box.x1)
          expect(rect.y0, label.id).toBeGreaterThanOrEqual(box.y0)
          expect(rect.y1, label.id).toBeLessThanOrEqual(box.y1)
        }
      })
    }
  }

  it("puts the mark of a spot outside the visible screen at the nearest edge inside it (K1)", () => {
    const frame = { width: 900, height: 500 }
    const bounds = { x0: 255, x1: 645, y0: 0, y1: 500 }
    const looks = layoutLabels(
      [at("pintu", 100, 300), at("lemari", 800, 300, 1)],
      { bounds, frame }
    )
    // Both labels are cropped away: each is a mark on the nearest edge.
    const left = looks.get("pintu")!
    const right = looks.get("lemari")!
    expect(left.look).toBe("mark")
    expect(right.look).toBe("mark")
    expect(left.x - MARK_SIZE / 2).toBeCloseTo(bounds.x0, 5)
    expect(right.x + MARK_SIZE / 2).toBeCloseTo(bounds.x1, 5)
    expect(left.y).toBe(300)
    expect(right.y).toBe(300)
  })

  // The owner's screen: every label keeps its full name there.
  for (const { name, view, viewport, frame, font, device } of SCREENS.filter(
    (screen) => screen.name.startsWith("1440")
  )) {
    for (const { state, hotspots } of STATES) {
      it(`shows every label in full: ${name}, ${state} shelf`, () => {
        const looks = layoutLabels(
          placeLabels(hotspots, view, viewport, frame, font),
          { bounds: onScreen(frame, device), frame }
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
          placeLabels(hotspots, startView(size), size, size, 14),
          { bounds: onScreen(size, size), frame: size }
        )
        for (const hotspot of hotspots) {
          const { look } = looks.get(hotspot.id)!
          expect(["full", "mark"], hotspot.id).toContain(look)
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
