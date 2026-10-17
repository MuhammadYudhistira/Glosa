import { useState } from "react"
import { BookCover } from "@/components/shelf/BookCover"
import { TrolleyGenrePicker } from "@/components/shelf/TrolleyGenrePicker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ShelfBook } from "@/lib/book-types"
import { genreLabel } from "@/lib/genre"
import { useOnline } from "@/lib/use-online"

/** "Susun buku": give each trolley book its shelf, from the lobby (spec 1D §5.1). */
export function TrolleyPanel({
  open,
  onOpenChange,
  books,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  books: ReadonlyArray<ShelfBook>
  onSaved: () => void
}) {
  const online = useOnline()
  const [notice, setNotice] = useState("")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setNotice("")
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Susun buku</DialogTitle>
          <DialogDescription>
            Pilih rak untuk setiap buku di troli.
          </DialogDescription>
        </DialogHeader>
        {!online && <p className="text-sm text-stamp">Butuh internet.</p>}
        {books.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Troli kosong. Semua buku sudah punya rak.
          </p>
        ) : (
          <ul className="divide-y">
            {books.map((book) => (
              <li key={book.id} className="flex items-center gap-3 py-3">
                <BookCover book={book} className="w-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{book.title}</p>
                  {book.author && (
                    <p className="truncate text-xs text-muted-foreground">
                      {book.author}
                    </p>
                  )}
                </div>
                {online && (
                  <div className="w-44 shrink-0">
                    <TrolleyGenrePicker
                      book={book}
                      onSaved={(genre) => {
                        setNotice(`Dipindahkan ke ${genreLabel(genre)}.`)
                        onSaved()
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <output className="block min-h-5 text-sm text-mint">{notice}</output>
      </DialogContent>
    </Dialog>
  )
}
