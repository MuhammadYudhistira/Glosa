import { admin } from "./members"

/**
 * A made-up headword, lower-case letters only and new on every call: the dev
 * dictionary is shared, so a test adds and removes only its own words (like
 * tests/db/dictionary-fixture.ts) and never swaps the dictionary.
 */
export function testWord(): string {
  const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
  return `qe${run.replace(/\d/g, (digit) => "abcdefghij"[Number(digit)])}`
}

export async function seedWord(entry: {
  headword: string
  pos: string
  meanings: Array<string>
  source: "wiktionary" | "wordnet" | "ai"
}) {
  const client = admin()
  const { error } = await client.from("dict_entries").insert(entry)
  if (error) throw error
  const { error: formError } = await client
    .from("dict_forms")
    .insert({ form: entry.headword, headword: entry.headword, pos: entry.pos })
  if (formError) throw formError
}

/** Its form goes with it (on delete cascade). */
export async function removeWord(headword: string) {
  const { error } = await admin()
    .from("dict_entries")
    .delete()
    .eq("headword", headword)
  if (error) throw error
}
