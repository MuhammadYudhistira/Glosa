import { localDb } from "./db"
import { COVER_CACHE, READER_SETTINGS_KEY, USER_KEY } from "./keys"

const OWNER_KEY = "owner"

/** Drops the member's books, positions, Kosakata, shelf snapshot, cached covers and reader settings. */
async function wipeMemberData(): Promise<void> {
  const db = localDb()
  const tables = [
    db.files,
    db.positions,
    db.meta,
    db.lookups,
    db.words,
    db.wordOps,
  ]
  await db.transaction("rw", tables, async () => {
    await Promise.all(tables.map((table) => table.clear()))
  })
  try {
    localStorage.removeItem(READER_SETTINGS_KEY)
  } catch {
    // No localStorage (private mode or tests): nothing to remove.
  }
  try {
    await caches.delete(COVER_CACHE)
  } catch {
    // No Cache Storage outside secure contexts: nothing to remove.
  }
}

/** On sign-out and account deletion: wipe everything, including the remembered member (plan 1C, decision 6). */
export async function clearLocalData(): Promise<void> {
  await wipeMemberData()
  try {
    localStorage.removeItem(USER_KEY)
  } catch {
    // No localStorage: nothing to remove.
  }
}

/**
 * Makes this device's data belong to `userId`. Another member's leftovers
 * (from a session that ended without signing out) are wiped first.
 */
export async function claimLocalData(userId: string): Promise<void> {
  const owner = await localDb().meta.get(OWNER_KEY)
  if (owner?.value === userId) return
  await wipeMemberData()
  await localDb().meta.put({ key: OWNER_KEY, value: userId })
}

/** Asks the browser to keep our storage, the first time a book is saved (spec §11). */
export async function requestPersistence(): Promise<void> {
  try {
    if (!("storage" in navigator) || !("persist" in navigator.storage)) return
    if (await navigator.storage.persisted()) return
    await navigator.storage.persist()
  } catch {
    // The browser decides; reading works either way.
  }
}
