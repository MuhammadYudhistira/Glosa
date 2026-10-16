import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  adminClient,
  anonClient,
  createTestMember,
  deleteTestMembers,
  signedInClient,
} from "./helpers"

const run = Date.now().toString(36)
const MB = 1024 * 1024
const emails = {
  ani: `db-books-ani-${run}@glosa.test`,
  budi: `db-books-budi-${run}@glosa.test`,
  cita: `db-books-cita-${run}@glosa.test`,
  dewi: `db-books-dewi-${run}@glosa.test`,
}
const newSha = () => `${randomUUID()}${randomUUID()}`.replaceAll("-", "")
const uploadedPaths: Array<string> = []

function reserve(
  userId: string,
  opts: {
    bookId?: string
    sha256?: string
    epubBytes?: number
    coverBytes?: number
    coverType?: string
  } = {}
) {
  return adminClient()
    .rpc("reserve_book_upload", {
      p_user_id: userId,
      p_book_id: opts.bookId ?? randomUUID(),
      p_sha256: opts.sha256 ?? newSha(),
      p_epub_bytes: opts.epubBytes ?? 1000,
      p_title: "Buku Uji",
      p_author: "Penulis Uji",
      p_subjects: ["Fiction"],
      p_cover_bytes: opts.coverBytes,
      p_cover_type: opts.coverType,
      p_genre: "fiksi_sastra",
      p_genre_source: "auto",
    })
    .single()
}

async function readyBook(userId: string): Promise<string> {
  const bookId = randomUUID()
  const { error } = await reserve(userId, { bookId })
  if (error) throw error
  const { error: updateError } = await adminClient()
    .from("books")
    .update({ status: "ready" })
    .eq("id", bookId)
  if (updateError) throw updateError
  return bookId
}

async function bookOf(id: string) {
  const { data, error } = await adminClient()
    .from("books")
    .select("genre, genre_source, size_bytes, status")
    .eq("id", id)
    .single()
  if (error) throw error
  return data
}

describe("books", () => {
  const ids = { ani: "", budi: "", cita: "", dewi: "" }

  beforeAll(async () => {
    for (const name of ["ani", "budi", "cita", "dewi"] as const) {
      ids[name] = (
        await createTestMember({
          email: emails[name],
          metadata: { username: `bk_${name}_${run}`, display_name: name },
        })
      ).id
    }
  })

  afterAll(async () => {
    if (uploadedPaths.length > 0) {
      await adminClient().storage.from("books").remove(uploadedPaths)
    }
    await deleteTestMembers()
  })

  it("lets members see only their own books", async () => {
    const aniBook = await readyBook(ids.ani)
    await readyBook(ids.budi)
    const ani = await signedInClient(emails.ani)
    const { data, error } = await ani.from("books").select("id")
    expect(error).toBeNull()
    expect(data?.map((book) => book.id)).toEqual([aniBook])
  })

  it("lets members change only the genre of their own books", async () => {
    const aniBook = await readyBook(ids.ani)
    const budiBook = await readyBook(ids.budi)
    const ani = await signedInClient(emails.ani)

    const own = await ani
      .from("books")
      .update({ genre: "sejarah_budaya", genre_source: "user" })
      .eq("id", aniBook)
      .select("id")
    expect(own.error).toBeNull()
    expect(own.data).toHaveLength(1)
    expect(await bookOf(aniBook)).toMatchObject({
      genre: "sejarah_budaya",
      genre_source: "user",
    })

    const other = await ani
      .from("books")
      .update({ genre: "lainnya", genre_source: "user" })
      .eq("id", budiBook)
      .select("id")
    expect(other.data).toEqual([])
    expect((await bookOf(budiBook)).genre).toBe("fiksi_sastra")

    for (const patch of [
      { size_bytes: 1 },
      { status: "pending" },
      { user_id: ids.budi },
    ]) {
      const { error } = await ani.from("books").update(patch).eq("id", aniBook)
      expect(error?.code).toBe("42501")
    }
    expect(await bookOf(aniBook)).toMatchObject({
      size_bytes: 1000,
      status: "ready",
    })
  })

  it("rejects client inserts and deletes of other members' books", async () => {
    const aniBook = await readyBook(ids.ani)
    const budiBook = await readyBook(ids.budi)
    const ani = await signedInClient(emails.ani)

    const insert = await ani.from("books").insert({
      user_id: ids.ani,
      title: "Selundupan",
      file_path: `${ids.ani}/x.epub`,
      size_bytes: 1,
      sha256: newSha(),
    })
    expect(insert.error?.code).toBe("42501")

    const other = await ani
      .from("books")
      .delete()
      .eq("id", budiBook)
      .select("id")
    expect(other.data).toEqual([])
    expect(await bookOf(budiBook)).toBeTruthy()

    const own = await ani.from("books").delete().eq("id", aniBook).select("id")
    expect(own.data).toHaveLength(1)
  })

  it("is refused to anonymous visitors", async () => {
    const { data, error } = await anonClient().from("books").select("id")
    expect(error?.code).toBe("42501")
    expect(data ?? []).toEqual([])
  })

  it("lets only the server reserve uploads", async () => {
    const ani = await signedInClient(emails.ani)
    const { error } = await ani.rpc("reserve_book_upload", {
      p_user_id: ids.ani,
      p_book_id: randomUUID(),
      p_sha256: newSha(),
      p_epub_bytes: 1000,
      p_title: "Buku",
      p_author: "",
      p_subjects: [],
    })
    expect(error?.code).toBe("42501")
  })

  it("rejects duplicates, oversized files and inconsistent covers", async () => {
    const sha256 = newSha()
    expect((await reserve(ids.ani, { sha256 })).error).toBeNull()
    expect((await reserve(ids.ani, { sha256 })).error?.message).toBe(
      "duplicate"
    )
    expect(
      (await reserve(ids.ani, { epubBytes: 50 * MB + 1 })).error?.message
    ).toBe("too_large")
    expect((await reserve(ids.ani, { coverBytes: 100 })).error?.message).toBe(
      "invalid_cover"
    )
    expect(
      (
        await reserve(ids.ani, {
          coverBytes: 2 * MB + 1,
          coverType: "image/webp",
        })
      ).error?.message
    ).toBe("invalid_cover")
  })

  it("enforces the quota, also for concurrent requests", async () => {
    const { error } = await adminClient()
      .from("profiles")
      .update({ storage_limit_bytes: 10 * MB })
      .eq("id", ids.cita)
    expect(error).toBeNull()

    const results = await Promise.all([
      reserve(ids.cita, { epubBytes: 6 * MB }),
      reserve(ids.cita, { epubBytes: 6 * MB }),
    ])
    const messages = results.map((result) => result.error?.message ?? "ok")
    expect(messages.sort()).toEqual(["ok", "quota_exceeded"])
  })

  it("does not count abandoned pending uploads", async () => {
    await adminClient()
      .from("profiles")
      .update({ storage_limit_bytes: 10 * MB })
      .eq("id", ids.dewi)
    const stale = randomUUID()
    const { error } = await adminClient()
      .from("books")
      .insert({
        id: stale,
        user_id: ids.dewi,
        title: "Terputus",
        file_path: `${ids.dewi}/${stale}.epub`,
        size_bytes: 9 * MB,
        sha256: newSha(),
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      })
    expect(error).toBeNull()
    expect((await reserve(ids.dewi, { epubBytes: 6 * MB })).error).toBeNull()
  })

  it("files the book under the member's folder", async () => {
    const bookId = randomUUID()
    const { data, error } = await reserve(ids.ani, {
      bookId,
      coverBytes: 500,
      coverType: "image/webp",
    })
    expect(error).toBeNull()
    expect(data).toEqual({
      epub_path: `${ids.ani}/${bookId}.epub`,
      cover_object_path: `${ids.ani}/${bookId}-cover.webp`,
    })
    expect((await bookOf(bookId)).size_bytes).toBe(1500)
  })

  it("lets members read only their own book files", async () => {
    const path = `${ids.budi}/${randomUUID()}.epub`
    const upload = await adminClient()
      .storage.from("books")
      .upload(
        path,
        new Blob([new Uint8Array(64)], { type: "application/epub+zip" }),
        {
          contentType: "application/epub+zip",
        }
      )
    expect(upload.error).toBeNull()
    uploadedPaths.push(path)

    const ani = await signedInClient(emails.ani)
    expect(
      (await ani.storage.from("books").download(path)).error
    ).not.toBeNull()

    const budi = await signedInClient(emails.budi)
    const own = await budi.storage.from("books").download(path)
    expect(own.error).toBeNull()
    expect(own.data?.size).toBe(64)

    const sneaky = await ani.storage
      .from("books")
      .upload(
        `${ids.ani}/${randomUUID()}.epub`,
        new Blob([new Uint8Array(8)], { type: "application/epub+zip" }),
        {
          contentType: "application/epub+zip",
        }
      )
    expect(sneaky.error).not.toBeNull()
  })
})
