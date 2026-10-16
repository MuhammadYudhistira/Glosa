import type { Genre, GenreSource } from "./genre"
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
}

export type StorageUsage = { usedBytes: number; limitBytes: number; plan: Plan }

export type ShelfData = { books: Array<ShelfBook>; usage: StorageUsage }

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
