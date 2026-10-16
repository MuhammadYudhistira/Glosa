import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BookActions } from "./BookActions"
import { sherlock } from "./fixtures"

const { updateBookGenreFn, deleteBookFn } = vi.hoisted(() => ({
  updateBookGenreFn: vi.fn(),
  deleteBookFn: vi.fn(),
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/books", () => ({ updateBookGenreFn, deleteBookFn }))

describe("BookActions", () => {
  it("moves the book to another genre", async () => {
    updateBookGenreFn.mockResolvedValueOnce({ ok: true })
    const onGenreSaved = vi.fn()
    render(
      <BookActions
        book={sherlock}
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
      <BookActions book={sherlock} onGenreSaved={vi.fn()} onDeleted={vi.fn()} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Hapus buku" }))
    fireEvent.click(screen.getByRole("button", { name: "Ya, hapus" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ada yang tidak beres"
    )
    expect(screen.getByRole("button", { name: "Ya, hapus" })).toBeEnabled()
  })
})
