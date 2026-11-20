import { type ReactNode, useRef } from "react"
import type { HotspotModel } from "./lobby-data"
import type { HotspotId } from "./scene/layout"
import { anchorOf } from "./scene/pick-volumes"
import { type View, type Viewport, project } from "./scene/projection"

/**
 * The lobby's places as HTML buttons over the scene (spec 3G §3.3). No label
 * is drawn: the button is unseen, at its place's anchor, in the tab order
 * with the place's name, and shows only its focus ring. In the 3D scene it
 * lets pointers through (the scene decides what a tap meets); in the still
 * image (`dots`) it is a small dot that takes the tap itself (§3.8).
 */
export function HotspotLayer({
  hotspots,
  view,
  viewport,
  dots = false,
  bubbles,
  onKey,
  onTap,
  onFocusSpot,
}: {
  hotspots: ReadonlyArray<HotspotModel>
  view: View
  viewport: Viewport
  /** The still image: each place is a visible dot that can be tapped. */
  dots?: boolean
  /** Speech bubbles shown above a place. */
  bubbles?: Partial<Record<HotspotId, ReactNode>>
  /** Enter or Space (a click without a pointer): the page opens at once. */
  onKey: (id: HotspotId) => void
  /** A click or tap on a dot (the still image). */
  onTap: (id: HotspotId) => void
  /** Focus that is not a press: the place is picked, and the camera may follow. */
  onFocusSpot?: (id: HotspotId) => void
}) {
  // A press on a button focuses it before the click lands: that focus must
  // not pick the place a second time (the tap would then open it). Kept per
  // place: the press blurs the place that had focus before this one focuses.
  const pressed = useRef<HotspotId | null>(null)
  return (
    <div className="lobby-hotspots lobby-overlay">
      {hotspots.map((hotspot) => {
        const { x, y } = project(anchorOf(hotspot.id), view, viewport)
        return (
          <div
            key={hotspot.id}
            className="lobby-hotspot-anchor"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {bubbles?.[hotspot.id] && (
              <div className="lobby-hotspot-bubble">{bubbles[hotspot.id]}</div>
            )}
            <button
              type="button"
              className="lobby-hotspot"
              data-dot={dots ? "" : undefined}
              onPointerDown={() => {
                pressed.current = hotspot.id
              }}
              onPointerCancel={() => {
                pressed.current = null
              }}
              onBlur={() => {
                if (pressed.current === hotspot.id) pressed.current = null
              }}
              onClick={(event) => {
                pressed.current = null
                if (event.detail === 0) onKey(hotspot.id)
                else onTap(hotspot.id)
              }}
              onFocus={() => {
                if (pressed.current !== hotspot.id) onFocusSpot?.(hotspot.id)
              }}
            >
              <span className="sr-only">{hotspot.label}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
