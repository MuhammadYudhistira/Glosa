import type { ReaderSettings } from "./reader-settings"

/** A reading position. `updatedAt` comes from the reading device's clock (spec §4). */
export type Position = { cfi: string; percentage: number; updatedAt: string }

export type ProgressEntry = Position & { bookId: string }

/** Where positions wait until the server has them (IndexedDB in the browser). */
export type PositionStore = {
  /** Stores the book's latest position and marks it as waiting to be sent. */
  put: (entry: ProgressEntry) => Promise<void>
  pending: () => Promise<Array<ProgressEntry>>
  /** Clears the waiting mark, unless the book moved again in the meantime. */
  markSynced: (entries: ReadonlyArray<ProgressEntry>) => Promise<void>
}

export type ReaderBook = { id: string; title: string; author: string }

export type ReadingState =
  | {
      ok: true
      book: ReaderBook
      progress: Position | null
      settings: ReaderSettings
    }
  | { ok: false; code: string }

export type BookFileTicket =
  { ok: true; url: string } | { ok: false; code: string }

/** One table-of-contents entry, as foliate-js reads it from the EPUB. */
export type TocItem = {
  label: string
  href: string
  subitems?: Array<TocItem> | null
}
