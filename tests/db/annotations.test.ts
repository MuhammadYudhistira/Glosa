import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  adminClient,
  anonClient,
  createTestMember,
  deleteTestMembers,
  forgetTestMember,
  newTestBook,
  signedInClient,
} from "./helpers"

const run = Date.now().toString(36)
const emails = {
  ani: `db-notes-ani-${run}@glosa.test`,
  budi: `db-notes-budi-${run}@glosa.test`,
  cita: `db-notes-cita-${run}@glosa.test`,
  dedi: `db-notes-dedi-${run}@glosa.test`,
}
type Client = Awaited<ReturnType<typeof signedInClient>>

const MINUTE = 60_000
// An hour ago, so the server's clamp to now() never touches these stamps.
const base = Date.now() - 60 * MINUTE
const at = (minutes: number) => new Date(base + minutes * MINUTE).toISOString()

type Entry = {
  id: string
  book_id: string
  kind: string
  cfi: string
  color: string | null
  note: string
  excerpt: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function highlight(bookId: string, changes: Partial<Entry> = {}): Entry {
  return {
    id: randomUUID(),
    book_id: bookId,
    kind: "highlight",
    cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
    color: "yellow",
    note: "",
    excerpt: "To Sherlock",
    created_at: at(0),
    updated_at: at(0),
    deleted_at: null,
    ...changes,
  }
}

function bookmark(bookId: string, changes: Partial<Entry> = {}): Entry {
  return highlight(bookId, {
    kind: "bookmark",
    cfi: "epubcfi(/6/4!/4/2/1:0)",
    color: null,
    ...changes,
  })
}

async function save(client: Client, entries: Array<Entry>) {
  const { data, error } = await client.rpc("save_annotations", {
    p_entries: entries,
  })
  if (error) throw error
  return data
}

async function rowOf(id: string) {
  const { data, error } = await adminClient()
    .from("annotations")
    .select("user_id, color, note, updated_at, deleted_at")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data
}

describe("annotations", () => {
  const ids = { ani: "", budi: "", cita: "", dedi: "" }
  const books = { ani: "", aniPending: "", budi: "", cita: "" }
  let ani: Client
  let budi: Client

  beforeAll(async () => {
    for (const name of ["ani", "budi", "cita", "dedi"] as const) {
      ids[name] = (await createTestMember({ email: emails[name] })).id
    }
    books.ani = await newTestBook(ids.ani)
    books.aniPending = await newTestBook(ids.ani, { ready: false })
    books.budi = await newTestBook(ids.budi)
    books.cita = await newTestBook(ids.cita)
    ani = await signedInClient(emails.ani)
    budi = await signedInClient(emails.budi)
  })

  afterAll(async () => {
    await deleteTestMembers()
  })

  it("stores a highlight that only its member can read", async () => {
    const entry = highlight(books.ani)
    expect(await save(ani, [entry])).toEqual(["ok"])

    const own = await ani.from("annotations").select("id").eq("id", entry.id)
    expect(own.data).toEqual([{ id: entry.id }])
    const other = await budi.from("annotations").select("id").eq("id", entry.id)
    expect(other.data).toEqual([])
    const anon = await anonClient().from("annotations").select("id")
    expect(anon.error).not.toBeNull()
  })

  it("keeps the newest change", async () => {
    const entry = highlight(books.ani)
    await save(ani, [entry])

    expect(
      await save(ani, [{ ...entry, color: "green", updated_at: at(-1) }])
    ).toEqual(["ok"])
    expect((await rowOf(entry.id))?.color).toBe("yellow")

    expect(
      await save(ani, [{ ...entry, color: "blue", updated_at: at(1) }])
    ).toEqual(["ok"])
    expect((await rowOf(entry.id))?.color).toBe("blue")
  })

  it("clamps a time from the future to now", async () => {
    const future = new Date(Date.now() + 24 * 60 * MINUTE).toISOString()
    const entry = highlight(books.ani, { updated_at: future })
    await save(ani, [entry])
    const row = await rowOf(entry.id)
    expect(Date.parse(row?.updated_at ?? "")).toBeLessThan(Date.parse(future))
  })

  it("keeps a deletion as a tombstone the member still reads", async () => {
    const entry = highlight(books.ani)
    await save(ani, [entry])
    expect(
      await save(ani, [{ ...entry, deleted_at: at(1), updated_at: at(1) }])
    ).toEqual(["ok"])
    const own = await ani
      .from("annotations")
      .select("deleted_at")
      .eq("id", entry.id)
      .single()
    expect(own.data?.deleted_at).not.toBeNull()
  })

  it("refuses another member's id, another member's book and a book not ready", async () => {
    const entry = highlight(books.ani)
    await save(ani, [entry])

    expect(
      await save(budi, [
        { ...entry, book_id: books.budi, color: "pink", updated_at: at(5) },
        highlight(books.ani),
      ])
    ).toEqual(["invalid", "invalid"])
    expect(await rowOf(entry.id)).toMatchObject({
      user_id: ids.ani,
      color: "yellow",
    })
    expect(await save(ani, [highlight(books.aniPending)])).toEqual(["invalid"])
  })

  it("skips a change for a book that is gone", async () => {
    const entry = highlight(randomUUID())
    expect(await save(ani, [entry])).toEqual(["ok"])
    expect(await rowOf(entry.id)).toBeNull()
  })

  it("refuses a bad entry alone and keeps the rest of the batch", async () => {
    const good = highlight(books.ani)
    expect(
      await save(ani, [
        good,
        highlight(books.ani, { note: "x".repeat(2001) }),
        bookmark(books.ani, { color: "yellow" }),
        bookmark(books.ani, { note: "Catatan" }),
      ])
    ).toEqual(["ok", "invalid", "invalid", "invalid"])
    expect(await rowOf(good.id)).not.toBeNull()
  })

  it("refuses more than 50 entries at once", async () => {
    const entries = Array.from({ length: 51 }, () => bookmark(books.ani))
    const { error } = await ani.rpc("save_annotations", {
      p_entries: entries,
    })
    expect(error?.message).toBe("invalid")
  })

  it("stops at 10,000 active annotations; tombstones do not count", async () => {
    const cita = await signedInClient(emails.cita)
    const rows = Array.from({ length: 9999 }, () => ({
      ...bookmark(books.cita),
      user_id: ids.cita,
    }))
    for (let i = 0; i < rows.length; i += 2500) {
      const { error } = await adminClient()
        .from("annotations")
        .insert(rows.slice(i, i + 2500))
      expect(error).toBeNull()
    }

    const last = bookmark(books.cita)
    expect(await save(cita, [last])).toEqual(["ok"])
    expect(await save(cita, [bookmark(books.cita)])).toEqual(["limit_reached"])
    // A change to one already there is still fine.
    expect(
      await save(cita, [{ ...last, excerpt: "Lagi", updated_at: at(1) }])
    ).toEqual(["ok"])

    expect(
      await save(cita, [{ ...last, deleted_at: at(2), updated_at: at(2) }])
    ).toEqual(["ok"])
    expect(await save(cita, [bookmark(books.cita)])).toEqual(["ok"])
  })

  it("leaves with the book and with the account", async () => {
    const dedi = await signedInClient(emails.dedi)
    const firstBook = await newTestBook(ids.dedi)
    const secondBook = await newTestBook(ids.dedi)
    const first = highlight(firstBook)
    const second = highlight(secondBook)
    expect(await save(dedi, [first, second])).toEqual(["ok", "ok"])

    const removed = await adminClient()
      .from("books")
      .delete()
      .eq("id", firstBook)
    expect(removed.error).toBeNull()
    expect(await rowOf(first.id)).toBeNull()
    expect(await rowOf(second.id)).not.toBeNull()

    const { error } = await adminClient().auth.admin.deleteUser(ids.dedi)
    expect(error).toBeNull()
    forgetTestMember(ids.dedi)
    expect(await rowOf(second.id)).toBeNull()
  })
})
