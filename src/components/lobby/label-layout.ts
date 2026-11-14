import { isGenre } from "@/lib/genre"
import type { HotspotModel } from "./lobby-data"
import { type HotspotId, spotOf } from "./scene/layout"
import { type View, type Viewport, project } from "./scene/projection"

/**
 * Keeping the hotspot labels apart (owner, 2026-11-13: "no two labels
 * overlap"). Each label is a pill whose bottom centre sits on its projected
 * point. A pill with no room there moves a little; where the room is drawn
 * too small for every pill (a phone showing the whole room), the less
 * important labels shrink to a small mark at their point, and a mark with no room either stays reachable by keyboard
 * only, until the camera zooms in. Pure: no DOM, so it is the same in the
 * browser, on the server and in tests.
 */
export type LabelLook = "full" | "mark" | "hidden"

/** A label on screen, in CSS pixels: `x`, `y` is its bottom centre. */
export type PlacedLabel = {
  id: HotspotId
  x: number
  y: number
  width: number
  height: number
  /** Lower comes first: it keeps its full pill when two collide. */
  rank: number
}

type Rect = { x0: number; x1: number; y0: number; y1: number }

/** The mark a label shrinks to, in pixels (styles.css: .lobby-hotspot[data-look="mark"]). */
export const MARK_SIZE = 14
/** The space kept between two labels. */
export const LABEL_GAP = 4

/**
 * A pill's size for its text, in pixels, from the label font size (styles.css:
 * .lobby-hotspot, 14 px from the desktop breakpoint, 12 px below). An
 * estimate a little on the generous side (measured: "Sorotan" is 76 × 34 px
 * at 14 px), so pills that fit here fit on screen; the E2E test measures.
 */
export function labelSize(
  hotspot: Pick<HotspotModel, "label" | "count" | "badge">,
  fontPx: number
): { width: number; height: number } {
  const text =
    hotspot.label + (hotspot.count === null ? "" : ` · ${hotspot.count}`)
  const badge = hotspot.badge === null ? 0 : 1.6 * fontPx + 0.35 * fontPx
  // Padding: 0.75rem a side on desktop, 0.55rem below; a 1 px border.
  const padding = fontPx >= 14 ? 24 : 17.6
  return {
    width: Math.ceil(text.length * 0.52 * fontPx + badge + padding + 2),
    height: Math.ceil(fontPx * 1.45 + (fontPx >= 14 ? 12.8 : 9.6) + 2),
  }
}

/**
 * Which labels keep their pill first: the room's places, then the shelf
 * sections that hold books, then the empty ones.
 */
export function labelRank(hotspot: Pick<HotspotModel, "count" | "dim">) {
  if (hotspot.count === null) return 0
  return hotspot.dim ? 2 : 1
}

const pill = ({ x, y, width, height }: PlacedLabel): Rect => ({
  x0: x - width / 2,
  x1: x + width / 2,
  y0: y - height,
  y1: y,
})

const mark = ({ x, y }: PlacedLabel): Rect => ({
  x0: x - MARK_SIZE / 2,
  x1: x + MARK_SIZE / 2,
  y0: y - MARK_SIZE,
  y1: y,
})

export const overlaps = (a: Rect, b: Rect, gap = LABEL_GAP) =>
  a.x0 < b.x1 + gap &&
  b.x0 < a.x1 + gap &&
  a.y0 < b.y1 + gap &&
  b.y0 < a.y1 + gap

/** How a label shows, and where: `x`, `y` is its bottom centre, moved a little from its spot when that makes room. */
export type LabelPlacement = { look: LabelLook; x: number; y: number }

/**
 * Where a pill may move to make room, in parts of its own height (dy) and
 * width (dx): up or down half a pill or a whole one, aside a quarter, or
 * both; the smaller moves first.
 */
const NUDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, -0.5],
  [0, 0.5],
  [-0.25, 0],
  [0.25, 0],
  [-0.25, -0.5],
  [0.25, -0.5],
  [-0.25, 0.5],
  [0.25, 0.5],
  [0, -1],
  [0, 1],
  [-0.25, -1],
  [0.25, -1],
]

/** A way for a label to show: a pill or a mark, at its spot or moved a little. */
type Option = { look: "full" | "mark"; x: number; y: number; rect: Rect }

/** A label's ways to show, best first: its pill at each move, then its mark at each. */
function optionsFor(label: PlacedLabel): Array<Option> {
  const pills = NUDGES.map(([dx, dy]): Option => {
    const at = {
      ...label,
      x: label.x + dx * label.width,
      y: label.y + dy * label.height,
    }
    return { look: "full", x: at.x, y: at.y, rect: pill(at) }
  })
  // A mark keeps to its spot, or steps just beside it.
  const marks = NUDGES.map(([dx, dy]): Option => {
    const at = {
      ...label,
      x: label.x + dx * 4 * MARK_SIZE,
      y: label.y + dy * 2 * MARK_SIZE,
    }
    return { look: "mark", x: at.x, y: at.y, rect: mark(at) }
  })
  return [...pills, ...marks]
}

/** The part of the frame that is on screen, in the frame's pixels. */
export type Bounds = Rect

/**
 * The part of a frame on a screen of this size: all of it for the live
 * canvas; the middle for the still image, which is centred and cropped to
 * cover the scene (styles.css: .lobby-still-frame).
 */
export function onScreen(frame: Viewport, screen: Viewport): Bounds {
  const x0 = Math.max(0, (frame.width - screen.width) / 2)
  const y0 = Math.max(0, (frame.height - screen.height) / 2)
  return {
    x0,
    x1: frame.width - x0,
    y0,
    y1: frame.height - y0,
  }
}

/**
 * How each label shows: in rank order (then list order), a pill where it
 * meets nothing already placed, moved a little if that makes room; else a
 * mark at its spot or just beside it; else hidden. A pill shows only wholly
 * on screen (inside `bounds`): the screen's edge never cuts one, it moves
 * inside or becomes a mark. What it returns never overlaps.
 */
export function layoutLabels(
  labels: ReadonlyArray<PlacedLabel>,
  {
    bounds,
  }: {
    /** The part of the frame on screen (onScreen); unbounded when omitted. */
    bounds?: Bounds
  } = {}
): Map<HotspotId, LabelPlacement> {
  const order = labels
    .map((label, index) => ({ label, index }))
    .sort((a, b) => a.label.rank - b.label.rank || a.index - b.index)
  const taken: Array<Rect> = []
  const placements = new Map<HotspotId, LabelPlacement>()
  const free = (rect: Rect) => !taken.some((other) => overlaps(rect, other))
  const inside = (rect: Rect) =>
    !bounds ||
    (rect.x0 >= bounds.x0 &&
      rect.x1 <= bounds.x1 &&
      rect.y0 >= bounds.y0 &&
      rect.y1 <= bounds.y1)
  for (const { label } of order) {
    const chosen = optionsFor(label).find(
      (option) =>
        free(option.rect) && (option.look === "mark" || inside(option.rect))
    )
    if (chosen) {
      taken.push(chosen.rect)
      placements.set(label.id, { look: chosen.look, x: chosen.x, y: chosen.y })
    } else {
      placements.set(label.id, { look: "hidden", x: label.x, y: label.y })
    }
  }
  return placements
}

/** The rectangle a label takes as it shows (null when hidden). */
export function labelRect(
  label: PlacedLabel,
  { look, x, y }: LabelPlacement
): Rect | null {
  if (look === "hidden") return null
  const at = { ...label, x, y }
  return look === "full" ? pill(at) : mark(at)
}

/**
 * The labels where they show on screen: `frame` is the size in CSS pixels
 * of the box the view is drawn in (the canvas, or the still image as it
 * covers the scene).
 */
export function placeLabels(
  hotspots: ReadonlyArray<HotspotModel>,
  view: View,
  viewport: Viewport,
  frame: Viewport,
  fontPx: number
): Array<PlacedLabel> {
  let shelfBelow = -Infinity
  return hotspots.map((hotspot) => {
    const { x, y } = project(spotOf(hotspot.id).label, view, viewport)
    const size = labelSize(hotspot, fontPx)
    let bottom = (y / 100) * frame.height
    if (isGenre(hotspot.id)) {
      // The shelf sections' labels step down the bookcase (layout.ts); on
      // a smaller screen they step a little further, so they stay a stack,
      // but never more than a pill's height from their spot.
      bottom = Math.min(
        Math.max(bottom, shelfBelow + size.height + LABEL_GAP),
        bottom + size.height
      )
      shelfBelow = bottom
    }
    return {
      id: hotspot.id,
      x: (x / 100) * frame.width,
      y: bottom,
      ...size,
      rank: labelRank(hotspot),
    }
  })
}

/** The still image's box as it covers a scene of this size (styles.css: .lobby-still-frame, 16:9). */
export function stillFrame(scene: Viewport): Viewport {
  return {
    width: Math.max(scene.width, (scene.height * 16) / 9),
    height: Math.max(scene.height, (scene.width * 9) / 16),
  }
}
