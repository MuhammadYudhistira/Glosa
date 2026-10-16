import { describe, expect, it } from "vitest"
import {
  type UploadAction,
  type UploadItem,
  canRetry,
  queueSummary,
  readyItems,
  uploadQueueReducer,
  uploadStatusText,
} from "./upload-queue"

const run = (actions: Array<UploadAction>) =>
  actions.reduce(uploadQueueReducer, [] as Array<UploadItem>)
const added: UploadAction = {
  type: "added",
  files: [
    { id: "a", fileName: "a.epub" },
    { id: "b", fileName: "b.epub" },
  ],
}

describe("uploadQueueReducer", () => {
  it("adds files as reading, then ready with the guessed genre", () => {
    const items = run([
      added,
      {
        type: "read",
        id: "a",
        title: "Sherlock",
        author: "Doyle",
        suggestedGenre: "misteri_thriller",
      },
    ])
    expect(items[0]).toMatchObject({
      status: "ready",
      title: "Sherlock",
      genre: "misteri_thriller",
      genreSource: "auto",
    })
    expect(items[1]).toMatchObject({ status: "reading", genre: null })
    expect(readyItems(items).map((item) => item.id)).toEqual(["a"])
  })

  it("marks a changed genre as chosen by the member, and back to auto", () => {
    const base: Array<UploadAction> = [
      added,
      {
        type: "read",
        id: "a",
        title: "S",
        author: "",
        suggestedGenre: "misteri_thriller",
      },
    ]
    expect(
      run([
        ...base,
        { type: "genre_chosen", id: "a", genre: "fiksi_sastra" },
      ])[0]
    ).toMatchObject({
      genre: "fiksi_sastra",
      genreSource: "user",
    })
    expect(
      run([
        ...base,
        { type: "genre_chosen", id: "a", genre: "fiksi_sastra" },
        { type: "genre_chosen", id: "a", genre: "misteri_thriller" },
      ])[0]
    ).toMatchObject({ genre: "misteri_thriller", genreSource: "auto" })
    expect(
      run([...base, { type: "genre_chosen", id: "a", genre: null }])[0]
    ).toMatchObject({
      genre: null,
      genreSource: null,
    })
  })

  it("tracks an upload from start to finish", () => {
    const base: Array<UploadAction> = [
      added,
      { type: "read", id: "a", title: "S", author: "", suggestedGenre: null },
      { type: "started", id: "a" },
      { type: "progressed", id: "a", progress: 0.4 },
    ]
    expect(run(base)[0]).toMatchObject({ status: "uploading", progress: 0.4 })
    expect(run([...base, { type: "finished", id: "a" }])[0]).toMatchObject({
      status: "done",
      progress: 1,
    })
  })

  it("retries only failures that a new attempt can fix", () => {
    const failedUpload = run([
      added,
      { type: "read", id: "a", title: "S", author: "", suggestedGenre: null },
      { type: "failed", id: "a", code: "upload_interrupted" },
    ])
    expect(canRetry(failedUpload[0])).toBe(true)
    expect(
      uploadQueueReducer(failedUpload, { type: "retried", id: "a" })[0]
    ).toMatchObject({
      status: "ready",
      code: null,
      progress: 0,
    })

    const broken = run([
      added,
      { type: "failed", id: "b", code: "epub_invalid" },
    ])
    expect(canRetry(broken[1])).toBe(false)
    const duplicate = run([
      added,
      { type: "read", id: "a", title: "S", author: "", suggestedGenre: null },
      { type: "failed", id: "a", code: "duplicate" },
    ])
    expect(canRetry(duplicate[0])).toBe(false)
  })

  it("clears finished uploads", () => {
    const items = run([
      added,
      { type: "read", id: "a", title: "S", author: "", suggestedGenre: null },
      { type: "started", id: "a" },
      { type: "finished", id: "a" },
      { type: "cleared" },
    ])
    expect(items.map((item) => item.id)).toEqual(["b"])
  })
})

describe("status texts", () => {
  it("describes each row", () => {
    const items = run([
      added,
      { type: "read", id: "a", title: "S", author: "", suggestedGenre: null },
      { type: "failed", id: "b", code: "not_epub" },
    ])
    expect(uploadStatusText(items[0])).toBe("Siap masuk rak")
    expect(uploadStatusText(items[1])).toBe(
      "Hanya file .epub yang bisa dibawa masuk."
    )
    const uploading = uploadQueueReducer(
      uploadQueueReducer(items, { type: "started", id: "a" }),
      { type: "progressed", id: "a", progress: 0.456 }
    )
    expect(uploadStatusText(uploading[0])).toBe("Mengunggah… 46%")
  })

  it("summarises the queue", () => {
    expect(queueSummary([])).toBe("")
    expect(queueSummary(run([added]))).toBe("Membaca 2 file…")
    const mixed = run([
      added,
      { type: "read", id: "a", title: "S", author: "", suggestedGenre: null },
      { type: "started", id: "a" },
      { type: "finished", id: "a" },
      { type: "failed", id: "b", code: "epub_invalid" },
    ])
    expect(queueSummary(mixed)).toBe("1 buku masuk rak, 1 gagal.")
  })
})
