// @vitest-environment node
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import type { Annotation } from "@/lib/annotations/types"
import {
  bookAnnotations,
  localAnnotationStore,
  mergeServerAnnotations,
  removeLocalAnnotations,
} from "./annotations"
import { localDb } from "./db"
import { clearLocalData } from "./device"

const BOOK = "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e"
const OTHER_BOOK = "7d6c5b4a-3f2e-4d1c-8b0a-1f2e3d4c5b6a"
const time = (minute: number) =>
  new Date(Date.UTC(2026, 9, 24, 8, minute)).toISOString()

const highlight = (
  id: string,
  minute = 0,
  changes: Partial<Annotation> = {}
): Annotation => ({
  id,
  bookId: BOOK,
  kind: "highlight",
  cfi: `epubcfi(/6/4!/4/${id.length * 2})`,
  color: "yellow",
  note: "",
  excerpt: `Teks ${id}`,
  createdAt: time(0),
  updatedAt: time(minute),
  deletedAt: null,
  ...changes,
})

const ids = async () => (await bookAnnotations(BOOK)).map((a) => a.id)

beforeEach(async () => {
  await clearLocalData()
})

describe("annotations on this device", () => {
  it("shows a change at once and queues it, oldest first", async () => {
    await localAnnotationStore.put(highlight("b", 2))
    await localAnnotationStore.put(highlight("a", 1))
    expect((await ids()).sort()).toEqual(["a", "b"])
    expect((await localAnnotationStore.pending()).map((a) => a.id)).toEqual([
      "a",
      "b",
    ])
  })

  it("lists a book's annotations without tombstones or other books", async () => {
    await localAnnotationStore.put(highlight("a"))
    await localAnnotationStore.put(highlight("b", 1, { deletedAt: time(1) }))
    await localAnnotationStore.put(highlight("c", 0, { bookId: OTHER_BOOK }))
    expect(await ids()).toEqual(["a"])
  })

  it("confirms only the change that was sent", async () => {
    const sent = highlight("a", 1)
    await localAnnotationStore.put(sent)
    await localAnnotationStore.put(highlight("a", 2, { color: "green" }))
    await localAnnotationStore.confirm([sent])
    expect((await localAnnotationStore.pending()).map((a) => a.color)).toEqual([
      "green",
    ])

    await localAnnotationStore.confirm([highlight("a", 2, { color: "green" })])
    expect(await localAnnotationStore.pending()).toEqual([])
    expect(await ids()).toEqual(["a"])
  })

  it("takes back a refused change unless it changed again", async () => {
    const refused = highlight("a", 1)
    await localAnnotationStore.put(refused)
    await localAnnotationStore.revert(refused)
    expect(await ids()).toEqual([])

    await localAnnotationStore.put(highlight("b", 1))
    await localAnnotationStore.put(highlight("b", 2))
    await localAnnotationStore.revert(highlight("b", 1))
    expect(await ids()).toEqual(["b"])
  })

  it("takes the server's list, keeping newer changes still waiting here", async () => {
    // Waiting here and newer than the server's: stays.
    await localAnnotationStore.put(highlight("mine", 5, { color: "pink" }))
    // Waiting here but older than the server's: the server's wins.
    await localAnnotationStore.put(highlight("theirs", 1, { color: "pink" }))
    // On this device only, already sent, and gone from the server: leaves.
    await localAnnotationStore.put(highlight("gone", 1))
    await localAnnotationStore.confirm([highlight("gone", 1)])

    await mergeServerAnnotations(BOOK, [
      highlight("mine", 2),
      highlight("theirs", 3, { color: "blue" }),
      highlight("new", 1),
    ])

    const byId = new Map(
      (await bookAnnotations(BOOK)).map((a) => [a.id, a.color])
    )
    expect(Object.fromEntries(byId)).toEqual({
      mine: "pink",
      theirs: "blue",
      new: "yellow",
    })
    expect((await localAnnotationStore.pending()).map((a) => a.id)).toEqual([
      "mine",
    ])
  })

  it("keeps an offline creation the server has not seen, and other books' rows", async () => {
    // Created offline: waiting here, absent from the server's list.
    await localAnnotationStore.put(highlight("offline", 1))
    await localAnnotationStore.put(
      highlight("elsewhere", 1, { bookId: OTHER_BOOK })
    )

    await mergeServerAnnotations(BOOK, [highlight("server", 1)])

    expect((await ids()).sort()).toEqual(["offline", "server"])
    expect(
      (await localAnnotationStore.pending()).map((a) => a.id).sort()
    ).toEqual(["elsewhere", "offline"])
    expect(await localDb().annotations.get("elsewhere")).toBeDefined()
  })

  it("takes a server tombstone over an older waiting change", async () => {
    await localAnnotationStore.put(highlight("a", 1))
    await mergeServerAnnotations(BOOK, [
      highlight("a", 3, { deletedAt: time(3) }),
    ])
    expect(await ids()).toEqual([])
    expect(await localAnnotationStore.pending()).toEqual([])
  })

  it("compares the server's times as times, not as text", async () => {
    await localAnnotationStore.put(highlight("a", 5, { color: "pink" }))
    // The same moment as minute 5, written the way Postgres writes it.
    const server = highlight("a", 0, {
      color: "blue",
      updatedAt: "2026-10-24T08:05:00.000001+00:00",
    })
    await mergeServerAnnotations(BOOK, [server])
    expect((await bookAnnotations(BOOK))[0].color).toBe("blue")
  })

  it("forgets a deleted book's annotations, and everything on sign-out", async () => {
    await localAnnotationStore.put(highlight("a"))
    await localAnnotationStore.put(highlight("b", 0, { bookId: OTHER_BOOK }))
    await removeLocalAnnotations(BOOK)
    expect(await ids()).toEqual([])
    expect(await localDb().annotations.count()).toBe(1)

    await clearLocalData()
    expect(await localDb().annotations.count()).toBe(0)
  })
})
