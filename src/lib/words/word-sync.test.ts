import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SavedWord, WordOp, WordSyncAnswer } from "./types"
import { type QueuedWordOp, type WordStore, createWordSync } from "./word-sync"

/** The same rules as localWordStore, in memory. */
function memoryStore() {
  const words = new Map<string, SavedWord>()
  const ops = new Map<string, QueuedWordOp>()
  let clock = 0
  const store: WordStore = {
    save: async (word) => {
      words.set(word.headword, word)
      ops.set(word.headword, {
        headword: word.headword,
        kind: "save",
        word,
        queuedAt: ++clock,
      })
    },
    remove: async (headword) => {
      words.delete(headword)
      ops.set(headword, {
        headword,
        kind: "delete",
        word: null,
        queuedAt: ++clock,
      })
    },
    pending: async () =>
      [...ops.values()].sort((a, b) => a.queuedAt - b.queuedAt),
    confirm: async (sent) => {
      for (const op of sent) {
        if (ops.get(op.headword)?.queuedAt === op.queuedAt) {
          ops.delete(op.headword)
        }
      }
    },
    revert: async (op) => {
      if (op.kind === "save" && !ops.has(op.headword)) words.delete(op.headword)
    },
  }
  return { words, ops, store }
}

const word = (headword: string): SavedWord => ({
  headword,
  pos: "verb",
  meanings: ["berlari"],
  bookId: null,
  bookTitle: null,
  sentence: "He ran.",
  cfi: null,
  createdAt: "2026-10-24T08:00:00.000Z",
})

const allOk = async (sent: Array<WordOp>): Promise<WordSyncAnswer> => ({
  ok: true,
  results: sent.map(() => "ok"),
})

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createWordSync", () => {
  it("shows a save at once and sends it two seconds after the last change", async () => {
    const { words, store } = memoryStore()
    const send = vi.fn(allOk)
    const sync = createWordSync({ store, send, isOnline: () => true })
    const listener = vi.fn()
    sync.subscribe(listener)

    await sync.save(word("run"), ["ran"])
    expect(words.has("run")).toBe(true)
    expect(listener).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_999)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledWith([
      {
        kind: "save",
        headword: "run",
        pos: "verb",
        meanings: ["berlari"],
        bookId: null,
        sentence: "He ran.",
        cfi: null,
      },
    ])
  })

  it("sends only the latest change of a word", async () => {
    const { store } = memoryStore()
    const send = vi.fn(allOk)
    const sync = createWordSync({ store, send, isOnline: () => true })
    await sync.save(word("run"), [])
    await sync.remove("run")
    await vi.advanceTimersByTimeAsync(2_000)
    expect(send).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith([{ kind: "delete", headword: "run" }])
  })

  it("takes back a save the server refuses as full, and says why", async () => {
    const { words, ops, store } = memoryStore()
    const send = vi.fn(async (): Promise<WordSyncAnswer> => ({
      ok: true,
      results: ["limit_reached"],
    }))
    const sync = createWordSync({ store, send, isOnline: () => true })
    await sync.save(word("run"), [])
    const before = sync.version()
    await sync.flush()
    expect(words.has("run")).toBe(false)
    expect(ops.size).toBe(0)
    expect(sync.rejection()).toEqual({ code: "words_full", headword: "run" })
    expect(sync.version()).toBeGreaterThan(before)
    sync.dismissRejection()
    expect(sync.rejection()).toBeNull()
  })

  it("refuses a word the server would refuse, without queueing it", async () => {
    const { ops, store } = memoryStore()
    const sync = createWordSync({ store, send: allOk, isOnline: () => true })
    await sync.save({ ...word("run"), sentence: "a".repeat(501) }, [])
    expect(ops.size).toBe(0)
    expect(sync.rejection()).toEqual({ code: "word_invalid", headword: "run" })
  })

  it("keeps changes that could not be sent for the next flush", async () => {
    const { ops, store } = memoryStore()
    const send = vi
      .fn<(sent: Array<WordOp>) => Promise<WordSyncAnswer>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: false, code: "unknown" })
      .mockImplementation(allOk)
    const sync = createWordSync({ store, send, isOnline: () => true })
    await sync.save(word("run"), [])
    await sync.flush()
    expect(ops.size).toBe(1)
    await sync.flush()
    expect(ops.size).toBe(1)
    await sync.flush()
    expect(ops.size).toBe(0)
  })

  it("waits while offline", async () => {
    const { ops, store } = memoryStore()
    const send = vi.fn(allOk)
    const sync = createWordSync({ store, send, isOnline: () => false })
    await sync.save(word("run"), [])
    await sync.flush()
    expect(send).not.toHaveBeenCalled()
    expect(ops.size).toBe(1)
  })

  it("fetches the forms again after the server took changes", async () => {
    const { store } = memoryStore()
    const onSynced = vi.fn(async () => {})
    const sync = createWordSync({
      store,
      send: allOk,
      isOnline: () => true,
      onSynced,
    })
    await sync.flush()
    expect(onSynced).not.toHaveBeenCalled()
    await sync.save(word("run"), [])
    await sync.flush()
    expect(onSynced).toHaveBeenCalledOnce()
  })

  it("sends at most 50 changes per request", async () => {
    const { store } = memoryStore()
    const send = vi.fn(allOk)
    const sync = createWordSync({ store, send, isOnline: () => true })
    for (let i = 0; i < 51; i++) await sync.remove(`w${i}`)
    await sync.flush()
    expect(send.mock.calls.map(([sent]) => sent.length)).toEqual([50, 1])
  })
})
