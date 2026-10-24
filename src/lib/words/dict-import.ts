// Extensions spelled out: Node runs this file for scripts/import-dictionary.ts
// and resolves nothing by itself.
import { MAX_WORD_LENGTH, normalizeWord } from "./normalize.ts"
import {
  type DictEntry,
  type DictForm,
  type DictPos,
  MAX_MEANINGS,
} from "./types.ts"

/** One wiktextract (kaikki.org) record, as far as the import reads it. */
type WiktTranslation = { code?: string; lang_code?: string; word?: string }
type WiktRecord = {
  word?: string
  lang_code?: string
  pos?: string
  forms?: Array<{ form?: string; tags?: Array<string> }>
  translations?: Array<WiktTranslation>
  senses?: Array<{
    form_of?: Array<{ word?: string }>
    translations?: Array<WiktTranslation>
  }>
}

/** Wiktionary's parts of speech that the popup shows, by the dictionary's names. */
const POS: Partial<Record<string, DictPos>> = {
  noun: "noun",
  verb: "verb",
  adj: "adj",
  adv: "adv",
  pron: "pron",
  prep: "prep",
  conj: "conj",
  intj: "interj",
  phrase: "phrase",
  prep_phrase: "phrase",
}
/** Inflection-table bookkeeping, not forms anyone reads. */
const SKIPPED_FORM_TAGS = new Set([
  "table-tags",
  "inflection-template",
  "class",
  "romanization",
])
const MAX_MEANING_LENGTH = 100

const keyOf = (headword: string, pos: DictPos) => `${headword}\t${pos}`

function cleanWord(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const word = normalizeWord(raw)
  return word.length > 0 && word.length <= MAX_WORD_LENGTH ? word : null
}

/** Translations into Indonesian, entry-level first, in Wiktionary's order. */
function indonesian(record: WiktRecord): Array<string> {
  const all = [
    ...(record.translations ?? []),
    ...(record.senses ?? []).flatMap((sense) => sense.translations ?? []),
  ]
  return all
    .filter(
      (translation) => (translation.lang_code ?? translation.code) === "id"
    )
    .map((translation) => translation.word?.trim() ?? "")
    .filter((word) => word.length > 0 && word.length <= MAX_MEANING_LENGTH)
}

/**
 * Builds the dictionary from wiktextract records (spec 2 §4.1): English
 * entries with their Indonesian translations, at most eight per part of
 * speech, and the forms that lead to them. Forms whose headword has no
 * meaning are dropped.
 */
export function createDictionaryBuilder() {
  const entries = new Map<string, DictEntry>()
  const forms = new Map<string, DictForm>()

  function addForm(form: string | null, headword: string | null, pos: DictPos) {
    if (!form || !headword || form === headword) return
    forms.set(`${form}\t${keyOf(headword, pos)}`, { form, headword, pos })
  }

  return {
    add(raw: unknown): void {
      if (typeof raw !== "object" || raw === null) return
      const record = raw as WiktRecord
      const pos = record.pos ? POS[record.pos] : undefined
      const headword = cleanWord(record.word)
      if (record.lang_code !== "en" || !pos || !headword) return

      const meanings = indonesian(record)
      if (meanings.length > 0) {
        const key = keyOf(headword, pos)
        const entry = entries.get(key) ?? { headword, pos, meanings: [] }
        for (const meaning of meanings) {
          if (
            entry.meanings.length < MAX_MEANINGS &&
            !entry.meanings.includes(meaning)
          ) {
            entry.meanings.push(meaning)
          }
        }
        entries.set(key, entry)
      }

      for (const { form, tags } of record.forms ?? []) {
        if (tags?.some((tag) => SKIPPED_FORM_TAGS.has(tag))) continue
        const clean = cleanWord(form)
        // "will run", "more beautiful": tenses built from a single word are not its forms.
        if (clean?.includes(" ") && !headword.includes(" ")) continue
        addForm(clean, headword, pos)
      }
      for (const sense of record.senses ?? []) {
        for (const base of sense.form_of ?? []) {
          addForm(headword, cleanWord(base.word), pos)
        }
      }
    },

    result(): {
      entries: Array<DictEntry>
      forms: Array<DictForm>
      phrases: number
    } {
      const list = [...entries.values()]
      return {
        entries: list,
        forms: [...forms.values()].filter((form) =>
          entries.has(keyOf(form.headword, form.pos))
        ),
        phrases: list.filter((entry) => entry.headword.includes(" ")).length,
      }
    },
  }
}
