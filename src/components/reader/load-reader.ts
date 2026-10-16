import { notFound, redirect } from "@tanstack/react-router"
import { BookLoadError, downloadBook } from "@/lib/book-download"
import {
  getLocalBook,
  removeLocalBook,
  saveLocalBook,
} from "@/lib/local/book-files"
import { requestPersistence } from "@/lib/local/device"
import { getLocalPosition, removeLocalPosition } from "@/lib/local/positions"
import { loadShelfSnapshot } from "@/lib/local/shelf-snapshot"
import type { ReaderSettings } from "@/lib/reader-settings"
import { initialReaderSettings } from "@/lib/reader-settings-cache"
import type { Position, ReaderBook, ReadingState } from "@/lib/reader-types"
import { readingStateFn } from "@/server/reading"

export type ReaderData = {
  book: ReaderBook
  file: Blob
  /** This device's last position, or null. */
  local: Position | null
  /** The account's last position, or null (also when offline). */
  server: Position | null
  settings: ReaderSettings
  /** Whether the server answered: only then is the last-opened time updated. */
  online: boolean
  /** Whether the EPUB is stored on this device (false when it is full). */
  saved: boolean
}

const unreachable = (error: unknown) =>
  !navigator.onLine || error instanceof TypeError

async function offlineBook(
  bookId: string,
  userId: string
): Promise<ReaderBook> {
  const shelf = await loadShelfSnapshot(userId)
  const entry = shelf?.books.find((candidate) => candidate.id === bookId)
  return entry
    ? { id: entry.id, title: entry.title, author: entry.author }
    : { id: bookId, title: "Buku", author: "" }
}

/**
 * Loads a book for /read (spec §9): this device's copy first, otherwise a
 * download that is stored for next time. The server's state (title, position,
 * settings) is fetched when online; offline, the shelf snapshot names the book.
 */
export async function loadReader(
  bookId: string,
  userId: string
): Promise<ReaderData> {
  const [stored, local] = await Promise.all([
    getLocalBook(bookId),
    getLocalPosition(bookId),
  ])

  let state: ReadingState | null = null
  if (navigator.onLine) {
    try {
      state = await readingStateFn({ data: { bookId } })
    } catch (error) {
      if (!unreachable(error)) throw error
    }
  }
  if (state && !state.ok) {
    if (state.code === "not_found") {
      // Deleted on another device: this device's copy goes too.
      await Promise.all([removeLocalBook(bookId), removeLocalPosition(bookId)])
      throw notFound()
    }
    if (state.code === "not_authenticated") {
      throw redirect({
        href: `/login?next=${encodeURIComponent(`/read/${bookId}`)}`,
      })
    }
    throw new BookLoadError(state.code)
  }

  let file = stored
  let saved = stored !== null
  if (!file) {
    if (!state) throw new BookLoadError("offline_not_saved")
    file = await downloadBook(bookId)
    saved = await saveLocalBook(bookId, file)
    if (saved) await requestPersistence()
  }

  return {
    book: state ? state.book : await offlineBook(bookId, userId),
    file,
    local,
    server: state ? state.progress : null,
    settings: initialReaderSettings(state ? state.settings : null),
    online: state !== null,
    saved,
  }
}
