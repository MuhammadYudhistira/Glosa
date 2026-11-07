import { normalizeWord } from "@/lib/words/normalize"
import { findSavedSpans, savedFormsOf } from "@/lib/words/saved-marks"

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
    for (const headword of headwordsOf.get(
      normalizeWord(text.slice(start, end))
    ) ?? []) {
      counts[headword] = (counts[headword] ?? 0) + 1
    }
  }
  return counts
}
