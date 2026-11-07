import "fake-indexeddb/auto"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearLocalData } from "@/lib/local/device"
import { localDb } from "@/lib/local/db"
import { dueSections, loadVocabCache } from "@/lib/local/vocab-store"
import {
  addSectionReading,
  dropWordMeetings,
  queueSectionRead,
  readDueSections,
  recordTap,
  refreshVocab,
  useBookVocab,
  useWordMeetings,
  vocabStateForTests,
} from "./vocab-client"

const server = vi.hoisted(() => ({
  recordWordsReadFn: vi.fn(),
  recordLookupsFn: vi.fn(),
  recordMeetingsFn: vi.fn(),
  loadVocabFn: vi.fn(),
  loadBookVocabFn: vi.fn(),
}))
vi.mock("@/server/vocab", () => server)

const BOOK = "00000000-0000-4000-8000-000000000001"
const ok = (n: number) =>
  Promise.resolve({ ok: true, results: Array<"ok">(n).fill("ok") })

describe("vocab client", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    })
    server.recordWordsReadFn.mockImplementation(({ data }) => ok(data.length))
    server.recordLookupsFn.mockImplementation(({ data }) => ok(data.length))
    server.recordMeetingsFn.mockImplementation(({ data }) => ok(data.length))
    await clearLocalData()
  })

  it("sends taps and section words before loading the numbers", async () => {
    await recordTap(BOOK, "Mat")
    await queueSectionRead(BOOK, 2, "The cat sat on the mat.", {})
    server.loadVocabFn.mockResolvedValue({
      ok: true,
      cache: { books: { [BOOK]: { read: 300, lookedUp: 1 } }, meetings: {} },
    })
    await refreshVocab()
    expect(server.recordLookupsFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ bookId: BOOK, word: "mat", taps: 1 })],
      })
    )
    expect(server.recordWordsReadFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          {
            bookId: BOOK,
            section: 2,
            words: ["cat", "mat", "on", "sat", "the"],
            last: true,
          },
        ],
      })
    )
    expect(server.loadVocabFn.mock.invocationCallOrder[0]).toBeGreaterThan(
      server.recordWordsReadFn.mock.invocationCallOrder[0]
    )
    expect(await loadVocabCache()).toEqual({
      books: { [BOOK]: { read: 300, lookedUp: 1 } },
      meetings: {},
    })
    expect(await localDb().vocabQueue.count()).toBe(0)
  })

  it("queues meetings of every saved word, leaving the saved section to the server", async () => {
    const forms = { run: ["run", "ran"], mat: ["mat"] }
    await queueSectionRead(BOOK, 2, "He ran to the mat and ran back.", forms)
    await queueSectionRead(BOOK, 3, "A mat. They run.", forms)
    server.loadVocabFn.mockResolvedValue({
      ok: true,
      cache: { books: {}, meetings: {} },
    })
    await refreshVocab()
    const sent = server.recordMeetingsFn.mock.calls.flatMap(
      ([{ data }]) => data
    )
    expect(sent).toHaveLength(4)
    expect(sent).toEqual(
      expect.arrayContaining([
        { bookId: BOOK, headword: "run", section: 2, count: 2 },
        { bookId: BOOK, headword: "mat", section: 2, count: 1 },
        { bookId: BOOK, headword: "run", section: 3, count: 1 },
        { bookId: BOOK, headword: "mat", section: 3, count: 1 },
      ])
    )
  })

  describe("sections read", () => {
    const source = (text: string | null) => ({
      sectionText: vi.fn().mockResolvedValue(text),
    })
    const NO_FORMS = {}

    it("queues a due section's words and marks it done", async () => {
      expect(await addSectionReading(BOOK, 4, 61_000)).toBe(true)
      const view = source("The cat sat.")
      await readDueSections(
        BOOK,
        () => view,
        () => NO_FORMS
      )
      expect(view.sectionText).toHaveBeenCalledWith(4)
      expect(await dueSections(BOOK)).toEqual([])
      expect(await localDb().vocabQueue.count()).toBe(1)
    })

    it("keeps a section due when there is no view, or the view goes", async () => {
      await addSectionReading(BOOK, 4, 61_000)
      await readDueSections(
        BOOK,
        () => null,
        () => NO_FORMS
      )
      expect(await dueSections(BOOK)).toEqual([4])
      let alive: typeof gone | null = null
      const gone = { sectionText: vi.fn().mockResolvedValue(null) }
      alive = gone
      gone.sectionText.mockImplementation(() => {
        alive = null // the view closes while the text is read
        return Promise.resolve(null)
      })
      await readDueSections(
        BOOK,
        () => alive,
        () => NO_FORMS
      )
      expect(await dueSections(BOOK)).toEqual([4])
      const throwing = {
        sectionText: vi.fn().mockRejectedValue(new Error("closed")),
      }
      await readDueSections(
        BOOK,
        () => throwing,
        () => NO_FORMS
      )
      expect(await dueSections(BOOK)).toEqual([4])
      expect(await localDb().vocabQueue.count()).toBe(0)
    })

    it("takes up the sections left due when the view is ready", async () => {
      await addSectionReading(BOOK, 1, 60_000)
      await addSectionReading(BOOK, 6, 70_000)
      await addSectionReading(BOOK, 7, 10_000)
      const view = source("Some words here.")
      await readDueSections(
        BOOK,
        () => view,
        () => NO_FORMS
      )
      expect(view.sectionText.mock.calls).toEqual([[1], [6]])
      expect(await dueSections(BOOK)).toEqual([])
    })

    it("marks a section done when its text is null while the view is alive", async () => {
      await addSectionReading(BOOK, 4, 61_000)
      const view = source(null)
      await readDueSections(
        BOOK,
        () => view,
        () => NO_FORMS
      )
      expect(await dueSections(BOOK)).toEqual([])
      expect(await localDb().vocabQueue.count()).toBe(0)
    })
  })

  it("shows a book's numbers and the meetings from the cache", async () => {
    server.loadVocabFn.mockResolvedValue({
      ok: true,
      cache: {
        books: { [BOOK]: { read: 850, lookedUp: 34 } },
        meetings: { run: { meetings: 7, books: 3 } },
      },
    })
    const book = renderHook(() => useBookVocab(BOOK))
    const meetings = renderHook(() => useWordMeetings())
    await act(() => refreshVocab())
    expect(book.result.current).toEqual({ read: 850, lookedUp: 34 })
    expect(meetings.result.current).toEqual({ run: { meetings: 7, books: 3 } })
  })

  it("keeps the last numbers when loading fails, and forgets them on a wipe", async () => {
    server.loadVocabFn.mockResolvedValueOnce({
      ok: true,
      cache: { books: { [BOOK]: { read: 300, lookedUp: 0 } }, meetings: {} },
    })
    await refreshVocab()
    server.loadVocabFn.mockResolvedValueOnce({ ok: false, code: "unknown" })
    await refreshVocab()
    expect(vocabStateForTests().cache?.books[BOOK]).toEqual({
      read: 300,
      lookedUp: 0,
    })
    await clearLocalData()
    expect(vocabStateForTests().cache).toBeNull()
  })

  it("drops a deleted word's meetings from the numbers at once", async () => {
    server.loadVocabFn.mockResolvedValue({
      ok: true,
      cache: {
        books: {},
        meetings: {
          run: { meetings: 7, books: 3 },
          mat: { meetings: 1, books: 1 },
        },
      },
    })
    await refreshVocab()
    await dropWordMeetings("run")
    expect(vocabStateForTests().cache?.meetings).toEqual({
      mat: { meetings: 1, books: 1 },
    })
    expect((await loadVocabCache())?.meetings).toEqual({
      mat: { meetings: 1, books: 1 },
    })
  })

  it("does not load the numbers while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    })
    await refreshVocab()
    expect(server.loadVocabFn).not.toHaveBeenCalled()
  })
})
