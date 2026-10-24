import { listSavedWordsFn } from "@/server/words"
import { BookLoadError } from "./book-download"
import { claimLocalData } from "./local/device"
import { listLocalWords } from "./local/saved-words"
import type { SavedWord } from "./words/types"
import { wordSync } from "./words/word-sync-client"

export type VocabularyView = { words: Array<SavedWord>; offline: boolean }

// The connection can drop while the request is in flight.
const unreachable = (error: unknown) =>
  !navigator.onLine || error instanceof TypeError

/**
 * Kosakata (spec 2 §7). Online: the server's list, once this device's
 * waiting changes went out; the page then stores it on the device. Offline,
 * or when the server cannot answer: this device's copy.
 */
export async function loadVocabulary(userId: string): Promise<VocabularyView> {
  if (import.meta.env.SSR) {
    const answer = await listSavedWordsFn()
    if (!answer.ok) throw new BookLoadError(answer.code)
    return { words: answer.words, offline: false }
  }
  // Another member's copy must not show, even for a moment.
  await claimLocalData(userId)
  if (navigator.onLine) {
    try {
      await wordSync().flush()
      const answer = await listSavedWordsFn()
      if (answer.ok) return { words: answer.words, offline: false }
    } catch (error) {
      if (!unreachable(error)) throw error
    }
  }
  return { words: await listLocalWords(), offline: !navigator.onLine }
}
