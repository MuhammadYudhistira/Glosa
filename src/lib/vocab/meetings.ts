import { normalizeWord } from "@/lib/words/normalize"
import { findSavedSpans, savedFormsOf } from "@/lib/words/saved-marks"
import type { SavedWord } from "@/lib/words/types"

/** The spine index of a CFI, as foliate numbers sections (plan 3D, decision 4). */
export function sectionOfCfi(cfi: string | null): number | null {
  const step = cfi ? /^epubcfi\(\/6\/(\d+)/.exec(cfi) : null
  if (!step) return null
  const n = Number(step[1])
  return n >= 2 && n % 2 === 0 ? n / 2 - 1 : null
}

/** How often each saved word occurs in a text, by headword, through all its forms. */
export function countMeetings(
  text: string,
  forms: Record<string, Array<string>>
): Record<string, number> {
  const headwordsOf = new Map<string, Array<string>>()
  for (const [headword, list] of Object.entries(forms)) {
    for (const form of list) {
      const key = normalizeWord(form)
      headwordsOf.set(key, [...(headwordsOf.get(key) ?? []), headword])
    }
  }
  const counts: Record<string, number> = {}
  for (const { start, end } of findSavedSpans(text, savedFormsOf(forms))) {
    for (const headword of headwordsOf.get(normalizeWord(text.slice(start, end))) ?? []) {
      counts[headword] = (counts[headword] ?? 0) + 1
    }
  }
  return counts
}

/**
 * The meetings to send for one section: words met at least once, without
 * the section where a word was saved (spec 3D §3.4).
 */
export function meetingCounts(
  counts: Record<string, number>,
  bookId: string,
  section: number,
  saved: ReadonlyArray<Pick<SavedWord, "headword" | "bookId" | "cfi">>
): Array<{ headword: string; count: number }> {
  const savedHere = new Set(
    saved
      .filter((word) => word.bookId === bookId && sectionOfCfi(word.cfi) === section)
      .map((word) => word.headword)
  )
  return saved
    .filter((word) => (counts[word.headword] ?? 0) > 0 && !savedHere.has(word.headword))
    .map((word) => ({ headword: word.headword, count: counts[word.headword] }))
}
