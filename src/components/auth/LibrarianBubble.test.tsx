import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LibrarianBubble } from "./LibrarianBubble"

describe("LibrarianBubble", () => {
  it("is a polite status by default", () => {
    render(<LibrarianBubble>Silakan isi buku tamu, ya.</LibrarianBubble>)
    expect(screen.getByRole("status")).toHaveTextContent("Petugas perpustakaan")
  })

  it("becomes an alert for errors", () => {
    render(
      <LibrarianBubble tone="error">Kata sandinya belum cocok.</LibrarianBubble>
    )
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kata sandinya belum cocok."
    )
  })
})
