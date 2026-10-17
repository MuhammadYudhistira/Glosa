import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BookLoadError } from "./book-download"
import type { ShelfData } from "./book-types"
import { loadShelf } from "./shelf-loader"

const mocks = vi.hoisted(() => ({
  listBooksFn: vi.fn(),
  loadShelfSnapshot: vi.fn(),
}))
vi.mock("@/server/books", () => ({ listBooksFn: mocks.listBooksFn }))
vi.mock("@/server/reading", () => ({ bookFileUrlFn: vi.fn() }))
vi.mock("@/lib/local/shelf-snapshot", () => ({
  loadShelfSnapshot: mocks.loadShelfSnapshot,
}))

const shelf: ShelfData = {
  books: [],
  usage: { usedBytes: 0, limitBytes: 104857600, plan: "free" },
}

beforeEach(() => {
  mocks.listBooksFn.mockReset()
  mocks.loadShelfSnapshot.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("loadShelf", () => {
  it("reads the shelf from the server when online", async () => {
    mocks.listBooksFn.mockResolvedValue(shelf)
    expect(await loadShelf("u1")).toEqual({ ...shelf, offline: false })
    expect(mocks.loadShelfSnapshot).not.toHaveBeenCalled()
  })

  it("shows the last saved shelf when the device is offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    mocks.loadShelfSnapshot.mockResolvedValue(shelf)
    expect(await loadShelf("u1")).toEqual({ ...shelf, offline: true })
    expect(mocks.listBooksFn).not.toHaveBeenCalled()
    expect(mocks.loadShelfSnapshot).toHaveBeenCalledWith("u1")
  })

  it("falls back to the saved shelf when the server cannot be reached", async () => {
    mocks.listBooksFn.mockRejectedValue(new TypeError("Failed to fetch"))
    mocks.loadShelfSnapshot.mockResolvedValue(shelf)
    expect(await loadShelf("u1")).toEqual({ ...shelf, offline: true })
  })

  it("rethrows other server errors", async () => {
    mocks.listBooksFn.mockRejectedValue(new Error("rusak"))
    await expect(loadShelf("u1")).rejects.toThrow("rusak")
  })

  it("explains when no shelf was saved on this device", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    mocks.loadShelfSnapshot.mockResolvedValue(null)
    await expect(loadShelf("u1")).rejects.toEqual(
      new BookLoadError("offline_no_shelf")
    )
  })
})
