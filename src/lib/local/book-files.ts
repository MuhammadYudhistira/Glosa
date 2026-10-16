import { type LocalFile, localDb } from "./db"

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const inner = (error as { inner?: unknown }).inner
  return (
    error.name === "QuotaExceededError" ||
    (inner instanceof Error && inner.name === "QuotaExceededError")
  )
}

/** The stored EPUB, or null. Marks it as just opened, so eviction keeps it longest. */
export async function getLocalBook(
  bookId: string,
  now = Date.now()
): Promise<Blob | null> {
  const db = localDb()
  const file = await db.files.get(bookId)
  if (!file) return null
  await db.files.update(bookId, { openedAt: now })
  return file.blob
}

export async function localBookIds(): Promise<Set<string>> {
  return new Set(await localDb().files.toCollection().primaryKeys())
}

/**
 * Stores an EPUB for offline reading. When the device is full, the copies
 * opened longest ago are dropped one by one (only copies on this device, never
 * the member's files on the server) and the save is retried (spec §12).
 * Returns false when the book still does not fit.
 */
export async function saveLocalBook(
  bookId: string,
  blob: Blob,
  now = Date.now()
): Promise<boolean> {
  const db = localDb()
  const file: LocalFile = { bookId, blob, savedAt: now, openedAt: now }
  for (;;) {
    try {
      await db.files.put(file)
      return true
    } catch (error) {
      if (!isQuotaError(error)) throw error
      const oldest = await db.files
        .orderBy("openedAt")
        .filter((row) => row.bookId !== bookId)
        .first()
      if (!oldest) return false
      await db.files.delete(oldest.bookId)
    }
  }
}

export async function removeLocalBook(bookId: string): Promise<void> {
  await localDb().files.delete(bookId)
}
