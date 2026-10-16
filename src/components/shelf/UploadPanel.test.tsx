import type * as ReadEpubModule from "@/lib/epub/read-epub"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { UploadPanel } from "./UploadPanel"

const { readEpub, uploadBook, invalidate } = vi.hoisted(() => ({
  readEpub: vi.fn(),
  uploadBook: vi.fn(),
  invalidate: vi.fn(),
}))

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ invalidate }) }))
vi.mock("@/server/books", () => ({
  requestUploadFn: vi.fn(),
  confirmUploadFn: vi.fn(),
}))
vi.mock("@/lib/epub/read-epub", async (importOriginal) => ({
  ...(await importOriginal<typeof ReadEpubModule>()),
  readEpub,
}))
vi.mock("./upload-book", () => ({ uploadBook }))

const usage = { usedBytes: 0, limitBytes: 104857600, plan: "free" as const }

describe("UploadPanel", () => {
  it("guesses the genre, lets the member change it, and uploads with that choice", async () => {
    readEpub.mockResolvedValueOnce({
      metadata: {
        title: "The Adventures of Sherlock Holmes",
        author: "Arthur Conan Doyle",
        language: "en",
        description: null,
        subjects: [],
      },
      cover: null,
      sha256: "a".repeat(64),
      suggestedGenre: "misteri_thriller",
    })
    uploadBook.mockImplementationOnce(
      (
        _file: File,
        _parsed: unknown,
        _choice: unknown,
        _deps: unknown,
        onProgress: (p: number) => void
      ) => {
        onProgress(1)
        return Promise.resolve({ ok: true })
      }
    )

    render(<UploadPanel open onOpenChange={() => undefined} usage={usage} />)
    const dialog = await screen.findByRole("dialog", {
      name: "Bawa buku ke rak",
    })
    const input = dialog.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement))
      throw new Error("file input missing")
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(10)], "sherlock.epub")] },
    })

    expect(
      await screen.findByText("The Adventures of Sherlock Holmes")
    ).toBeInTheDocument()
    const genre = screen.getByLabelText("Genre")
    expect(genre).toHaveValue("misteri_thriller")
    fireEvent.change(genre, { target: { value: "fiksi_sastra" } })
    fireEvent.click(screen.getByRole("button", { name: "Terima semua" }))

    expect(await screen.findByText("Masuk rak ✓")).toBeInTheDocument()
    expect(uploadBook.mock.calls[0][2]).toEqual({
      genre: "fiksi_sastra",
      genreSource: "user",
    })
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
    expect(screen.getByText("1 buku masuk rak.")).toBeInTheDocument()
  })

  it("explains files that cannot come in", async () => {
    render(<UploadPanel open onOpenChange={() => undefined} usage={usage} />)
    const dialog = await screen.findByRole("dialog", {
      name: "Bawa buku ke rak",
    })
    const input = dialog.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement))
      throw new Error("file input missing")
    const { EpubError } = await import("@/lib/epub/read-epub")
    readEpub.mockRejectedValueOnce(new EpubError("not_epub"))
    fireEvent.change(input, {
      target: { files: [new File(["x"], "catatan.txt")] },
    })

    expect(
      await screen.findByText("Hanya file .epub yang bisa dibawa masuk.")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Terima semua" })).toBeDisabled()
  })
})
