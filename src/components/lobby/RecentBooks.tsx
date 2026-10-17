import {
  type LocalShelf,
  shelfPercentage,
} from "@/components/shelf/useLocalShelf"
import { Panel } from "@/components/ui/panel"
import type { ShelfBook } from "@/lib/book-types"

/** The last five books opened, with their progress (spec 1D §5.2). */
export function RecentBooks({
  books,
  local,
  onSelect,
}: {
  books: ReadonlyArray<ShelfBook>
  local: LocalShelf
  onSelect: (book: ShelfBook) => void
}) {
  if (books.length === 0) return null
  return (
    <Panel className="lobby-panel">
      <h2 className="lobby-panel-title">Baru Dibuka</h2>
      <ul className="space-y-1">
        {books.map((book) => (
          <li key={book.id}>
            <button
              type="button"
              // Without this the progress value leaks into the button's name.
              aria-label={book.title}
              className="w-full space-y-1 rounded-md px-2 py-1.5 text-left hover:bg-muted"
              onClick={() => onSelect(book)}
            >
              <span className="block truncate text-sm">{book.title}</span>
              <progress
                className="book-progress"
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
