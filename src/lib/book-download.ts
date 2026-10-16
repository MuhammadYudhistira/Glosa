import { bookFileUrlFn } from "@/server/reading"
import { saveLocalBook } from "./local/book-files"
import { requestPersistence } from "./local/device"

/** A book could not be opened or saved; `code` is shown with bookMessage(). */
export class BookLoadError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

/**
 * Downloads the EPUB through a one-hour signed URL. When Storage refuses the
 * URL (it may have expired), a fresh one is requested once (spec §12).
 */
export async function downloadBook(bookId: string): Promise<Blob> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ticket = await bookFileUrlFn({ data: { bookId } })
    if (!ticket.ok) throw new BookLoadError(ticket.code)
    let response: Response
    try {
      response = await fetch(ticket.url)
    } catch {
      // A network failure is not a refused URL: no retry, and no raw error.
      throw new BookLoadError("download_failed")
    }
    if (response.ok) return await response.blob()
  }
  throw new BookLoadError("download_failed")
}

/** "Simpan offline": downloads and stores the book; false when the device is full. */
export async function saveBookOffline(bookId: string): Promise<boolean> {
  const saved = await saveLocalBook(bookId, await downloadBook(bookId))
  if (saved) await requestPersistence()
  return saved
}
