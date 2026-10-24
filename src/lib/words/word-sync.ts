import type { LocalWordOp } from "@/lib/local/db"
import { type QueueStore, createQueueSync } from "@/lib/sync/queue-sync"
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
export type WordStore = QueueStore<QueuedWordOp> & {
  /** Shows the word at once and queues its save; `forms` underline it until the server's arrive. */
  save: (word: SavedWord, forms: Array<string>) => Promise<void>
  /** Hides the word at once and queues its deletion. */
  remove: (headword: string) => Promise<void>
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
  const { store } = options
  let rejection: WordRejection | null = null
  const queue = createQueueSync<QueuedWordOp>({
    store,
    send: (batch) => options.send(batch.map(toWordOp)),
    isOnline: options.isOnline,
    keyOf: (op) => op.headword,
    batchSize: MAX_WORD_OPS,
    onRefused: (refused) => {
      for (const { item, result } of refused) {
        refuse(
          result === "limit_reached" ? "words_full" : "word_invalid",
          item.headword
        )
      }
    },
    onSynced: options.onSynced,
    debounceMs: options.debounceMs,
  })

  function refuse(code: WordRejection["code"], headword: string) {
    rejection = { code, headword }
    queue.changed()
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
      queue.changed()
      queue.later()
    },
    async remove(headword) {
      await store.remove(headword)
      queue.changed()
      queue.later()
    },
    flush: queue.flush,
    version: queue.version,
    notify: queue.changed,
    rejection: () => rejection,
    dismissRejection() {
      if (!rejection) return
      rejection = null
      queue.changed()
    },
    subscribe: queue.subscribe,
    dispose: queue.dispose,
  }
}
