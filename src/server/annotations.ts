import { createServerFn } from "@tanstack/react-start"
import {
  AnnotationSyncSchema,
  BookAnnotationsSchema,
} from "@/lib/annotations/schemas"
import type {
  Annotation,
  AnnotationKind,
  AnnotationResult,
  AnnotationSyncAnswer,
  AnnotationsAnswer,
  HighlightColor,
} from "@/lib/annotations/types"
import type { Database } from "./database.types"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })
/** PostgREST answers at most this many rows at once. */
const PAGE = 1000

type AnnotationRow = Omit<
  Database["public"]["Tables"]["annotations"]["Row"],
  "user_id"
>

/** Postgres writes times its own way; the device compares and sends ISO times. */
const iso = (time: string) => new Date(time).toISOString()

const toAnnotation = (row: AnnotationRow): Annotation => ({
  id: row.id,
  bookId: row.book_id,
  kind: row.kind as AnnotationKind,
  cfi: row.cfi,
  color: row.color as HighlightColor | null,
  note: row.note,
  excerpt: row.excerpt,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  deletedAt: row.deleted_at === null ? null : iso(row.deleted_at),
})

const toEntry = (annotation: Annotation) => ({
  id: annotation.id,
  book_id: annotation.bookId,
  kind: annotation.kind,
  cfi: annotation.cfi,
  color: annotation.color,
  note: annotation.note,
  excerpt: annotation.excerpt,
  created_at: annotation.createdAt,
  updated_at: annotation.updatedAt,
  deleted_at: annotation.deletedAt,
})

/**
 * Applies the annotation changes waiting on a device (spec 2 §4.3), with one
 * answer per change. save_annotations keeps the newest of each.
 */
export const syncAnnotationsFn = createServerFn({ method: "POST" })
  .validator((data: { entries: Array<Annotation> }) =>
    AnnotationSyncSchema.parse(data)
  )
  .handler(async ({ data }): Promise<AnnotationSyncAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data: results, error } = await supabase.rpc("save_annotations", {
      p_entries: data.entries.map(toEntry),
    })
    if (error) {
      if (error.message === "not_authenticated") {
        return fail("not_authenticated")
      }
      logServerError("save_annotations failed", error)
      return fail("unknown")
    }
    return { ok: true, results: results as Array<AnnotationResult> }
  })

/** Every annotation of a book, tombstones too, read a page at a time (spec 2 §4.3). */
export const listAnnotationsFn = createServerFn({ method: "GET" })
  .validator((data: { bookId: string }) => BookAnnotationsSchema.parse(data))
  .handler(async ({ data }): Promise<AnnotationsAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const annotations: Array<Annotation> = []
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await supabase
        .from("annotations")
        .select(
          "id, book_id, kind, cfi, color, note, excerpt, created_at, updated_at, deleted_at"
        )
        .eq("book_id", data.bookId)
        .order("id")
        .range(from, from + PAGE - 1)
      if (error) {
        logServerError("listing annotations failed", error)
        return fail("unknown")
      }
      annotations.push(...rows.map(toAnnotation))
      if (rows.length < PAGE) return { ok: true, annotations }
    }
  })
