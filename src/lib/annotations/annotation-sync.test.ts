import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AnnotationStore } from "@/lib/local/annotations"
import { createAnnotationSync } from "./annotation-sync"
import type { Annotation, AnnotationSyncAnswer } from "./types"

/** The same rules as localAnnotationStore, in memory. */
function memoryStore() {
  const rows = new Map<string, { annotation: Annotation; pending: boolean }>()
  const store: AnnotationStore = {
    put: async (annotation) => {
      rows.set(annotation.id, { annotation, pending: true })
    },
    pending: async () =>
      [...rows.values()]
        .filter((row) => row.pending)
        .map((row) => row.annotation)
        .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt)),
    confirm: async (sent) => {
      for (const annotation of sent) {
        const row = rows.get(annotation.id)
        if (row?.annotation.updatedAt === annotation.updatedAt)
          row.pending = false
      }
    },
    revert: async (annotation) => {
      if (
        rows.get(annotation.id)?.annotation.updatedAt === annotation.updatedAt
      )
        rows.delete(annotation.id)
    },
  }
  return { rows, store }
}

const highlight = (n: number): Annotation => ({
  id: `8b1f7c2e-4a5d-4c3b-9e2f-${String(n).padStart(12, "0")}`,
  bookId: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  kind: "highlight",
  cfi: `epubcfi(/6/4!/4/${n * 2})`,
  color: "yellow",
  note: "",
  excerpt: "Teks",
  createdAt: "2026-10-24T08:00:00.000Z",
  updatedAt: new Date(Date.UTC(2026, 9, 24, 8, 0, n)).toISOString(),
  deletedAt: null,
})

const allOk = async (
  entries: Array<Annotation>
): Promise<AnnotationSyncAnswer> => ({
  ok: true,
  results: entries.map(() => "ok"),
})

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createAnnotationSync", () => {
  it("shows a change at once and sends it two seconds later", async () => {
    const { rows, store } = memoryStore()
    const send = vi.fn(allOk)
    const sync = createAnnotationSync({ store, send, isOnline: () => true })
    const listener = vi.fn()
    sync.subscribe(listener)

    await sync.put(highlight(1))
    expect(rows.has(highlight(1).id)).toBe(true)
    expect(listener).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_999)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledWith([highlight(1)])
    expect(await store.pending()).toEqual([])
  })

  it("sends at most 50 changes per request", async () => {
    const { store } = memoryStore()
    const send = vi.fn(allOk)
    const sync = createAnnotationSync({ store, send, isOnline: () => true })
    for (let n = 1; n <= 51; n++) await sync.put(highlight(n))
    await sync.flush()
    expect(send.mock.calls.map(([entries]) => entries.length)).toEqual([50, 1])
  })

  it("takes back a change refused as full, and says why", async () => {
    const { rows, store } = memoryStore()
    const sync = createAnnotationSync({
      store,
      isOnline: () => true,
      send: async (entries) => ({
        ok: true,
        results: entries.map(() => "limit_reached"),
      }),
    })
    await sync.put(highlight(1))
    await sync.flush()
    expect(rows.size).toBe(0)
    expect(sync.rejection()).toEqual({ code: "annotations_full" })
    sync.dismissRejection()
    expect(sync.rejection()).toBeNull()
  })

  it("refuses a change the server would refuse, without queueing it", async () => {
    const { rows, store } = memoryStore()
    const sync = createAnnotationSync({
      store,
      send: allOk,
      isOnline: () => true,
    })
    await sync.put({ ...highlight(1), color: null })
    expect(rows.size).toBe(0)
    expect(sync.rejection()).toEqual({ code: "annotation_invalid" })
  })
})
