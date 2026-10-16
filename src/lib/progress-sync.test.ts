import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createProgressSync } from "./progress-sync"
import type { PositionStore, ProgressEntry } from "./reader-types"

type Row = ProgressEntry & { pending: boolean }

function memoryStore(initial: Array<ProgressEntry> = []) {
  const rows = new Map<string, Row>(
    initial.map((entry) => [entry.bookId, { ...entry, pending: true }])
  )
  const store: PositionStore = {
    put: async (entry) => {
      rows.set(entry.bookId, { ...entry, pending: true })
    },
    pending: async () =>
      [...rows.values()]
        .filter((row) => row.pending)
        .map((row) => ({
          bookId: row.bookId,
          cfi: row.cfi,
          percentage: row.percentage,
          updatedAt: row.updatedAt,
        })),
    markSynced: async (entries) => {
      for (const entry of entries) {
        const row = rows.get(entry.bookId)
        if (row?.updatedAt === entry.updatedAt) row.pending = false
      }
    },
  }
  return { rows, store }
}

const entry = (bookId: string, minute: number): ProgressEntry => ({
  bookId,
  cfi: `epubcfi(/6/${minute}!/4/2)`,
  percentage: minute,
  updatedAt: new Date(Date.UTC(2026, 9, 17, 8, minute)).toISOString(),
})

const ok = { ok: true as const }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createProgressSync", () => {
  it("sends a recorded position once the reader pauses for five seconds", async () => {
    const { store } = memoryStore()
    const send = vi.fn().mockResolvedValue(ok)
    const sync = createProgressSync({ store, send, isOnline: () => true })

    await sync.record(entry("a", 1))
    expect(sync.status()).toBe("pending")
    await vi.advanceTimersByTimeAsync(4_999)
    expect(send).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledWith([entry("a", 1)], { keepalive: false })
    expect(sync.status()).toBe("synced")
  })

  it("sends only the latest position of a book", async () => {
    const { store } = memoryStore()
    const send = vi.fn().mockResolvedValue(ok)
    const sync = createProgressSync({ store, send, isOnline: () => true })

    await sync.record(entry("a", 1))
    await vi.advanceTimersByTimeAsync(2_000)
    await sync.record(entry("a", 2))
    await vi.advanceTimersByTimeAsync(5_000)

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith([entry("a", 2)], { keepalive: false })
  })

  it("sends at once, with keepalive, when the page is hidden or left", async () => {
    const { store } = memoryStore()
    const send = vi.fn().mockResolvedValue(ok)
    const sync = createProgressSync({ store, send, isOnline: () => true })

    await sync.record(entry("a", 1))
    const flushed = sync.flush({ keepalive: true })
    // The request starts in the same tick: the page may be gone after it.
    expect(send).toHaveBeenCalledWith([entry("a", 1)], { keepalive: true })
    await flushed
    await vi.advanceTimersByTimeAsync(5_000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("waits while offline and reports it, then sends when back online", async () => {
    const { store } = memoryStore()
    const send = vi.fn().mockResolvedValue(ok)
    let online = false
    const sync = createProgressSync({ store, send, isOnline: () => online })

    await sync.record(entry("a", 1))
    await vi.advanceTimersByTimeAsync(5_000)
    expect(send).not.toHaveBeenCalled()
    expect(sync.status()).toBe("failing")

    online = true
    await sync.flush()
    expect(send).toHaveBeenCalledWith([entry("a", 1)], { keepalive: false })
    expect(sync.status()).toBe("synced")
  })

  it("reports failing after three failed attempts, and recovers", async () => {
    const { store } = memoryStore([entry("a", 1)])
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "unknown" })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: false, code: "unknown" })
      .mockResolvedValueOnce(ok)
    const sync = createProgressSync({ store, send, isOnline: () => true })

    await sync.flush()
    await sync.flush()
    expect(sync.status()).toBe("pending")
    await sync.flush()
    expect(sync.status()).toBe("failing")
    await sync.flush()
    expect(sync.status()).toBe("synced")
  })

  it("keeps a position that moved while it was being sent", async () => {
    const { rows, store } = memoryStore()
    let finish: (value: typeof ok) => void = () => undefined
    const send = vi.fn(
      () =>
        new Promise<typeof ok>((resolve) => {
          finish = resolve
        })
    )
    const sync = createProgressSync({ store, send, isOnline: () => true })

    await sync.record(entry("a", 1))
    const flushed = sync.flush()
    await vi.advanceTimersByTimeAsync(0)
    await sync.record(entry("a", 2))
    finish(ok)
    await flushed

    expect(rows.get("a")).toMatchObject({ percentage: 2, pending: true })
    expect(sync.status()).toBe("pending")
  })

  it("sends positions left from earlier visits in batches of fifty", async () => {
    const earlier = Array.from({ length: 51 }, (_, i) => entry(`b${i}`, i % 60))
    const { store } = memoryStore(earlier)
    const send = vi.fn().mockResolvedValue(ok)
    const sync = createProgressSync({ store, send, isOnline: () => true })

    await sync.flush()
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0][0]).toHaveLength(50)
    expect(send.mock.calls[1][0]).toHaveLength(1)
    expect(sync.status()).toBe("synced")
  })

  it("tells subscribers when the status changes", async () => {
    const { store } = memoryStore()
    const send = vi.fn().mockResolvedValue(ok)
    const sync = createProgressSync({ store, send, isOnline: () => true })
    const listener = vi.fn()
    const unsubscribe = sync.subscribe(listener)

    await sync.record(entry("a", 1))
    await sync.flush()
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    await sync.record(entry("a", 2))
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
