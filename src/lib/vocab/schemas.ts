import { z } from "zod"
import { MAX_MEET_BATCH, MAX_TAP_BATCH, MAX_WORDS_READ_BATCH } from "./types"
import { MAX_WORDS_PER_PART } from "./words"

const Word = z.string().min(1).max(64)

export const WordsReadBatchSchema = z
  .array(
    z.object({
      bookId: z.uuid(),
      section: z.number().int().min(0),
      words: z.array(Word).max(MAX_WORDS_PER_PART),
      last: z.boolean(),
    })
  )
  .min(1)
  .max(MAX_WORDS_READ_BATCH)

export const TapBatchSchema = z
  .array(
    z.object({
      bookId: z.uuid(),
      word: Word,
      taps: z.number().int().min(1).max(1000),
      at: z.iso.datetime({ offset: true }),
    })
  )
  .min(1)
  .max(MAX_TAP_BATCH)

export const MeetBatchSchema = z
  .array(
    z.object({
      bookId: z.uuid(),
      headword: Word,
      section: z.number().int().min(0),
      count: z.number().int().min(1).max(10_000),
    })
  )
  .min(1)
  .max(MAX_MEET_BATCH)

export const VocabCacheSchema = z.object({
  books: z.record(
    z.string(),
    z.object({ read: z.number().int(), lookedUp: z.number().int() })
  ),
  meetings: z.record(
    z.string(),
    z.object({ meetings: z.number().int(), books: z.number().int() })
  ),
})
