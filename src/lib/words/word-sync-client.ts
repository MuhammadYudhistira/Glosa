import { useEffect, useState, useSyncExternalStore } from "react"
import { claimLocalData } from "@/lib/local/device"
import {
  type FormsByHeadword,
  listLocalWords,
  loadSavedForms,
  localHeadwords,
  localWordStore,
  saveSavedForms,
} from "@/lib/local/saved-words"
import { savedWordFormsFn, syncSavedWordsFn } from "@/server/words"
import type { SavedWord } from "./types"
import { type WordRejection, type WordSync, createWordSync } from "./word-sync"

let engine: WordSync | null = null

/** The one word sync of this tab (browser only). */
export function wordSync(): WordSync {
  engine ??= createWordSync({
    store: localWordStore,
    isOnline: () => navigator.onLine,
    send: (ops) => syncSavedWordsFn({ data: { ops } }),
    onSynced: refreshSavedForms,
  })
  return engine
}

/**
 * Fetches the forms of every saved word, words saved on other devices too,
 * and keeps them for offline. Without a connection the device's copy stays.
 */
export async function refreshSavedForms(): Promise<void> {
  try {
    const answer = await savedWordFormsFn()
    if (!answer.ok) return
    await saveSavedForms(answer.forms)
    wordSync().notify()
  } catch (error) {
    console.error("fetching the saved words' forms failed", error)
  }
}

/**
 * Sends waiting changes when the app opens and when the connection comes back
 * (spec 2 §7). It waits for this device to be the member's first: otherwise the
 * previous member's queue could be sent under the new session.
 */
export function useWordFlush(userId: string): void {
  useEffect(() => {
    let live = true
    const sync = wordSync()
    const onOnline = () => void sync.flush()
    claimLocalData(userId)
      .then(() => {
        if (!live) return
        void sync.flush()
        window.addEventListener("online", onOnline)
      })
      .catch((error: unknown) =>
        console.error("claiming this device failed", error)
      )
    return () => {
      live = false
      window.removeEventListener("online", onOnline)
    }
  }, [userId])
}

export function useVocabularyVersion(): number {
  return useSyncExternalStore(
    (listener) => wordSync().subscribe(listener),
    () => wordSync().version(),
    () => 0
  )
}

/**
 * Reads this device's copy on mount and again after every change to Kosakata.
 * `read` must keep the same identity (a module-level function).
 */
function useLocal<T>(read: () => Promise<T>, initial: T): T {
  const version = useVocabularyVersion()
  const [value, setValue] = useState(initial)
  useEffect(() => {
    let live = true
    read()
      .then((next) => {
        if (live) setValue(next)
      })
      .catch((error: unknown) =>
        console.error("reading Kosakata on this device failed", error)
      )
    return () => {
      live = false
    }
  }, [read, version])
  return value
}

const NO_HEADWORDS: ReadonlySet<string> = new Set()
const NO_FORMS: FormsByHeadword = {}

export function useSavedHeadwords(): ReadonlySet<string> {
  return useLocal<ReadonlySet<string>>(localHeadwords, NO_HEADWORDS)
}

export function useSavedForms(): FormsByHeadword {
  return useLocal(loadSavedForms, NO_FORMS)
}

/**
 * Kosakata as the loader gave it, then as this device keeps it once anything
 * changes. Not read on mount: after a server render the device's copy may be
 * older than the loader's list until the page has stored it.
 */
export function useLocalWords(initial: Array<SavedWord>): Array<SavedWord> {
  const version = useVocabularyVersion()
  const [state, setState] = useState({ version, words: initial })
  useEffect(() => {
    if (version === state.version) return
    let live = true
    listLocalWords()
      .then((words) => {
        if (live) setState({ version, words })
      })
      .catch((error: unknown) =>
        console.error("reading Kosakata on this device failed", error)
      )
    return () => {
      live = false
    }
  }, [version, state.version])
  return state.words
}

export function useWordRejection(): WordRejection | null {
  useVocabularyVersion()
  return import.meta.env.SSR ? null : wordSync().rejection()
}
