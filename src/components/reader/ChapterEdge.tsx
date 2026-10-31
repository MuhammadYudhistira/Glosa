import type { ReaderMove } from "./reader-input"
import type { ChapterEdgeState } from "./ReaderView"

function wordsOf(edge: ChapterEdgeState) {
  if (edge.side === "end") {
    return edge.label
      ? { lead: "Akhir bab · Gulir terus ke ", label: edge.label }
      : { lead: "Akhir bagian · Gulir terus untuk lanjut", label: null }
  }
  return edge.label
    ? { lead: "Tarik ke bawah ke ", label: edge.label }
    : { lead: "Tarik ke bawah ke bagian sebelumnya", label: null }
}

/**
 * The way on at a section's edge in the scrolled flow (spec pindah bab §3):
 * where scrolling on leads, a bar that fills while the member pulls, and a
 * press that moves there at once.
 */
export function ChapterEdge({
  edge,
  chromeShown,
  backShown,
  onMove,
}: {
  edge: ChapterEdgeState | null
  /** The reader's bars show: the marker stays clear of them. */
  chromeShown: boolean
  /** Kembali shows above the bottom bar: the marker goes above it. */
  backShown: boolean
  onMove: (move: Extract<ReaderMove, "next" | "prev">) => void
}) {
  if (!edge) return null
  const place = {
    "data-side": edge.side,
    "data-chrome": chromeShown ? "shown" : "hidden",
    "data-back": chromeShown && backShown,
  }
  if (edge.bookEnd) {
    return (
      <output className="chapter-edge" {...place}>
        Akhir buku
      </output>
    )
  }
  const { lead, label } = wordsOf(edge)
  return (
    <button
      type="button"
      className="chapter-edge"
      {...place}
      onClick={() => onMove(edge.side === "end" ? "next" : "prev")}
    >
      <span>
        {lead}
        {label && <strong>{label}</strong>}
      </span>
      <span aria-hidden="true" className="chapter-edge-bar">
        <span
          className="chapter-edge-fill"
          style={{ transform: `scaleX(${edge.progress})` }}
        />
      </span>
    </button>
  )
}
