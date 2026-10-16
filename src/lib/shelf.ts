import type { ShelfBook } from "./book-types"
import {
  GENRE_LABELS,
  GENRE_VALUES,
  type Genre,
  TROLLEY_LABEL,
  isGenre,
} from "./genre"

export type ShelfFilter = "semua" | Genre | "troli"
export type ShelfSort = "opened" | "title" | "added"
/** /shelf search params. Defaults ("semua", "opened") stay out of the URL. */
export type ShelfSearch = {
  genre?: Genre | "troli"
  q?: string
  sort?: "title" | "added"
}

export const MAX_QUERY_LENGTH = 100

export const SHELF_FILTERS: ReadonlyArray<{
  value: ShelfFilter
  label: string
}> = [
  { value: "semua", label: "Semua" },
  ...GENRE_VALUES.map((value) => ({ value, label: GENRE_LABELS[value] })),
  { value: "troli", label: TROLLEY_LABEL },
]

export const SHELF_SORTS: ReadonlyArray<{ value: ShelfSort; label: string }> = [
  { value: "opened", label: "Terakhir dibuka" },
  { value: "title", label: "Judul" },
  { value: "added", label: "Tanggal ditambahkan" },
]

export function parseShelfSearch(search: Record<string, unknown>): ShelfSearch {
  const result: ShelfSearch = {}
  const { genre, q, sort } = search
  if (genre === "troli" || isGenre(genre)) result.genre = genre
  if (typeof q === "string" && q.trim())
    result.q = q.trim().slice(0, MAX_QUERY_LENGTH)
  if (sort === "title" || sort === "added") result.sort = sort
  return result
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

const titleOrder = new Intl.Collator("id", {
  sensitivity: "base",
  numeric: true,
})

function matches(book: ShelfBook, filter: ShelfFilter): boolean {
  if (filter === "semua") return true
  if (filter === "troli") return book.genre === null
  return book.genre === filter
}

function comparator(sort: ShelfSort): (a: ShelfBook, b: ShelfBook) => number {
  if (sort === "title") return (a, b) => titleOrder.compare(a.title, b.title)
  if (sort === "added") return (a, b) => b.createdAt.localeCompare(a.createdAt)
  // Last opened first; books never opened follow, newest first.
  return (a, b) =>
    (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? "") ||
    b.createdAt.localeCompare(a.createdAt)
}

export function shelfBooks(
  books: ReadonlyArray<ShelfBook>,
  search: ShelfSearch
): Array<ShelfBook> {
  const filter = search.genre ?? "semua"
  const query = fold(search.q ?? "")
  return books
    .filter(
      (book) =>
        matches(book, filter) &&
        (!query || fold(`${book.title} ${book.author}`).includes(query))
    )
    .sort(comparator(search.sort ?? "opened"))
}

export function countBooks(
  books: ReadonlyArray<ShelfBook>
): Record<ShelfFilter, number> {
  const counts = Object.fromEntries(
    SHELF_FILTERS.map(({ value }) => [value, 0])
  ) as Record<ShelfFilter, number>
  for (const book of books) {
    counts.semua += 1
    counts[book.genre ?? "troli"] += 1
  }
  return counts
}
