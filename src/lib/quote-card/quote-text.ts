import { isLookupWord, normalizeWord } from "@/lib/words/normalize"
import type { SavedForms } from "@/lib/words/saved-marks"

/** The longest quote a card carries (spec kartu kutipan, decision 11). */
export const MAX_QUOTE_LENGTH = 300
/** A cut may go back this far to end on a whole word. */
const MIN_CUT = 200
/** Double quotation marks: the card draws its own. */
const OUTER_QUOTES = /^["“”„«»]+|["“”„«»]+$/gu
const TRAILING = /[\s,;:—–-]+$/u

export type PreparedQuote = { text: string; cut: boolean }

/**
 * A quote as a card shows it: one line, no outer quotation marks, at most
 * 300 characters, cut at a word with an ellipsis.
 */
export function prepareQuote(raw: string): PreparedQuote {
  const text = raw.replace(/\s+/gu, " ").trim().replace(OUTER_QUOTES, "").trim()
  if (text.length <= MAX_QUOTE_LENGTH) return { text, cut: false }
  const head = text.slice(0, MAX_QUOTE_LENGTH - 1)
  const space = head.lastIndexOf(" ")
  const whole = space >= MIN_CUT ? head.slice(0, space) : head
  return { text: `${whole.replace(TRAILING, "")}…`, cut: true }
}

/** A piece of the quote between spaces, and the word it looks up, if any. */
export type QuoteToken = { text: string; word: string | null }

export function quoteTokens(text: string): Array<QuoteToken> {
  return (text.match(/\S+/gu) ?? []).map((piece) => {
    const word = normalizeWord(piece)
    return { text: piece, word: isLookupWord(word) ? word : null }
  })
}

/** The first word of the quote saved in Kosakata (spec kartu kutipan, decision 2). */
export function defaultWord(
  tokens: ReadonlyArray<QuoteToken>,
  saved: SavedForms
): number | null {
  const index = tokens.findIndex(
    (token) => token.word !== null && saved.set.has(token.word)
  )
  return index === -1 ? null : index
}
