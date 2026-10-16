// @vitest-environment node
import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShelfData } from "@/lib/book-types"
import {
  getLocalBook,
  localBookIds,
  removeLocalBook,
  saveLocalBook,
} from "./book-files"
import { localDb } from "./db"
import { claimLocalData, clearLocalData } from "./device"
import {
  getLocalPosition,
  localPercentages,
  localPositionStore,
} from "./positions"
import { loadShelfSnapshot, saveShelfSnapshot } from "./shelf-snapshot"

const epub = (text: string) =>
  new Blob([text], { type: "application/epub+zip" })
const quotaError = () =>
  Object.assign(new Error("full"), { name: "QuotaExceededError" })
const entry = (bookId: string, updatedAt: string) => ({
  bookId,
  cfi: "epubcfi(/6/4!/4/2)",
  percentage: 12.5,
  updatedAt,
})
const shelf: ShelfData = {
  books: [],
  usage: { usedBytes: 0, limitBytes: 104857600, plan: "free" },
}

beforeEach(async () => {
  await clearLocalData()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("local books", () => {
  it("saves, reads and removes a book copy", async () => {
    expect(await saveLocalBook("a", epub("isi a"), 1)).toBe(true)
    const blob = await getLocalBook("a", 5)
    expect(await blob?.text()).toBe("isi a")
    expect((await localDb().files.get("a"))?.openedAt).toBe(5)
    expect(await localBookIds()).toEqual(new Set(["a"]))

    await removeLocalBook("a")
    expect(await getLocalBook("a")).toBeNull()
  })

  it("makes room by dropping the copy opened longest ago", async () => {
    await saveLocalBook("a", epub("a"), 1)
    await saveLocalBook("b", epub("b"), 2)
    await saveLocalBook("c", epub("c"), 3)
    await getLocalBook("a", 10)

    vi.spyOn(localDb().files, "put").mockRejectedValueOnce(quotaError())
    expect(await saveLocalBook("d", epub("d"), 11)).toBe(true)
    expect(await localBookIds()).toEqual(new Set(["a", "c", "d"]))
  })

  it("gives up when nothing else can be dropped", async () => {
    vi.spyOn(localDb().files, "put").mockRejectedValue(quotaError())
    expect(await saveLocalBook("a", epub("a"))).toBe(false)
  })

  it("rethrows other storage errors", async () => {
    vi.spyOn(localDb().files, "put").mockRejectedValueOnce(new Error("rusak"))
    await expect(saveLocalBook("a", epub("a"))).rejects.toThrow("rusak")
  })
})

describe("local positions", () => {
  it("keeps the latest position per book until it is synced", async () => {
    await localPositionStore.put(entry("a", "2026-10-17T08:00:00.000Z"))
    await localPositionStore.put(entry("a", "2026-10-17T08:05:00.000Z"))
    await localPositionStore.put(entry("b", "2026-10-17T08:01:00.000Z"))
    expect(await localPositionStore.pending()).toHaveLength(2)
    expect(await getLocalPosition("a")).toEqual({
      cfi: "epubcfi(/6/4!/4/2)",
      percentage: 12.5,
      updatedAt: "2026-10-17T08:05:00.000Z",
    })
    expect(await localPercentages()).toEqual(
      new Map([
        ["a", 12.5],
        ["b", 12.5],
      ])
    )

    await localPositionStore.markSynced([
      entry("a", "2026-10-17T08:05:00.000Z"),
      entry("b", "2026-10-17T07:00:00.000Z"),
    ])
    const pending = await localPositionStore.pending()
    expect(pending.map((row) => row.bookId)).toEqual(["b"])
  })
})

describe("shelf snapshot and device owner", () => {
  it("returns the snapshot only to the member it belongs to", async () => {
    await saveShelfSnapshot("u1", shelf)
    expect(await loadShelfSnapshot("u1")).toEqual(shelf)
    expect(await loadShelfSnapshot("u2")).toBeNull()
  })

  it("wipes another member's copies when a new member claims the device", async () => {
    await claimLocalData("u1")
    await saveLocalBook("a", epub("a"))
    await saveShelfSnapshot("u1", shelf)

    await claimLocalData("u1")
    expect(await localBookIds()).toEqual(new Set(["a"]))

    await claimLocalData("u2")
    expect(await localBookIds()).toEqual(new Set())
    expect(await loadShelfSnapshot("u1")).toBeNull()
  })
})
