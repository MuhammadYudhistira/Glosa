import { normalizeWord } from "./normalize"
import { findSavedSpans, savedFormsOf } from "./saved-marks"
import type { SavedWord } from "./types"

export const ALL_BOOKS = "semua"

/** A book to filter by: its id while it exists, its copied title after it is deleted. */
export function bookKeyOf(word: SavedWord): string {
  if (word.bookId) return word.bookId
  return word.bookTitle ? `judul:${word.bookTitle}` : "tanpa-buku"
}

export type BookOption = { key: string; title: string }

export function bookOptions(
  words: ReadonlyArray<SavedWord>
): Array<BookOption> {
  const titles = new Map<string, string>()
  for (const word of words) {
    const key = bookKeyOf(word)
    if (!titles.has(key)) titles.set(key, word.bookTitle ?? "Tanpa buku")
  }
  return [...titles]
    .map(([key, title]) => ({ key, title }))
    .sort((a, b) => a.title.localeCompare(b.title, "id"))
}

/** Kosakata's search (a word or a meaning) and book filter, in the browser (spec 2 §6.4). */
export function filterWords(
  words: ReadonlyArray<SavedWord>,
  { q, book }: { q: string; book: string }
): Array<SavedWord> {
  const query = normalizeWord(q)
  return words.filter(
    (word) =>
      (book === ALL_BOOKS || bookKeyOf(word) === book) &&
      (query === "" ||
        word.headword.includes(query) ||
        word.meanings.some((meaning) => meaning.toLowerCase().includes(query)))
  )
}

export type SentencePart = { text: string; bold: boolean }

/** The sentence with every form of its word picked out, for the card to bold. */
export function sentenceParts(
  sentence: string,
  forms: ReadonlyArray<string>
): Array<SentencePart> {
  const parts: Array<SentencePart> = []
  let last = 0
  const spans = findSavedSpans(sentence, savedFormsOf({ word: [...forms] }))
  for (const { start, end } of spans) {
    if (start > last)
      parts.push({ text: sentence.slice(last, start), bold: false })
    parts.push({ text: sentence.slice(start, end), bold: true })
    last = end
  }
  if (last < sentence.length) {
    parts.push({ text: sentence.slice(last), bold: false })
  }
  return parts
}
