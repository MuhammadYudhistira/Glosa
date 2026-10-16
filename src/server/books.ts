import type { SupabaseClient } from "@supabase/supabase-js"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { ActionResult } from "@/lib/action-result"
import type { ShelfData, UploadRequest, UploadTicket } from "@/lib/book-types"
import { GENRE_VALUES, type Genre, isGenre } from "@/lib/genre"
import { isAbandoned, usedBytes } from "@/lib/quota"
import { toPlan } from "@/lib/session-types"
import {
  MAX_COVER_BYTES,
  MAX_EPUB_BYTES,
  METADATA_LIMITS,
  cleanDescription,
} from "@/lib/upload-rules"
import { bookStorage, objectPaths } from "./book-storage"
import type { Database } from "./database.types"
import { getSupabaseAdminClient, getSupabaseServerClient } from "./supabase"

const RESERVE_ERRORS = new Set([
  "too_large",
  "invalid_cover",
  "duplicate",
  "quota_exceeded",
  "not_authenticated",
])

const fail = (code: string) => ({ ok: false as const, code })

type AdminClient = SupabaseClient<Database>

const UploadRequestSchema = z
  .object({
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    epubBytes: z.number().int().positive(),
    cover: z
      .object({
        bytes: z.number().int().positive().max(MAX_COVER_BYTES),
        type: z.enum(["image/webp", "image/jpeg"]),
      })
      .nullable(),
    title: z.string().trim().min(1).max(METADATA_LIMITS.title),
    author: z.string().trim().max(METADATA_LIMITS.author),
    description: z
      .string()
      .trim()
      .max(METADATA_LIMITS.description)
      .nullable()
      .transform((value) => cleanDescription(value)),
    language: z.string().trim().max(METADATA_LIMITS.language).nullable(),
    subjects: z
      .array(z.string().trim().min(1).max(METADATA_LIMITS.subject))
      .max(METADATA_LIMITS.subjects),
    genre: z.enum(GENRE_VALUES).nullable(),
    genreSource: z.enum(["auto", "user"]).nullable(),
  })
  .refine((value) => (value.genre === null) === (value.genreSource === null))

const BookIdSchema = z.object({ bookId: z.uuid() })

/**
 * Replaces the spec's pg_cron job (Storage objects cannot be removed from SQL):
 * before a new reservation, drop this member's abandoned uploads and any earlier
 * attempt at the same file, together with their objects.
 */
async function removeAbandonedUploads(
  admin: AdminClient,
  userId: string,
  sha256: string
) {
  const { data, error } = await admin
    .from("books")
    .select("id, sha256, created_at, file_path, cover_path")
    .eq("user_id", userId)
    .eq("status", "pending")
  if (error) throw error
  const stale = data.filter(
    (row) =>
      row.sha256 === sha256 ||
      isAbandoned({ status: "pending", createdAt: row.created_at })
  )
  if (stale.length === 0) return
  // Delete only rows that are still pending: one that another tab confirmed in
  // the meantime is left alone. Leftover objects fall to the orphan sweep.
  const { data: deleted, error: deleteError } = await admin
    .from("books")
    .delete()
    .in(
      "id",
      stale.map((row) => row.id)
    )
    .eq("status", "pending")
    .select("file_path, cover_path")
  if (deleteError) throw deleteError
  await bookStorage(admin).remove(deleted.flatMap(objectPaths))
}

/**
 * Removes objects in the member's folder that no book row refers to: files
 * uploaded through a still-valid signed URL after their row was cleaned up.
 * Runs on every upload request and deletion, which bounds what a member can
 * keep beyond their quota; plan 1D adds a periodic sweep for everyone.
 */
async function removeOrphanedObjects(admin: AdminClient, userId: string) {
  const storage = bookStorage(admin)
  // List first, then read the rows: every object present at listing time had its
  // row inserted before its upload URL was signed, so the rows cannot miss it.
  const objects = await storage.listFolder(userId)
  const rowsResult = await admin
    .from("books")
    .select("file_path, cover_path")
    .eq("user_id", userId)
  if (rowsResult.error) throw rowsResult.error
  const referenced = new Set(rowsResult.data.flatMap(objectPaths))
  await storage.remove(objects.filter((path) => !referenced.has(path)))
}

/** Removes a pending upload's objects, then its row (only while still pending). */
async function discardUpload(
  admin: AdminClient,
  userId: string,
  book: { id: string; file_path: string; cover_path: string | null }
) {
  try {
    await bookStorage(admin).remove(objectPaths(book))
  } catch (removeError) {
    console.error("removing a discarded upload failed", removeError)
  }
  const { error } = await admin
    .from("books")
    .delete()
    .eq("id", book.id)
    .eq("user_id", userId)
    .eq("status", "pending")
  if (error) console.error("deleting a discarded reservation failed", error)
}

export const requestUploadFn = createServerFn({ method: "POST" })
  .validator((data: UploadRequest) => UploadRequestSchema.parse(data))
  .handler(async ({ data }): Promise<UploadTicket> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")
    if (data.epubBytes > MAX_EPUB_BYTES) return fail("too_large")

    const admin = getSupabaseAdminClient()
    try {
      await removeAbandonedUploads(admin, user.id, data.sha256)
      await removeOrphanedObjects(admin, user.id)
    } catch (error) {
      console.error("upload cleanup failed", error)
      return fail("unknown")
    }

    const bookId = crypto.randomUUID()
    const { data: paths, error } = await admin
      .rpc("reserve_book_upload", {
        p_user_id: user.id,
        p_book_id: bookId,
        p_sha256: data.sha256,
        p_epub_bytes: data.epubBytes,
        p_title: data.title,
        p_author: data.author,
        p_subjects: data.subjects,
        p_cover_bytes: data.cover?.bytes ?? 0,
        p_cover_type: data.cover?.type,
        p_description: data.description ?? undefined,
        p_language: data.language ?? undefined,
        p_genre: data.genre ?? undefined,
        p_genre_source: data.genreSource ?? undefined,
      })
      .single()
    if (error) {
      if (RESERVE_ERRORS.has(error.message)) return fail(error.message)
      console.error("reserve_book_upload failed", error)
      return fail("unknown")
    }

    const storage = bookStorage(admin)
    try {
      return {
        ok: true,
        bookId,
        epubUploadUrl: await storage.createUploadUrl(paths.epub_path),
        coverUploadUrl: paths.cover_object_path
          ? await storage.createUploadUrl(paths.cover_object_path)
          : null,
      }
    } catch (signError) {
      console.error("signing upload URLs failed", signError)
      const { error: cleanupError } = await admin
        .from("books")
        .delete()
        .eq("id", bookId)
        .eq("user_id", user.id)
      if (cleanupError)
        console.error("removing the reservation failed", cleanupError)
      return fail("unknown")
    }
  })

export const confirmUploadFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data: book, error } = await supabase
      .from("books")
      .select("id, file_path, cover_path, size_bytes, status, created_at")
      .eq("id", data.bookId)
      .maybeSingle()
    if (error) {
      console.error("book lookup failed", error)
      return fail("unknown")
    }
    if (!book) return fail("not_found")
    if (book.status === "ready") return { ok: true }

    const admin = getSupabaseAdminClient()
    // An expired reservation no longer counts toward the quota, so it cannot be
    // promoted: confirming it late would let the member exceed their quota.
    if (isAbandoned({ status: "pending", createdAt: book.created_at })) {
      await discardUpload(admin, user.id, book)
      return fail("upload_interrupted")
    }

    const storage = bookStorage(admin)
    let epubSize: number | null
    let coverSize: number | null
    try {
      epubSize = await storage.statObject(book.file_path)
      coverSize = book.cover_path
        ? await storage.statObject(book.cover_path)
        : 0
    } catch (statError) {
      // Not proof that the upload is broken: keep it so the member can retry.
      console.error("checking the uploaded files failed", statError)
      return fail("unknown")
    }
    if (
      epubSize === null ||
      coverSize === null ||
      coverSize > MAX_COVER_BYTES ||
      epubSize + coverSize !== book.size_bytes
    ) {
      await discardUpload(admin, user.id, book)
      return fail("size_mismatch")
    }

    const { data: marked, error: markError } = await admin.rpc(
      "mark_book_ready",
      { p_user_id: user.id, p_book_id: book.id }
    )
    if (markError) {
      console.error("marking the book ready failed", markError)
      return fail("unknown")
    }
    if (!marked) {
      await discardUpload(admin, user.id, book)
      return fail("upload_interrupted")
    }
    return { ok: true }
  })

export const listBooksFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShelfData> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("not_authenticated")

    const [booksResult, profileResult] = await Promise.all([
      supabase
        .from("books")
        .select(
          "id, title, author, description, language, genre, genre_source, size_bytes, status, created_at, last_opened_at, cover_path"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("plan, storage_limit_bytes")
        .eq("id", user.id)
        .single(),
    ])
    if (booksResult.error) throw booksResult.error
    if (profileResult.error) throw profileResult.error
    const rows = booksResult.data

    const ready = rows.filter((row) => row.status === "ready")
    let covers = new Map<string, string>()
    try {
      // Signed with the member's own client, so Storage RLS applies.
      covers = await bookStorage(supabase).getReadUrls(
        ready.flatMap((row) => (row.cover_path ? [row.cover_path] : []))
      )
    } catch (error) {
      console.error("signing cover URLs failed", error)
    }

    return {
      books: ready.map((row) => ({
        id: row.id,
        title: row.title,
        author: row.author,
        description: row.description,
        language: row.language,
        genre: isGenre(row.genre) ? row.genre : null,
        genreSource:
          row.genre_source === "auto" || row.genre_source === "user"
            ? row.genre_source
            : null,
        sizeBytes: row.size_bytes,
        createdAt: row.created_at,
        lastOpenedAt: row.last_opened_at,
        coverUrl: row.cover_path ? (covers.get(row.cover_path) ?? null) : null,
      })),
      usage: {
        usedBytes: usedBytes(
          rows.map((row) => ({
            sizeBytes: row.size_bytes,
            status: row.status === "ready" ? "ready" : "pending",
            createdAt: row.created_at,
          }))
        ),
        limitBytes: profileResult.data.storage_limit_bytes,
        plan: toPlan(profileResult.data.plan),
      },
    }
  }
)

export const updateBookGenreFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string; genre: Genre }) =>
    z.object({ bookId: z.uuid(), genre: z.enum(GENRE_VALUES) }).parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data: rows, error } = await supabase
      .from("books")
      .update({ genre: data.genre, genre_source: "user" })
      .eq("id", data.bookId)
      .select("id")
    if (error) {
      console.error("updating the genre failed", error)
      return fail("unknown")
    }
    return rows.length > 0 ? { ok: true } : fail("not_found")
  })

export const deleteBookFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    // Looked up with the member's client: RLS proves ownership.
    const { data: book, error } = await supabase
      .from("books")
      .select("id, file_path, cover_path")
      .eq("id", data.bookId)
      .maybeSingle()
    if (error) {
      console.error("book lookup failed", error)
      return fail("unknown")
    }
    if (!book) return fail("not_found")

    // Members cannot delete rows themselves (decision 7): remove the files first,
    // then the row with the admin client, scoped to this member.
    const admin = getSupabaseAdminClient()
    try {
      await bookStorage(admin).remove(objectPaths(book))
    } catch (removeError) {
      console.error("removing book files failed", removeError)
      return fail("unknown")
    }
    const { error: deleteError } = await admin
      .from("books")
      .delete()
      .eq("id", book.id)
      .eq("user_id", user.id)
    if (deleteError) {
      console.error("deleting the book failed", deleteError)
      return fail("unknown")
    }
    try {
      await removeOrphanedObjects(admin, user.id)
    } catch (sweepError) {
      console.error("orphan sweep failed", sweepError)
    }
    return { ok: true }
  })
