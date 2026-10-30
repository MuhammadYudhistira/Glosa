// Extensions spelled out: Node runs this file for scripts/fill-dictionary.ts.
import { headwordOfKey } from "./dict-merge.ts"
import { isLookupWord, normalizeWord } from "./normalize.ts"
import type { DictForm, DictPos } from "./types.ts"

/** One headword for the AI (spec kamus tiga sumber §4.3). */
export type FillRequest = {
  headword: string
  /** The parts of speech to fill; none: the AI gives the word's likeliest one. */
  pos: Array<DictPos>
  /** The listed or tapped words that led here ("made" leads to make). */
  from: Array<string>
}

export type CandidateSources = {
  /** The frequency list in order, then the tapped words without meanings. */
  words: Iterable<string>
  /** Wiktionary's parts of speech per headword, with meanings or without (decision 6). */
  partsOfSpeech: ReadonlyMap<string, ReadonlySet<DictPos>>
  /** Wiktionary's forms, of every headword. */
  forms: ReadonlyArray<DictForm>
  /** keyOf pairs that Wiktionary or WordNet fill. A word with any of its headwords here is not asked. */
  filled: ReadonlySet<string>
  /** keyOf pairs already in dict_generated, those without meanings too. A word with any of its headwords here is not asked again. */
  generated: ReadonlySet<string>
}

/**
 * What the AI is asked: only the words that show no meaning today. A word is
 * skipped entirely when it, or any single word it is a form of, already has an
 * entry from any source or was already asked (owner decision 2026-10-30), so
 * "the" or "made" never get rare parts of speech asked. For a word left, each
 * headword (the word itself and the single words it is a form of) is asked
 * with the parts of speech Wiktionary gives it; a word Wiktionary does not
 * know is asked as it is. Phrases never: they come from Wiktionary only. In
 * the order of the words, each headword once.
 */
export function pickCandidates(sources: CandidateSources): Array<FillRequest> {
  const basesOf = new Map<string, Array<string>>()
  for (const { form, headword } of sources.forms) {
    if (headword.includes(" ")) continue
    const list = basesOf.get(form) ?? []
    if (!list.includes(headword)) list.push(headword)
    basesOf.set(form, list)
  }
  const touched = new Set(
    [...sources.filled, ...sources.generated].map(headwordOfKey)
  )
  const requests = new Map<string, FillRequest>()
  const ask = (headword: string, pos: Array<DictPos>, word: string) => {
    const request = requests.get(headword) ?? { headword, pos: [], from: [] }
    for (const each of pos)
      if (!request.pos.includes(each)) request.pos.push(each)
    if (!request.from.includes(word)) request.from.push(word)
    requests.set(headword, request)
  }

  for (const raw of sources.words) {
    const word = normalizeWord(raw)
    if (!isLookupWord(word)) continue
    const all = [word, ...(basesOf.get(word) ?? [])]
    if (all.some((headword) => touched.has(headword))) continue
    const headwords = all.filter(
      (headword, i) =>
        all.indexOf(headword) === i && sources.partsOfSpeech.has(headword)
    )
    if (headwords.length === 0) {
      ask(word, [], word)
      continue
    }
    for (const headword of headwords) {
      const pos = [...(sources.partsOfSpeech.get(headword) ?? [])].filter(
        (each) => each !== "phrase"
      )
      if (pos.length > 0) ask(headword, pos, word)
    }
  }
  return [...requests.values()]
}

export function chunk<T>(
  items: ReadonlyArray<T>,
  size: number
): Array<Array<T>> {
  const pieces: Array<Array<T>> = []
  for (let i = 0; i < items.length; i += size)
    pieces.push(items.slice(i, i + size))
  return pieces
}
