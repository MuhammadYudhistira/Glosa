import { describe, expect, it, vi } from "vitest"
import type { ParsedEpub } from "@/lib/epub/read-epub"
import { uploadBook } from "./upload-book"

const parsed: ParsedEpub = {
  metadata: {
    title: "Sherlock",
    author: "Doyle",
    language: "en",
    description: null,
    subjects: ["Detective and mystery stories"],
  },
  cover: {
    blob: new Blob([new Uint8Array(100)], { type: "image/webp" }),
    type: "image/webp",
  },
  sha256: "a".repeat(64),
  suggestedGenre: "misteri_thriller",
}
const file = new File([new Uint8Array(300)], "sherlock.epub")
const choice = {
  genre: "misteri_thriller" as const,
  genreSource: "auto" as const,
}
const ticket = {
  ok: true as const,
  bookId: "b1",
  epubUploadUrl: "https://storage/epub",
  coverUploadUrl: "https://storage/cover",
}

describe("uploadBook", () => {
  it("reserves, uploads the EPUB and cover, then confirms", async () => {
    const requestUpload = vi.fn().mockResolvedValue(ticket)
    const confirmUpload = vi.fn().mockResolvedValue({ ok: true })
    const put = vi.fn(
      (
        _url: string,
        _body: Blob,
        _type: string,
        onProgress?: (f: number) => void
      ) => {
        onProgress?.(1)
        return Promise.resolve()
      }
    )
    const progress: Array<number> = []

    const result = await uploadBook(
      file,
      parsed,
      choice,
      { requestUpload, confirmUpload, put },
      (p) => progress.push(p)
    )

    expect(result).toEqual({ ok: true })
    expect(requestUpload).toHaveBeenCalledWith({
      data: {
        sha256: "a".repeat(64),
        epubBytes: 300,
        cover: { bytes: 100, type: "image/webp" },
        title: "Sherlock",
        author: "Doyle",
        description: null,
        language: "en",
        subjects: ["Detective and mystery stories"],
        genre: "misteri_thriller",
        genreSource: "auto",
      },
    })
    expect(put.mock.calls.map((call) => [call[0], call[2]])).toEqual([
      ["https://storage/epub", "application/epub+zip"],
      ["https://storage/cover", "image/webp"],
    ])
    expect(confirmUpload).toHaveBeenCalledWith({ data: { bookId: "b1" } })
    expect(progress).toEqual([0.75, 1, 1])
  })

  it("stops when the reservation is refused", async () => {
    const put = vi.fn()
    const result = await uploadBook(
      file,
      parsed,
      choice,
      {
        requestUpload: vi
          .fn()
          .mockResolvedValue({ ok: false, code: "quota_exceeded" }),
        confirmUpload: vi.fn(),
        put,
      },
      () => undefined
    )
    expect(result).toEqual({ ok: false, code: "quota_exceeded" })
    expect(put).not.toHaveBeenCalled()
  })

  it("reports an interrupted upload without confirming", async () => {
    const confirmUpload = vi.fn()
    const result = await uploadBook(
      file,
      parsed,
      choice,
      {
        requestUpload: vi.fn().mockResolvedValue(ticket),
        confirmUpload,
        put: vi.fn().mockRejectedValue(new Error("network")),
      },
      () => undefined
    )
    expect(result).toEqual({ ok: false, code: "upload_interrupted" })
    expect(confirmUpload).not.toHaveBeenCalled()
  })

  it("passes on a failed confirmation and skips a missing cover", async () => {
    const put = vi.fn().mockResolvedValue(undefined)
    const result = await uploadBook(
      file,
      { ...parsed, cover: null },
      choice,
      {
        requestUpload: vi
          .fn()
          .mockResolvedValue({ ...ticket, coverUploadUrl: null }),
        confirmUpload: vi
          .fn()
          .mockResolvedValue({ ok: false, code: "size_mismatch" }),
        put,
      },
      () => undefined
    )
    expect(result).toEqual({ ok: false, code: "size_mismatch" })
    expect(put).toHaveBeenCalledTimes(1)
  })
})
