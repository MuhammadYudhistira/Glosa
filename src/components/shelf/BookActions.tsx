import { useServerFn } from "@tanstack/react-start"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { bookMessage } from "@/lib/book-messages"
import type { ShelfBook } from "@/lib/book-types"
import {
  GENRE_LABELS,
  GENRE_VALUES,
  type Genre,
  TROLLEY_LABEL,
  isGenre,
} from "@/lib/genre"
import { formatBytes } from "@/lib/member"
import { deleteBookFn } from "@/server/books"
import { useSaveGenre } from "./useSaveGenre"

export function BookActions({
  book,
  onGenreSaved,
  onDeleted,
}: {
  book: ShelfBook
  onGenreSaved: (genre: Genre) => void
  onDeleted: (book: ShelfBook) => void
}) {
  const genreId = useId()
  const { save, saving } = useSaveGenre()
  const [genre, setGenre] = useState<Genre | null>(book.genre)
  const [genreState, setGenreState] = useState<
    "idle" | "saved" | { code: string }
  >("idle")

  const deleteBook = useServerFn(deleteBookFn)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function onGenre(value: string) {
    if (!isGenre(value)) return
    const previous = genre
    setGenre(value)
    setGenreState("idle")
    const result = await save(book.id, value)
    if (result.ok) {
      setGenreState("saved")
      onGenreSaved(value)
    } else {
      setGenre(previous)
      setGenreState({ code: result.code })
    }
  }

  async function onConfirmDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteBook({ data: { bookId: book.id } })
      if (result.ok) {
        onDeleted(book)
        return
      }
      setDeleteError(result.code)
    } catch {
      setDeleteError("unknown")
    }
    setDeleting(false)
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="space-y-1">
        <label htmlFor={genreId} className="block text-sm font-bold">
          Genre
        </label>
        <select
          id={genreId}
          value={genre ?? ""}
          disabled={saving}
          onChange={(event) => void onGenre(event.target.value)}
          className="native-select w-full"
        >
          {genre === null && <option value="">{TROLLEY_LABEL}</option>}
          {GENRE_VALUES.map((value) => (
            <option key={value} value={value}>
              {GENRE_LABELS[value]}
            </option>
          ))}
        </select>
        <output className="block min-h-4 text-xs text-muted-foreground">
          {genreState === "saved" ? "Genre disimpan." : ""}
        </output>
        {typeof genreState === "object" && (
          <p role="alert" className="text-xs text-stamp">
            {bookMessage(genreState.code)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {!confirming ? (
          <Button variant="destructive" onClick={() => setConfirming(true)}>
            Hapus buku
          </Button>
        ) : (
          <>
            <p className="text-sm">
              Hapus “{book.title}” beserta filenya? Kuota{" "}
              {formatBytes(book.sizeBytes)} kembali ke rakmu.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => void onConfirmDelete()}
                disabled={deleting}
              >
                {deleting ? "Menghapus…" : "Ya, hapus"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirming(false)}
                disabled={deleting}
              >
                Batal
              </Button>
            </div>
          </>
        )}
        {deleteError && (
          <p role="alert" className="text-sm text-stamp">
            {bookMessage(deleteError)}
          </p>
        )}
      </div>
    </div>
  )
}
