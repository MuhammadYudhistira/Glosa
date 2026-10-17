import { Link } from "@tanstack/react-router"
import { BookCover } from "@/components/shelf/BookCover"
import {
  type LocalShelf,
  shelfPercentage,
} from "@/components/shelf/useLocalShelf"
import { Panel } from "@/components/ui/panel"
import type { ShelfBook } from "@/lib/book-types"
import { cn } from "@/lib/utils"

/** The last five books opened, with their covers and progress (spec 1D §5.2). */
export function RecentBooks({
  books,
  local,
  onSelect,
  className,
}: {
  books: ReadonlyArray<ShelfBook>
  local: LocalShelf
  onSelect: (book: ShelfBook) => void
  className?: string
}) {
  if (books.length === 0) return null
  return (
    <Panel className={cn("lobby-panel", className)}>
      <div className="lobby-panel-title">
        <h2>Baru Dibuka</h2>
        <Link to="/shelf" className="lobby-panel-hint">
          Lihat semua di Rak Saya →
        </Link>
      </div>
      <ul className="lobby-recent-row">
        {books.map((book) => (
          <li key={book.id}>
            <button
              type="button"
              // Without this the progress value leaks into the button's name.
              aria-label={book.title}
              className="lobby-recent-book"
              onClick={() => onSelect(book)}
            >
              <BookCover book={book} className="mx-auto mb-1.5 w-14" />
              <span className="block truncate text-xs font-bold">
                {book.title}
              </span>
              {book.author && (
                <span className="block truncate text-[0.7rem] text-muted-foreground">
                  {book.author}
                </span>
              )}
              <progress
                className="book-progress mt-1"
                max={100}
                value={shelfPercentage(book, local)}
                aria-label={`Progres ${book.title}`}
              />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
