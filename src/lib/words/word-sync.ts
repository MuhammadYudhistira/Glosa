import type { LocalWordOp } from "@/lib/local/db"
import type { SavedWord } from "./types"

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
