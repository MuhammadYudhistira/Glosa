import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BookDetail } from "./BookDetail"
import { sherlock } from "./fixtures"

describe("BookDetail", () => {
  it("shows the book's details in a dialog named after it", async () => {
    render(<BookDetail book={sherlock} onClose={() => undefined} />)
    const dialog = await screen.findByRole("dialog", { name: sherlock.title })
    expect(dialog).toHaveTextContent("Arthur Conan Doyle")
    expect(dialog).toHaveTextContent("Twelve cases.")
    expect(dialog).toHaveTextContent("Misteri & Thriller")
    expect(dialog).toHaveTextContent("0.7 MB")
    expect(dialog).toHaveTextContent("Kamis, 15 Oktober 2026")
  })

  it("renders nothing without a book", () => {
    render(<BookDetail book={null} onClose={() => undefined} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
