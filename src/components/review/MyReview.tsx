import { useCallback, useState } from "react"
import { FinishCardDialog } from "@/components/review/FinishCardDialog"
import { Button } from "@/components/ui/button"
import type { ShelfBook } from "@/lib/book-types"
import { fetchCoverBlob } from "@/lib/quote-card/cover-art"
import { DIFFICULTY_LABELS } from "@/lib/review"

/**
 * "Ulasan saya" and "Lihat kartu" in a finished book's details (spec 3E §4.2).
 * The review comes with the shelf list, so it shows offline; changing it needs
 * a connection (the form says so).
 */
export function MyReview({
  book,
  offline = false,
  onChanged,
}: {
  book: ShelfBook
  offline?: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState<"card" | "form" | null>(null)
  const [expanded, setExpanded] = useState(false)
  const loadCover = useCallback(
    () => fetchCoverBlob(book.coverUrl),
    [book.coverUrl]
  )
  if (book.finishedAt === null) return null
  const { review } = book
  // Only decides whether "Baca selengkapnya" shows; the CSS does the clamping.
  const longNote = (review?.note?.length ?? 0) > 140

  return (
    <section aria-label="Ulasan saya" className="space-y-2">
      <h3 className="text-sm font-bold">Ulasan saya</h3>
      {review && (
        <div className="space-y-1 text-sm">
          <p>
            <span aria-hidden="true">
              {"★".repeat(review.rating)}
              {"☆".repeat(5 - review.rating)}
            </span>
            <span className="sr-only">{review.rating} dari 5 bintang</span>
            {review.difficulty && (
              <span className="ml-2 text-muted-foreground">
                {DIFFICULTY_LABELS[review.difficulty]}
              </span>
            )}
          </p>
          {review.note && (
            <p
              data-testid="review-note"
              className={
                expanded
                  ? "whitespace-pre-line"
                  : "line-clamp-3 whitespace-pre-line"
              }
            >
              {review.note}
            </p>
          )}
          {longNote && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Tutup" : "Baca selengkapnya"}
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen("form")}>
          {review ? "Ubah" : "Tulis ulasan"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpen("card")}>
          Lihat kartu
        </Button>
      </div>
      {open && (
        <FinishCardDialog
          book={book}
          loadCover={loadCover}
          fallbackReview={review}
          start={open}
          offline={offline}
          onChanged={onChanged}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}
