// Extensions spelled out: Node runs this file for scripts/fill-dictionary.ts.
import { z } from "zod"
import type { GeneratedRow } from "./dict-merge.ts"
import type { FillRequest } from "./fill-candidates.ts"
import { normalizeWord } from "./normalize.ts"
import { DICT_POS, MAX_MEANINGS } from "./types.ts"

/** Spec kamus tiga sumber, decision 5. */
export const FILL_MODEL = "claude-opus-5-5"
export const WORDS_PER_REQUEST = 50
/** Thinking counts too; a batch request has no timeout to fear. */
export const FILL_MAX_TOKENS = 32_000
const MAX_MEANING_LENGTH = 100
/** Phrases come from Wiktionary only. */
const ASKED_POS = DICT_POS.filter((pos) => pos !== "phrase")

export const FILL_SYSTEM = `You write entries for an English-Indonesian dictionary inside an e-book reader for Indonesian readers learning English. A reader taps an English word and sees its Indonesian equivalents.

For each requested word and each requested part of speech, give the Indonesian equivalents that a reader would understand the word by, the most common sense first:
- Each equivalent is an Indonesian word or a short phrase in standard spelling (KBBI): lower case unless always capitalised, with no explanation, example, brackets or English.
- At most 8 per part of speech, without repeats. A word with few senses gets few equivalents.
- Function words (pronouns, prepositions, conjunctions, determiners, articles, particles) get the Indonesian words that usually translate them, e.g. "it" (pron): "itu", "ia", "dia".
- If no Indonesian equivalent fits a part of speech, give an empty list for it.
- If a word's pos list is empty, choose the one part of speech it is most often used as, from: ${ASKED_POS.join(", ")}. Answer with that one only.

Answer every requested word, in the order given, with exactly the parts of speech requested.`

/** The user message: one JSON object per line. */
export function fillPrompt(requests: ReadonlyArray<FillRequest>): string {
  const lines = requests.map((request) =>
    JSON.stringify({ word: request.headword, pos: request.pos })
  )
  return ["Words:", ...lines].join("\n")
}

/** output_config.format's schema: what the API holds the answer to. */
export const FILL_SCHEMA = {
  type: "object",
  properties: {
    words: {
      type: "array",
      items: {
        type: "object",
        properties: {
          word: { type: "string" },
          entries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                pos: { type: "string", enum: ASKED_POS },
                meanings: { type: "array", items: { type: "string" } },
              },
              required: ["pos", "meanings"],
              additionalProperties: false,
            },
          },
        },
        required: ["word", "entries"],
        additionalProperties: false,
      },
    },
  },
  required: ["words"],
  additionalProperties: false,
}

const AnswerSchema = z.object({
  words: z.array(
    z.object({
      word: z.string(),
      entries: z.array(
        z.object({ pos: z.enum(DICT_POS), meanings: z.array(z.string()) })
      ),
    })
  ),
})

/** Trimmed and without repeats, the first eight; null if one is empty, too long or holds control characters. */
function cleanMeanings(raw: Array<string>): Array<string> | null {
  const meanings: Array<string> = []
  for (const meaning of raw) {
    const clean = meaning.replace(/\s+/gu, " ").trim()
    if (clean.length === 0 || clean.length > MAX_MEANING_LENGTH) return null
    if (/\p{Cc}/u.test(meaning.replace(/\s/gu, ""))) return null
    if (!meanings.includes(clean)) meanings.push(clean)
  }
  return meanings.slice(0, MAX_MEANINGS)
}

/**
 * The dict_generated rows an answer gives (spec kamus tiga sumber §4.3, step
 * 4): a row for each part of speech asked, or for the one the AI picked. A
 * word without an answer, with other parts of speech, or with a bad meaning
 * gives no rows and is named in problems; the next run asks it again.
 */
export function readAnswer(
  requests: ReadonlyArray<FillRequest>,
  text: string
): {
  rows: Array<GeneratedRow>
  answered: Array<string>
  problems: Array<string>
} {
  let parsed: z.infer<typeof AnswerSchema> | null = null
  try {
    const result = AnswerSchema.safeParse(JSON.parse(text))
    if (result.success) parsed = result.data
  } catch {
    parsed = null
  }
  if (!parsed) {
    const words = requests.map((request) => request.headword).join(", ")
    return {
      rows: [],
      answered: [],
      problems: [`unreadable answer for ${words}`],
    }
  }

  const byWord = new Map(
    parsed.words.map(
      (word): [string, (typeof parsed.words)[number]["entries"]] => [
        normalizeWord(word.word),
        word.entries,
      ]
    )
  )
  const rows: Array<GeneratedRow> = []
  const answered: Array<string> = []
  const problems: Array<string> = []
  for (const request of requests) {
    const entries = byWord.get(request.headword)
    if (!entries) {
      problems.push(`${request.headword}: no answer`)
      continue
    }
    const given = entries.map((entry) => entry.pos)
    const fits =
      request.pos.length > 0
        ? given.length === request.pos.length &&
          request.pos.every((pos) => given.includes(pos))
        : given.length === 1 && given[0] !== "phrase"
    if (!fits) {
      const asked = request.pos.length > 0 ? request.pos.join("/") : "one"
      problems.push(
        `${request.headword}: answered ${given.join("/") || "nothing"}, asked ${asked}`
      )
      continue
    }
    const cleaned = entries.map((entry) => ({
      pos: entry.pos,
      meanings: cleanMeanings(entry.meanings),
    }))
    if (cleaned.some((entry) => entry.meanings === null)) {
      problems.push(
        `${request.headword}: a meaning is empty, too long or holds control characters`
      )
      continue
    }
    for (const entry of cleaned) {
      rows.push({
        headword: request.headword,
        pos: entry.pos,
        meanings: entry.meanings ?? [],
      })
    }
    answered.push(request.headword)
  }
  return { rows, answered, problems }
}

/** Opus 5.5 through the Batch API: half of $4 and $20 per million tokens. */
export function batchCost(usage: { input: number; output: number }): number {
  return (usage.input * 2 + usage.output * 10) / 1_000_000
}
