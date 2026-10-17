import type { ReactNode } from "react"
import type { HotspotModel } from "./lobby-data"
import { type HotspotId, spotOf } from "./scene/layout"
import { type View, type Viewport, project } from "./scene/projection"

/**
 * The lobby's places as HTML buttons over the scene (spec 1D §5.1), placed by
 * projecting their 3D spot with the camera's current view.
 */
export function HotspotLayer({
  hotspots,
  view,
  viewport,
  bubbles,
  onActivate,
  onFocusSpot,
}: {
  hotspots: ReadonlyArray<HotspotModel>
  view: View
  viewport: Viewport
  /** Speech bubbles shown above a hotspot. */
  bubbles?: Partial<Record<HotspotId, ReactNode>>
  onActivate: (id: HotspotId) => void
  onFocusSpot?: (id: HotspotId) => void
}) {
  return (
    <div className="lobby-hotspots lobby-overlay">
      {hotspots.map((hotspot) => {
        const { x, y } = project(spotOf(hotspot.id).label, view, viewport)
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
              onClick={() => onActivate(hotspot.id)}
              onFocus={() => onFocusSpot?.(hotspot.id)}
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
