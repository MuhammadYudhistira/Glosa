import { adminClient } from "./helpers"

/**
 * Letters only (headwords hold no digits) and new on every run: the dev
 * project holds the real dictionary as well, so tests add and remove only
 * their own words and never swap the dictionary.
 */
export function fixturePrefix(): string {
  const run = Date.now()
    .toString(36)
    .replace(/\d/g, (digit) => "abcdefghij"[Number(digit)])
  return `qz${run}`
}

/** A few made-up words with a derived form and two phrasal verbs (spec 2 §10). */
export function dictionaryFixture(prefix: string) {
  const run = `${prefix}run`
  const ran = `${prefix}ran`
  const running = `${prefix}running`
  const fast = `${prefix}fast`
  const runUp = `${run} up`
  const runUpAgainst = `${run} up against`
  return {
    run,
    ran,
    running,
    fast,
    runUp,
    runUpAgainst,
    entries: [
      { headword: run, pos: "noun", meanings: ["lari"] },
      { headword: run, pos: "verb", meanings: ["berlari", "menjalankan"] },
      { headword: runUp, pos: "verb", meanings: ["menaikkan"] },
      { headword: runUpAgainst, pos: "verb", meanings: ["menghadapi"] },
      { headword: fast, pos: "adj", meanings: ["cepat"] },
    ],
    forms: [
      { form: run, headword: run, pos: "noun" },
      { form: run, headword: run, pos: "verb" },
      { form: ran, headword: run, pos: "verb" },
      { form: running, headword: run, pos: "verb" },
      { form: runUp, headword: runUp, pos: "verb" },
      { form: `${ran} up`, headword: runUp, pos: "verb" },
      { form: runUpAgainst, headword: runUpAgainst, pos: "verb" },
      { form: fast, headword: fast, pos: "adj" },
    ],
  }
}

export type DictionaryFixture = ReturnType<typeof dictionaryFixture>

export async function seedDictionary(fixture: DictionaryFixture) {
  const admin = adminClient()
  const { error } = await admin.from("dict_entries").insert(fixture.entries)
  if (error) throw error
  const { error: formsError } = await admin
    .from("dict_forms")
    .insert(fixture.forms)
  if (formsError) throw formsError
}

/** Its forms go with the entries (on delete cascade). */
export async function removeDictionary(fixture: DictionaryFixture) {
  const headwords = [...new Set(fixture.entries.map((e) => e.headword))]
  const { error } = await adminClient()
    .from("dict_entries")
    .delete()
    .in("headword", headwords)
  if (error) throw error
}
