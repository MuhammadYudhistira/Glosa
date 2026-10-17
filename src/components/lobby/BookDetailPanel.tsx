import { XIcon } from "lucide-react"
import { useEffect, useId, useRef } from "react"
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
import { cn } from "@/lib/utils"

/** The book picked from the search or "Baru Dibuka", beside the scene. */
export function BookDetailPanel({
  book,
  local,
  onClose,
  onChanged,
  onDeleted,
  className,
}: {
  book: ShelfBook
  local: LocalShelf
  onClose: () => void
  onChanged: () => void
  onDeleted: (book: ShelfBook) => void
  className?: string
}) {
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  // A picked book takes the focus, so the keyboard lands on its details.
  useEffect(() => {
    titleRef.current?.focus()
  }, [book.id])
  const percentage = shelfPercentage(book, local)
  return (
    <Panel
      role="region"
      aria-labelledby={titleId}
      className={cn("lobby-panel space-y-3", className)}
    >
      <div className="flex items-start gap-3">
        <BookCover book={book} className="w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className="font-heading text-lg leading-tight outline-none"
          >
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
