import { useServerFn } from "@tanstack/react-start"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { BookLoadError, saveBookOffline } from "@/lib/book-download"
import { bookMessage } from "@/lib/book-messages"
import type { ShelfBook } from "@/lib/book-types"
import {
  GENRE_LABELS,
  GENRE_VALUES,
  type Genre,
  TROLLEY_LABEL,
  isGenre,
} from "@/lib/genre"
import { removeLocalBook } from "@/lib/local/book-files"
import { removeLocalPosition } from "@/lib/local/positions"
import { formatBytes } from "@/lib/member"
import { useOnline } from "@/lib/use-online"
import { deleteBookFn } from "@/server/books"
import { announceLocalChange } from "./useLocalShelf"
import { useSaveGenre } from "./useSaveGenre"

type CopyState = "idle" | "saved" | "removed" | { code: string }

export function BookActions({
  book,
  saved,
  onGenreSaved,
  onDeleted,
}: {
  book: ShelfBook
  /** Whether this device holds the EPUB for offline reading. */
  saved: boolean
  onGenreSaved: (genre: Genre) => void
  onDeleted: (book: ShelfBook) => void
}) {
  const genreId = useId()
  const online = useOnline()
  const { save, saving } = useSaveGenre()
  const [genre, setGenre] = useState<Genre | null>(book.genre)
  const [genreState, setGenreState] = useState<
    "idle" | "saved" | { code: string }
  >("idle")

  const deleteBook = useServerFn(deleteBookFn)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [copyBusy, setCopyBusy] = useState(false)
  const [copyState, setCopyState] = useState<CopyState>("idle")

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
        // The book is gone from the server: this device's copy goes too (spec §5).
        await Promise.all([
          removeLocalBook(book.id),
          removeLocalPosition(book.id),
        ]).catch((error: unknown) =>
          console.error("removing this device's copy failed", error)
        )
        announceLocalChange()
        onDeleted(book)
        return
      }
      setDeleteError(result.code)
    } catch {
      setDeleteError("unknown")
    }
    setDeleting(false)
  }

  async function onSaveOffline() {
    setCopyBusy(true)
    setCopyState("idle")
    try {
      const stored = await saveBookOffline(book.id)
      setCopyState(stored ? "saved" : { code: "device_full_offline" })
      if (stored) announceLocalChange()
    } catch (error) {
      setCopyState({
        code: error instanceof BookLoadError ? error.code : "unknown",
      })
    }
    setCopyBusy(false)
  }

  async function onRemoveCopy() {
    setCopyBusy(true)
    setCopyState("idle")
    try {
      // Only the file: a position not yet sent stays until it reaches the server.
      await removeLocalBook(book.id)
      setCopyState("removed")
      announceLocalChange()
    } catch {
      setCopyState({ code: "unknown" })
    }
    setCopyBusy(false)
  }

  return (
    <div className="space-y-4 border-t pt-4">
      {!online && (
        <p className="text-xs text-muted-foreground">
          {bookMessage("offline")}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor={genreId} className="block text-sm font-bold">
          Genre
        </label>
        <select
          id={genreId}
          value={genre ?? ""}
          disabled={saving || !online}
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

      <div className="space-y-1">
        <p className="text-sm font-bold">Di perangkat ini</p>
        {saved ? (
          <Button
            variant="outline"
            onClick={() => void onRemoveCopy()}
            disabled={copyBusy}
          >
            Hapus dari perangkat
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => void onSaveOffline()}
            disabled={copyBusy || !online}
          >
            {copyBusy ? "Menyimpan…" : "Simpan offline"}
          </Button>
        )}
        <output className="block min-h-4 text-xs text-muted-foreground">
          {copyState === "saved"
            ? "Tersimpan untuk offline."
            : copyState === "removed"
              ? "Salinan di perangkat ini dihapus."
              : ""}
        </output>
        {typeof copyState === "object" && (
          <p role="alert" className="text-xs text-stamp">
            {bookMessage(copyState.code)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {!confirming ? (
          <Button
            variant="destructive"
            onClick={() => setConfirming(true)}
            disabled={!online}
          >
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
                disabled={deleting || !online}
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
