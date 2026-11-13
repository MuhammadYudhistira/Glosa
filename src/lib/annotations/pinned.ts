import type { ShelfBook } from "@/lib/book-types"
import type { Highlight } from "./types"

/**
 * The first `count` highlights whose book is still on the shelf, each with
 * its book. The order is kept (newest first); one of a removed book is
 * skipped and the next older one takes its place.
 */
export function pinnedHighlights(
  highlights: ReadonlyArray<Highlight>,
  books: ReadonlyArray<ShelfBook>,
  count = 3
): Array<{ highlight: Highlight; book: ShelfBook }> {
  const pinned: Array<{ highlight: Highlight; book: ShelfBook }> = []
  for (const highlight of highlights) {
    if (pinned.length >= count) break
    const book = books.find(({ id }) => id === highlight.bookId)
    if (book) pinned.push({ highlight, book })
  }
  return pinned
}
