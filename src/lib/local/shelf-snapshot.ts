import type { ShelfData } from "@/lib/book-types"
import { localDb } from "./db"

type Snapshot = { userId: string; data: ShelfData; savedAt: number }

const SNAPSHOT_KEY = "shelf"

/** Saves the shelf as it was last seen online, for offline visits (spec §11). */
export async function saveShelfSnapshot(
  userId: string,
  data: ShelfData,
  now = Date.now()
): Promise<void> {
  const value: Snapshot = { userId, data, savedAt: now }
  await localDb().meta.put({ key: SNAPSHOT_KEY, value })
}

/** The last shelf this member saw online; another member's snapshot is never returned. */
export async function loadShelfSnapshot(
  userId: string
): Promise<ShelfData | null> {
  const row = await localDb().meta.get(SNAPSHOT_KEY)
  const snapshot = row?.value as Snapshot | undefined
  return snapshot?.userId === userId ? snapshot.data : null
}
