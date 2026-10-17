import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BookActions } from "./BookActions"
import { sherlock } from "./fixtures"

const mocks = vi.hoisted(() => ({
  updateBookGenreFn: vi.fn(),
  deleteBookFn: vi.fn(),
  saveBookOffline: vi.fn(),
  removeLocalBook: vi.fn(),
  removeLocalPosition: vi.fn(),
}))
const { updateBookGenreFn, deleteBookFn } = mocks
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/books", () => ({
  updateBookGenreFn: mocks.updateBookGenreFn,
  deleteBookFn: mocks.deleteBookFn,
}))
vi.mock("@/lib/book-download", () => ({
  saveBookOffline: mocks.saveBookOffline,
  BookLoadError: class BookLoadError extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  },
}))
vi.mock("@/lib/local/book-files", () => ({
  removeLocalBook: mocks.removeLocalBook,
  localBookIds: vi.fn(async () => new Set()),
}))
vi.mock("@/lib/local/positions", () => ({
  removeLocalPosition: mocks.removeLocalPosition,
  localPercentages: vi.fn(async () => new Map()),
}))

afterEach(() => {
  vi.restoreAllMocks()
  // Call history carries over between tests otherwise ("not called" checks below).
  vi.clearAllMocks()
})

describe("BookActions", () => {
  it("moves the book to another genre", async () => {
    updateBookGenreFn.mockResolvedValueOnce({ ok: true })
    const onGenreSaved = vi.fn()
    render(
      <BookActions
        book={sherlock}
        saved={false}
        onGenreSaved={onGenreSaved}
        onDeleted={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText("Genre"), {
      target: { value: "fiksi_sastra" },
    })

    expect(await screen.findByText("Genre disimpan.")).toBeInTheDocument()
    expect(updateBookGenreFn).toHaveBeenCalledWith({
      data: { bookId: sherlock.id, genre: "fiksi_sastra" },
    })
    expect(onGenreSaved).toHaveBeenCalledWith("fiksi_sastra")
  })

  it("deletes only after confirmation", async () => {
    deleteBookFn.mockResolvedValueOnce({ ok: true })
    const onDeleted = vi.fn()
    render(
      <BookActions
        book={sherlock}
        saved={false}
        onGenreSaved={vi.fn()}
        onDeleted={onDeleted}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Hapus buku" }))
    expect(deleteBookFn).not.toHaveBeenCalled()
    expect(
      screen.getByText(/Kuota 0.7 MB kembali ke rakmu/)
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ya, hapus" }))

    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledWith(sherlock))
    expect(deleteBookFn).toHaveBeenCalledWith({ data: { bookId: sherlock.id } })
  })

  it("explains a failed deletion and lets the member try again", async () => {
    deleteBookFn.mockRejectedValueOnce(new Error("network down"))
    render(
      <BookActions
        book={sherlock}
        saved={false}
        onGenreSaved={vi.fn()}
        onDeleted={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Hapus buku" }))
    fireEvent.click(screen.getByRole("button", { name: "Ya, hapus" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ada yang tidak beres"
    )
    expect(screen.getByRole("button", { name: "Ya, hapus" })).toBeEnabled()
  })

  it("saves the book for offline reading", async () => {
    mocks.saveBookOffline.mockResolvedValueOnce(true)
    render(
      <BookActions
        book={sherlock}
        saved={false}
        onGenreSaved={vi.fn()}
        onDeleted={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Simpan offline" }))
    expect(
      await screen.findByText("Tersimpan untuk offline.")
    ).toBeInTheDocument()
    expect(mocks.saveBookOffline).toHaveBeenCalledWith(sherlock.id)
  })

  it("explains when the device has no room for the book", async () => {
    mocks.saveBookOffline.mockResolvedValueOnce(false)
    render(
      <BookActions
        book={sherlock}
        saved={false}
        onGenreSaved={vi.fn()}
        onDeleted={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Simpan offline" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Penyimpanan perangkat penuh. Buku ini tidak bisa disimpan untuk offline."
    )
  })

  it("removes only this device's copy", async () => {
    mocks.removeLocalBook.mockResolvedValueOnce(undefined)
    render(
      <BookActions
        book={sherlock}
        saved
        onGenreSaved={vi.fn()}
        onDeleted={vi.fn()}
      />
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Hapus dari perangkat" })
    )
    expect(
      await screen.findByText("Salinan di perangkat ini dihapus.")
    ).toBeInTheDocument()
    expect(mocks.removeLocalBook).toHaveBeenCalledWith(sherlock.id)
    expect(mocks.removeLocalPosition).not.toHaveBeenCalled()
    expect(deleteBookFn).not.toHaveBeenCalled()
  })

  it("deleting the book also removes this device's copy and position", async () => {
    deleteBookFn.mockResolvedValueOnce({ ok: true })
    mocks.removeLocalBook.mockResolvedValueOnce(undefined)
    mocks.removeLocalPosition.mockResolvedValueOnce(undefined)
    const onDeleted = vi.fn()
    render(
      <BookActions
        book={sherlock}
        saved
        onGenreSaved={vi.fn()}
        onDeleted={onDeleted}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Hapus buku" }))
    fireEvent.click(screen.getByRole("button", { name: "Ya, hapus" }))
    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledWith(sherlock))
    expect(mocks.removeLocalBook).toHaveBeenCalledWith(sherlock.id)
    expect(mocks.removeLocalPosition).toHaveBeenCalledWith(sherlock.id)
  })

  it("needs a connection for changes, deletion and offline copies", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    render(
      <BookActions
        book={sherlock}
        saved={false}
        onGenreSaved={vi.fn()}
        onDeleted={vi.fn()}
      />
    )
    expect(screen.getByText("Butuh internet.")).toBeInTheDocument()
    expect(screen.getByLabelText("Genre")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Hapus buku" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Simpan offline" })
    ).toBeDisabled()
  })
})
