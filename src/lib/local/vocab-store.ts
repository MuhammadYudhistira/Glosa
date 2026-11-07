import type { QueueStore } from "@/lib/sync/queue-sync"
import { VocabCacheSchema } from "@/lib/vocab/schemas"
import type {
  MeetItem,
  TapItem,
  VocabCache,
  WordsReadItem,
} from "@/lib/vocab/types"
import { type LocalVocabOp, localDb } from "./db"

/** A section counts as read after this much reading time in it (spec 3D §3.1). */
export const SECTION_READ_MS = 60_000
const CACHE_KEY = "vocab"

const sectionKey = (bookId: string, section: number) => `${bookId} ${section}`

/**
 * Adds reading time to a section; true while the section is due: 60 s read
 * and its words not queued yet. It stays due until markSectionDone, so a
 * section that reached 60 s as the reader closed is picked up on the next
 * visit.
 */
export async function addSectionTime(
  bookId: string,
  section: number,
  ms: number
): Promise<boolean> {
  const db = localDb()
  return db.transaction("rw", db.sectionTime, async () => {
    const key = sectionKey(bookId, section)
    const row = await db.sectionTime.get(key)
    if (row?.done === 1) return false
    const total = (row?.ms ?? 0) + ms
    await db.sectionTime.put({
      key,
      bookId,
      section,
      ms: total,
      done: 0,
    })
    return total >= SECTION_READ_MS
  })
}

/** The sections of a book that reached 60 s and are not done yet. */
export async function dueSections(bookId: string): Promise<Array<number>> {
  const rows = await localDb()
    .sectionTime.where("bookId")
    .equals(bookId)
    .filter((row) => row.done === 0 && row.ms >= SECTION_READ_MS)
    .toArray()
  return rows.map((row) => row.section).sort((a, b) => a - b)
}

/** A due section whose words are queued (or that cannot be read at all). */
export async function markSectionDone(
  bookId: string,
  section: number
): Promise<void> {
  await localDb().sectionTime.update(sectionKey(bookId, section), { done: 1 })
}

async function pendingOf<T>(kind: LocalVocabOp["kind"]): Promise<Array<T>> {
  const rows = await localDb()
    .vocabQueue.where("kind")
    .equals(kind)
    .sortBy("queuedAt")
  return rows.map((row) => row.item as T)
}

const dropAll = async (items: ReadonlyArray<{ key: string }>) => {
  await localDb().vocabQueue.bulkDelete(items.map((item) => item.key))
}

export const wordsReadStore: QueueStore<WordsReadItem> = {
  pending: () => pendingOf<WordsReadItem>("read"),
  confirm: dropAll,
  // A part the server refused is broken; it is not sent again.
  revert: (item) => dropAll([item]),
}

export const tapStore: QueueStore<TapItem> = {
  pending: () => pendingOf<TapItem>("tap"),
  // Taps added while the batch was on its way stay for the next one.
  async confirm(sent) {
    const db = localDb()
    await db.transaction("rw", db.vocabQueue, async () => {
      for (const item of sent) {
        const row = await db.vocabQueue.get(item.key)
        if (!row) continue
        const left = (row.item as TapItem).taps - item.taps
        if (left <= 0) await db.vocabQueue.delete(item.key)
        else
          await db.vocabQueue.put({
            ...row,
            item: { ...(row.item as TapItem), taps: left },
          })
      }
    })
  },
  revert: (item) => dropAll([item]),
}

export const meetStore: QueueStore<MeetItem> = {
  pending: () => pendingOf<MeetItem>("meet"),
  async confirm(sent) {
    const db = localDb()
    await db.transaction("rw", db.vocabQueue, async () => {
      for (const item of sent) {
        const row = await db.vocabQueue.get(item.key)
        if (row && (row.item as MeetItem).count <= item.count) {
          await db.vocabQueue.delete(item.key)
        }
      }
    })
  },
  revert: (item) => dropAll([item]),
}

export async function queueTap(
  bookId: string,
  word: string,
  at: string
): Promise<void> {
  const db = localDb()
  const key = `tap ${bookId} ${word}`
  await db.transaction("rw", db.vocabQueue, async () => {
    const row = await db.vocabQueue.get(key)
    const taps = row ? (row.item as TapItem).taps + 1 : 1
    await db.vocabQueue.put({
      key,
      kind: "tap",
      queuedAt: row?.queuedAt ?? Date.now(),
      item: { key, bookId, word, taps, at },
    })
  })
}

export async function queueWordsRead(
  bookId: string,
  section: number,
  parts: ReadonlyArray<Array<string>>
): Promise<void> {
  const now = Date.now()
  await localDb().vocabQueue.bulkPut(
    parts.map((words, part) => {
      const key = `read ${bookId} ${section} ${part}`
      return {
        key,
        kind: "read" as const,
        queuedAt: now + part,
        item: {
          key,
          bookId,
          section,
          part,
          words,
          last: part === parts.length - 1,
        },
      }
    })
  )
}

export async function queueMeetings(
  bookId: string,
  section: number,
  counts: ReadonlyArray<{ headword: string; count: number }>
): Promise<void> {
  const db = localDb()
  await db.transaction("rw", db.vocabQueue, async () => {
    for (const { headword, count } of counts) {
      const key = `meet ${headword} ${bookId} ${section}`
      const row = await db.vocabQueue.get(key)
      if (row && (row.item as MeetItem).count >= count) continue
      await db.vocabQueue.put({
        key,
        kind: "meet",
        queuedAt: row?.queuedAt ?? Date.now(),
        item: { key, bookId, headword, section, count },
      })
    }
  })
}

export async function loadVocabCache(): Promise<VocabCache | null> {
  const stored = await localDb().meta.get(CACHE_KEY)
  const parsed = VocabCacheSchema.safeParse(stored?.value)
  return parsed.success ? parsed.data : null
}

export async function saveVocabCache(cache: VocabCache): Promise<void> {
  await localDb().meta.put({ key: CACHE_KEY, value: cache })
}
