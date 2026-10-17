import type { ReactNode } from "react"
import type { ShelfBook } from "@/lib/book-types"
import { formatPercent } from "@/lib/progress"
import { BookCover } from "./BookCover"
import { type LocalShelf, shelfPercentage } from "./useLocalShelf"

export function BookGrid({
  books,
  local,
  onOpen,
  footer,
}: {
  books: ReadonlyArray<ShelfBook>
  local: LocalShelf
  onOpen: (book: ShelfBook) => void
  footer?: (book: ShelfBook) => ReactNode
}) {
  return (
    <ul className="shelf-grid">
      {books.map((book) => {
        const percentage = shelfPercentage(book, local)
        return (
          <li key={book.id} className="shelf-slot">
            <button
              type="button"
              onClick={() => onOpen(book)}
              className="block w-full rounded-sm text-left outline-offset-4 focus-visible:outline-2 focus-visible:outline-mint"
            >
              <BookCover book={book} />
              {percentage > 0 && (
                <progress
                  max={100}
                  value={percentage}
                  aria-label={`Dibaca ${formatPercent(percentage)}`}
                  className="book-progress mt-1.5"
                />
              )}
              <span className="mt-2 line-clamp-2 block min-h-[2lh] text-xs font-bold">
                {book.title}
              </span>
              {book.author && (
                <span className="line-clamp-1 text-[0.7rem] text-muted-foreground">
                  {book.author}
                </span>
              )}
              {local.saved.has(book.id) && (
                <span className="offline-badge mt-1">Tersedia offline</span>
              )}
            </button>
            {footer?.(book)}
          </li>
        )
      })}
    </ul>
  )
}
