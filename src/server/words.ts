import { createServerFn } from "@tanstack/react-start"
import { LookupRequestSchema, WordSyncSchema } from "@/lib/words/schemas"
import type {
  DictPos,
  LookupAnswer,
  LookupResult,
  SavedFormsAnswer,
  SavedWord,
  SavedWordsAnswer,
  WordOp,
  WordOpResult,
  WordSyncAnswer,
} from "@/lib/words/types"
import type { Database } from "./database.types"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })
/** PostgREST answers at most this many rows at once. */
const PAGE = 1000

type SavedWordRow = Pick<
  Database["public"]["Tables"]["saved_words"]["Row"],
  | "headword"
  | "pos"
  | "meanings"
  | "book_id"
  | "book_title"
  | "sentence"
  | "cfi"
  | "created_at"
>

const toSavedWord = (row: SavedWordRow): SavedWord => ({
  headword: row.headword,
  pos: row.pos as DictPos | null,
  meanings: row.meanings,
  bookId: row.book_id,
  bookTitle: row.book_title,
  sentence: row.sentence,
  cfi: row.cfi,
  createdAt: row.created_at,
})

/**
 * The meanings of a tapped word (spec 2 §4.1), through the server like every
 * other call: there is no Supabase client in the browser. Tahap 5 counts the
 * daily taps here.
 */
export const lookupWordFn = createServerFn({ method: "GET" })
  .validator((data: { word: string; next: Array<string> }) =>
    LookupRequestSchema.parse(data)
  )
  .handler(async ({ data }): Promise<LookupAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data: result, error } = await supabase.rpc("lookup_word", {
      p_word: data.word,
      p_next: data.next,
    })
    if (error) {
      logServerError("lookup_word failed", error)
      return fail("unknown")
    }
    return { ok: true, result: result as unknown as LookupResult }
  })

/**
 * Applies the changes waiting on a device, in order (spec 2 §4.2). Each one is
 * idempotent, so a batch cut short by an error is simply sent again.
 */
export const syncSavedWordsFn = createServerFn({ method: "POST" })
  .validator((data: { ops: Array<WordOp> }) => WordSyncSchema.parse(data))
  .handler(async ({ data }): Promise<WordSyncAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const results: Array<WordOpResult> = []
    for (const op of data.ops) {
      const { data: answer, error } =
        op.kind === "save"
          ? await supabase.rpc("save_word", {
              p_headword: op.headword,
              p_pos: op.pos ?? undefined,
              p_meanings: op.meanings,
              p_book_id: op.bookId ?? undefined,
              p_sentence: op.sentence,
              p_cfi: op.cfi ?? undefined,
            })
          : await supabase.rpc("delete_word", { p_headword: op.headword })
      if (error) {
        // Another member's book, or a value the database refuses (data
        // exceptions, class 22, and integrity violations, class 23): that one
        // change is dropped, so it cannot hold up the queue behind it.
        if (
          error.message === "invalid" ||
          error.code.startsWith("22") ||
          error.code.startsWith("23")
        ) {
          results.push("invalid")
          continue
        }
        if (error.message === "not_authenticated") {
          return fail("not_authenticated")
        }
        logServerError("saving a word failed", error)
        return fail("unknown")
      }
      results.push(answer === "limit_reached" ? "limit_reached" : "ok")
    }
    return { ok: true, results }
  })

/** Kosakata, newest first, read a page at a time (up to 5,000 words). */
export const listSavedWordsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SavedWordsAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const words: Array<SavedWord> = []
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await supabase
        .from("saved_words")
        .select(
          "headword, pos, meanings, book_id, book_title, sentence, cfi, created_at"
        )
        .order("created_at", { ascending: false })
        .order("headword")
        .range(from, from + PAGE - 1)
      if (error) {
        logServerError("listing saved words failed", error)
        return fail("unknown")
      }
      words.push(...rows.map(toSavedWord))
      if (rows.length < PAGE) return { ok: true, words }
    }
  }
)

/** Every form of the saved words, for the underline in books (spec 2 §6.5). */
export const savedWordFormsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SavedFormsAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data, error } = await supabase.rpc("saved_word_forms")
    if (error) {
      logServerError("saved_word_forms failed", error)
      return fail("unknown")
    }
    return { ok: true, forms: data as unknown as Record<string, Array<string>> }
  }
)
