import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  type QueueAnswer,
  type QueueStore,
  type Refused,
  createQueueSync,
} from "./queue-sync"

type Item = { key: string; stamp: number }

/** A queue in memory: one item per key, the latest wins. */
function memoryStore() {
  const items = new Map<string, Item>()
  const reverted: Array<Item> = []
  const store: QueueStore<Item> = {
    pending: async () => [...items.values()].sort((a, b) => a.stamp - b.stamp),
    confirm: async (sent) => {
      for (const item of sent) {
        if (items.get(item.key)?.stamp === item.stamp) items.delete(item.key)
      }
    },
    revert: async (item) => {
      reverted.push(item)
    },
  }
  return { items, reverted, store }
}

const allOk = async (batch: Array<Item>): Promise<QueueAnswer> => ({
  ok: true,
  results: batch.map(() => "ok"),
})

function queueOf(
  store: QueueStore<Item>,
  send: (batch: Array<Item>) => Promise<QueueAnswer>,
  onRefused: (refused: Array<Refused<Item>>) => void = () => undefined
) {
  return createQueueSync<Item>({
    store,
    send,
    isOnline: () => true,
    keyOf: (item) => item.key,
    batchSize: 2,
    onRefused,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createQueueSync", () => {
  it("sends two seconds after the last change, in batches", async () => {
    const { items, store } = memoryStore()
    const send = vi.fn(allOk)
    const queue = queueOf(store, send)
    for (const [index, key] of ["a", "b", "c"].entries()) {
      items.set(key, { key, stamp: index })
    }

    queue.later()
    await vi.advanceTimersByTimeAsync(1_999)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(send.mock.calls.map(([batch]) => batch.map((i) => i.key))).toEqual([
      ["a", "b"],
      ["c"],
    ])
    expect(items.size).toBe(0)
  })

  it("takes back a refused item and reports it, unless it changed again in flight", async () => {
    const { items, reverted, store } = memoryStore()
    const onRefused = vi.fn()
    items.set("a", { key: "a", stamp: 1 })
    items.set("b", { key: "b", stamp: 2 })
    const queue = queueOf(
      store,
      async (batch) => {
        // "b" changes again while the batch is on its way.
        items.set("b", { key: "b", stamp: 3 })
        return { ok: true, results: batch.map(() => "limit_reached") }
      },
      onRefused
    )

    await queue.flush()
    expect(reverted.map((item) => item.key)).toEqual(["a", "b"])
    expect(onRefused).toHaveBeenCalledWith([
      { item: { key: "a", stamp: 1 }, result: "limit_reached" },
    ])
  })

  it("keeps everything for the next try when sending fails or the device is offline", async () => {
    const { items, store } = memoryStore()
    items.set("a", { key: "a", stamp: 1 })
    const failing = queueOf(store, async () => ({ ok: false, code: "unknown" }))
    await failing.flush()
    expect(items.size).toBe(1)

    const send = vi.fn(allOk)
    const offline = createQueueSync<Item>({
      store,
      send,
      isOnline: () => false,
      keyOf: (item) => item.key,
      batchSize: 2,
      onRefused: () => undefined,
    })
    await offline.flush()
    expect(send).not.toHaveBeenCalled()
  })

  it("tells listeners about changes", () => {
    const { store } = memoryStore()
    const queue = queueOf(store, allOk)
    const listener = vi.fn()
    const stop = queue.subscribe(listener)
    queue.changed()
    expect(queue.version()).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    queue.changed()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
