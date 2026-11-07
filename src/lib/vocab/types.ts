import type { VocabSummary } from "./comprehension"

/** One part of a section's words, as it waits on the device (spec 3D §3.2). */
export type WordsReadItem = {
  key: string
  bookId: string
  section: number
  part: number
  words: Array<string>
  last: boolean
}
/** Taps on one word in one book not sent yet (spec 3D §3.3). */
export type TapItem = {
  key: string
  bookId: string
  word: string
  taps: number
  at: string
}
/** A saved word's meetings in one section (spec 3D §3.4). */
export type MeetItem = {
  key: string
  bookId: string
  headword: string
  section: number
  count: number
}

export type BookVocab = {
  read: number
  lookedUp: number
  words: Array<{ word: string; taps: number; lastAt: string }>
}
export type WordMeetings = Record<string, { meetings: number; books: number }>
/** What the lobby and Kosakata show without a request per book. */
export type VocabCache = {
  books: Record<string, VocabSummary>
  meetings: WordMeetings
}

export type VocabAnswer =
  { ok: true; cache: VocabCache } | { ok: false; code: string }
export type BookVocabAnswer =
  { ok: true; vocab: BookVocab } | { ok: false; code: string }

export const MAX_TAP_BATCH = 50
export const MAX_MEET_BATCH = 50
export const MAX_WORDS_READ_BATCH = 10
