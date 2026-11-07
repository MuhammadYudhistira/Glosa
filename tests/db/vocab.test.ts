import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  adminClient,
  createTestMember,
  deleteTestMembers,
  forgetTestMember,
  newTestBook,
  signedInClient,
} from "./helpers"

const run = Date.now().toString(36)
const emails = {
  ani: `db-vocab-ani-${run}@glosa.test`,
  budi: `db-vocab-budi-${run}@glosa.test`,
}
type Client = Awaited<ReturnType<typeof signedInClient>>

async function rpc(client: Client, name: string, args: object) {
  const { data, error } = await client.rpc(name as never, args as never)
  if (error) throw error
  return data as unknown
}
const words = (n: number, prefix = "w") =>
  Array.from({ length: n }, (_, i) => `${prefix}${i.toString(36)}`)

describe("vocabulary from reading", () => {
  const ids = { ani: "", budi: "" }
  const books = { ani: "", ani2: "", budi: "" }
  let ani: Client
  let budi: Client

  beforeAll(async () => {
    ids.ani = (await createTestMember({ email: emails.ani })).id
    ids.budi = (await createTestMember({ email: emails.budi })).id
    books.ani = await newTestBook(ids.ani)
    books.ani2 = await newTestBook(ids.ani)
    books.budi = await newTestBook(ids.budi)
    ani = await signedInClient(emails.ani)
    budi = await signedInClient(emails.budi)
  })

  afterAll(async () => {
    await deleteTestMembers()
  })

  it("adds a section's words once, in parts, without duplicates", async () => {
    const entry = (section: number, list: Array<string>, last: boolean) => ({
      book_id: books.ani,
      section,
      words: list,
      last,
    })
    expect(
      await rpc(ani, "record_words_read", {
        p_entries: [entry(2, ["the", "cat", "sat"], false)],
      })
    ).toEqual(["ok"])
    // The part again (a retry) and the last part.
    expect(
      await rpc(ani, "record_words_read", {
        p_entries: [
          entry(2, ["the", "cat", "sat"], false),
          entry(2, ["on", "the", "mat"], true),
        ],
      })
    ).toEqual(["ok", "ok"])
    // The section is done: another device's copy is ignored.
    expect(
      await rpc(ani, "record_words_read", {
        p_entries: [entry(2, ["ignored"], true)],
      })
    ).toEqual(["ok"])
    const { data } = await adminClient()
      .from("book_words_read")
      .select("sections, words")
      .eq("user_id", ids.ani)
      .eq("book_id", books.ani)
      .single()
    expect(data?.sections).toEqual([2])
    expect([...(data?.words ?? [])].sort()).toEqual(
      ["cat", "mat", "on", "sat", "the"].sort()
    )
  })

  it("refuses broken entries one by one and skips other members' books", async () => {
    const answers = await rpc(ani, "record_words_read", {
      p_entries: [
        { book_id: books.ani, section: 3, words: words(5001), last: true },
        { book_id: books.ani, section: -1, words: ["a"], last: true },
        { book_id: books.ani, section: 4, words: [""], last: true },
        { book_id: books.ani, section: 5, words: ["x".repeat(65)], last: true },
        { book_id: books.budi, section: 1, words: ["stolen"], last: true },
        { book_id: books.ani, section: 6, words: words(5000), last: true },
      ],
    })
    expect(answers).toEqual([
      "invalid",
      "invalid",
      "invalid",
      "invalid",
      "ok",
      "ok",
    ])
    const { data } = await adminClient()
      .from("book_words_read")
      .select("book_id")
      .eq("user_id", ids.ani)
      .eq("book_id", books.budi)
    expect(data).toEqual([])
  })

  it("adds taps to a word, per book", async () => {
    const tap = (word: string, taps: number, at: string) => ({
      book_id: books.ani,
      word,
      taps,
      at,
    })
    expect(
      await rpc(ani, "record_lookups", {
        p_entries: [
          tap("mat", 1, "2026-11-01T10:00:00Z"),
          tap("zebra", 2, "2026-11-01T11:00:00Z"),
        ],
      })
    ).toEqual(["ok", "ok"])
    expect(
      await rpc(ani, "record_lookups", {
        p_entries: [
          tap("mat", 2, "2026-11-02T09:00:00Z"),
          tap("", 1, "2026-11-02T09:00:00Z"),
        ],
      })
    ).toEqual(["ok", "invalid"])
    const { data } = await adminClient()
      .from("word_lookups")
      .select("word, taps, first_at, last_at")
      .eq("user_id", ids.ani)
      .order("word")
    expect(data?.map(({ word, taps }) => [word, taps])).toEqual([
      ["mat", 3],
      ["zebra", 2],
    ])
  })

  it("answers a book's numbers, counting only looked-up words it has read", async () => {
    const vocab = (await rpc(ani, "book_vocab", { p_book_id: books.ani })) as {
      read: number
      looked_up: number
      words: Array<{ word: string; taps: number }>
    }
    // 5 words of section 2 plus 5,000 of section 6; "zebra" was never read.
    expect(vocab.read).toBe(5005)
    expect(vocab.looked_up).toBe(1)
    expect(vocab.words.map(({ word, taps }) => [word, taps])).toEqual([
      ["mat", 3],
      ["zebra", 2],
    ])
    expect(await rpc(ani, "book_vocab", { p_book_id: books.budi })).toBeNull()
    const summaries = (await rpc(ani, "book_vocab_summaries", {})) as Array<{
      book_id: string
      read: number
      looked_up: number
    }>
    expect(summaries).toEqual([
      { book_id: books.ani, read: 5005, looked_up: 1 },
    ])
  })

  it("keeps the most meetings per word, book and section, for saved words only", async () => {
    const { error } = await adminClient()
      .from("saved_words")
      .insert({
        user_id: ids.ani,
        headword: "mat",
        meanings: ["tikar"],
        sentence: "",
      })
    if (error) throw error
    const meet = (headword: string, section: number, count: number) => ({
      headword,
      book_id: books.ani,
      section,
      count,
    })
    expect(
      await rpc(ani, "record_meetings", {
        p_entries: [
          meet("mat", 2, 3),
          meet("mat", 2, 1),
          meet("mat", 7, 2),
          meet("dog", 2, 5),
        ],
      })
    ).toEqual(["ok", "ok", "ok", "ok"])
    await rpc(ani, "record_meetings", {
      p_entries: [
        { headword: "mat", book_id: books.ani2, section: 1, count: 4 },
      ],
    })
    expect(await rpc(ani, "word_meeting_counts", {})).toEqual([
      { headword: "mat", meetings: 3 + 2 + 4, books: 2 },
    ])
  })

  it("keeps meetings after the book is deleted, and drops them with the word", async () => {
    await adminClient().from("books").delete().eq("id", books.ani2)
    expect(await rpc(ani, "word_meeting_counts", {})).toEqual([
      { headword: "mat", meetings: 9, books: 2 },
    ])
    const { data: read } = await adminClient()
      .from("book_words_read")
      .select("book_id")
      .eq("book_id", books.ani2)
    expect(read).toEqual([])
    await adminClient()
      .from("saved_words")
      .delete()
      .eq("user_id", ids.ani)
      .eq("headword", "mat")
    expect(await rpc(ani, "word_meeting_counts", {})).toEqual([])
  })

  it("keeps every table private and read-only", async () => {
    for (const [table, row] of [
      ["book_words_read", { user_id: ids.ani, book_id: books.ani }],
      [
        "word_lookups",
        { user_id: ids.ani, book_id: books.ani, word: "x", taps: 1 },
      ],
      [
        "word_meetings",
        {
          user_id: ids.ani,
          headword: "x",
          book_id: books.ani,
          section: 0,
          count: 1,
        },
      ],
    ] as const) {
      const { error } = await ani.from(table).insert(row as never)
      expect(error, table).not.toBeNull()
    }
    const { data } = await budi.from("word_lookups").select("word")
    expect(data).toEqual([])
    expect(await rpc(budi, "book_vocab_summaries", {})).toEqual([])
  })

  it("drops a member's rows with the account", async () => {
    const dora = (
      await createTestMember({ email: `db-vocab-dora-${run}@glosa.test` })
    ).id
    const book = await newTestBook(dora)
    const admin = adminClient()
    await admin
      .from("book_words_read")
      .insert({ user_id: dora, book_id: book, words: ["a"] })
    await admin
      .from("word_lookups")
      .insert({ user_id: dora, book_id: book, word: "a", taps: 1 })
    await admin
      .from("word_meetings")
      .insert({
        user_id: dora,
        headword: "a",
        book_id: book,
        section: 0,
        count: 1,
      })
    const { error } = await admin.auth.admin.deleteUser(dora)
    if (error) throw error
    forgetTestMember(dora)
    for (const table of [
      "book_words_read",
      "word_lookups",
      "word_meetings",
    ] as const) {
      const { count } = await admin
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("user_id", dora)
      expect(count, table).toBe(0)
    }
  })
})
