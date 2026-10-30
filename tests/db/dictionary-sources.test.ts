import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  dictionaryFixture,
  fixturePrefix,
  removeDictionary,
  seedDictionary,
} from "./dictionary-fixture"
import {
  adminClient,
  anonClient,
  createTestMember,
  deleteTestMembers,
  signedInClient,
} from "./helpers"

const email = `db-dict-src-${Date.now().toString(36)}@glosa.test`
type Client = Awaited<ReturnType<typeof signedInClient>>
type Entry = { headword: string; pos: string; source?: string }

// Spec kamus tiga sumber §3, §7. Only this run's prefixed words are written,
// and the dictionary is never swapped.
describe("dictionary sources", () => {
  const prefix = fixturePrefix()
  const fixture = dictionaryFixture(prefix)
  const made = `${prefix}made`
  const missing = `${prefix}missing`
  let member: Client

  beforeAll(async () => {
    await createTestMember({ email })
    member = await signedInClient(email)
    await seedDictionary(fixture)
    const admin = adminClient()
    const { error } = await admin.from("dict_entries").insert({
      headword: made,
      pos: "noun",
      meanings: ["buatan"],
      source: "ai",
    })
    if (error) throw error
    const { error: formError } = await admin
      .from("dict_forms")
      .insert({ form: made, headword: made, pos: "noun" })
    if (formError) throw formError
  })

  afterAll(async () => {
    const admin = adminClient()
    await admin.from("dict_entries").delete().eq("headword", made)
    await admin.from("dict_misses").delete().like("word", `${prefix}%`)
    await removeDictionary(fixture)
    await deleteTestMembers()
  })

  const lookUp = (word: string, next: Array<string> = []) =>
    member.rpc("lookup_word", { p_word: word, p_next: next })

  async function missesOf(word: string) {
    const { data, error } = await adminClient()
      .from("dict_misses")
      .select("lookups, last_seen")
      .eq("word", word)
    if (error) throw error
    return data
  }

  it("names the source of each entry", async () => {
    const run = await lookUp(fixture.run)
    expect(
      (run.data as { entries: Array<Entry> }).entries.map((e) => e.source)
    ).toEqual(["wiktionary", "wiktionary"])
    const ai = await lookUp(made)
    expect((ai.data as { entries: unknown }).entries).toEqual([
      { headword: made, pos: "noun", meanings: ["buatan"], source: "ai" },
    ])
  })

  it("counts a word looked up without a meaning", async () => {
    await lookUp(missing)
    await lookUp(missing)
    const rows = await missesOf(missing)
    expect(rows).toHaveLength(1)
    expect(rows[0].lookups).toBe(2)
    expect(rows[0].last_seen).toEqual(expect.any(String))
  })

  it("does not count a word that has a meaning, or one too long", async () => {
    await lookUp(fixture.ran)
    await lookUp(made)
    expect(await missesOf(fixture.ran)).toEqual([])
    expect(await missesOf(made)).toEqual([])
    const long = `${prefix}${"a".repeat(64)}`
    const answer = await lookUp(long)
    expect(answer.data).toMatchObject({ entries: [], phrases: [] })
    expect(await missesOf(long)).toEqual([])
  })

  it("cannot be made to count a word that has a meaning", async () => {
    const { error } = await member.rpc("dict_note_miss", {
      p_word: fixture.run,
    })
    expect(error).toBeNull()
    expect(await missesOf(fixture.run)).toEqual([])
  })

  it("holds only single words in the AI meanings, never a phrase", async () => {
    const admin = adminClient()
    const phrase = await admin.from("dict_generated").insert({
      headword: `${prefix}run up`,
      pos: "verb",
      meanings: ["naik"],
      model: "test",
    })
    expect(phrase.error?.code).toBe("23514")
    const phrasePos = await admin.from("dict_generated").insert({
      headword: `${prefix}single`,
      pos: "phrase",
      meanings: ["tunggal"],
      model: "test",
    })
    expect(phrasePos.error?.code).toBe("23514")
    await admin.from("dict_generated").delete().like("headword", `${prefix}%`)
  })

  it("keeps members and guests out of the AI meanings and the misses", async () => {
    const generated = await member.from("dict_generated").select("headword")
    expect(generated.error?.code).toBe("42501")
    const misses = await member.from("dict_misses").select("word")
    expect(misses.error?.code).toBe("42501")
    const guest = await anonClient().rpc("dict_note_miss", {
      p_word: missing,
    })
    expect(guest.error).not.toBeNull()
  })
})
