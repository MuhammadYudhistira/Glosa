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
/** data.adj marks where an adjective may stand: "galore(ip)", "outback(a)". */
const ADJECTIVE_MARKER = /\([a-z]+\)$/u

type Sense = { synset: string; number: number; tagged: number }
/** How one synset writes one word: in lower case, all in capitals, or neither ("He"). */
type Written = { lower: boolean; capitals: boolean }

/**
 * Builds dictionary entries from WordNet Bahasa (wn-msa-all.tab) and Princeton
 * WordNet 3.0's index.sense: each English word's Indonesian lemmas, the most
 * often tagged sense first. Phrases stay out: they come from Wiktionary only.
 * index.sense writes every word in lower case, so the synsets of data.* tell
 * "He" (helium), "US" and "More" (Thomas More) apart from he, us and more.
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
  const written = new Map<string, Written>()
  /** Words some synset writes in lower case. */
  const ordinary = new Set<string>()

  /**
   * A sense WordNet writes only with a capital is a symbol or a name. It
   * stays when it is the word's only use (April), and goes when the word is
   * all capitals (US) or ordinary English elsewhere (he, more).
   */
  function isCapitalOnly(
    word: string,
    synset: string,
    known: (word: string) => boolean
  ): boolean {
    const how = written.get(`${synset}\t${word}`)
    if (!how || how.lower) return false
    return how.capitals || ordinary.has(word) || known(word)
  }

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

    /** One line of data.noun, .verb, .adj or .adv: offset, file, type, word count (hex), words. */
    addSynset(line: string): void {
      if (line.startsWith(" ")) return
      const [offset, , type, count, ...rest] = line.split(" ")
      const letter = type === "s" ? "a" : type
      if (!offset || !letter) return
      const size = parseInt(count, 16)
      for (let i = 0; i < size; i++) {
        const raw = rest.at(i * 2)
        if (!raw) return
        const form = raw.replace(ADJECTIVE_MARKER, "").replaceAll("_", " ")
        const word = normalizeWord(form)
        const id = `${offset}-${letter}\t${word}`
        const how = written.get(id) ?? { lower: false, capitals: false }
        if (form === form.toLowerCase()) {
          how.lower = true
          ordinary.add(word)
        } else if (form === form.toUpperCase()) {
          how.capitals = true
        }
        written.set(id, how)
      }
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
     * sense's second, and so on, at most eight. `known` names the words
     * Wiktionary has, which keep none of their capital-only senses.
     */
    result(known: (word: string) => boolean = () => false): Array<DictEntry> {
      const entries: Array<DictEntry> = []
      for (const { headword, pos, senses } of words.values()) {
        const ranked = senses
          .filter((sense) => !isCapitalOnly(headword, sense.synset, known))
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
