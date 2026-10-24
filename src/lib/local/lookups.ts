import type { LookupResult } from "@/lib/words/types"
import { localDb } from "./db"

/** Words whose meanings stay on this device; the least recently used go first (spec 2 §5). */
export const LOOKUP_CACHE_LIMIT = 2000

/** Phrasal verbs depend on the next words, so they are part of the key. */
const keyOf = (word: string, next: ReadonlyArray<string>) =>
  [word, ...next].join(" ")

export async function getCachedLookup(
  word: string,
  next: ReadonlyArray<string>,
  now = Date.now()
): Promise<LookupResult | null> {
  const db = localDb()
  const row = await db.lookups.get(keyOf(word, next))
  if (!row) return null
  await db.lookups.update(row.key, { usedAt: now })
  return row.result
}

/** Offline: any lookup of the same word. Its meanings hold; its phrases may not. */
export async function getCachedWord(
  word: string
): Promise<LookupResult | null> {
  const row = await localDb().lookups.where("word").equals(word).first()
  return row ? { ...row.result, phrases: [] } : null
}

export async function putCachedLookup(
  word: string,
  next: ReadonlyArray<string>,
  result: LookupResult,
  now = Date.now(),
  limit = LOOKUP_CACHE_LIMIT
): Promise<void> {
  const db = localDb()
  await db.transaction("rw", db.lookups, async () => {
    await db.lookups.put({ key: keyOf(word, next), word, result, usedAt: now })
    const extra = (await db.lookups.count()) - limit
    if (extra > 0) {
      const oldest = await db.lookups
        .orderBy("usedAt")
        .limit(extra)
        .primaryKeys()
      await db.lookups.bulkDelete(oldest)
    }
  })
}
