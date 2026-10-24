import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  dictionaryFixture,
  fixturePrefix,
  removeDictionary,
  seedDictionary,
} from "./dictionary-fixture"
import {
  anonClient,
  createTestMember,
  deleteTestMembers,
  signedInClient,
} from "./helpers"

const email = `db-dict-${Date.now().toString(36)}@glosa.test`
type Client = Awaited<ReturnType<typeof signedInClient>>

describe("dictionary", () => {
  const fixture = dictionaryFixture(fixturePrefix())
  let member: Client

  beforeAll(async () => {
    await createTestMember({ email })
    member = await signedInClient(email)
    await seedDictionary(fixture)
  })

  afterAll(async () => {
    await removeDictionary(fixture)
    await deleteTestMembers()
  })

  const lookUp = (word: string, next: Array<string> = []) =>
    member.rpc("lookup_word", { p_word: word, p_next: next })

  it("finds a derived form's headword", async () => {
    const { data, error } = await lookUp(fixture.ran)
    expect(error).toBeNull()
    expect(data).toMatchObject({
      word: fixture.ran,
      entries: [
        {
          headword: fixture.run,
          pos: "verb",
          meanings: ["berlari", "menjalankan"],
        },
      ],
      phrases: [],
    })
  })

  it("names the dictionary it answers from", async () => {
    const { data } = await lookUp(fixture.ran)
    expect(data).toHaveProperty("version")
    // Null before the first import, else when the dictionary was imported.
    const meta = await member.from("dict_meta").select("imported_at")
    expect((data as { version: unknown }).version).toBe(
      meta.data?.[0]?.imported_at ?? null
    )
  })

  it("lists verbs before nouns", async () => {
    const { data } = await lookUp(fixture.run)
    expect(
      (data as { entries: Array<{ pos: string }> }).entries.map((e) => e.pos)
    ).toEqual(["verb", "noun"])
  })

  it("suggests the phrasal verbs that start here, longest first", async () => {
    const { data } = await lookUp(fixture.ran, ["up", "against"])
    expect((data as { phrases: unknown }).phrases).toEqual([
      { headword: fixture.runUpAgainst, meanings: ["menghadapi"] },
      { headword: fixture.runUp, meanings: ["menaikkan"] },
    ])
  })

  it("tries one particle when only one follows", async () => {
    const { data } = await lookUp(fixture.running, ["up"])
    expect((data as { phrases: unknown }).phrases).toEqual([
      { headword: fixture.runUp, meanings: ["menaikkan"] },
    ])
  })

  it("answers nothing for a word over 64 characters or more than two next words", async () => {
    const long = await lookUp("a".repeat(65))
    expect(long.data).toMatchObject({ entries: [], phrases: [] })
    const many = await lookUp(fixture.run, ["up", "against", "it"])
    expect(many.data).toMatchObject({ entries: [], phrases: [] })
  })

  it("lets members read the dictionary but not change it", async () => {
    const { data } = await member
      .from("dict_entries")
      .select("pos")
      .eq("headword", fixture.run)
    expect(data).toHaveLength(2)
    const insert = await member
      .from("dict_entries")
      .insert({ headword: `${fixture.run}x`, pos: "noun", meanings: ["x"] })
    expect(insert.error?.code).toBe("42501")
    const reset = await member.rpc("dict_staging_reset")
    expect(reset.error?.code).toBe("42501")
    const swap = await member.rpc("dict_swap", { p_source: "test" })
    expect(swap.error?.code).toBe("42501")
  })

  it("keeps guests out", async () => {
    const anon = anonClient()
    const read = await anon.from("dict_entries").select("headword").limit(1)
    expect(read.error).not.toBeNull()
    const lookup = await anon.rpc("lookup_word", {
      p_word: fixture.run,
      p_next: [],
    })
    expect(lookup.error).not.toBeNull()
  })
})
