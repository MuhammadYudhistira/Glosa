import { MAX_PROGRESS_BATCH } from "./progress"
import type { PositionStore, ProgressEntry } from "./reader-types"

export type SyncStatus = "synced" | "pending" | "failing"

export type SendResult = { ok: true } | { ok: false; code: string }

export type SendProgress = (
  entries: Array<ProgressEntry>,
  options: { keepalive: boolean }
) => Promise<SendResult>

export type ProgressSync = {
  /** Saves the position on this device and sends it after a pause (spec §10 step 2). */
  record: (entry: ProgressEntry) => Promise<void>
  /** Sends every waiting position now. `keepalive` lets the request outlive the page. */
  flush: (options?: { keepalive?: boolean }) => Promise<void>
  status: () => SyncStatus
  subscribe: (listener: () => void) => () => void
  dispose: () => void
}

export function createProgressSync(options: {
  store: PositionStore
  send: SendProgress
  isOnline: () => boolean
  debounceMs?: number
  failLimit?: number
}): ProgressSync {
  const { store, send, isOnline } = options
  const debounceMs = options.debounceMs ?? 5_000
  const failLimit = options.failLimit ?? 3
  const listeners = new Set<() => void>()
  // Positions recorded in this tab and not yet confirmed. When the page is
  // being hidden or closed they are sent straight away, without waiting for
  // IndexedDB, so the request starts before the page can go away.
  const recent = new Map<string, ProgressEntry>()
  let status: SyncStatus = "synced"
  let failures = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let running: Promise<void> | null = null
  let again = false

  function setStatus(next: SyncStatus) {
    if (next === status) return
    status = next
    for (const listener of listeners) listener()
  }

  const stuck = () => (failures >= failLimit ? "failing" : "pending")

  function fail() {
    failures += 1
    setStatus(stuck())
  }

  async function confirm(batch: Array<ProgressEntry>) {
    await store.markSynced(batch)
    for (const entry of batch) {
      if (recent.get(entry.bookId)?.updatedAt === entry.updatedAt) {
        recent.delete(entry.bookId)
      }
    }
  }

  /** Sends the entries in batches and confirms each one. False on the first failure. */
  async function deliver(
    entries: Array<ProgressEntry>,
    keepalive: boolean
  ): Promise<boolean> {
    for (let i = 0; i < entries.length; i += MAX_PROGRESS_BATCH) {
      const batch = entries.slice(i, i + MAX_PROGRESS_BATCH)
      let result: SendResult
      try {
        result = await send(batch, { keepalive })
      } catch {
        result = { ok: false, code: "network" }
      }
      if (!result.ok) return false
      await confirm(batch)
    }
    return true
  }

  async function settle() {
    failures = 0
    setStatus((await store.pending()).length > 0 ? "pending" : "synced")
  }

  /** Runs one attempt. A storage error counts as one failure and never rejects. */
  async function attempt(work: () => Promise<void>) {
    try {
      await work()
    } catch {
      fail()
    }
  }

  async function sendWaiting() {
    const entries = await store.pending()
    if (entries.length === 0) {
      failures = 0
      setStatus("synced")
      return
    }
    if (!isOnline()) {
      setStatus("failing")
      return
    }
    if (await deliver(entries, false)) {
      await settle()
    } else {
      fail()
    }
  }

  function flush(flushOptions: { keepalive?: boolean } = {}): Promise<void> {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (flushOptions.keepalive && recent.size > 0) {
      // Starts in this tick, outside the queue, so it is not held up by a send
      // that is still running and the request can outlive the page.
      return attempt(async () => {
        if (!isOnline()) {
          setStatus("failing")
          return
        }
        if (await deliver([...recent.values()], true)) {
          await settle()
        } else {
          fail()
        }
      })
    }
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      try {
        do {
          again = false
          await attempt(sendWaiting)
          // again is set by a flush() made while the loop awaits; TS cannot see it.
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        } while (again)
      } finally {
        running = null
      }
    })()
    return running
  }

  async function record(entry: ProgressEntry) {
    recent.set(entry.bookId, entry)
    await store.put(entry)
    if (status === "synced") setStatus("pending")
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, debounceMs)
  }

  return {
    record,
    flush,
    status: () => status,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}
