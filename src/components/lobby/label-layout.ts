import { isGenre } from "@/lib/genre"
import type { HotspotModel } from "./lobby-data"
import { type HotspotId, spotOf } from "./scene/layout"
import { type View, type Viewport, project } from "./scene/projection"

/**
 * Keeping the hotspot labels apart (owner, 2026-11-13: "no two labels
 * overlap"). Each label is a pill whose bottom centre sits on its projected
 * point. A pill with no room there moves a little; where the room is drawn
 * too small for every pill (a phone showing the whole room), the less
 * important labels shrink to a small mark at their point. No label is ever
 * hidden (owner, 2026-11-14): with no free room even for a mark, it still
 * shows as a mark, beside the others, touching them at most. Pure: no DOM,
 * so it is the same in the browser, on the server and in tests.
 */
export type LabelLook = "full" | "mark"

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

/** A pill's size on screen, in CSS pixels. */
export type LabelSize = { width: number; height: number }

/**
 * A pill's size for its text, in pixels, from the label font size (styles.css:
 * .lobby-hotspot, 14 px from the desktop breakpoint, 12 px below). An
 * estimate a little on the generous side (measured: "Sorotan" is 76 × 34 px
 * at 14 px), used only until the page has measured the real pills
 * (HotspotLayer), and in tests, which have no layout.
 */
export function labelSize(
  hotspot: Pick<HotspotModel, "label" | "count" | "badge">,
  fontPx: number
): LabelSize {
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
export type LabelPlacement = {
  look: LabelLook
  x: number
  y: number
  /** Which of its ways to show it took, best first (optionsFor); a crowded mark is last. */
  choice: number
}

/**
 * How much more room than LABEL_GAP a better way to show must have before
 * a label leaves the one it showed last (a mark for its pill, a move back
 * to its spot): while the camera pans or zooms, a label at the edge of
 * fitting holds its look instead of flipping every frame.
 */
export const SETTLE_MARGIN = 8

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
 * Where a crowded mark may go, nearest first: its spot, then rings of half
 * a mark around it, up to four marks away.
 */
const CROWDED_STEPS: ReadonlyArray<readonly [number, number]> = (() => {
  const steps: Array<readonly [number, number]> = [[0, 0]]
  for (let ring = 1; ring <= 8; ring++) {
    const around = 8 * ring
    for (let i = 0; i < around; i++) {
      const angle = (2 * Math.PI * i) / around
      steps.push([
        Math.cos(angle) * ring * (MARK_SIZE / 2),
        Math.sin(angle) * ring * (MARK_SIZE / 2),
      ])
    }
  }
  return steps
})()

/** How much two rectangles overlap, in square pixels. */
const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
  Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))

/**
 * How each label shows: in rank order (then list order), a pill where it
 * meets nothing already placed, moved a little if that makes room; else a
 * mark at its spot or just beside it. A pill shows only wholly on screen
 * (inside `bounds`): the screen's edge never cuts one, it moves inside or
 * becomes a mark. A mark stays inside the `frame` (when its spot is in it).
 * Where even a mark finds no free room, it still shows (never hidden): the
 * nearest place clear of every pill where it covers no other mark (centres
 * at least half a mark apart), with the least overlap. Given the `previous`
 * layout, a label takes a better way than its last only with SETTLE_MARGIN
 * to spare. Pills never overlap anything; marks may touch each other.
 */
export function layoutLabels(
  labels: ReadonlyArray<PlacedLabel>,
  {
    bounds,
    frame,
    previous,
  }: {
    /** The part of the frame on screen (onScreen); unbounded when omitted. */
    bounds?: Bounds
    /** The box the labels are drawn in: marks stay inside it. */
    frame?: Viewport
    /** The last layout, for a moving camera (SETTLE_MARGIN). */
    previous?: ReadonlyMap<HotspotId, LabelPlacement>
  } = {}
): Map<HotspotId, LabelPlacement> {
  const order = labels
    .map((label, index) => ({ label, index }))
    .sort((a, b) => a.label.rank - b.label.rank || a.index - b.index)
  const taken: Array<{ look: LabelLook; x: number; y: number; rect: Rect }> = []
  const placements = new Map<HotspotId, LabelPlacement>()
  const free = (rect: Rect, margin: number) =>
    !taken.some((other) => overlaps(rect, other.rect, LABEL_GAP + margin))
  const inside = (rect: Rect, margin: number) =>
    !bounds ||
    (rect.x0 >= bounds.x0 + margin &&
      rect.x1 <= bounds.x1 - margin &&
      rect.y0 >= bounds.y0 + margin &&
      rect.y1 <= bounds.y1 - margin)
  for (const { label } of order) {
    // A spot off the frame (the camera turned away) has nothing to keep in.
    const keepIn =
      frame &&
      label.x >= 0 &&
      label.x <= frame.width &&
      label.y >= 0 &&
      label.y <= frame.height
        ? frame
        : null
    const inFrame = (rect: Rect) =>
      !keepIn ||
      (rect.x0 >= 0 &&
        rect.x1 <= keepIn.width &&
        rect.y0 >= 0 &&
        rect.y1 <= keepIn.height)
    const options = optionsFor(label)
    const last = previous?.get(label.id)?.choice
    const choice = options.findIndex((option, index) => {
      // Better than last time: only with room to spare.
      const margin = last !== undefined && index < last ? SETTLE_MARGIN : 0
      return (
        free(option.rect, margin) &&
        (option.look === "mark"
          ? inFrame(option.rect)
          : inside(option.rect, margin))
      )
    })
    const chosen =
      choice >= 0
        ? { ...options[choice], choice }
        : { ...crowdedMark(label, keepIn), choice: options.length }
    taken.push(chosen)
    placements.set(label.id, {
      look: chosen.look,
      x: chosen.x,
      y: chosen.y,
      choice: chosen.choice,
    })
  }
  return placements

  /** A mark with no free room: the best place among CROWDED_STEPS. */
  function crowdedMark(label: PlacedLabel, keepIn: Viewport | null) {
    let best: { score: Array<number>; option: Option } | null = null
    for (const [dx, dy] of CROWDED_STEPS) {
      let x = label.x + dx
      let y = label.y + dy
      if (keepIn) {
        x = Math.min(Math.max(x, MARK_SIZE / 2), keepIn.width - MARK_SIZE / 2)
        y = Math.min(Math.max(y, MARK_SIZE), keepIn.height)
      }
      const rect = mark({ ...label, x, y })
      let onPills = 0
      let onMarks = 0
      let covers = 0
      for (const other of taken) {
        if (other.look === "full") {
          onPills += overlapArea(rect, other.rect)
        } else {
          onMarks += overlapArea(rect, other.rect)
          if (Math.hypot(other.x - x, other.y - y) < MARK_SIZE / 2) covers++
        }
      }
      // Clear of pills and covering no mark first; then the least overlap;
      // the nearest wins a tie (CROWDED_STEPS is nearest first).
      const score = [
        onPills > 0 || covers > 0 ? 1 : 0,
        onPills,
        covers,
        onMarks,
      ]
      if (!best || isLess(score, best.score)) {
        best = { score, option: { look: "mark", x, y, rect } }
      }
    }
    return best!.option
  }
}

const isLess = (a: ReadonlyArray<number>, b: ReadonlyArray<number>) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i]
  }
  return false
}

/** The rectangle a label takes as it shows. */
export function labelRect(
  label: PlacedLabel,
  { look, x, y }: LabelPlacement
): Rect {
  const at = { ...label, x, y }
  return look === "full" ? pill(at) : mark(at)
}

/**
 * The labels where they show on screen: `frame` is the size in CSS pixels
 * of the box the view is drawn in (the canvas, or the still image as it
 * covers the scene). `sizes` holds the pills as measured on the page; a
 * label without one is estimated from its text (labelSize).
 */
export function placeLabels(
  hotspots: ReadonlyArray<HotspotModel>,
  view: View,
  viewport: Viewport,
  frame: Viewport,
  fontPx: number,
  sizes?: ReadonlyMap<HotspotId, LabelSize>
): Array<PlacedLabel> {
  let shelfBelow = -Infinity
  return hotspots.map((hotspot) => {
    const { x, y } = project(spotOf(hotspot.id).label, view, viewport)
    const size = sizes?.get(hotspot.id) ?? labelSize(hotspot, fontPx)
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
