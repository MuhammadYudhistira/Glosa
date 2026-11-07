import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { ShelfBook } from "@/lib/book-types"
import { MyReview } from "./MyReview"

vi.mock("./FinishCardDialog", () => ({
  FinishCardDialog: ({ start }: { start?: "card" | "form" }) => (
    <div role="dialog">{start ?? "card"}</div>
  ),
}))
vi.mock("@/lib/quote-card/cover-art", () => ({
  fetchCoverBlob: vi.fn(() => null),
}))

const DONE = "2026-11-01T00:00:00Z"
const book = (over: Partial<ShelfBook>): ShelfBook => ({ ...sherlock, ...over })

describe("MyReview", () => {
  it("shows nothing for a book that is not finished", () => {
    const { container } = render(
      <MyReview book={book({ finishedAt: null })} onChanged={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the review: stars, difficulty and the note, with Ubah", () => {
    render(
      <MyReview
        book={book({
          finishedAt: DONE,
          review: {
            rating: 4,
            difficulty: "hard",
            note: "Seru sekali",
            updatedAt: DONE,
          },
        })}
        onChanged={vi.fn()}
      />
    )
    const section = screen.getByRole("region", { name: "Ulasan saya" })
    expect(within(section).getByText("4 dari 5 bintang")).toBeInTheDocument()
    expect(within(section).getByText("Sulit")).toBeInTheDocument()
    expect(within(section).getByText("Seru sekali")).toBeInTheDocument()
    expect(
      within(section).getByRole("button", { name: "Ubah" })
    ).toBeInTheDocument()
  })

  it("offers Tulis ulasan when there is none, and Lihat kartu always", () => {
    render(
      <MyReview
        book={book({ finishedAt: DONE, review: null })}
        onChanged={vi.fn()}
      />
    )
    expect(
      screen.getByRole("button", { name: "Tulis ulasan" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Lihat kartu" })
    ).toBeInTheDocument()
  })

  it("opens the form from Tulis ulasan", () => {
    render(
      <MyReview
        book={book({ finishedAt: DONE, review: null })}
        onChanged={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Tulis ulasan" }))
    expect(screen.getByRole("dialog")).toHaveTextContent("form")
  })

  it("opens the card on Lihat kartu", () => {
    render(<MyReview book={book({ finishedAt: DONE })} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Lihat kartu" }))
    expect(screen.getByRole("dialog")).toHaveTextContent("card")
  })

  it("clamps a long note to three lines and opens it on request", () => {
    render(
      <MyReview
        book={book({
          finishedAt: DONE,
          review: {
            rating: 3,
            difficulty: null,
            note: "x ".repeat(300),
            updatedAt: DONE,
          },
        })}
        onChanged={vi.fn()}
      />
    )
    const note = screen.getByTestId("review-note")
    expect(note).toHaveClass("line-clamp-3")
    fireEvent.click(screen.getByRole("button", { name: "Baca selengkapnya" }))
    expect(note).not.toHaveClass("line-clamp-3")
  })

  it("ties the toggle to the note with aria-expanded and aria-controls", () => {
    render(
      <MyReview
        book={book({
          finishedAt: DONE,
          review: {
            rating: 3,
            difficulty: null,
            note: "x ".repeat(300),
            updatedAt: DONE,
          },
        })}
        onChanged={vi.fn()}
      />
    )
    const toggle = screen.getByRole("button", { name: "Baca selengkapnya" })
    const note = screen.getByTestId("review-note")
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(toggle).toHaveAttribute("aria-controls", note.id)
    expect(note.id).not.toBe("")
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
  })

  it("offers the toggle for a short note of more than three lines", () => {
    render(
      <MyReview
        book={book({
          finishedAt: DONE,
          review: {
            rating: 3,
            difficulty: null,
            note: "a\nb\nc\nd",
            updatedAt: DONE,
          },
        })}
        onChanged={vi.fn()}
      />
    )
    expect(
      screen.getByRole("button", { name: "Baca selengkapnya" })
    ).toBeInTheDocument()
  })
})
