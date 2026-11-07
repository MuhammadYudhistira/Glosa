import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { bookMessage } from "@/lib/book-messages"
import {
  type BookReview,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  type Difficulty,
  MAX_NOTE,
  NOTE_COUNTER_FROM,
  RATINGS,
} from "@/lib/review"
import { deleteReviewFn, saveReviewFn } from "@/server/reviews"

const count = new Intl.NumberFormat("id-ID")

/** Stars, difficulty and note of a finished book (spec 3E §4.1). Saving needs a connection. */
export function ReviewForm({
  bookId,
  initial,
  words,
  offline,
  onSaved,
  onCancel,
}: {
  bookId: string
  initial: BookReview | null
  /** The book's first saved words, at most 12; read only. */
  words: Array<string>
  offline: boolean
  /** The review as saved, or null after "Hapus ulasan". */
  onSaved: (review: BookReview | null) => void
  onCancel: () => void
}) {
  const save = useServerFn(saveReviewFn)
  const remove = useServerFn(deleteReviewFn)
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(
    initial?.difficulty ?? null
  )
  const [note, setNote] = useState(initial?.note ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(
    action: () => Promise<{ ok: boolean; code?: string }>,
    done: () => void
  ) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      if (result.ok) done()
      else setError(result.code ?? "unknown")
    } catch {
      setError("unknown")
    }
    setBusy(false)
  }
  const onSave = () => {
    if (rating === null) return
    const trimmed = note.trim()
    void run(
      () =>
        save({
          data: {
            bookId,
            rating,
            difficulty,
            note: trimmed === "" ? null : trimmed,
          },
        }),
      () =>
        onSaved({
          rating,
          difficulty,
          note: trimmed === "" ? null : trimmed,
          updatedAt: new Date().toISOString(),
        })
    )
  }
  const onDelete = () =>
    void run(
      () => remove({ data: { bookId } }),
      () => onSaved(null)
    )

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Bintang" className="flex gap-1">
        {RATINGS.map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} bintang`}
            aria-pressed={rating === value}
            className="text-3xl leading-none text-muted-foreground aria-pressed:text-primary"
            data-lit={rating !== null && value <= rating}
            onClick={() => setRating(value)}
          >
            <span aria-hidden="true">
              {rating !== null && value <= rating ? "★" : "☆"}
            </span>
          </button>
        ))}
      </div>
      <div role="group" aria-label="Kesulitan" className="flex gap-2">
        {DIFFICULTIES.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={difficulty === value}
            onClick={() => setDifficulty(difficulty === value ? null : value)}
          >
            {DIFFICULTY_LABELS[value]}
          </Button>
        ))}
      </div>
      <div className="space-y-1">
        <label htmlFor="review-note" className="text-sm font-medium">
          Catatan
        </label>
        <textarea
          id="review-note"
          value={note}
          maxLength={MAX_NOTE}
          rows={4}
          className="w-full rounded-md border bg-background p-2 text-sm"
          onChange={(event) => setNote(event.target.value)}
        />
        {note.length >= NOTE_COUNTER_FROM && (
          <p className="text-xs text-muted-foreground">
            {count.format(note.length)} / {count.format(MAX_NOTE)}
          </p>
        )}
      </div>
      {words.length > 0 && (
        <section aria-label="Kata dari buku ini" className="space-y-1">
          <h3 className="text-sm font-medium">Kata dari buku ini</h3>
          <ul className="flex flex-wrap gap-1 text-sm">
            {words.map((word) => (
              <li key={word} className="rounded bg-muted px-2 py-0.5">
                {word}
              </li>
            ))}
          </ul>
          <Link
            to="/vocabulary"
            search={{ buku: bookId }}
            className="text-sm underline underline-offset-2"
          >
            Lihat semua
          </Link>
        </section>
      )}
      {offline && (
        <p className="text-xs text-muted-foreground">Perlu koneksi internet</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-stamp">
          {bookMessage(error)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          disabled={offline || rating === null || busy}
          aria-busy={busy}
          onClick={onSave}
        >
          Simpan
        </Button>
        {initial && (
          <Button
            size="lg"
            variant="outline"
            disabled={offline || busy}
            onClick={onDelete}
          >
            Hapus ulasan
          </Button>
        )}
        <Button size="lg" variant="ghost" disabled={busy} onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  )
}
