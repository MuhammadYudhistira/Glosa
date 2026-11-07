import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BookVocabLine, vocabLineText } from "./BookVocabLine"

const vocab = vi.hoisted(() => ({ useBookVocab: vi.fn() }))
vi.mock("@/lib/vocab/vocab-client", () => vocab)
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
  }: {
    children: React.ReactNode
    to: string
    search: { buku: string }
  }) => <a href={`${to}?buku=${search.buku}`}>{children}</a>,
}))

describe("BookVocabLine", () => {
  it("says the share understood and the words looked up", () => {
    expect(vocabLineText({ read: 850, lookedUp: 34 })).toBe(
      "Paham 96% kata tanpa kamus · 34 kata dicari"
    )
    expect(vocabLineText({ read: 300, lookedUp: 0 })).toBe(
      "Paham 100% kata tanpa kamus"
    )
    expect(vocabLineText({ read: 120, lookedUp: 3 })).toBe(
      "Baca lebih banyak untuk melihat angkanya"
    )
  })

  it("links to the book's words in Kosakata", () => {
    vocab.useBookVocab.mockReturnValue({ read: 850, lookedUp: 34 })
    render(<BookVocabLine bookId="b1" />)
    expect(
      screen.getByText("Paham 96% kata tanpa kamus · 34 kata dicari")
    ).toBeVisible()
    expect(screen.getByRole("link", { name: "Lihat kata" })).toHaveAttribute(
      "href",
      "/vocabulary?buku=b1"
    )
  })

  it("shows nothing for a book not read yet", () => {
    vocab.useBookVocab.mockReturnValue(null)
    const { container } = render(<BookVocabLine bookId="b1" />)
    expect(container).toBeEmptyDOMElement()
  })
})
