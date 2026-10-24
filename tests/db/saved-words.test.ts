import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  dictionaryFixture,
  fixturePrefix,
  removeDictionary,
  seedDictionary,
} from "./dictionary-fixture"
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
  ani: `db-words-ani-${run}@glosa.test`,
  budi: `db-words-budi-${run}@glosa.test`,
  cita: `db-words-cita-${run}@glosa.test`,
}
type Client = Awaited<ReturnType<typeof signedInClient>>

function save(
  client: Client,
  headword: string,
  context: { bookId?: string | null; sentence?: string } = {}
) {
  return client.rpc("save_word", {
    p_headword: headword,
    p_pos: "verb",
    p_meanings: ["berlari"],
    p_book_id: context.bookId ?? undefined,
    p_sentence: context.sentence ?? "",
    p_cfi: "epubcfi(/6/4!/4/2/1:0)",
  })
}

async function rowOf(userId: string, headword: string) {
  const { data, error } = await adminClient()
    .from("saved_words")
    .select("book_id, book_title, sentence, meanings")
    .eq("user_id", userId)
    .eq("headword", headword)
    .maybeSingle()
  if (error) throw error
  return data
}

describe("saved words", () => {
  const fixture = dictionaryFixture(fixturePrefix())
  const ids = { ani: "", budi: "", cita: "" }
  const books = { ani: "", budi: "" }
  let ani: Client
  let budi: Client

  beforeAll(async () => {
    ids.ani = (await createTestMember({ email: emails.ani })).id
    ids.budi = (await createTestMember({ email: emails.budi })).id
    ids.cita = (await createTestMember({ email: emails.cita })).id
    books.ani = await newTestBook(ids.ani, { title: "Petualangan Ani" })
    books.budi = await newTestBook(ids.budi)
    ani = await signedInClient(emails.ani)
    budi = await signedInClient(emails.budi)
    await seedDictionary(fixture)
  })

  afterAll(async () => {
    await removeDictionary(fixture)
    await deleteTestMembers()
  })

  it("saves a word once and keeps its first context", async () => {
    const first = await save(ani, "holmes", {
      bookId: books.ani,
      sentence: "Holmes smiled.",
    })
    expect(first).toMatchObject({ data: "ok", error: null })
    const again = await save(ani, "holmes", { sentence: "Another sentence." })
    expect(again).toMatchObject({ data: "ok", error: null })
    expect(await rowOf(ids.ani, "holmes")).toEqual({
      book_id: books.ani,
      book_title: "Petualangan Ani",
      sentence: "Holmes smiled.",
      meanings: ["berlari"],
    })
  })

  it("refuses another member's book", async () => {
    const { error } = await save(ani, "watson", { bookId: books.budi })
    expect(error?.message).toBe("invalid")
    expect(await rowOf(ids.ani, "watson")).toBeNull()
  })

  it("keeps a word whose book is already gone, without the book", async () => {
    const gone = "00000000-0000-4000-8000-000000000000"
    const { data } = await save(ani, "lestrade", { bookId: gone })
    expect(data).toBe("ok")
    expect(await rowOf(ids.ani, "lestrade")).toMatchObject({
      book_id: null,
      book_title: null,
    })
  })

  it("deletes a word, and deleting it again is fine", async () => {
    await save(ani, "moriarty")
    expect(
      (await ani.rpc("delete_word", { p_headword: "moriarty" })).error
    ).toBeNull()
    expect(await rowOf(ids.ani, "moriarty")).toBeNull()
    expect(
      (await ani.rpc("delete_word", { p_headword: "moriarty" })).error
    ).toBeNull()
  })

  it("stops at 5,000 words", async () => {
    const cita = await signedInClient(emails.cita)
    const rows = Array.from({ length: 4999 }, (_, i) => ({
      user_id: ids.cita,
      headword: `kata${i}`,
    }))
    const { error } = await adminClient().from("saved_words").insert(rows)
    expect(error).toBeNull()
    expect((await save(cita, "terakhir")).data).toBe("ok")
    expect((await save(cita, "kelebihan")).data).toBe("limit_reached")
    // A word already there still answers ok.
    expect((await save(cita, "terakhir")).data).toBe("ok")
  })

  it("lists each saved word's forms for the underline", async () => {
    await save(ani, fixture.run)
    const { data, error } = await ani.rpc("saved_word_forms")
    expect(error).toBeNull()
    const forms = data as Record<string, Array<string>>
    expect([...forms[fixture.run]].sort()).toEqual(
      [fixture.ran, fixture.run, fixture.running].sort()
    )
    expect(forms.holmes).toEqual(["holmes"])
  })

  it("shows members only their own words, and writes go through the functions", async () => {
    const { data } = await budi.from("saved_words").select("headword")
    expect(data).toEqual([])
    const insert = await budi
      .from("saved_words")
      .insert({ user_id: ids.budi, headword: "langsung" })
    expect(insert.error).not.toBeNull()
  })

  it("keeps the words when their book is deleted", async () => {
    const bookId = await newTestBook(ids.ani, { title: "Buku Sementara" })
    await save(ani, "irene", { bookId })
    const { error } = await adminClient()
      .from("books")
      .delete()
      .eq("id", bookId)
    expect(error).toBeNull()
    expect(await rowOf(ids.ani, "irene")).toMatchObject({
      book_id: null,
      book_title: "Buku Sementara",
    })
  })

  it("removes everything with the account", async () => {
    expect((await save(budi, "mycroft")).data).toBe("ok")
    const { error } = await adminClient().auth.admin.deleteUser(ids.budi)
    expect(error).toBeNull()
    forgetTestMember(ids.budi)
    const { count } = await adminClient()
      .from("saved_words")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ids.budi)
    expect(count).toBe(0)
  })
})
