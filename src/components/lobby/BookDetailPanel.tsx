import { XIcon } from "lucide-react"
import { useId } from "react"
import { BookActions } from "@/components/shelf/BookActions"
import { BookCover } from "@/components/shelf/BookCover"
import { BookFacts } from "@/components/shelf/BookDetail"
import { ReadLink } from "@/components/shelf/ReadLink"
import {
  type LocalShelf,
  shelfPercentage,
} from "@/components/shelf/useLocalShelf"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"
import type { ShelfBook } from "@/lib/book-types"

/** The book picked from the search or "Baru Dibuka", beside the scene. */
export function BookDetailPanel({
  book,
  local,
  onClose,
  onChanged,
  onDeleted,
}: {
  book: ShelfBook
  local: LocalShelf
  onClose: () => void
  onChanged: () => void
  onDeleted: (book: ShelfBook) => void
}) {
  const titleId = useId()
  const percentage = shelfPercentage(book, local)
  return (
    <Panel
      role="region"
      aria-labelledby={titleId}
      className="lobby-panel space-y-3"
    >
      <div className="flex items-start gap-3">
        <BookCover book={book} className="w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-heading text-lg leading-tight">
            {book.title}
          </h2>
          {book.author && (
            <p className="text-sm text-muted-foreground">{book.author}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Tutup detail"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      <BookFacts book={book} percentage={percentage} />
      <ReadLink bookId={book.id} percentage={percentage} />
      <BookActions
        key={book.id}
        book={book}
        saved={local.saved.has(book.id)}
        onGenreSaved={onChanged}
        onDeleted={onDeleted}
      />
    </Panel>
  )
}
