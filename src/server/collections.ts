import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { ActionResult } from "@/lib/action-result"
import { MAX_COLLECTIONS, MAX_COLLECTION_NAME } from "@/lib/book-types"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The database's answers (spec Tahap 3 §5), as codes bookMessage knows. */
const CODES: Record<string, string> = {
  limit_reached: "collections_full",
  duplicate: "collection_duplicate",
  invalid: "collection_invalid",
  not_found: "not_found",
}

const NameSchema = z.string().trim().min(1).max(MAX_COLLECTION_NAME)
const BookIdSchema = z.object({ bookId: z.uuid() })

/** The member's client, or null when the session is gone. */
async function memberClient() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? supabase : null
}

function answerOf(
  answer: string | null,
  error: unknown,
  what: string
): ActionResult {
  if (error) {
    logServerError(`${what} failed`, error)
    return fail("unknown")
  }
  if (answer === "ok") return { ok: true }
  return fail(CODES[answer ?? ""] ?? "unknown")
}

/** For rename and delete, "not found" is the collection, not a book. */
function aboutCollection(result: ActionResult): ActionResult {
  return !result.ok && result.code === "not_found"
    ? fail("collection_missing")
    : result
}

export const createCollectionFn = createServerFn({ method: "POST" })
  .validator((data: { name: string }) =>
    z.object({ name: NameSchema }).parse(data)
  )
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; id: string } | { ok: false; code: string }> => {
      const supabase = await memberClient()
      if (!supabase) return fail("not_authenticated")
      const { data: answer, error } = await supabase.rpc("create_collection", {
        p_name: data.name,
      })
      if (!error && UUID.test(answer)) return { ok: true, id: answer }
      const result = answerOf(answer, error, "creating a collection")
      return result.ok ? fail("unknown") : result
    }
  )

export const renameCollectionFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; name: string }) =>
    z.object({ id: z.uuid(), name: NameSchema }).parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("rename_collection", {
      p_id: data.id,
      p_name: data.name,
    })
    return aboutCollection(answerOf(answer, error, "renaming a collection"))
  })

export const deleteCollectionFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => z.object({ id: z.uuid() }).parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("delete_collection", {
      p_id: data.id,
    })
    return aboutCollection(answerOf(answer, error, "deleting a collection"))
  })

export const setBookCollectionsFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string; collectionIds: Array<string> }) =>
    z
      .object({
        bookId: z.uuid(),
        collectionIds: z.array(z.uuid()).max(MAX_COLLECTIONS),
      })
      .parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("set_book_collections", {
      p_book_id: data.bookId,
      p_collection_ids: data.collectionIds,
    })
    const result = answerOf(answer, error, "saving a book's collections")
    // "Invalid" here is a collection id that is not the member's (any more),
    // not a bad name; "not found" stays the book.
    return !result.ok && result.code === "collection_invalid"
      ? fail("collections_changed")
      : result
  })

export const setBookFinishedFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string; finished: boolean }) =>
    z.object({ bookId: z.uuid(), finished: z.boolean() }).parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("set_book_finished", {
      p_book_id: data.bookId,
      p_finished: data.finished,
    })
    return answerOf(answer, error, "marking a book finished")
  })

export const declineFinishFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("decline_finish", {
      p_book_id: data.bookId,
    })
    return answerOf(answer, error, "declining to finish a book")
  })
