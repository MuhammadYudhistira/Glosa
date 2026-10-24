export type QueueResult = "ok" | "limit_reached" | "invalid"

export type QueueAnswer =
  { ok: true; results: Array<QueueResult> } | { ok: false; code: string }

/** Where the waiting changes live (IndexedDB in the browser). */
export type QueueStore<T> = {
  /** Oldest first. */
  pending: () => Promise<Array<T>>
  /** Drops sent changes, unless they changed again since. */
  confirm: (sent: ReadonlyArray<T>) => Promise<void>
  /** Takes back a change the server refused, unless it changed again since. */
  revert: (item: T) => Promise<void>
}

export type Refused<T> = { item: T; result: Exclude<QueueResult, "ok"> }

export type QueueSync = {
  /** Sends every waiting change now. Never rejects. */
  flush: () => Promise<void>
  /** Sends the waiting changes after the pause. */
  later: () => void
  /** Tells the listeners something on this device changed. */
  changed: () => void
  /** Grows on every change, so views read the device's copy again. */
  version: () => number
  subscribe: (listener: () => void) => () => void
  dispose: () => void
}

/**
 * A queue of changes made on this device (spec 2 §7): sent `debounceMs`
 * after the last change, in batches, with one answer per change. A change the
 * server refuses is taken back, and reported unless it changed again while
 * the batch was on its way.
 */
export function createQueueSync<T>(options: {
  store: QueueStore<T>
  send: (batch: Array<T>) => Promise<QueueAnswer>
  isOnline: () => boolean
  /** Which item a later change replaces. */
  keyOf: (item: T) => string
  batchSize: number
  onRefused: (refused: Array<Refused<T>>) => void
  /** After the server took changes. */
  onSynced?: () => Promise<void>
  debounceMs?: number
}): QueueSync {
  const { store, send, isOnline, keyOf, batchSize } = options
  const debounceMs = options.debounceMs ?? 2_000
  const listeners = new Set<() => void>()
  let version = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let running: Promise<void> | null = null
  let again = false

  function changed() {
    version += 1
    for (const listener of listeners) listener()
  }

  function later() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, debounceMs)
  }

  /** Sends the waiting changes until a batch fails; the next trigger retries. */
  async function sendWaiting() {
    if (!isOnline()) return
    const waiting = await store.pending()
    let delivered = false
    try {
      for (let i = 0; i < waiting.length; i += batchSize) {
        const batch = waiting.slice(i, i + batchSize)
        let answer: QueueAnswer
        try {
          answer = await send(batch)
        } catch {
          return
        }
        if (!answer.ok) return
        await store.confirm(batch)
        delivered = true
        const refused: Array<Refused<T>> = []
        for (const [index, result] of answer.results.entries()) {
          if (result === "ok") continue
          const item = batch[index]
          await store.revert(item)
          refused.push({ item, result })
        }
        if (refused.length > 0) {
          // A change made again while the batch was in flight is not refused news.
          const queued = new Set((await store.pending()).map(keyOf))
          const news = refused.filter(({ item }) => !queued.has(keyOf(item)))
          if (news.length > 0) options.onRefused(news)
        }
      }
    } finally {
      if (delivered) await options.onSynced?.()
    }
  }

  function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      try {
        do {
          again = false
          try {
            await sendWaiting()
          } catch {
            // A storage error: the changes stay queued for the next trigger.
          }
          // again is set by a flush() made while the loop awaits; TS cannot see it.
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        } while (again)
      } finally {
        running = null
      }
    })()
    return running
  }

  return {
    flush,
    later,
    changed,
    version: () => version,
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
