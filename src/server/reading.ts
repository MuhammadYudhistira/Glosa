import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { ActionResult } from "@/lib/action-result"
import { MAX_PROGRESS_BATCH, ProgressEntrySchema } from "@/lib/progress"
import {
  type ReaderSettings,
  ReaderSettingsSchema,
  parseReaderSettings,
} from "@/lib/reader-settings"
import type {
  BookFileTicket,
  ProgressEntry,
  ReadingState,
} from "@/lib/reader-types"
import { bookStorage } from "./book-storage"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })

const BookIdSchema = z.object({ bookId: z.uuid() })
const SaveProgressSchema = z.object({
  entries: z.array(ProgressEntrySchema).min(1).max(MAX_PROGRESS_BATCH),
})

/** Everything the reader needs from the server except the file (spec §9, §10). */
export const readingStateFn = createServerFn({ method: "GET" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<ReadingState> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const [bookResult, progressResult, profileResult] = await Promise.all([
      supabase
        .from("books")
        .select("id, title, author")
        .eq("id", data.bookId)
        .eq("status", "ready")
        .maybeSingle(),
      supabase
        .from("reading_progress")
        .select("cfi, percentage, updated_at")
        .eq("book_id", data.bookId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("reader_settings")
        .eq("id", user.id)
        .single(),
    ])
    const error =
      bookResult.error ?? progressResult.error ?? profileResult.error
    if (error) {
      logServerError("reading state lookup failed", error)
      return fail("unknown")
    }
    if (!bookResult.data) return fail("not_found")

    const progress = progressResult.data
    return {
      ok: true,
      book: bookResult.data,
      progress: progress
        ? {
            cfi: progress.cfi,
            percentage: progress.percentage,
            updatedAt: progress.updated_at,
          }
        : null,
      settings: parseReaderSettings(profileResult.data?.reader_settings),
    }
  })

/** A one-hour download URL for the EPUB, signed as the member so Storage RLS applies. */
export const bookFileUrlFn = createServerFn({ method: "GET" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<BookFileTicket> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data: book, error } = await supabase
      .from("books")
      .select("file_path")
      .eq("id", data.bookId)
      .eq("status", "ready")
      .maybeSingle()
    if (error) {
      logServerError("book lookup failed", error)
      return fail("unknown")
    }
    if (!book) return fail("not_found")

    try {
      const urls = await bookStorage(supabase).getReadUrls([book.file_path])
      const url = urls.get(book.file_path)
      return url ? { ok: true, url } : fail("not_found")
    } catch (signError) {
      logServerError("signing the book URL failed", signError)
      return fail("unknown")
    }
  })

/** "Terakhir dibuka" on the shelf (spec §9): set when a book opens online. */
export const markBookOpenedFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data: rows, error } = await supabase
      .from("books")
      .update({ last_opened_at: new Date().toISOString() })
      .eq("id", data.bookId)
      .select("id")
    if (error) {
      logServerError("marking the book opened failed", error)
      return fail("unknown")
    }
    return rows.length > 0 ? { ok: true } : fail("not_found")
  })

/**
 * Stores positions waiting on a device (spec §10). save_progress keeps the
 * newest one. A position for a book deleted in the meantime has nothing left to
 * update and is skipped, so it does not stay in the queue forever.
 */
export const saveProgressFn = createServerFn({ method: "POST" })
  .validator((data: { entries: Array<ProgressEntry> }) =>
    SaveProgressSchema.parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    for (const entry of data.entries) {
      const { error } = await supabase.rpc("save_progress", {
        p_book_id: entry.bookId,
        p_cfi: entry.cfi,
        p_percentage: entry.percentage,
        p_updated_at: entry.updatedAt,
      })
      if (error && error.message !== "not_found") {
        logServerError("save_progress failed", error)
        return fail(
          error.message === "not_authenticated"
            ? "not_authenticated"
            : "unknown"
        )
      }
    }
    return { ok: true }
  })

export const saveReaderSettingsFn = createServerFn({ method: "POST" })
  .validator((data: ReaderSettings) => ReaderSettingsSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { error } = await supabase
      .from("profiles")
      .update({ reader_settings: data })
      .eq("id", user.id)
    if (error) {
      logServerError("saving reader settings failed", error)
      return fail("unknown")
    }
    return { ok: true }
  })
