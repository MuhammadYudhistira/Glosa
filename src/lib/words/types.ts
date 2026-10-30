/**
 * The dictionary's parts of speech (spec 2 §4.1). No imports here: Node runs
 * this file as it is for scripts/import-dictionary.ts.
 */
export const DICT_POS = [
  "noun",
  "verb",
  "adj",
  "adv",
  "pron",
  "prep",
  "conj",
  "interj",
  "phrase",
  "article",
  "det",
  "num",
  "particle",
] as const
export type DictPos = (typeof DICT_POS)[number]

/** Meanings kept per part of speech, and copied into a saved word. */
export const MAX_MEANINGS = 8

/** Where an entry's meanings came from (spec kamus tiga sumber §3.1). */
export const DICT_SOURCES = ["wiktionary", "wordnet", "ai"] as const
export type DictSource = (typeof DICT_SOURCES)[number]

export type DictEntry = {
  headword: string
  pos: DictPos
  meanings: Array<string>
}
export type DictPhrase = { headword: string; meanings: Array<string> }
export type DictForm = { form: string; headword: string; pos: DictPos }

/** An entry as the dictionary keeps it: one source per headword and part of speech. */
export type SourcedEntry = DictEntry & { source: DictSource }
/**
 * An entry as lookup_word answers it. Answers cached on a device before the
 * source column came have none: those meanings came from Wiktionary.
 */
export type LookupEntry = DictEntry & { source?: DictSource }

/** What lookup_word answers (spec 2 §4.1). */
export type LookupResult = {
  word: string
  entries: Array<LookupEntry>
  phrases: Array<DictPhrase>
  /** When the dictionary was imported; null before the first import. */
  version: string | null
}

/** Changes sent in one request (spec 2 §4.2). */
export const MAX_WORD_OPS = 50
export const MAX_SENTENCE_LENGTH = 500

/** A word in Kosakata (spec 2 §4.2), as the server and this device keep it. */
export type SavedWord = {
  headword: string
  pos: DictPos | null
  meanings: Array<string>
  bookId: string | null
  /** Copied from the book when saved; stays after the book is deleted. */
  bookTitle: string | null
  sentence: string
  cfi: string | null
  createdAt: string
}

/** One change to Kosakata, as it travels to the server. */
export type WordOp =
  | {
      kind: "save"
      headword: string
      pos: DictPos | null
      meanings: Array<string>
      bookId: string | null
      sentence: string
      cfi: string | null
    }
  | { kind: "delete"; headword: string }

export type WordOpResult = "ok" | "limit_reached" | "invalid"

type Failed = { ok: false; code: string }
export type LookupAnswer = { ok: true; result: LookupResult } | Failed
export type WordSyncAnswer = { ok: true; results: Array<WordOpResult> } | Failed
export type SavedWordsAnswer = { ok: true; words: Array<SavedWord> } | Failed
/** Every form of every saved word, by headword (the headword included). */
export type SavedFormsAnswer =
  { ok: true; forms: Record<string, Array<string>> } | Failed
