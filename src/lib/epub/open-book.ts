import type { EPUB } from "foliate-js/epub.js"
import { EpubError, openZip } from "./zip-loader"

export type OpenedBook = { book: EPUB; close: () => Promise<void> }

/** Opens a stored EPUB for reading. The zip stays open until close(), which is idempotent. */
export async function openBookFile(file: Blob): Promise<OpenedBook> {
  let zip: Awaited<ReturnType<typeof openZip>>
  try {
    zip = await openZip(file)
  } catch {
    throw new EpubError("epub_invalid")
  }
  let closed = false
  const closeZip = async () => {
    if (closed) return
    closed = true
    await zip.close().catch(() => undefined)
  }
  try {
    const { EPUB } = await import("foliate-js/epub.js")
    const book = await new EPUB(zip).init()
    if (book.sections.length === 0) throw new EpubError("epub_invalid")
    return {
      book,
      close: async () => {
        if (closed) return
        book.destroy()
        await closeZip()
      },
    }
  } catch (error) {
    await closeZip()
    throw error instanceof EpubError ? error : new EpubError("epub_invalid")
  }
}
