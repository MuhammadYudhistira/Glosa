import Dexie, { type EntityTable } from "dexie"
import type { Annotation } from "@/lib/annotations/types"
import type { DailyGoal } from "@/lib/habit/types"
import type { LookupResult, SavedWord } from "@/lib/words/types"

export type LocalFile = {
  bookId: string
  blob: Blob
  savedAt: number
  openedAt: number
}

export type LocalPosition = {
  bookId: string
  cfi: string
  percentage: number
  updatedAt: string
  /** 1 while the server does not have this position yet (booleans cannot be indexed). */
  pending: 0 | 1
}

export type LocalMeta = { key: string; value: unknown }

/** A word's meanings as the server gave them, keyed by the word and the next ones (spec 2 §5). */
export type LocalLookup = {
  key: string
  word: string
  result: LookupResult
  usedAt: number
}

/** A change to Kosakata the server does not have yet: one per word, the latest wins. */
export type LocalWordOp = {
  headword: string
  kind: "save" | "delete"
  /** The word as saved; null for a deletion. */
  word: SavedWord | null
  queuedAt: number
}

/** An annotation as this device keeps it; `pending` is 1 until the server has this change. */
export type LocalAnnotation = Annotation & { pending: 0 | 1 }

/**
 * This device's reading time for one local day and book (spec 3B §5.4), in
 * milliseconds; `sentSeconds` is the total the server confirmed.
 */
export type LocalReadingTime = {
  key: string
  day: string
  bookId: string
  ms: number
  sentSeconds: number
  goalMinutes: DailyGoal | null
}

/** Everything Glosa keeps in IndexedDB for the member using this device (spec §3). */
class GlosaDb extends Dexie {
  files!: EntityTable<LocalFile, "bookId">
  positions!: EntityTable<LocalPosition, "bookId">
  meta!: EntityTable<LocalMeta, "key">
  lookups!: EntityTable<LocalLookup, "key">
  words!: EntityTable<SavedWord, "headword">
  wordOps!: EntityTable<LocalWordOp, "headword">
  annotations!: EntityTable<LocalAnnotation, "id">
  readingTime!: EntityTable<LocalReadingTime, "key">

  constructor() {
    super("glosa")
    this.version(1).stores({
      files: "bookId, openedAt",
      positions: "bookId, pending",
      meta: "key",
    })
    // Tahap 2A: the meanings cache, Kosakata and its queue (spec 2 §5).
    this.version(2).stores({
      lookups: "key, word, usedAt",
      words: "headword, createdAt",
      wordOps: "headword, queuedAt",
    })
    // Tahap 2B: highlights and bookmarks, with their queue (spec 2 §5).
    this.version(3).stores({
      annotations: "id, bookId, pending",
    })
    // Tahap 3B: reading time per day and book (spec 3B §5.4).
    this.version(4).stores({
      readingTime: "key, day",
    })
  }
}

let db: GlosaDb | null = null

/** Browser only: the server render never touches IndexedDB. */
export function localDb(): GlosaDb {
  db ??= new GlosaDb()
  return db
}
