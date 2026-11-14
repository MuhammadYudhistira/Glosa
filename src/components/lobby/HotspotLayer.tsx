import type { ReactNode } from "react"
import { layoutLabels, onScreen, placeLabels } from "./label-layout"
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
  const placed = frame
    ? placeLabels(hotspots, view, viewport, frame, fontPx)
    : null
  const looks =
    placed && frame
      ? layoutLabels(placed, { bounds: onScreen(frame, scene ?? frame) })
      : null
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
            </button>
          </div>
        )
      })}
    </div>
  )
}
