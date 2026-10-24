import type { LookupResult } from "@/lib/words/types"
import { localDb } from "./db"

/** Words whose meanings stay on this device; the least recently used go first (spec 2 §5). */
export const LOOKUP_CACHE_LIMIT = 2000

/** The dictionary the cached meanings came from (`LookupResult.version`). */
const VERSION_KEY = "dict-version"

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
  const version = result.version ?? null
  await db.transaction("rw", db.lookups, db.meta, async () => {
    // A new import makes every cached answer stale, empty ones too.
    const known = await db.meta.get(VERSION_KEY)
    if (!known || known.value !== version) {
      await db.lookups.clear()
      await db.meta.put({ key: VERSION_KEY, value: version })
    }
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
