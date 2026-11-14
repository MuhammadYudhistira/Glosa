import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  type LabelPlacement,
  type LabelSize,
  layoutLabels,
  onScreen,
  placeLabels,
} from "./label-layout"
import type { HotspotModel } from "./lobby-data"
import { type HotspotId, spotOf } from "./scene/layout"
import { type View, type Viewport, project } from "./scene/projection"

/** True when focus came from the keyboard (not from a mouse or touch press). */
function isKeyboardFocus(element: HTMLElement): boolean {
  try {
    return element.matches(":focus-visible")
  } catch {
    return false
  }
}

/** What a label's pill says: its name, its count and its badge. */
function PillText({ hotspot }: { hotspot: HotspotModel }) {
  return (
    <>
      <span>{hotspot.label}</span>
      {hotspot.count !== null && (
        <>
          {" "}
          <span className="lobby-hotspot-count">
            · {hotspot.count} <span className="sr-only">buku</span>
          </span>
        </>
      )}
      {hotspot.badge !== null && (
        <>
          {" "}
          <span className="lobby-hotspot-badge" aria-hidden="true">
            {hotspot.badge}
          </span>
          <span className="sr-only">· {hotspot.badge} buku</span>
        </>
      )}
    </>
  )
}

function sameSizes(
  a: ReadonlyMap<HotspotId, LabelSize> | null,
  b: ReadonlyMap<HotspotId, LabelSize>
): boolean {
  if (a?.size !== b.size) return false
  for (const [id, size] of b) {
    const other = a.get(id)
    if (other?.width !== size.width || other.height !== size.height) {
      return false
    }
  }
  return true
}

/**
 * Each label's full pill as the page draws it, from a hidden copy of every
 * pill (`box`'s children): the real font, a long name, a badge. Measured
 * again when the labels or the font change, and, where ResizeObserver
 * exists, whenever a copy changes size (a web font arriving). Null until
 * measured (and always in jsdom): the layout then estimates.
 */
function useMeasuredPills(
  hotspots: ReadonlyArray<HotspotModel>,
  fontPx: number
) {
  const box = useRef<HTMLDivElement>(null)
  const [sizes, setSizes] = useState<ReadonlyMap<HotspotId, LabelSize> | null>(
    null
  )
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const copies = [...element.children] as Array<HTMLElement>
    const measure = () => {
      const next = new Map<HotspotId, LabelSize>()
      for (const copy of copies) {
        const { width, height } = copy.getBoundingClientRect()
        if (width > 0 && height > 0) {
          next.set(copy.dataset.id as HotspotId, {
            width: Math.ceil(width),
            height: Math.ceil(height),
          })
        }
      }
      // Not drawn (the scene hidden behind a page): keep what was measured.
      if (next.size === 0) return
      setSizes((current) => (sameSizes(current, next) ? current : next))
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    for (const copy of copies) observer.observe(copy)
    return () => observer.disconnect()
  }, [hotspots, fontPx])
  return { box, sizes }
}

/**
 * The lobby's places as HTML buttons over the scene (spec 1D §5.1), placed by
 * projecting their 3D spot with the camera's current view. No two labels
 * overlap (owner, 2026-11-13): where the room is drawn too small for every
 * pill, the less important ones shrink to a mark at their spot, or wait for
 * the keyboard or a closer camera (label-layout.ts). Each keeps its name and
 * its place in the tab order.
 */
export function HotspotLayer({
  hotspots,
  view,
  viewport,
  frame,
  scene,
  fontPx = 14,
  bubbles,
  onActivate,
  onFocusSpot,
}: {
  hotspots: ReadonlyArray<HotspotModel>
  view: View
  viewport: Viewport
  /** The layer's size in CSS pixels; unknown (before the first measure), every label waits unseen, as with no room. */
  frame?: Viewport | null
  /**
   * The scene's size, where the frame is bigger and centred on it (the still
   * image, cropped to cover): only that part is on screen. The whole frame
   * when omitted.
   */
  scene?: Viewport | null
  /** The labels' font size (styles.css: 14 px on desktop, 12 px below). */
  fontPx?: number
  /** Speech bubbles shown above a hotspot. */
  bubbles?: Partial<Record<HotspotId, ReactNode>>
  /** `keyboard`: Enter or Space, a click without a pointer (no walk, no activity). */
  onActivate: (id: HotspotId, how: { keyboard: boolean }) => void
  onFocusSpot?: (id: HotspotId) => void
}) {
  // Laid out again only when what it depends on changes (frames come as new
  // objects of the same size), each time from the last layout, so a label
  // at the edge of fitting holds its look while the camera moves.
  const pills = useMeasuredPills(hotspots, fontPx)
  const sizes = pills.sizes
  const last = useRef<ReadonlyMap<HotspotId, LabelPlacement> | null>(null)
  const width = frame?.width
  const height = frame?.height
  const sceneWidth = scene?.width
  const sceneHeight = scene?.height
  const looks = useMemo(() => {
    if (width === undefined || height === undefined) return null
    const box = { width, height }
    const shown = { width: sceneWidth ?? width, height: sceneHeight ?? height }
    const placed = placeLabels(
      hotspots,
      view,
      viewport,
      box,
      fontPx,
      sizes ?? undefined
    )
    return layoutLabels(placed, {
      bounds: onScreen(box, shown),
      previous: last.current ?? undefined,
    })
  }, [
    hotspots,
    view,
    viewport,
    width,
    height,
    sceneWidth,
    sceneHeight,
    fontPx,
    sizes,
  ])
  useEffect(() => {
    last.current = looks
  }, [looks])
  return (
    <div className="lobby-hotspots lobby-overlay">
      {hotspots.map((hotspot) => {
        const at = looks?.get(hotspot.id)
        const { x, y } =
          frame && at
            ? { x: (at.x / frame.width) * 100, y: (at.y / frame.height) * 100 }
            : project(spotOf(hotspot.id).label, view, viewport)
        // Unplaced (no frame yet): invisible, so no two overlap, but still
        // in the DOM, the tab order and the accessibility tree.
        const look = at?.look ?? "hidden"
        return (
          <div
            key={hotspot.id}
            className="lobby-hotspot-anchor"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {bubbles?.[hotspot.id]}
            <button
              type="button"
              className="lobby-hotspot"
              data-empty={hotspot.dim ? "" : undefined}
              data-look={look === "full" ? undefined : look}
              onClick={(event) =>
                onActivate(hotspot.id, { keyboard: event.detail === 0 })
              }
              onFocus={(event) => {
                // A press must not move the button before the click lands.
                if (isKeyboardFocus(event.currentTarget)) {
                  onFocusSpot?.(hotspot.id)
                }
              }}
            >
              <PillText hotspot={hotspot} />
            </button>
          </div>
        )
      })}
      {/* Every pill in full, unseen, to measure (useMeasuredPills). */}
      <div ref={pills.box} className="lobby-hotspot-measure" aria-hidden="true">
        {hotspots.map((hotspot) => (
          <span
            key={hotspot.id}
            data-id={hotspot.id}
            className="lobby-hotspot"
            data-empty={hotspot.dim ? "" : undefined}
          >
            <PillText hotspot={hotspot} />
          </span>
        ))}
      </div>
    </div>
  )
}
