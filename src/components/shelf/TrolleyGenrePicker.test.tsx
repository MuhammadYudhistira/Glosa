import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "./fixtures"
import { TrolleyGenrePicker } from "./TrolleyGenrePicker"

const { updateBookGenreFn } = vi.hoisted(() => ({ updateBookGenreFn: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/books", () => ({ updateBookGenreFn, deleteBookFn: vi.fn() }))

describe("TrolleyGenrePicker", () => {
  it("gives a trolley book its genre in one choice", async () => {
    updateBookGenreFn.mockResolvedValueOnce({ ok: true })
    const onSaved = vi.fn()
    const book = { ...sherlock, genre: null, genreSource: null }
    render(<TrolleyGenrePicker book={book} onSaved={onSaved} />)

    fireEvent.change(screen.getByLabelText(`Genre untuk ${book.title}`), {
      target: { value: "sejarah_budaya" },
    })

    await vi.waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith("sejarah_budaya")
    )
    expect(updateBookGenreFn).toHaveBeenCalledWith({
      data: { bookId: book.id, genre: "sejarah_budaya" },
    })
  })
})
