import type { CSSProperties } from "react"
import { Panel } from "@/components/ui/panel"
import type { HotspotModel } from "./lobby-data"
import { ATRIUM, type HotspotId, type Point2, spotOf } from "./scene/layout"

/**
 * Where a floor point lies on the map: the atrium seen from above, turned like
 * the isometric view, so the map is a diamond (left edge: the left wall).
 */
function onMap([x, z]: Point2): CSSProperties {
  return {
    left: `${50 + ((x - z) / (2 * ATRIUM.size)) * 100}%`,
    top: `${((x + z) / (2 * ATRIUM.size)) * 100}%`,
  }
}

const floorOf = (id: HotspotId): Point2 => {
  const [x, , z] = spotOf(id).label
  return [x, z]
}

/** A small plan of the lobby; tapping a place moves the camera there (spec 1D §5.2). */
export function LibraryMap({
  hotspots,
  anda,
  onSelect,
  interactive = true,
}: {
  hotspots: ReadonlyArray<HotspotModel>
  anda: Point2
  onSelect: (id: HotspotId) => void
  /** False without a live 3D camera: the spots would have nothing to move. */
  interactive?: boolean
}) {
  return (
    <Panel className="lobby-panel">
      <h2 className="lobby-panel-title">Peta Perpustakaan</h2>
      <div className="lobby-map">
        {hotspots.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            className="lobby-map-spot"
            data-kind={count === null ? "place" : "zone"}
            style={onMap(floorOf(id))}
            aria-label={`${label} di peta`}
            title={label}
            disabled={!interactive}
            onClick={() => onSelect(id)}
          />
        ))}
        <span className="lobby-map-anda" style={onMap(anda)}>
          <span className="sr-only">Anda</span>
        </span>
      </div>
      {!interactive && (
        <p className="mt-2 text-xs text-muted-foreground">
          Peta aktif saat adegan 3D tampil.
        </p>
      )}
    </Panel>
  )
}
