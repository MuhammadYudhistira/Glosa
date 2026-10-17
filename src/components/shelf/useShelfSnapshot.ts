import { useEffect } from "react"
import type { ShelfBook, StorageUsage } from "@/lib/book-types"
import { saveShelfSnapshot } from "@/lib/local/shelf-snapshot"

/** What the shelf looked like online is what offline visits show (plan 1C, decision 2). */
export function useShelfSnapshot(
  userId: string,
  books: Array<ShelfBook>,
  usage: StorageUsage,
  offline: boolean
): void {
  useEffect(() => {
    if (offline) return
    saveShelfSnapshot(userId, { books, usage }).catch((error: unknown) =>
      console.error("saving the shelf snapshot failed", error)
    )
  }, [books, usage, offline, userId])
}
