import "fake-indexeddb/auto"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearLocalData } from "@/lib/local/device"
import { localDb } from "@/lib/local/db"
import { loadVocabCache } from "@/lib/local/vocab-store"
import {
  queueSectionRead,
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
const words = vi.hoisted(() => ({ listLocalWords: vi.fn() }))
vi.mock("@/lib/local/saved-words", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listLocalWords: words.listLocalWords,
}))

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
    words.listLocalWords.mockResolvedValue([])
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

  it("queues meetings of saved words, not in the section they were saved", async () => {
    words.listLocalWords.mockResolvedValue([
      { headword: "run", bookId: BOOK, cfi: "epubcfi(/6/6!/4/2/1:0)" },
      { headword: "mat", bookId: null, cfi: null },
    ])
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
    expect(sent).toEqual(
      expect.arrayContaining([
        { bookId: BOOK, headword: "mat", section: 2, count: 1 },
        { bookId: BOOK, headword: "run", section: 3, count: 1 },
        { bookId: BOOK, headword: "mat", section: 3, count: 1 },
      ])
    )
    expect(sent).toHaveLength(3) // "run" in section 2 is where it was saved
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
})
