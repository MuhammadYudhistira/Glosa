import type { ShelfBook, ShelfData } from "@/lib/book-types"
import { localDb } from "./db"

type Snapshot = { userId: string; data: ShelfData; savedAt: number }

/** A snapshot as an older version saved it: without what Tahap 3A added. */
type StoredShelf = {
  books: Array<
    Omit<ShelfBook, "finishedAt" | "finishDeclined" | "collectionIds"> &
      Partial<
        Pick<ShelfBook, "finishedAt" | "finishDeclined" | "collectionIds">
      >
  >
  usage: ShelfData["usage"]
  collections?: ShelfData["collections"]
}

const SNAPSHOT_KEY = "shelf"

/** Saves the shelf as it was last seen online, for offline visits (spec §11). */
export async function saveShelfSnapshot(
  userId: string,
  data: ShelfData,
  now = Date.now()
): Promise<void> {
  const value: Snapshot = { userId, data, savedAt: now }
  await localDb().meta.put({ key: SNAPSHOT_KEY, value })
}

/**
 * The last shelf this member saw online; another member's snapshot is never
 * returned. One saved before collections came (Tahap 3A) reads as having none.
 */
export async function loadShelfSnapshot(
  userId: string
): Promise<ShelfData | null> {
  const row = await localDb().meta.get(SNAPSHOT_KEY)
  const snapshot = row?.value as Snapshot | undefined
  if (snapshot?.userId !== userId) return null
  const data: StoredShelf = snapshot.data
  return {
    ...data,
    books: data.books.map((book) => ({
      ...book,
      finishedAt: book.finishedAt ?? null,
      finishDeclined: book.finishDeclined ?? false,
      collectionIds: book.collectionIds ?? [],
    })),
    collections: data.collections ?? [],
  }
}
