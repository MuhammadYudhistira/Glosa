import type { ShelfBook } from "@/lib/book-types"
import type { Highlight, HighlightColor } from "./types"

export type HighlightFilter = {
  bookId: string | null
  color: HighlightColor | null
}

export type HighlightRow = Highlight & {
  book: { id: string; title: string; author: string; coverUrl: string | null }
}

const byId = (books: ReadonlyArray<ShelfBook>) =>
  new Map(books.map((book) => [book.id, book]))

/**
 * The highlights of books still on the shelf, each with its book, narrowed by
 * the filter and ordered newest first (spec 3F §3.2).
 */
export function highlightRows(
  highlights: ReadonlyArray<Highlight>,
  books: ReadonlyArray<ShelfBook>,
  filter: HighlightFilter
): Array<HighlightRow> {
  const shelf = byId(books)
  const rows: Array<HighlightRow> = []
  for (const highlight of highlights) {
    const book = shelf.get(highlight.bookId)
    if (!book) continue
    if (filter.bookId !== null && highlight.bookId !== filter.bookId) continue
    if (filter.color !== null && highlight.color !== filter.color) continue
    rows.push({
      ...highlight,
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
      },
    })
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** The books that have highlights, with how many, ordered by title. */
export function highlightBooks(
  highlights: ReadonlyArray<Highlight>,
  books: ReadonlyArray<ShelfBook>
): Array<{ id: string; title: string; count: number }> {
  const shelf = byId(books)
  const counts = new Map<string, number>()
  for (const { bookId } of highlights) {
    if (shelf.has(bookId)) counts.set(bookId, (counts.get(bookId) ?? 0) + 1)
  }
  return [...counts]
    .map(([id, count]) => ({ id, title: shelf.get(id)!.title, count }))
    .sort((a, b) => a.title.localeCompare(b.title, "id"))
}
