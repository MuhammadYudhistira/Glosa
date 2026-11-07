import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { ActionResult } from "@/lib/action-result"
import {
  DIFFICULTIES,
  type FinishSummary,
  MAX_NOTE,
  parseFinishSummary,
} from "@/lib/review"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })

/** The database's answers (spec 3E §6.2), as codes bookMessage knows. */
const CODES: Record<string, string> = {
  not_found: "not_found",
  not_finished: "review_not_finished",
  invalid: "review_invalid",
}

async function memberClient() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? supabase : null
}

const SaveSchema = z.object({
  bookId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  difficulty: z.enum(DIFFICULTIES).nullable(),
  note: z.string().max(MAX_NOTE).nullable(),
})
const BookIdSchema = z.object({ bookId: z.uuid() })

function answerOf(
  answer: string | null,
  error: unknown,
  what: string
): ActionResult {
  if (error) {
    logServerError(`${what} failed`, error)
    return fail("unknown")
  }
  return answer === "ok" ? { ok: true } : fail(CODES[answer ?? ""] ?? "unknown")
}

export const saveReviewFn = createServerFn({ method: "POST" })
  .validator((data: z.input<typeof SaveSchema>) => SaveSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("save_review", {
      p_book_id: data.bookId,
      p_rating: data.rating,
      // The generated types leave out null; the function accepts it.
      p_difficulty: data.difficulty as string,
      p_note: data.note as string,
    })
    return answerOf(answer, error, "saving a review")
  })

export const deleteReviewFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("delete_review", {
      p_book_id: data.bookId,
    })
    return answerOf(answer, error, "deleting a review")
  })

export const finishSummaryFn = createServerFn({ method: "GET" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; summary: FinishSummary } | { ok: false; code: string }
    > => {
      const supabase = await memberClient()
      if (!supabase) return fail("not_authenticated")
      const { data: answer, error } = await supabase.rpc(
        "book_finish_summary",
        { p_book_id: data.bookId }
      )
      if (error) {
        logServerError("book_finish_summary failed", error)
        return fail("unknown")
      }
      if (answer === null) return fail("not_found")
      const summary = parseFinishSummary(answer)
      return summary ? { ok: true, summary } : fail("unknown")
    }
  )
