import type { CSSProperties } from "react"
import { Panel } from "@/components/ui/panel"
import { cn } from "@/lib/utils"
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

/** How a place shows on the map; the legend uses the same marks. */
type MapKind = "zone" | "meja-baca" | "meja-admin" | "troli" | "katalog"
const kindOf = (id: HotspotId, count: number | null): MapKind =>
  count !== null ? "zone" : (id as Exclude<MapKind, "zone">)

const LEGEND: ReadonlyArray<[MapKind | "anda", string]> = [
  ["zone", "Rak buku"],
  ["meja-baca", "Meja Baca"],
  ["meja-admin", "Meja Admin"],
  ["troli", "Troli Buku Baru"],
  ["katalog", "Kosakata"],
  ["anda", "Posisi Anda"],
]

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
  className,
}: {
  hotspots: ReadonlyArray<HotspotModel>
  anda: Point2
  onSelect: (id: HotspotId) => void
  /** False without a live 3D camera: the spots would have nothing to move. */
  interactive?: boolean
  className?: string
}) {
  return (
    <Panel className={cn("lobby-panel", className)}>
      <div className="lobby-panel-title">
        <h2>Peta Perpustakaan</h2>
        {interactive && (
          <span className="lobby-panel-hint">ketuk untuk pindah</span>
        )}
      </div>
      <div className="lobby-map">
        {hotspots.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            className="lobby-map-spot"
            data-kind={kindOf(id, count)}
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
      <ul aria-hidden="true" className="lobby-legend">
        {LEGEND.map(([kind, label]) => (
          <li key={kind}>
            <span className="lobby-map-mark" data-kind={kind} />
            {label}
          </li>
        ))}
      </ul>
      {!interactive && (
        <p className="mt-2 text-xs text-muted-foreground">
          Peta aktif saat adegan 3D tampil.
        </p>
      )}
    </Panel>
  )
}
