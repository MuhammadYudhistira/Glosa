// Extensions spelled out: Node runs this file for scripts/fill-dictionary.ts.
import { headwordOfKey, keyOf } from "./dict-merge.ts"
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
  /** keyOf pairs that Wiktionary or WordNet fill. */
  filled: ReadonlySet<string>
  /** keyOf pairs already in dict_generated, those without meanings too. */
  generated: ReadonlySet<string>
}

/**
 * What the AI is asked: for each word, its headwords (the word itself and the
 * single words it is a form of) with the parts of speech Wiktionary gives
 * them that no source fills yet and that were never asked. A word Wiktionary
 * does not know, and no source fills, is asked as it is. Phrases never: they
 * come from Wiktionary only. In the order of the words, each headword once.
 */
export function pickCandidates(sources: CandidateSources): Array<FillRequest> {
  const basesOf = new Map<string, Array<string>>()
  for (const { form, headword } of sources.forms) {
    if (headword.includes(" ")) continue
    const list = basesOf.get(form) ?? []
    if (!list.includes(headword)) list.push(headword)
    basesOf.set(form, list)
  }
  const done = (headword: string, pos: DictPos) =>
    sources.filled.has(keyOf(headword, pos)) ||
    sources.generated.has(keyOf(headword, pos))
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
    const headwords = [word, ...(basesOf.get(word) ?? [])].filter(
      (headword, i, all) =>
        all.indexOf(headword) === i && sources.partsOfSpeech.has(headword)
    )
    if (headwords.length === 0) {
      if (!touched.has(word)) ask(word, [], word)
      continue
    }
    for (const headword of headwords) {
      const missing = [...(sources.partsOfSpeech.get(headword) ?? [])].filter(
        (pos) => pos !== "phrase" && !done(headword, pos)
      )
      if (missing.length > 0) ask(headword, missing, word)
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
