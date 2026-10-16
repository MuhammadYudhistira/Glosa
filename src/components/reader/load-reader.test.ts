import { isNotFound } from "@tanstack/react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BookLoadError } from "@/lib/book-download"
import { DEFAULT_READER_SETTINGS } from "@/lib/reader-settings"
import { loadReader } from "./load-reader"

const mocks = vi.hoisted(() => ({
  readingStateFn: vi.fn(),
  bookFileUrlFn: vi.fn(),
  getLocalBook: vi.fn(),
  saveLocalBook: vi.fn(),
  removeLocalBook: vi.fn(),
  getLocalPosition: vi.fn(),
  removeLocalPosition: vi.fn(),
  loadShelfSnapshot: vi.fn(),
  requestPersistence: vi.fn(),
}))
vi.mock("@/server/reading", () => ({
  readingStateFn: mocks.readingStateFn,
  bookFileUrlFn: mocks.bookFileUrlFn,
}))
vi.mock("@/lib/local/book-files", () => ({
  getLocalBook: mocks.getLocalBook,
  saveLocalBook: mocks.saveLocalBook,
  removeLocalBook: mocks.removeLocalBook,
}))
vi.mock("@/lib/local/positions", () => ({
  getLocalPosition: mocks.getLocalPosition,
  removeLocalPosition: mocks.removeLocalPosition,
}))
vi.mock("@/lib/local/shelf-snapshot", () => ({
  loadShelfSnapshot: mocks.loadShelfSnapshot,
}))
vi.mock("@/lib/local/device", () => ({
  requestPersistence: mocks.requestPersistence,
}))

const BOOK_ID = "0f9f5c1e-8a4b-4c2e-9d3a-1b2c3d4e5f60"
const book = { id: BOOK_ID, title: "Sherlock", author: "Doyle" }
const local = {
  cfi: "epubcfi(/6/4!/4/2)",
  percentage: 10,
  updatedAt: "2026-10-17T08:00:00.000Z",
}
const server = {
  cfi: "epubcfi(/6/8!/4/2)",
  percentage: 40,
  updatedAt: "2026-10-17T09:00:00.000Z",
}
const stored = new Blob(["epub"], { type: "application/epub+zip" })
const state = {
  ok: true,
  book,
  progress: server,
  settings: DEFAULT_READER_SETTINGS,
}
const fetchMock = vi.fn()

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.getLocalPosition.mockResolvedValue(local)
  mocks.saveLocalBook.mockResolvedValue(true)
  mocks.requestPersistence.mockResolvedValue(undefined)
  mocks.removeLocalBook.mockResolvedValue(undefined)
  mocks.removeLocalPosition.mockResolvedValue(undefined)
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("loadReader", () => {
  it("opens a stored copy without downloading it", async () => {
    mocks.getLocalBook.mockResolvedValue(stored)
    mocks.readingStateFn.mockResolvedValue(state)

    const data = await loadReader(BOOK_ID, "u1")
    expect(data).toMatchObject({
      book,
      local,
      server,
      online: true,
      saved: true,
    })
    expect(data.file).toBe(stored)
    expect(mocks.bookFileUrlFn).not.toHaveBeenCalled()
  })

  it("downloads, stores and keeps a book that is not on this device yet", async () => {
    mocks.getLocalBook.mockResolvedValue(null)
    mocks.readingStateFn.mockResolvedValue(state)
    mocks.bookFileUrlFn.mockResolvedValue({
      ok: true,
      url: "https://storage/a",
    })
    fetchMock.mockResolvedValue(new Response("epub", { status: 200 }))

    const data = await loadReader(BOOK_ID, "u1")
    expect(await data.file.text()).toBe("epub")
    expect(mocks.saveLocalBook).toHaveBeenCalledWith(BOOK_ID, data.file)
    expect(mocks.requestPersistence).toHaveBeenCalled()
    expect(data.saved).toBe(true)
  })

  it("asks for a fresh URL once when the download is refused", async () => {
    mocks.getLocalBook.mockResolvedValue(null)
    mocks.readingStateFn.mockResolvedValue(state)
    mocks.bookFileUrlFn
      .mockResolvedValueOnce({ ok: true, url: "https://storage/old" })
      .mockResolvedValueOnce({ ok: true, url: "https://storage/new" })
    fetchMock
      .mockResolvedValueOnce(new Response("expired", { status: 400 }))
      .mockResolvedValueOnce(new Response("epub", { status: 200 }))

    const data = await loadReader(BOOK_ID, "u1")
    expect(await data.file.text()).toBe("epub")
    expect(fetchMock).toHaveBeenLastCalledWith("https://storage/new")
  })

  it("gives up after the second refusal", async () => {
    mocks.getLocalBook.mockResolvedValue(null)
    mocks.readingStateFn.mockResolvedValue(state)
    mocks.bookFileUrlFn.mockResolvedValue({
      ok: true,
      url: "https://storage/a",
    })
    fetchMock.mockImplementation(
      async () => new Response("no", { status: 403 })
    )

    await expect(loadReader(BOOK_ID, "u1")).rejects.toEqual(
      new BookLoadError("download_failed")
    )
  })

  it("still reads a book that does not fit on the device", async () => {
    mocks.getLocalBook.mockResolvedValue(null)
    mocks.readingStateFn.mockResolvedValue(state)
    mocks.bookFileUrlFn.mockResolvedValue({
      ok: true,
      url: "https://storage/a",
    })
    fetchMock.mockResolvedValue(new Response("epub", { status: 200 }))
    mocks.saveLocalBook.mockResolvedValue(false)

    const data = await loadReader(BOOK_ID, "u1")
    expect(data.saved).toBe(false)
    expect(mocks.requestPersistence).not.toHaveBeenCalled()
  })

  it("opens a stored copy offline with the shelf snapshot's title", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    mocks.getLocalBook.mockResolvedValue(stored)
    mocks.loadShelfSnapshot.mockResolvedValue({
      books: [{ id: BOOK_ID, title: "Sherlock (salinan)", author: "Doyle" }],
      usage: { usedBytes: 0, limitBytes: 1, plan: "free" },
    })

    const data = await loadReader(BOOK_ID, "u1")
    expect(mocks.readingStateFn).not.toHaveBeenCalled()
    expect(data).toMatchObject({
      book: { id: BOOK_ID, title: "Sherlock (salinan)", author: "Doyle" },
      server: null,
      online: false,
    })
  })

  it("explains that an unsaved book needs a connection", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    mocks.getLocalBook.mockResolvedValue(null)

    await expect(loadReader(BOOK_ID, "u1")).rejects.toEqual(
      new BookLoadError("offline_not_saved")
    )
  })

  it("forgets this device's copy of a book deleted elsewhere", async () => {
    mocks.getLocalBook.mockResolvedValue(stored)
    mocks.readingStateFn.mockResolvedValue({ ok: false, code: "not_found" })

    const error: unknown = await loadReader(BOOK_ID, "u1").catch(
      (e: unknown) => e
    )
    expect(isNotFound(error)).toBe(true)
    expect(mocks.removeLocalBook).toHaveBeenCalledWith(BOOK_ID)
    expect(mocks.removeLocalPosition).toHaveBeenCalledWith(BOOK_ID)
  })

  it("reports a network failure during the download as a load error", async () => {
    mocks.getLocalBook.mockResolvedValue(null)
    mocks.readingStateFn.mockResolvedValue(state)
    mocks.bookFileUrlFn.mockResolvedValue({
      ok: true,
      url: "https://storage/a",
    })
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))

    await expect(loadReader(BOOK_ID, "u1")).rejects.toEqual(
      new BookLoadError("download_failed")
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
