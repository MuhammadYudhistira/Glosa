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
const emails = {
  ani: `db-progress-ani-${run}@glosa.test`,
  budi: `db-progress-budi-${run}@glosa.test`,
}
const newSha = () => `${randomUUID()}${randomUUID()}`.replaceAll("-", "")
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()
type Client = Awaited<ReturnType<typeof signedInClient>>

async function newBook(userId: string, ready: boolean): Promise<string> {
  const bookId = randomUUID()
  const { error } = await adminClient()
    .rpc("reserve_book_upload", {
      p_user_id: userId,
      p_book_id: bookId,
      p_sha256: newSha(),
      p_epub_bytes: 1000,
      p_title: "Buku Uji",
      p_author: "Penulis Uji",
      p_subjects: [],
    })
    .single()
  if (error) throw error
  if (ready) {
    const { error: updateError } = await adminClient()
      .from("books")
      .update({ status: "ready" })
      .eq("id", bookId)
    if (updateError) throw updateError
  }
  return bookId
}

function save(
  client: Client,
  bookId: string,
  cfi: string,
  percentage: number,
  updatedAt: string
) {
  return client.rpc("save_progress", {
    p_book_id: bookId,
    p_cfi: cfi,
    p_percentage: percentage,
    p_updated_at: updatedAt,
  })
}

async function storedFor(bookId: string) {
  const { data, error } = await adminClient()
    .from("reading_progress")
    .select("cfi, percentage, updated_at")
    .eq("book_id", bookId)
    .maybeSingle()
  if (error) throw error
  return data
}

describe("reading progress", () => {
  const ids = { ani: "", budi: "" }
  const books = { ani: "", aniPending: "", budi: "" }
  let ani: Client
  let budi: Client

  beforeAll(async () => {
    ids.ani = (await createTestMember({ email: emails.ani })).id
    ids.budi = (await createTestMember({ email: emails.budi })).id
    books.ani = await newBook(ids.ani, true)
    books.aniPending = await newBook(ids.ani, false)
    books.budi = await newBook(ids.budi, true)
    ani = await signedInClient(emails.ani)
    budi = await signedInClient(emails.budi)
  })

  afterAll(async () => {
    await deleteTestMembers()
  })

  it("keeps the newest position", async () => {
    const first = await save(
      ani,
      books.ani,
      "epubcfi(/6/4!/4/2)",
      12.5,
      at(-60_000)
    )
    expect(first.error).toBeNull()
    expect(first.data).toBe(true)

    const older = await save(
      ani,
      books.ani,
      "epubcfi(/6/2!/4/2)",
      3,
      at(-120_000)
    )
    expect(older.error).toBeNull()
    expect(older.data).toBe(false)
    expect(await storedFor(books.ani)).toMatchObject({
      cfi: "epubcfi(/6/4!/4/2)",
      percentage: 12.5,
    })

    const newer = await save(
      ani,
      books.ani,
      "epubcfi(/6/8!/4/2)",
      40,
      at(-30_000)
    )
    expect(newer.data).toBe(true)
    expect(await storedFor(books.ani)).toMatchObject({
      cfi: "epubcfi(/6/8!/4/2)",
      percentage: 40,
    })
  })

  it("clamps a timestamp from the future to the database clock", async () => {
    const future = await save(
      ani,
      books.ani,
      "epubcfi(/6/10!/4/2)",
      50,
      "2100-01-01T00:00:00Z"
    )
    expect(future.data).toBe(true)
    const stored = await storedFor(books.ani)
    expect(new Date(stored!.updated_at).getFullYear()).toBeLessThan(2100)

    // A later save from a device with a correct clock still wins.
    const later = await save(
      ani,
      books.ani,
      "epubcfi(/6/12!/4/2)",
      55,
      at(60_000)
    )
    expect(later.data).toBe(true)
  })

  it("lets members read only their own positions", async () => {
    const { data: own, error } = await ani
      .from("reading_progress")
      .select("book_id")
    expect(error).toBeNull()
    expect(own?.map((row) => row.book_id)).toEqual([books.ani])

    const { data: others } = await budi
      .from("reading_progress")
      .select("book_id")
      .eq("book_id", books.ani)
    expect(others).toEqual([])
  })

  it("refuses positions for other members' books, unready books and guests", async () => {
    const foreign = await save(budi, books.ani, "epubcfi(/6/4!/4/2)", 1, at(0))
    expect(foreign.error?.message).toBe("not_found")

    const pending = await save(
      ani,
      books.aniPending,
      "epubcfi(/6/4!/4/2)",
      1,
      at(0)
    )
    expect(pending.error?.message).toBe("not_found")

    const guest = await save(
      anonClient(),
      books.ani,
      "epubcfi(/6/4!/4/2)",
      1,
      at(0)
    )
    expect(guest.error?.code).toBe("42501")
  })

  it("rejects direct writes and invalid values", async () => {
    const insert = await budi.from("reading_progress").insert({
      user_id: ids.budi,
      book_id: books.budi,
      cfi: "epubcfi(/6/4!/4/2)",
      percentage: 1,
      updated_at: at(0),
    })
    expect(insert.error?.code).toBe("42501")

    const update = await ani
      .from("reading_progress")
      .update({ percentage: 99 })
      .eq("book_id", books.ani)
    expect(update.error?.code).toBe("42501")

    const remove = await ani
      .from("reading_progress")
      .delete()
      .eq("book_id", books.ani)
    expect(remove.error?.code).toBe("42501")

    const tooFar = await save(
      budi,
      books.budi,
      "epubcfi(/6/4!/4/2)",
      101,
      at(0)
    )
    expect(tooFar.error?.code).toBe("23514")
    const empty = await save(budi, books.budi, "", 1, at(0))
    expect(empty.error?.code).toBe("23514")
  })

  it("removes positions together with their book", async () => {
    const saved = await save(budi, books.budi, "epubcfi(/6/4!/4/2)", 5, at(0))
    expect(saved.data).toBe(true)

    const { error } = await adminClient()
      .from("books")
      .delete()
      .eq("id", books.budi)
    expect(error).toBeNull()
    expect(await storedFor(books.budi)).toBeNull()
  })
})
