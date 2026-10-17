import { listBooksFn } from "@/server/books"
import { BookLoadError } from "./book-download"
import type { ShelfData } from "./book-types"
import { loadShelfSnapshot } from "./local/shelf-snapshot"

export type ShelfView = ShelfData & { offline: boolean }

// The connection can drop while the request is in flight.
const unreachable = (error: unknown) =>
  !navigator.onLine || error instanceof TypeError

/**
 * Online: the server's shelf. Offline in the browser: the last shelf saved on
 * this device (spec §11; plan 1C, decision 2).
 */
export async function loadShelf(userId: string): Promise<ShelfView> {
  if (import.meta.env.SSR) return { ...(await listBooksFn()), offline: false }
  if (navigator.onLine) {
    try {
      return { ...(await listBooksFn()), offline: false }
    } catch (error) {
      if (!unreachable(error)) throw error
    }
  }
  const snapshot = await loadShelfSnapshot(userId)
  if (!snapshot) throw new BookLoadError("offline_no_shelf")
  return { ...snapshot, offline: true }
}
