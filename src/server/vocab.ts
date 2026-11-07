import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { QueueAnswer, QueueResult } from "@/lib/sync/queue-sync"
import { MeetBatchSchema, TapBatchSchema, WordsReadBatchSchema } from "@/lib/vocab/schemas"
import type {
  BookVocabAnswer,
  MeetItem,
  TapItem,
  VocabAnswer,
  WordMeetings,
  WordsReadItem,
} from "@/lib/vocab/types"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })

async function sendQueue(
  name: "record_words_read" | "record_lookups" | "record_meetings",
  entries: Array<Record<string, unknown>>
): Promise<QueueAnswer> {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("not_authenticated")
  const { data, error } = await supabase.rpc(name, { p_entries: entries as never })
  if (error) {
    if (error.message === "not_authenticated") return fail("not_authenticated")
    logServerError(`${name} failed`, error)
    return fail("unknown")
  }
  return { ok: true, results: data as Array<QueueResult> }
}

/** Parts of the words of sections read (spec 3D §3.2). */
export const recordWordsReadFn = createServerFn({ method: "POST" })
  .validator((items: Array<Omit<WordsReadItem, "key" | "part">>) =>
    WordsReadBatchSchema.parse(items)
  )
  .handler(({ data }) =>
    sendQueue(
      "record_words_read",
      data.map((item) => ({
        book_id: item.bookId,
        section: item.section,
        words: item.words,
        last: item.last,
      }))
    )
  )

/** Taps on words, per book (spec 3D §3.3). */
export const recordLookupsFn = createServerFn({ method: "POST" })
  .validator((items: Array<Omit<TapItem, "key">>) => TapBatchSchema.parse(items))
  .handler(({ data }) =>
    sendQueue(
      "record_lookups",
      data.map((item) => ({ book_id: item.bookId, word: item.word, taps: item.taps, at: item.at }))
    )
  )

/** Saved words met in a section (spec 3D §3.4). */
export const recordMeetingsFn = createServerFn({ method: "POST" })
  .validator((items: Array<Omit<MeetItem, "key">>) => MeetBatchSchema.parse(items))
  .handler(({ data }) =>
    sendQueue(
      "record_meetings",
      data.map((item) => ({
        headword: item.headword,
        book_id: item.bookId,
        section: item.section,
        count: item.count,
      }))
    )
  )

/** Every book's numbers and every saved word's meetings (spec 3D §4). */
export const loadVocabFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<VocabAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")
    const [summaries, meetings] = await Promise.all([
      supabase.rpc("book_vocab_summaries"),
      supabase.rpc("word_meeting_counts"),
    ])
    if (summaries.error || meetings.error) {
      logServerError("loading vocabulary numbers failed", summaries.error ?? meetings.error)
      return fail("unknown")
    }
    const books: Record<string, { read: number; lookedUp: number }> = {}
    for (const row of summaries.data) {
      books[row.book_id] = { read: row.read, lookedUp: row.looked_up }
    }
    const byWord: WordMeetings = {}
    for (const row of meetings.data) {
      byWord[row.headword] = { meetings: row.meetings, books: row.books }
    }
    return { ok: true, cache: { books, meetings: byWord } }
  }
)

const BookVocabSchema = z.object({
  read: z.number().int(),
  looked_up: z.number().int(),
  words: z.array(z.object({ word: z.string(), taps: z.number().int(), last_at: z.string() })),
})

/** One book's numbers and the words looked up in it (spec 3D §4.2). */
export const loadBookVocabFn = createServerFn({ method: "GET" })
  .validator((data: { bookId: string }) => z.object({ bookId: z.uuid() }).parse(data))
  .handler(async ({ data }): Promise<BookVocabAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("book_vocab", { p_book_id: data.bookId })
    if (error) {
      logServerError("book_vocab failed", error)
      return fail("unknown")
    }
    if (answer === null) return fail("not_found")
    const parsed = BookVocabSchema.safeParse(answer)
    if (!parsed.success) {
      logServerError("book_vocab answered something else", parsed.error)
      return fail("unknown")
    }
    return {
      ok: true,
      vocab: {
        read: parsed.data.read,
        lookedUp: parsed.data.looked_up,
        words: parsed.data.words.map((word) => ({
          word: word.word,
          taps: word.taps,
          lastAt: word.last_at,
        })),
      },
    }
  })
