import type { Position, PositionStore, ProgressEntry } from "@/lib/reader-types"
import { localDb } from "./db"

export async function getLocalPosition(
  bookId: string
): Promise<Position | null> {
  const row = await localDb().positions.get(bookId)
  return row
    ? { cfi: row.cfi, percentage: row.percentage, updatedAt: row.updatedAt }
    : null
}

/** The last percentage read on this device, per book. */
export async function localPercentages(): Promise<Map<string, number>> {
  const rows = await localDb().positions.toArray()
  return new Map(rows.map((row) => [row.bookId, row.percentage]))
}

export async function removeLocalPosition(bookId: string): Promise<void> {
  await localDb().positions.delete(bookId)
}

/** One waiting entry per book: the latest position read on this device. */
export const localPositionStore: PositionStore = {
  async put(entry) {
    await localDb().positions.put({
      bookId: entry.bookId,
      cfi: entry.cfi,
      percentage: entry.percentage,
      updatedAt: entry.updatedAt,
      pending: 1,
    })
  },

  async pending(): Promise<Array<ProgressEntry>> {
    const rows = await localDb().positions.where("pending").equals(1).toArray()
    return rows.map((row) => ({
      bookId: row.bookId,
      cfi: row.cfi,
      percentage: row.percentage,
      updatedAt: row.updatedAt,
    }))
  },

  async markSynced(entries) {
    const db = localDb()
    await db.transaction("rw", db.positions, async () => {
      for (const entry of entries) {
        const row = await db.positions.get(entry.bookId)
        if (row?.updatedAt === entry.updatedAt) {
          await db.positions.update(entry.bookId, { pending: 0 })
        }
      }
    })
  },
}
