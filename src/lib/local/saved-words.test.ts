// @vitest-environment node
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import type { SavedWord } from "@/lib/words/types"
import { localDb } from "./db"
import { clearLocalData } from "./device"
import {
  listLocalWords,
  loadSavedForms,
  localWordStore,
  replaceLocalWords,
  saveSavedForms,
} from "./saved-words"

const headwords = async () =>
  (await listLocalWords()).map((saved) => saved.headword)

const word = (headword: string, minute = 0): SavedWord => ({
  headword,
  pos: "verb",
  meanings: ["arti"],
  bookId: null,
  bookTitle: "Buku Uji",
  sentence: `Kalimat dengan ${headword}.`,
  cfi: null,
  createdAt: new Date(Date.UTC(2026, 9, 24, 8, minute)).toISOString(),
})

beforeEach(async () => {
  await clearLocalData()
})

describe("Kosakata on this device", () => {
  it("shows a saved word at once and queues it", async () => {
    await localWordStore.save(word("run"), ["ran"])
    expect(await headwords()).toEqual(["run"])
    expect(await loadSavedForms()).toEqual({ run: ["run", "ran"] })
    const pending = await localWordStore.pending()
    expect(pending.map(({ headword, kind }) => [headword, kind])).toEqual([
      ["run", "save"],
    ])
  })

  it("keeps one waiting change per word, the latest", async () => {
    await localWordStore.save(word("run"), [])
    await localWordStore.remove("run")
    expect(await listLocalWords()).toEqual([])
    expect(await loadSavedForms()).toEqual({})
    const pending = await localWordStore.pending()
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({ headword: "run", kind: "delete" })
  })

  it("keeps a change made after the batch was sent", async () => {
    await localWordStore.save(word("run"), [])
    const sent = await localWordStore.pending()
    await localWordStore.remove("run")
    await localWordStore.confirm(sent)
    expect((await localWordStore.pending()).map((op) => op.kind)).toEqual([
      "delete",
    ])
    await localWordStore.confirm(await localWordStore.pending())
    expect(await localWordStore.pending()).toEqual([])
  })

  it("takes back a refused save, unless the word changed again", async () => {
    await localWordStore.save(word("run"), [])
    const [op] = await localWordStore.pending()
    await localWordStore.confirm([op])
    await localWordStore.revert(op)
    expect(await listLocalWords()).toEqual([])
    expect(await loadSavedForms()).toEqual({})

    await localWordStore.save(word("walk"), [])
    const [first] = await localWordStore.pending()
    await localWordStore.save(word("walk", 1), [])
    await localWordStore.revert(first)
    expect(await headwords()).toEqual(["walk"])
  })

  it("lays this device's waiting changes over the server's list", async () => {
    await localWordStore.save(word("new", 3), [])
    await localWordStore.remove("gone")
    await replaceLocalWords([word("gone", 1), word("kept", 2)])
    expect((await listLocalWords()).map((w) => w.headword)).toEqual([
      "new",
      "kept",
    ])
  })

  it("keeps the server's forms, with waiting changes laid over them", async () => {
    await localWordStore.save(word("new"), ["newer"])
    await localWordStore.remove("gone")
    await saveSavedForms({ gone: ["gone", "went"], kept: ["kept"] })
    expect(await loadSavedForms()).toEqual({
      kept: ["kept"],
      new: ["new", "newer"],
    })
  })

  it("is cleared with the member's data", async () => {
    await localWordStore.save(word("run"), [])
    await clearLocalData()
    expect(await localDb().words.count()).toBe(0)
    expect(await localDb().wordOps.count()).toBe(0)
    expect(await loadSavedForms()).toEqual({})
  })
})
