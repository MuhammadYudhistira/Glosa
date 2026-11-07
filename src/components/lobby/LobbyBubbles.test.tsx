import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderWithRouter } from "@/test/router"
import { LibrarianWelcome, ReadingHint, RecapBubbleNote } from "./LobbyBubbles"

describe("lobby bubbles", () => {
  it("links the recap bubble to its period", async () => {
    renderWithRouter(
      <RecapBubbleNote
        bubble={{ key: "2026-10", label: "Kilas balik Oktober sudah siap" }}
      />
    )
    expect(
      await screen.findByRole("link", {
        name: "Kilas balik Oktober sudah siap",
      })
    ).toHaveAttribute("href", "/recap?periode=2026-10")
  })

  it("points to Rak Saya when no book has been read yet", async () => {
    renderWithRouter(<ReadingHint />)
    expect(
      await screen.findByText(/Belum ada buku yang dibaca/)
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Rak Saya" })).toHaveAttribute(
      "href",
      "/shelf"
    )
  })

  it("greets a member with an empty shelf and points to free EPUBs", () => {
    render(<LibrarianWelcome />)
    expect(
      screen.getByText("Rakmu masih kosong. Bawa buku pertamamu ke sini!")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Standard Ebooks" })
    ).toHaveAttribute("href", "https://standardebooks.org")
    expect(
      screen.getByRole("link", { name: "Project Gutenberg" })
    ).toHaveAttribute("href", "https://www.gutenberg.org")
  })
})
