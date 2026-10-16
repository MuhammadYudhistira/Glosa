import Dexie, { type EntityTable } from "dexie"

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

/** Everything Glosa keeps in IndexedDB for the member using this device (spec §3). */
class GlosaDb extends Dexie {
  files!: EntityTable<LocalFile, "bookId">
  positions!: EntityTable<LocalPosition, "bookId">
  meta!: EntityTable<LocalMeta, "key">

  constructor() {
    super("glosa")
    this.version(1).stores({
      files: "bookId, openedAt",
      positions: "bookId, pending",
      meta: "key",
    })
  }
}

let db: GlosaDb | null = null

/** Browser only: the server render never touches IndexedDB. */
export function localDb(): GlosaDb {
  db ??= new GlosaDb()
  return db
}
