import { BookmarkIcon, Share2Icon, Trash2Icon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { HIGHLIGHT_FILL } from "@/lib/annotations/draw"
import { inBookOrder } from "@/lib/annotations/places"
import type { Annotation } from "@/lib/annotations/types"
import { isQuotable } from "@/lib/quote-card/quote-text"
import { COLOR_LABELS } from "./AnnotationPopup"

const NAME_EXCERPT_MAX = 25

/** Accessible name of an item's button: the action, the kind and a short excerpt, so each is distinct. */
function itemLabel(
  action: "Hapus" | "Bagikan",
  annotation: Annotation
): string {
  const kind = annotation.kind === "bookmark" ? "bookmark" : "highlight"
  const excerpt = annotation.excerpt.trim()
  if (!excerpt) return `${action} ${kind}`
  const short =
    excerpt.length > NAME_EXCERPT_MAX
      ? `${excerpt.slice(0, NAME_EXCERPT_MAX).trimEnd()}…`
      : excerpt
  return `${action} ${kind} "${short}"`
}

type ChaptersOf = (cfis: ReadonlyArray<string>) => Promise<Array<string | null>>

/**
 * The Anotasi tab (spec 2 §6.6): bookmarks and highlights in book order, with
 * their text, colour, note and chapter. A tap goes to the place.
 */
export function AnnotationList({
  annotations,
  chaptersOf,
  onSelect,
  onDelete,
  onShare,
}: {
  annotations: ReadonlyArray<Annotation>
  /** Null until the book is open. */
  chaptersOf: ChaptersOf | null
  onSelect: (cfi: string) => void
  onDelete: (annotation: Annotation) => void
  onShare: (annotation: Annotation) => void
}) {
  const ordered = useMemo(() => inBookOrder(annotations), [annotations])
  const [chapters, setChapters] = useState<ReadonlyMap<string, string | null>>(
    new Map()
  )

  useEffect(() => {
    if (!chaptersOf || ordered.length === 0) return
    let live = true
    const cfis = ordered.map((annotation) => annotation.cfi)
    chaptersOf(cfis)
      .then((labels) => {
        if (live) setChapters(new Map(cfis.map((cfi, i) => [cfi, labels[i]])))
      })
      .catch((error: unknown) =>
        console.error("reading the chapters of annotations failed", error)
      )
    return () => {
      live = false
    }
  }, [ordered, chaptersOf])

  if (ordered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada anotasi. Pilih teks untuk membuat highlight, atau ketuk tombol
        bookmark untuk menandai halaman.
      </p>
    )
  }
  return (
    <ol className="annotation-list">
      {ordered.map((annotation) => {
        const chapter = chapters.get(annotation.cfi)
        const bookmark = annotation.kind === "bookmark"
        return (
          <li key={annotation.id} className="annotation-item">
            <button
              type="button"
              className="annotation-place"
              onClick={() => onSelect(annotation.cfi)}
            >
              <span className="annotation-kind">
                {bookmark ? (
                  <BookmarkIcon aria-hidden="true" className="size-3" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="annotation-dot"
                    style={{
                      background: HIGHLIGHT_FILL[annotation.color ?? "yellow"],
                    }}
                  />
                )}
                {bookmark
                  ? "Bookmark"
                  : `Highlight ${COLOR_LABELS[annotation.color ?? "yellow"].toLowerCase()}`}
                {chapter ? ` · ${chapter}` : ""}
              </span>
              <span className="annotation-excerpt">
                {annotation.excerpt || "…"}
              </span>
              {annotation.note && (
                <span className="annotation-note">{annotation.note}</span>
              )}
            </button>
            {!bookmark && isQuotable(annotation.excerpt) && (
              <Button
                variant="ghost"
                size="icon-lg"
                className="size-10"
                aria-label={itemLabel("Bagikan", annotation)}
                onClick={() => onShare(annotation)}
              >
                <Share2Icon aria-hidden="true" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-lg"
              className="size-10"
              aria-label={itemLabel("Hapus", annotation)}
              onClick={() => onDelete(annotation)}
            >
              <Trash2Icon aria-hidden="true" />
            </Button>
          </li>
        )
      })}
    </ol>
  )
}
