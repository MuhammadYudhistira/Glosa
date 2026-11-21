import { Link } from "@tanstack/react-router"
import { useId } from "react"
import type { ShelfBook } from "@/lib/book-types"
import { formatPercent } from "@/lib/progress"
import { BookCover } from "./BookCover"

/** The book being read, in front of the grid (spec poles mobile §3.2). */
export function CurrentReadCard({
  book,
  percentage,
  onOpen,
}: {
  book: ShelfBook
  percentage: number
  onOpen: (book: ShelfBook) => void
}) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="current-read">
      <h2 id={titleId} className="current-read-kicker">
        Sedang dibaca
      </h2>
      <div className="current-read-body">
        <button
          type="button"
          onClick={() => onOpen(book)}
          className="current-read-book"
        >
          <span className="current-read-cover">
            <BookCover book={book} />
          </span>
          <span className="min-w-0">
            <span className="line-clamp-2 block font-bold">{book.title}</span>
            {book.author && (
              <span className="line-clamp-1 block text-sm text-muted-foreground">
                {book.author}
              </span>
            )}
          </span>
        </button>
        <progress
          max={100}
          value={percentage}
          aria-label={`Dibaca ${formatPercent(percentage)}`}
          className="book-progress"
        />
        <Link
          to="/read/$bookId"
          params={{ bookId: book.id }}
          // Preloading would download the whole EPUB on hover (see ReadLink).
          preload={false}
          className="current-read-continue"
        >
          Lanjutkan · {formatPercent(percentage)}
        </Link>
      </div>
    </section>
  )
}
