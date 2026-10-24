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
] as const
export type DictPos = (typeof DICT_POS)[number]

/** Meanings kept per part of speech, and copied into a saved word. */
export const MAX_MEANINGS = 8

export type DictEntry = {
  headword: string
  pos: DictPos
  meanings: Array<string>
}
export type DictPhrase = { headword: string; meanings: Array<string> }
export type DictForm = { form: string; headword: string; pos: DictPos }

/** What lookup_word answers (spec 2 §4.1). */
export type LookupResult = {
  word: string
  entries: Array<DictEntry>
  phrases: Array<DictPhrase>
}
