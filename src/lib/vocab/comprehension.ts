/** No figure before this many distinct words read (spec 3D §3.5). */
export const MIN_WORDS_READ = 200

export type VocabSummary = { read: number; lookedUp: number }

/**
 * The share of the words read that needed no dictionary, rounded down so a
 * looked-up word never shows 100% (spec 3D §3.5); null below 200 words.
 */
export function comprehension({ read, lookedUp }: VocabSummary): number | null {
  if (read < MIN_WORDS_READ) return null
  return Math.floor((1 - lookedUp / read) * 100)
}
