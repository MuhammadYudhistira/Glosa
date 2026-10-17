import { type ReactNode, useId, useState } from "react"
import { BookActions } from "@/components/shelf/BookActions"
import { BookCover } from "@/components/shelf/BookCover"
import { BookFacts } from "@/components/shelf/BookDetail"
import { ReadLink } from "@/components/shelf/ReadLink"
import {
  type LocalShelf,
  shelfPercentage,
} from "@/components/shelf/useLocalShelf"
import { Button } from "@/components/ui/button"
import type { ShelfBook } from "@/lib/book-types"
import { LibrarianWelcome, ReadingHint } from "./LobbyBubbles"

/**
 * The phone's bottom sheet (spec 1D §5.2): the last book, whose details open
 * in the sheet. On an empty shelf it holds the librarian's greeting, since the
 * admin desk is off screen in the phone's first view.
 */
export function ContinueSheet({
  book,
  empty,
  local,
  onChanged,
  onDeleted,
}: {
  book: ShelfBook | null
  empty: boolean
  local: LocalShelf
  onChanged: () => void
  onDeleted: (book: ShelfBook) => void
}) {
  const titleId = useId()
  const [open, setOpen] = useState(false)

  let content: ReactNode
  if (empty) {
    content = <LibrarianWelcome />
  } else if (!book) {
    content = <ReadingHint />
  } else {
    const percentage = shelfPercentage(book, local)
    content = (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <BookCover book={book} className="w-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{book.title}</p>
            {book.author && (
              <p className="truncate text-xs text-muted-foreground">
                {book.author}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? "Tutup detail" : "Detail"}
          </Button>
        </div>
        <ReadLink bookId={book.id} percentage={percentage} />
        {open && (
          <div className="max-h-[50dvh] space-y-3 overflow-y-auto">
            <BookFacts book={book} percentage={percentage} />
            <BookActions
              key={book.id}
              book={book}
              saved={local.saved.has(book.id)}
              onGenreSaved={onChanged}
              onDeleted={onDeleted}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <section aria-labelledby={titleId} className="lobby-sheet lobby-overlay">
      <h2 id={titleId} className="lobby-panel-title">
        Lanjutkan membaca
      </h2>
      {content}
    </section>
  )
}
