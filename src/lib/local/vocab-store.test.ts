// @vitest-environment node
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import { localDb } from "./db"
import {
  SECTION_READ_MS,
  addSectionTime,
  loadVocabCache,
  meetStore,
  queueMeetings,
  queueTap,
  queueWordsRead,
  saveVocabCache,
  tapStore,
  wordsReadStore,
} from "./vocab-store"

const BOOK = "00000000-0000-4000-8000-000000000001"

describe("vocab store", () => {
  beforeEach(async () => {
    const db = localDb()
    await Promise.all([db.sectionTime.clear(), db.vocabQueue.clear(), db.meta.clear()])
  })

  it("says a section is read once, when its time reaches 60 s across visits", async () => {
    expect(SECTION_READ_MS).toBe(60_000)
    expect(await addSectionTime(BOOK, 2, 40_000)).toBe(false)
    expect(await addSectionTime(BOOK, 2, 19_999)).toBe(false)
    expect(await addSectionTime(BOOK, 2, 1)).toBe(true)
    expect(await addSectionTime(BOOK, 2, 90_000)).toBe(false)
    expect(await addSectionTime(BOOK, 3, 60_000)).toBe(true)
  })

  it("adds taps on the same word and takes off only what was sent", async () => {
    await queueTap(BOOK, "mat", "2026-11-06T10:00:00.000Z")
    await queueTap(BOOK, "mat", "2026-11-06T10:01:00.000Z")
    const [sent] = await tapStore.pending()
    expect(sent).toMatchObject({ word: "mat", taps: 2, at: "2026-11-06T10:01:00.000Z" })
    await queueTap(BOOK, "mat", "2026-11-06T10:02:00.000Z") // while in flight
    await tapStore.confirm([sent])
    expect(await tapStore.pending()).toMatchObject([{ word: "mat", taps: 1 }])
    const [last] = await tapStore.pending()
    await tapStore.confirm([last])
    expect(await tapStore.pending()).toEqual([])
  })

  it("keeps the most meetings and drops them once sent unchanged", async () => {
    await queueMeetings(BOOK, 4, [{ headword: "run", count: 2 }])
    await queueMeetings(BOOK, 4, [{ headword: "run", count: 1 }])
    const pending = await meetStore.pending()
    expect(pending).toMatchObject([{ headword: "run", section: 4, count: 2 }])
    await queueMeetings(BOOK, 4, [{ headword: "run", count: 5 }])
    await meetStore.confirm(pending)
    expect(await meetStore.pending()).toMatchObject([{ count: 5 }])
  })

  it("queues a section's parts in order and drops them once sent", async () => {
    await queueWordsRead(BOOK, 1, [["a", "b"], ["c"]])
    const pending = await wordsReadStore.pending()
    expect(pending.map(({ part, last, words }) => [part, last, words])).toEqual([
      [0, false, ["a", "b"]],
      [1, true, ["c"]],
    ])
    await wordsReadStore.confirm(pending.slice(0, 1))
    expect(await wordsReadStore.pending()).toHaveLength(1)
    await wordsReadStore.revert(pending[1])
    expect(await wordsReadStore.pending()).toEqual([])
  })

  it("keeps the last summaries", async () => {
    expect(await loadVocabCache()).toBeNull()
    const cache = { books: { [BOOK]: { read: 300, lookedUp: 4 } }, meetings: {} }
    await saveVocabCache(cache)
    expect(await loadVocabCache()).toEqual(cache)
  })
})
