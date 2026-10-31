import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  adminClient,
  createTestMember,
  deleteTestMembers,
  newTestBook,
  signedInClient,
} from "./helpers"

const run = Date.now().toString(36)
const emails = {
  ani: `db-coll-ani-${run}@glosa.test`,
  budi: `db-coll-budi-${run}@glosa.test`,
  cita: `db-coll-cita-${run}@glosa.test`,
}
type Client = Awaited<ReturnType<typeof signedInClient>>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

async function create(client: Client, name: string): Promise<string> {
  const { data, error } = await client.rpc("create_collection", {
    p_name: name,
  })
  if (error) throw error
  return data
}

async function membersOf(bookId: string): Promise<Array<string>> {
  const { data, error } = await adminClient()
    .from("collection_books")
    .select("collection_id")
    .eq("book_id", bookId)
  if (error) throw error
  return data.map((row) => row.collection_id).sort()
}

async function finishOf(bookId: string) {
  const { data, error } = await adminClient()
    .from("books")
    .select("finished_at, finish_declined")
    .eq("id", bookId)
    .single()
  if (error) throw error
  return data
}

describe("collections", () => {
  const ids = { ani: "", budi: "", cita: "" }
  const books = { ani: "", ani2: "", budi: "" }
  let ani: Client
  let budi: Client
  let cita: Client

  beforeAll(async () => {
    ids.ani = (await createTestMember({ email: emails.ani })).id
    ids.budi = (await createTestMember({ email: emails.budi })).id
    ids.cita = (await createTestMember({ email: emails.cita })).id
    books.ani = await newTestBook(ids.ani)
    books.ani2 = await newTestBook(ids.ani)
    books.budi = await newTestBook(ids.budi)
    ani = await signedInClient(emails.ani)
    budi = await signedInClient(emails.budi)
    cita = await signedInClient(emails.cita)
  })

  afterAll(async () => {
    await deleteTestMembers()
  })

  it("makes a collection with a trimmed name, once per name in any case", async () => {
    const id = await create(ani, "  Bacaan santai  ")
    expect(id).toMatch(UUID)
    expect(await create(ani, "BACAAN SANTAI")).toBe("duplicate")
    // Another member may use the same name.
    expect(await create(budi, "Bacaan santai")).toMatch(UUID)
    const { data } = await ani.from("collections").select("id, name")
    expect(data).toEqual([{ id, name: "Bacaan santai" }])
  })

  it("refuses an empty name and one over 40 characters", async () => {
    expect(await create(ani, "   ")).toBe("invalid")
    expect(await create(ani, "a".repeat(41))).toBe("invalid")
    expect(await create(ani, "a".repeat(40))).toMatch(UUID)
  })

  it("stops at 50 collections, also for two calls at once", async () => {
    for (let i = 0; i < 49; i++) {
      expect(await create(cita, `Koleksi ${i}`)).toMatch(UUID)
    }
    const both = await Promise.all([
      create(cita, "Terakhir A"),
      create(cita, "Terakhir B"),
    ])
    expect(both.filter((answer) => UUID.test(answer))).toHaveLength(1)
    expect(both).toContain("limit_reached")
    expect(await create(cita, "Satu lagi")).toBe("limit_reached")
  })

  it("renames and deletes only the member's own collections", async () => {
    const id = await create(ani, "Untuk tahun depan")
    await create(ani, "Klasik")
    const rename = (client: Client, name: string) =>
      client.rpc("rename_collection", { p_id: id, p_name: name })
    expect((await rename(ani, " Tahun depan ")).data).toBe("ok")
    expect((await rename(ani, "klasik")).data).toBe("duplicate")
    expect((await rename(ani, "")).data).toBe("invalid")
    expect((await rename(budi, "Punya Budi")).data).toBe("not_found")
    expect((await budi.rpc("delete_collection", { p_id: id })).data).toBe(
      "not_found"
    )
    // Budi does not see Ani's collections at all.
    const { data: seen } = await budi
      .from("collections")
      .select("id")
      .eq("id", id)
    expect(seen).toEqual([])
    expect((await ani.rpc("delete_collection", { p_id: id })).data).toBe("ok")
  })

  it("puts a book in exactly the collections asked for", async () => {
    const a = await create(ani, "Satu")
    const b = await create(ani, "Dua")
    const set = (client: Client, bookId: string, list: Array<string>) =>
      client.rpc("set_book_collections", {
        p_book_id: bookId,
        p_collection_ids: list,
      })
    expect((await set(ani, books.ani, [a, b])).data).toBe("ok")
    expect(await membersOf(books.ani)).toEqual([a, b].sort())
    expect((await set(ani, books.ani, [b])).data).toBe("ok")
    expect(await membersOf(books.ani)).toEqual([b])
    // Not Ani's book, or not Ani's collection.
    expect((await set(ani, books.budi, [b])).data).toBe("not_found")
    const theirs = await create(budi, "Milik Budi")
    expect((await set(ani, books.ani, [theirs])).data).toBe("invalid")
    expect((await set(budi, books.budi, [b])).data).toBe("invalid")
    // Members read the rows of their own collections only.
    const { data: rows } = await budi.from("collection_books").select("book_id")
    expect(rows).toEqual([])
  })

  it("drops the rows with their collection or their book", async () => {
    const c = await create(ani, "Sementara")
    await ani.rpc("set_book_collections", {
      p_book_id: books.ani2,
      p_collection_ids: [c],
    })
    expect(await membersOf(books.ani2)).toEqual([c])
    await ani.rpc("delete_collection", { p_id: c })
    expect(await membersOf(books.ani2)).toEqual([])

    const d = await create(ani, "Sementara lagi")
    await ani.rpc("set_book_collections", {
      p_book_id: books.ani2,
      p_collection_ids: [d],
    })
    await adminClient().from("books").delete().eq("id", books.ani2)
    const { data } = await adminClient()
      .from("collection_books")
      .select("book_id")
      .eq("collection_id", d)
    expect(data).toEqual([])
  })

  it("marks a book finished once, and not finished again", async () => {
    const finish = (finished: boolean) =>
      ani.rpc("set_book_finished", {
        p_book_id: books.ani,
        p_finished: finished,
      })
    expect(
      (await ani.rpc("decline_finish", { p_book_id: books.ani })).data
    ).toBe("ok")
    expect(await finishOf(books.ani)).toMatchObject({
      finished_at: null,
      finish_declined: true,
    })
    expect((await finish(true)).data).toBe("ok")
    const first = (await finishOf(books.ani)).finished_at
    expect(first).not.toBeNull()
    expect((await finish(true)).data).toBe("ok")
    expect((await finishOf(books.ani)).finished_at).toBe(first)
    expect((await finish(false)).data).toBe("ok")
    expect(await finishOf(books.ani)).toEqual({
      finished_at: null,
      finish_declined: false,
    })
    expect(
      (
        await budi.rpc("set_book_finished", {
          p_book_id: books.ani,
          p_finished: true,
        })
      ).data
    ).toBe("not_found")
    expect(
      (await budi.rpc("decline_finish", { p_book_id: books.ani })).data
    ).toBe("not_found")
  })

  it("lets no member write the tables or the finish columns directly", async () => {
    const insert = await ani
      .from("collections")
      .insert({ user_id: ids.ani, name: "Langsung" })
    expect(insert.error).not.toBeNull()
    const update = await ani
      .from("books")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", books.ani)
    expect(update.error).not.toBeNull()
  })
})
