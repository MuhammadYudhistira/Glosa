// Extensions spelled out: Node runs this file for the dictionary scripts.
import {
  type DictEntry,
  type DictForm,
  type DictPos,
  type DictSource,
  MAX_MEANINGS,
  type SourcedEntry,
} from "./types.ts"

/** A row of dict_generated. Empty meanings: the AI found no Indonesian equivalent. */
export type GeneratedRow = DictEntry

export const keyOf = (headword: string, pos: DictPos) => `${headword}\t${pos}`

/**
 * One dictionary from three sources (spec kamus tiga sumber, decision 1): for
 * each headword and part of speech, Wiktionary's meanings, else WordNet
 * Bahasa's, else the AI's. Forms stay when their headword ends up with an
 * entry from any source (decision 9).
 */
export function mergeDictionary(sources: {
  wiktionary: Array<DictEntry>
  wordnet: Array<DictEntry>
  generated: Array<GeneratedRow>
  forms: Array<DictForm>
}): {
  entries: Array<SourcedEntry>
  forms: Array<DictForm>
  counts: Record<DictSource, number>
} {
  const entries = new Map<string, SourcedEntry>()
  const counts: Record<DictSource, number> = {
    wiktionary: 0,
    wordnet: 0,
    ai: 0,
  }
  const fill = (list: Array<DictEntry>, source: DictSource) => {
    for (const { headword, pos, meanings } of list) {
      const key = keyOf(headword, pos)
      if (meanings.length === 0 || entries.has(key)) continue
      entries.set(key, {
        headword,
        pos,
        meanings: meanings.slice(0, MAX_MEANINGS),
        source,
      })
      counts[source] += 1
    }
  }
  fill(sources.wiktionary, "wiktionary")
  fill(sources.wordnet, "wordnet")
  fill(sources.generated, "ai")
  return {
    entries: [...entries.values()],
    forms: sources.forms.filter((form) =>
      entries.has(keyOf(form.headword, form.pos))
    ),
    counts,
  }
}
