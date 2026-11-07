import { useEffect, useSyncExternalStore } from "react"
import { onMemberDataWiped } from "@/lib/local/device"
import {
  addSectionTime,
  dueSections,
  loadVocabCache,
  markSectionDone,
  meetStore,
  queueMeetings,
  queueTap,
  queueWordsRead,
  saveVocabCache,
  tapStore,
  wordsReadStore,
} from "@/lib/local/vocab-store"
import { type QueueSync, createQueueSync } from "@/lib/sync/queue-sync"
import { normalizeWord, isLookupWord } from "@/lib/words/normalize"
import {
  loadVocabFn,
  recordLookupsFn,
  recordMeetingsFn,
  recordWordsReadFn,
} from "@/server/vocab"
import type { VocabSummary } from "./comprehension"
import { countMeetings } from "./meetings"
import {
  MAX_MEET_BATCH,
  MAX_TAP_BATCH,
  MAX_WORDS_READ_BATCH,
  type MeetItem,
  type TapItem,
  type VocabCache,
  type WordMeetings,
  type WordsReadItem,
} from "./types"
import { sectionWords, wordParts } from "./words"

type VocabState = { cache: VocabCache | null }
let state: VocabState = { cache: null }
const listeners = new Set<() => void>()
function setState(next: VocabState) {
  state = next
  for (const listener of listeners) listener()
}
/** For tests: the state the hooks read. */
export const vocabStateForTests = (): VocabState => state

const keepaliveFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, keepalive: true })
const isOnline = () => navigator.onLine

type VocabSyncs = { reads: QueueSync; taps: QueueSync; meets: QueueSync }
let syncs: VocabSyncs | null = null
/** The three queues of this tab (browser only). */
function vocabSyncs(): VocabSyncs {
  syncs ??= {
    reads: createQueueSync<WordsReadItem>({
      store: wordsReadStore,
      isOnline,
      keyOf: (item) => item.key,
      batchSize: MAX_WORDS_READ_BATCH,
      send: (batch) =>
        recordWordsReadFn({
          data: batch.map(({ bookId, section, words, last }) => ({
            bookId,
            section,
            words,
            last,
          })),
        }),
      onRefused: (refused) =>
        console.error("the server refused words read", refused.length),
    }),
    taps: createQueueSync<TapItem>({
      store: tapStore,
      isOnline,
      keyOf: (item) => item.key,
      batchSize: MAX_TAP_BATCH,
      // Often sent as the reader closes.
      send: (batch) =>
        recordLookupsFn({
          data: batch.map(({ bookId, word, taps, at }) => ({
            bookId,
            word,
            taps,
            at,
          })),
          fetch: keepaliveFetch,
        }),
      onRefused: (refused) =>
        console.error("the server refused taps", refused.length),
      debounceMs: 10_000,
    }),
    meets: createQueueSync<MeetItem>({
      store: meetStore,
      isOnline,
      keyOf: (item) => item.key,
      batchSize: MAX_MEET_BATCH,
      send: (batch) =>
        recordMeetingsFn({
          data: batch.map(({ bookId, headword, section, count }) => ({
            bookId,
            headword,
            section,
            count,
          })),
        }),
      onRefused: (refused) =>
        console.error("the server refused meetings", refused.length),
    }),
  }
  return syncs
}

let refreshSeq = 0
let wipeEpoch = 0
let cacheRead: Promise<void> | null = null

onMemberDataWiped(() => {
  refreshSeq++
  wipeEpoch++
  cacheRead = null
  setState({ cache: null })
})

function readCache(): Promise<void> {
  const epoch = wipeEpoch
  cacheRead ??= loadVocabCache()
    .then((cache) => {
      if (epoch === wipeEpoch) setState({ cache: state.cache ?? cache })
    })
    .catch((error: unknown) => {
      if (epoch === wipeEpoch) cacheRead = null
      console.error(
        "reading the vocabulary numbers on this device failed",
        error
      )
    })
  return cacheRead
}

/** A tap that opened a meaning (spec 3D §3.3). */
export async function recordTap(bookId: string, word: string): Promise<void> {
  const normal = normalizeWord(word)
  if (!isLookupWord(normal)) return
  await queueTap(bookId, normal, new Date().toISOString())
  vocabSyncs().taps.later()
}

/** Reading time in a section; true while the section is due (spec 3D §3.1). */
export function addSectionReading(
  bookId: string,
  section: number,
  ms: number
): Promise<boolean> {
  return addSectionTime(bookId, section, ms)
}

/** A section just read: its words, and the saved words met in it (spec 3D §3.2, §3.4). */
export async function queueSectionRead(
  bookId: string,
  section: number,
  text: string,
  forms: Record<string, Array<string>>
): Promise<void> {
  await queueWordsRead(bookId, section, wordParts(sectionWords(text)))
  // The server leaves out the section where a word was saved.
  const met = Object.entries(countMeetings(text, forms)).map(
    ([headword, count]) => ({ headword, count })
  )
  if (met.length > 0) await queueMeetings(bookId, section, met)
  const { reads, meets } = vocabSyncs()
  reads.later()
  meets.later()
}

/** What the reader gives for the text of a section. */
export type SectionSource = {
  /** null: the section cannot be read; throws: the view is gone. */
  sectionText: (index: number) => Promise<string | null>
}

let dueChain: Promise<void> = Promise.resolve()

/**
 * Queues the words of every due section of a book. A section is done once
 * its rows are queued, or once its text came back null while the view was
 * alive (a document that really fails is not tried again). Without a source,
 * or when the view goes while reading, the section stays due for the next
 * visit. Runs one call at a time. Never rejects.
 */
export function readDueSections(
  bookId: string,
  getSource: () => SectionSource | null,
  getForms: () => Record<string, Array<string>>
): Promise<void> {
  dueChain = dueChain.then(async () => {
    try {
      for (const section of await dueSections(bookId)) {
        const source = getSource()
        if (!source) return
        let text: string | null
        try {
          text = await source.sectionText(section)
        } catch {
          return
        }
        if (text === null && getSource() !== source) return
        if (text) await queueSectionRead(bookId, section, text, getForms())
        await markSectionDone(bookId, section)
      }
    } catch (error) {
      console.error("counting the sections read failed", error)
    }
  })
  return dueChain
}

/** A word left Kosakata: its meetings go from this device's numbers at once (spec 3D §3.4). */
export async function dropWordMeetings(headword: string): Promise<void> {
  const cache = state.cache
  if (!cache || !Object.hasOwn(cache.meetings, headword)) return
  const { [headword]: _dropped, ...meetings } = cache.meetings
  const next = { ...cache, meetings }
  setState({ cache: next })
  try {
    await saveVocabCache(next)
  } catch (error) {
    console.error("keeping the vocabulary numbers on this device failed", error)
  }
}

/** Sends every waiting change. Never rejects. */
export async function flushVocab(): Promise<void> {
  const { reads, taps, meets } = vocabSyncs()
  for (const sync of [reads, taps, meets]) await sync.flush()
}

/** Sends the queues, then loads every book's numbers and the meetings. Never rejects. */
export async function refreshVocab(): Promise<void> {
  const seq = ++refreshSeq
  const epoch = wipeEpoch
  try {
    await readCache()
    await flushVocab()
    // Offline there is nothing to load (and no console noise).
    if (!isOnline()) return
    const answer = await loadVocabFn()
    if (seq !== refreshSeq || epoch !== wipeEpoch) return
    if (!answer.ok) {
      console.error("loading the vocabulary numbers was refused", answer.code)
      return
    }
    await saveVocabCache(answer.cache)
    if (seq !== refreshSeq || epoch !== wipeEpoch) return
    setState({ cache: answer.cache })
  } catch (error) {
    console.error("refreshing the vocabulary numbers failed", error)
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const SERVER_STATE: VocabState = { cache: null }

function useVocabState(): VocabState {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE
  )
  useEffect(() => {
    void readCache()
  }, [])
  return snapshot
}

/** A book's numbers; null when nothing was read or looked up in it yet. */
export function useBookVocab(bookId: string): VocabSummary | null {
  return useVocabState().cache?.books[bookId] ?? null
}

const NO_MEETINGS: WordMeetings = {}
/** Every saved word's meetings, by headword. */
export function useWordMeetings(): WordMeetings {
  return useVocabState().cache?.meetings ?? NO_MEETINGS
}
