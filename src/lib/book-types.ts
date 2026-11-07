import type { Genre, GenreSource } from "./genre"
import type { BookReview } from "./review"
import type { Plan } from "./session-types"

export type ShelfBook = {
  id: string
  title: string
  author: string
  description: string | null
  language: string | null
  genre: Genre | null
  genreSource: GenreSource | null
  sizeBytes: number
  createdAt: string
  lastOpenedAt: string | null
  /** Signed URL valid for one hour, or null when the book has no cover. */
  coverUrl: string | null
  /** Last percentage read, as stored on the server (0–100), or null when never read. */
  progress: number | null
  /** When the member said they finished it (spec Tahap 3 §4.4), or null. */
  finishedAt: string | null
  /** The member answered "Belum" when the reader asked: it asks no more. */
  finishDeclined: boolean
  /** The member's collections this book is in. */
  collectionIds: Array<string>
  /** The member's private review, only while the book is finished (spec 3E §4.3). */
  review: BookReview | null
}

export type StorageUsage = { usedBytes: number; limitBytes: number; plan: Plan }

/** A collection the member made (spec Tahap 3 §4.1). */
export type Collection = { id: string; name: string; createdAt: string }

/** Collections per member, and the length of a name once trimmed (spec Tahap 3 §4.1). */
export const MAX_COLLECTIONS = 50
export const MAX_COLLECTION_NAME = 40

export type ShelfData = {
  books: Array<ShelfBook>
  usage: StorageUsage
  collections: Array<Collection>
}

export type CoverInfo = { bytes: number; type: "image/webp" | "image/jpeg" }

export type UploadRequest = {
  sha256: string
  epubBytes: number
  cover: CoverInfo | null
  title: string
  author: string
  description: string | null
  language: string | null
  subjects: Array<string>
  genre: Genre | null
  genreSource: GenreSource | null
}

export type UploadTicket =
  | {
      ok: true
      bookId: string
      epubUploadUrl: string
      coverUploadUrl: string | null
    }
  | { ok: false; code: string }
