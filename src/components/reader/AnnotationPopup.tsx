import { Button } from "@/components/ui/button"
import { HIGHLIGHT_FILL } from "@/lib/annotations/draw"
import {
  type Annotation,
  HIGHLIGHT_COLORS,
  type HighlightColor,
} from "@/lib/annotations/types"
import { ReaderPopup, type WordRect } from "./ReaderPopup"
import type { WordTap } from "./WordPopup"

/** A tap on a highlight: which one, where, and the word under the tap if any. */
export type HighlightTap = { cfi: string; rect: WordRect; word: WordTap | null }

export const COLOR_LABELS: Record<HighlightColor, string> = {
  yellow: "Kuning",
  green: "Hijau",
  blue: "Biru",
  pink: "Merah muda",
}

/**
 * What a tapped highlight can do (spec 2 §6.6): another colour, its note,
 * deletion, and the meaning of the word tapped inside it.
 */
export function AnnotationPopup({
  tap,
  annotation,
  onColor,
  onNote,
  onDelete,
  onMeaning,
  onClose,
  finalFocus,
}: {
  tap: HighlightTap | null
  /** The highlight tapped, or null once it is gone. */
  annotation: Annotation | null
  onColor: (color: HighlightColor) => void
  onNote: () => void
  onDelete: () => void
  onMeaning: () => void
  onClose: () => void
  finalFocus: () => HTMLElement | null
}) {
  if (!tap || !annotation) return null
  return (
    <ReaderPopup
      rect={tap.rect}
      label="Highlight"
      onClose={onClose}
      finalFocus={finalFocus}
    >
      <div className="annotation-card">
        <div role="group" aria-label="Warna" className="annotation-colors">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={COLOR_LABELS[color]}
              aria-pressed={annotation.color === color}
              className="annotation-swatch"
              style={{ background: HIGHLIGHT_FILL[color] }}
              onClick={() => onColor(color)}
            />
          ))}
        </div>
        {annotation.note && (
          <p className="annotation-note">{annotation.note}</p>
        )}
        <div className="annotation-actions">
          <Button size="lg" variant="outline" onClick={onNote}>
            Catatan
          </Button>
          <Button size="lg" variant="destructive" onClick={onDelete}>
            Hapus
          </Button>
          {tap.word && (
            <Button size="lg" variant="ghost" onClick={onMeaning}>
              {`Arti "${tap.word.word}"`}
            </Button>
          )}
        </div>
      </div>
    </ReaderPopup>
  )
}
