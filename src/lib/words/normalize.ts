/** The longest word or phrase looked up, saved or kept in the dictionary (spec 2 §4). */
export const MAX_WORD_LENGTH = 64

const APOSTROPHES = /[‘’ʼ]/gu
const EDGES = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu
/** Latin letters joined by apostrophes or hyphens: "don't", "well-known". */
const LOOKUP_WORD = /^\p{Script=Latin}+(?:['-]\p{Script=Latin}+)*$/u

/**
 * The form a word is looked up and saved in (spec 2 §5): lower case, straight
 * apostrophes, single spaces, no punctuation at either end and no possessive
 * 's. The dictionary import runs every headword and form through it too, so
 * the reader and the dictionary always agree. No imports: Node runs this file
 * as it is for scripts/import-dictionary.ts.
 */
export function normalizeWord(raw: string): string {
  const word = raw
    .normalize("NFC")
    .replace(APOSTROPHES, "'")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .replace(EDGES, "")
  return word.replace(/'s$/u, "").replace(EDGES, "")
}

/** Whether a tapped word opens its meaning (spec 2 §6.2): Latin letters only, at most 64. */
export function isLookupWord(word: string): boolean {
  return word.length <= MAX_WORD_LENGTH && LOOKUP_WORD.test(word)
}
