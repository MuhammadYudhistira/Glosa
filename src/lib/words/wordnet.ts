// Extensions spelled out: Node runs this file for the dictionary scripts and
// resolves nothing by itself.
import { isLookupWord, normalizeWord } from "./normalize.ts"
import { type DictEntry, type DictPos, MAX_MEANINGS } from "./types.ts"

/** WordNet Bahasa's marks of quality the import may take (spec kamus tiga sumber, decision 7). */
export const WORDNET_QUALITIES = ["Y", "O", "L"] as const
export type WordnetQuality = (typeof WORDNET_QUALITIES)[number]
export const DEFAULT_WORDNET_QUALITIES: ReadonlyArray<WordnetQuality> = [
  "Y",
  "O",
]

/** Indonesian, or Indonesian and Malay alike. "M" (Malay only) stays out. */
const LANGUAGES = new Set(["I", "B"])
/** Princeton's synset types; adjectives (3) and their satellites (5) share one file. */
const SYNSET_TYPES: Partial<Record<string, { letter: string; pos: DictPos }>> =
  {
    "1": { letter: "n", pos: "noun" },
    "2": { letter: "v", pos: "verb" },
    "3": { letter: "a", pos: "adj" },
    "4": { letter: "r", pos: "adv" },
    "5": { letter: "a", pos: "adj" },
  }
const MAX_MEANING_LENGTH = 100

type Sense = { synset: string; number: number; tagged: number }

/**
 * Builds dictionary entries from WordNet Bahasa (wn-msa-all.tab) and Princeton
 * WordNet 3.0's index.sense: each English word's Indonesian lemmas, the most
 * often tagged sense first. Phrases stay out: they come from Wiktionary only.
 */
export function createWordnetReader(
  qualities: ReadonlyArray<WordnetQuality> = DEFAULT_WORDNET_QUALITIES
) {
  const accepted = new Set<string>(qualities)
  const lemmas = new Map<string, Array<string>>()
  const words = new Map<
    string,
    { headword: string; pos: DictPos; senses: Array<Sense> }
  >()

  return {
    /** One line of wn-msa-all.tab: synset, language, quality, lemma. */
    addBahasa(line: string): void {
      const [synset, language, quality, raw] = line.split("\t")
      if (!synset || !raw || !LANGUAGES.has(language)) return
      if (!accepted.has(quality)) return
      const lemma = raw.replaceAll("_", " ").replace(/\s+/gu, " ").trim()
      if (lemma.length === 0 || lemma.length > MAX_MEANING_LENGTH) return
      const list = lemmas.get(synset) ?? []
      if (!list.includes(lemma)) list.push(lemma)
      lemmas.set(synset, list)
    },

    /** One line of index.sense: sense key, synset offset, sense number, tag count. */
    addSense(line: string): void {
      const [key, offset, number, tagged] = line.trim().split(" ")
      const percent = key ? key.indexOf("%") : -1
      if (!key || !offset || percent < 1) return
      const type = SYNSET_TYPES[key.charAt(percent + 1)]
      if (!type) return
      const headword = normalizeWord(key.slice(0, percent).replaceAll("_", " "))
      if (!isLookupWord(headword)) return
      const id = `${headword}\t${type.pos}`
      const word = words.get(id) ?? { headword, pos: type.pos, senses: [] }
      word.senses.push({
        synset: `${offset}-${type.letter}`,
        number: Number(number),
        tagged: Number(tagged),
      })
      words.set(id, word)
    },

    /**
     * One entry per English word and part of speech that has Indonesian:
     * each sense's first equivalent, the most tagged sense first, then each
     * sense's second, and so on, at most eight.
     */
    result(): Array<DictEntry> {
      const entries: Array<DictEntry> = []
      for (const { headword, pos, senses } of words.values()) {
        const ranked = [...senses]
          .sort((a, b) => b.tagged - a.tagged || a.number - b.number)
          .map((sense) => lemmas.get(sense.synset) ?? [])
        const longest = Math.max(0, ...ranked.map((list) => list.length))
        const meanings: Array<string> = []
        for (let i = 0; i < longest && meanings.length < MAX_MEANINGS; i++) {
          for (const list of ranked) {
            const meaning = list.at(i)
            if (
              meaning !== undefined &&
              meanings.length < MAX_MEANINGS &&
              !meanings.includes(meaning)
            ) {
              meanings.push(meaning)
            }
          }
        }
        if (meanings.length > 0) entries.push({ headword, pos, meanings })
      }
      return entries
    },
  }
}
