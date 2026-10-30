// Extensions spelled out: Node runs this file for scripts/import-dictionary.ts.
import { isLookupWord, normalizeWord } from "./normalize.ts"

export type Coverage = {
  tokens: number
  coveredTokens: number
  words: number
  coveredWords: number
}

/**
 * How much of a text the dictionary covers (spec kamus tiga sumber §7): of
 * its words as they occur, and of its distinct words, each spelled the way
 * the reader looks it up.
 */
export function measureCoverage(
  text: string,
  hasMeaning: (word: string) => boolean
): Coverage {
  const counts = new Map<string, number>()
  for (const raw of text.split(/[^\p{L}'’-]+/u)) {
    const word = normalizeWord(raw)
    if (isLookupWord(word)) counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  const coverage: Coverage = {
    tokens: 0,
    coveredTokens: 0,
    words: counts.size,
    coveredWords: 0,
  }
  for (const [word, count] of counts) {
    coverage.tokens += count
    if (hasMeaning(word)) {
      coverage.coveredTokens += count
      coverage.coveredWords += 1
    }
  }
  return coverage
}
