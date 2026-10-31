import type { Collection, ShelfBook } from "./book-types"
import {
  GENRE_LABELS,
  GENRE_VALUES,
  type Genre,
  TROLLEY_LABEL,
  isGenre,
} from "./genre"

export type ShelfFilter = "semua" | Genre | "troli"
export type ShelfSort = "opened" | "title" | "added" | "finished"
/** /shelf search params. Defaults ("semua", the collection's own order) stay out of the URL. */
export type ShelfSearch = {
  genre?: Genre | "troli"
  /** "sedang", "selesai" or the id of one of the member's collections (spec Tahap 3 §4.3). */
  koleksi?: string
  q?: string
  sort?: ShelfSort
}

export const MAX_QUERY_LENGTH = 100

/** The automatic collections (spec Tahap 3 §4.2). */
export const COLLECTION_LABELS = {
  sedang: "Sedang dibaca",
  selesai: "Sudah dibaca",
} as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

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
  { value: "finished", label: "Terakhir selesai" },
]

export function isShelfSort(value: unknown): value is ShelfSort {
  return SHELF_SORTS.some((sort) => sort.value === value)
}

export function parseShelfSearch(search: Record<string, unknown>): ShelfSearch {
  const result: ShelfSearch = {}
  const { genre, koleksi, q, sort } = search
  if (genre === "troli" || isGenre(genre)) result.genre = genre
  if (
    koleksi === "sedang" ||
    koleksi === "selesai" ||
    (typeof koleksi === "string" && UUID.test(koleksi))
  )
    result.koleksi = koleksi
  if (typeof q === "string" && q.trim())
    result.q = q.trim().slice(0, MAX_QUERY_LENGTH)
  if (isShelfSort(sort)) result.sort = sort
  return result
}

/** The collection asked for while it still exists; anything else is Semua (spec Tahap 3 §4.3). */
export function activeCollection(
  koleksi: string | undefined,
  collections: ReadonlyArray<Collection>
): string | undefined {
  if (koleksi === "sedang" || koleksi === "selesai") return koleksi
  return collections.some((collection) => collection.id === koleksi)
    ? koleksi
    : undefined
}

/** Sudah dibaca lists the last finished first; everything else, the last opened. */
export function defaultSort(koleksi: string | undefined): ShelfSort {
  return koleksi === "selesai" ? "finished" : "opened"
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

/** "Sedang dibaca" goes by the server's progress, the same on every device (plan 3A, decision 4). */
function inCollection(book: ShelfBook, koleksi: string | undefined): boolean {
  if (!koleksi) return true
  if (koleksi === "sedang")
    return (book.progress ?? 0) > 0 && book.finishedAt === null
  if (koleksi === "selesai") return book.finishedAt !== null
  return book.collectionIds.includes(koleksi)
}

const byOpened = (a: ShelfBook, b: ShelfBook) =>
  (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? "") ||
  b.createdAt.localeCompare(a.createdAt)

function comparator(sort: ShelfSort): (a: ShelfBook, b: ShelfBook) => number {
  if (sort === "title") return (a, b) => titleOrder.compare(a.title, b.title)
  if (sort === "added") return (a, b) => b.createdAt.localeCompare(a.createdAt)
  if (sort === "finished")
    return (a, b) =>
      (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "") || byOpened(a, b)
  // Last opened first; books never opened follow, newest first.
  return byOpened
}

/** `search.koleksi` must have been through activeCollection. */
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
        inCollection(book, search.koleksi) &&
        (!query || fold(`${book.title} ${book.author}`).includes(query))
    )
    .sort(comparator(search.sort ?? defaultSort(search.koleksi)))
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

export function countCollections(
  books: ReadonlyArray<ShelfBook>,
  collections: ReadonlyArray<Collection>
): Record<string, number> {
  const counts: Record<string, number> = { semua: 0, sedang: 0, selesai: 0 }
  for (const collection of collections) counts[collection.id] = 0
  for (const book of books) {
    counts.semua += 1
    if (inCollection(book, "sedang")) counts.sedang += 1
    if (inCollection(book, "selesai")) counts.selesai += 1
    for (const id of book.collectionIds) {
      if (id in counts) counts[id] += 1
    }
  }
  return counts
}
