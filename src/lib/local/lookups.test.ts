// @vitest-environment node
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import type { LookupResult } from "@/lib/words/types"
import { localDb } from "./db"
import { clearLocalData } from "./device"
import { getCachedLookup, getCachedWord, putCachedLookup } from "./lookups"

const result = (word: string, phrase = false): LookupResult => ({
  word,
  entries: [{ headword: word, pos: "verb", meanings: ["arti"] }],
  phrases: phrase ? [{ headword: `${word} up`, meanings: ["frasa"] }] : [],
})

beforeEach(async () => {
  await clearLocalData()
})

describe("lookup cache", () => {
  it("answers a word with the same next words, and marks it used", async () => {
    await putCachedLookup("gave", ["up"], result("gave", true), 1)
    expect(await getCachedLookup("gave", ["up"], 5)).toEqual(
      result("gave", true)
    )
    expect(await getCachedLookup("gave", ["in"])).toBeNull()
    expect((await localDb().lookups.get("gave up"))?.usedAt).toBe(5)
  })

  it("offers any lookup of the word for offline, without its phrases", async () => {
    await putCachedLookup("gave", ["up"], result("gave", true), 1)
    expect(await getCachedWord("gave")).toEqual(result("gave"))
    expect(await getCachedWord("took")).toBeNull()
  })

  it("keeps at most the limit, dropping the least recently used", async () => {
    await putCachedLookup("a", [], result("a"), 1, 2)
    await putCachedLookup("b", [], result("b"), 2, 2)
    await getCachedLookup("a", [], 3)
    await putCachedLookup("c", [], result("c"), 4, 2)
    expect(
      (await localDb().lookups.toCollection().primaryKeys()).sort()
    ).toEqual(["a", "c"])
  })

  it("is cleared with the member's data", async () => {
    await putCachedLookup("a", [], result("a"), 1)
    await clearLocalData()
    expect(await localDb().lookups.count()).toBe(0)
  })
})
