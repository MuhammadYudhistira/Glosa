import type { ReactNode } from "react"
import type { ShelfBook } from "@/lib/book-types"
import { BookCover } from "./BookCover"

export function BookGrid({
  books,
  onOpen,
  footer,
}: {
  books: ReadonlyArray<ShelfBook>
  onOpen: (book: ShelfBook) => void
  footer?: (book: ShelfBook) => ReactNode
}) {
  return (
    <ul className="shelf-grid">
      {books.map((book) => (
        <li key={book.id} className="shelf-slot">
          <button
            type="button"
            onClick={() => onOpen(book)}
            className="block w-full rounded-sm text-left outline-offset-4 focus-visible:outline-2 focus-visible:outline-mint"
          >
            <BookCover book={book} />
            <span className="mt-2 line-clamp-2 text-xs font-bold">
              {book.title}
            </span>
            {book.author && (
              <span className="line-clamp-1 text-[0.7rem] text-muted-foreground">
                {book.author}
              </span>
            )}
          </button>
          {footer?.(book)}
        </li>
      ))}
    </ul>
  )
}
