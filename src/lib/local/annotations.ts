import type { Annotation } from "@/lib/annotations/types"
import type { QueueStore } from "@/lib/sync/queue-sync"
import { type LocalAnnotation, localDb } from "./db"

/** Where annotations and their waiting changes live (IndexedDB in the browser). */
export type AnnotationStore = QueueStore<Annotation> & {
  /** Shows the change at once and queues it. */
  put: (annotation: Annotation) => Promise<void>
}

const toAnnotation = (row: LocalAnnotation): Annotation => ({
  id: row.id,
  bookId: row.bookId,
  kind: row.kind,
  cfi: row.cfi,
  color: row.color,
  note: row.note,
  excerpt: row.excerpt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  deletedAt: row.deletedAt,
})

// The server writes its times differently (+00:00, microseconds): compare them as times.
const newer = (a: string, b: string) => Date.parse(a) > Date.parse(b)

/** The book's annotations on this device, without tombstones. */
export async function bookAnnotations(
  bookId: string
): Promise<Array<Annotation>> {
  const rows = await localDb()
    .annotations.where("bookId")
    .equals(bookId)
    .toArray()
  return rows.filter((row) => row.deletedAt === null).map(toAnnotation)
}

/**
 * The server's list for a book (tombstones included), with this device's
 * waiting changes laid over it when they are newer (spec 2 §7). What the
 * server no longer has and this device is not still sending goes.
 */
export async function mergeServerAnnotations(
  bookId: string,
  server: Array<Annotation>
): Promise<void> {
  const db = localDb()
  await db.transaction("rw", db.annotations, async () => {
    const theirs = new Map(
      server.map((annotation) => [annotation.id, annotation])
    )
    const local = await db.annotations.where("bookId").equals(bookId).toArray()
    for (const row of local) {
      const remote = theirs.get(row.id)
      if (
        row.pending === 1 &&
        (!remote || newer(row.updatedAt, remote.updatedAt))
      ) {
        theirs.delete(row.id)
        continue
      }
      if (!remote) await db.annotations.delete(row.id)
    }
    await db.annotations.bulkPut(
      [...theirs.values()].map((annotation) => ({
        ...annotation,
        pending: 0 as const,
      }))
    )
  })
}

/** A deleted book's annotations leave this device too. */
export async function removeLocalAnnotations(bookId: string): Promise<void> {
  await localDb().annotations.where("bookId").equals(bookId).delete()
}

/** Annotations in IndexedDB: a change shows at once and waits for the server. */
export const localAnnotationStore: AnnotationStore = {
  async put(annotation) {
    await localDb().annotations.put({ ...annotation, pending: 1 })
  },

  async pending() {
    const rows = await localDb()
      .annotations.where("pending")
      .equals(1)
      .toArray()
    return rows
      .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))
      .map(toAnnotation)
  },

  async confirm(sent) {
    const db = localDb()
    await db.transaction("rw", db.annotations, async () => {
      for (const annotation of sent) {
        const row = await db.annotations.get(annotation.id)
        if (row?.updatedAt === annotation.updatedAt) {
          await db.annotations.update(annotation.id, { pending: 0 })
        }
      }
    })
  },

  // The whole row goes: the server's version, if any, comes back with the
  // book's list the next time it opens (plan 2B, decision 7).
  async revert(annotation) {
    const db = localDb()
    await db.transaction("rw", db.annotations, async () => {
      const row = await db.annotations.get(annotation.id)
      if (row?.updatedAt === annotation.updatedAt) {
        await db.annotations.delete(annotation.id)
      }
    })
  },
}
