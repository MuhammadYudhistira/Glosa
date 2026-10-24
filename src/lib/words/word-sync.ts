import type { LocalWordOp } from "@/lib/local/db"
import { isValidWordOp } from "./schemas"
import {
  MAX_WORD_OPS,
  type SavedWord,
  type WordOp,
  type WordSyncAnswer,
} from "./types"

/** A change waiting for the server; `queuedAt` tells a later change of the same word apart. */
export type QueuedWordOp = LocalWordOp

/** Where Kosakata and its waiting changes live (IndexedDB in the browser). */
export type WordStore = {
  /** Shows the word at once and queues its save; `forms` underline it until the server's arrive. */
  save: (word: SavedWord, forms: Array<string>) => Promise<void>
  /** Hides the word at once and queues its deletion. */
  remove: (headword: string) => Promise<void>
  /** Oldest first. */
  pending: () => Promise<Array<QueuedWordOp>>
  /** Drops sent changes, unless the word changed again since. */
  confirm: (sent: ReadonlyArray<QueuedWordOp>) => Promise<void>
  /** Takes back a save the server refused, unless the word changed again since. */
  revert: (op: QueuedWordOp) => Promise<void>
}

/** A change the server refused, shown until dismissed. `code` is a bookMessage key. */
export type WordRejection = {
  code: "words_full" | "word_invalid"
  headword: string
}

export type SendWords = (ops: Array<WordOp>) => Promise<WordSyncAnswer>

export type WordSync = {
  save: (word: SavedWord, forms: Array<string>) => Promise<void>
  remove: (headword: string) => Promise<void>
  /** Sends every waiting change now. Never rejects. */
  flush: () => Promise<void>
  /** Grows on every change to Kosakata on this device, so views read it again. */
  version: () => number
  /** For changes made beside the queue, such as the server's forms arriving. */
  notify: () => void
  rejection: () => WordRejection | null
  dismissRejection: () => void
  subscribe: (listener: () => void) => () => void
  dispose: () => void
}

export function toWordOp(op: QueuedWordOp): WordOp {
  if (op.kind === "delete" || !op.word) {
    return { kind: "delete", headword: op.headword }
  }
  const { headword, pos, meanings, bookId, sentence, cfi } = op.word
  return { kind: "save", headword, pos, meanings, bookId, sentence, cfi }
}

/**
 * Saves and deletions of words (spec 2 §7): shown on this device at once,
 * then sent two seconds after the last change, in batches of 50. A change the
 * server refuses is taken back, and its reason kept for the page to show.
 */
export function createWordSync(options: {
  store: WordStore
  send: SendWords
  isOnline: () => boolean
  /** After the server took changes: fetch the saved words' forms again. */
  onSynced?: () => Promise<void>
  debounceMs?: number
}): WordSync {
  const { store, send, isOnline } = options
  const debounceMs = options.debounceMs ?? 2_000
  const listeners = new Set<() => void>()
  let version = 0
  let rejection: WordRejection | null = null
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

  function refuse(code: WordRejection["code"], headword: string) {
    rejection = { code, headword }
    changed()
  }

  /** Sends the waiting changes until a batch fails; the next trigger retries. */
  async function sendWaiting() {
    if (!isOnline()) return
    const waiting = await store.pending()
    let delivered = false
    try {
      for (let i = 0; i < waiting.length; i += MAX_WORD_OPS) {
        const batch = waiting.slice(i, i + MAX_WORD_OPS)
        let answer: WordSyncAnswer
        try {
          answer = await send(batch.map(toWordOp))
        } catch {
          return
        }
        if (!answer.ok) return
        await store.confirm(batch)
        delivered = true
        const refused: Array<{
          op: QueuedWordOp
          code: WordRejection["code"]
        }> = []
        for (const [index, result] of answer.results.entries()) {
          if (result === "ok") continue
          const op = batch[index]
          await store.revert(op)
          refused.push({
            op,
            code: result === "limit_reached" ? "words_full" : "word_invalid",
          })
        }
        if (refused.length > 0) {
          // A word changed again while the batch was in flight is not refused news.
          const queued = new Set((await store.pending()).map((q) => q.headword))
          for (const { op, code } of refused) {
            if (!queued.has(op.headword)) refuse(code, op.headword)
          }
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
    async save(word, forms) {
      const op: QueuedWordOp = {
        headword: word.headword,
        kind: "save",
        word,
        queuedAt: 0,
      }
      if (!isValidWordOp(toWordOp(op))) {
        refuse("word_invalid", word.headword)
        return
      }
      await store.save(word, forms)
      changed()
      later()
    },
    async remove(headword) {
      await store.remove(headword)
      changed()
      later()
    },
    flush,
    version: () => version,
    notify: changed,
    rejection: () => rejection,
    dismissRejection() {
      if (!rejection) return
      rejection = null
      changed()
    },
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
