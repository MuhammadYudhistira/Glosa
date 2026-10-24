import { z } from "zod"
import { MAX_CFI_LENGTH } from "@/lib/progress"
import { MAX_WORD_LENGTH } from "./normalize"
import {
  DICT_POS,
  MAX_MEANINGS,
  MAX_SENTENCE_LENGTH,
  MAX_WORD_OPS,
  type WordOp,
} from "./types"

const Word = z.string().min(1).max(MAX_WORD_LENGTH)

export const LookupRequestSchema = z.object({
  word: Word,
  next: z.array(Word).max(2),
})

export const WordOpSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("save"),
    headword: Word,
    pos: z.enum(DICT_POS).nullable(),
    meanings: z.array(z.string().min(1).max(200)).max(MAX_MEANINGS),
    bookId: z.uuid().nullable(),
    sentence: z.string().max(MAX_SENTENCE_LENGTH),
    cfi: z.string().min(1).max(MAX_CFI_LENGTH).nullable(),
  }),
  z.object({ kind: z.literal("delete"), headword: Word }),
])

export const WordSyncSchema = z.object({
  ops: z.array(WordOpSchema).min(1).max(MAX_WORD_OPS),
})

/**
 * Whether the server will take this change. One it would refuse never enters
 * the queue: a bad change in a batch would hold up every change behind it.
 */
export function isValidWordOp(op: WordOp): boolean {
  return WordOpSchema.safeParse(op).success
}
