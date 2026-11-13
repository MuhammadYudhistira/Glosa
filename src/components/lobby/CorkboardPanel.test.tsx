import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { HighlightsState } from "@/lib/annotations/highlights-client"
import type { Highlight } from "@/lib/annotations/types"
import { renderWithRouter } from "@/test/router"
import { CorkboardPanel } from "./CorkboardPanel"

const first: Highlight = {
  id: "8b1f7c2e-4a5d-4c3b-9e2f-1a2b3c4d5e6f",
  bookId: sherlock.id,
  cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  color: "yellow",
  note: "Pembuka yang bagus",
  excerpt: "To Sherlock Holmes she is always the woman",
  createdAt: "2026-10-24T08:00:00.000Z",
}
const second: Highlight = {
  ...first,
  id: "9c2f8d3f-5b6e-4d4c-8f3a-2b3c4d5e6f70",
  color: "pink",
  note: "",
  excerpt: "A second marked line",
}
const gone: Highlight = {
  ...first,
  id: "7a0e6b1d-3a4c-4b2a-8d1e-0a1b2c3d4e5f",
  bookId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  excerpt: "From a book that was removed",
}

function renderPanel(state: HighlightsState, onRetry = vi.fn()) {
  renderWithRouter(
    <CorkboardPanel
      open
      onOpenChange={vi.fn()}
      state={state}
      books={[sherlock]}
      onRetry={onRetry}
    />
  )
  return onRetry
}

describe("CorkboardPanel", () => {
  it("lists the highlights with their note, book and a link into the book", async () => {
    renderPanel({ status: "ready", highlights: [first, second] })
    await screen.findByRole("dialog", { name: "Sorotan" })
    expect(screen.getByText(first.excerpt)).toBeInTheDocument()
    expect(screen.getByText("Pembuka yang bagus")).toBeInTheDocument()
    expect(screen.getByText(second.excerpt)).toBeInTheDocument()
    expect(screen.getAllByText(sherlock.title)).toHaveLength(2)
    const links = screen.getAllByRole("link", { name: "Buka di buku" })
    expect(links).toHaveLength(2)
    // The router encodes the cfi; reading it back gives the original.
    const url = new URL(links[0].getAttribute("href") ?? "", "http://x")
    expect(url.pathname).toBe(`/read/${sherlock.id}`)
    expect(url.searchParams.get("cfi")).toBe(first.cfi)
  })

  it("leaves out highlights of books that are gone", async () => {
    renderPanel({ status: "ready", highlights: [gone, first] })
    await screen.findByRole("dialog", { name: "Sorotan" })
    expect(screen.queryByText(gone.excerpt)).not.toBeInTheDocument()
    expect(screen.getByText(first.excerpt)).toBeInTheDocument()
  })

  it("fills the board from older highlights when the newest is of a removed book", async () => {
    const third = { ...first, id: "x3", excerpt: "Third" }
    const fourth = { ...first, id: "x4", excerpt: "Fourth" }
    renderPanel({
      status: "ready",
      highlights: [gone, first, second, third, fourth],
    })
    await screen.findByRole("dialog", { name: "Sorotan" })
    expect(screen.getAllByRole("link", { name: "Buka di buku" })).toHaveLength(
      3
    )
    expect(screen.queryByText(gone.excerpt)).not.toBeInTheDocument()
    expect(screen.getByText(first.excerpt)).toBeInTheDocument()
    expect(screen.getByText("Third")).toBeInTheDocument()
    expect(screen.queryByText("Fourth")).not.toBeInTheDocument()
  })

  it("shows at most three", async () => {
    const third = { ...first, id: "x3", excerpt: "Third" }
    const fourth = { ...first, id: "x4", excerpt: "Fourth" }
    renderPanel({
      status: "ready",
      highlights: [first, second, third, fourth],
    })
    await screen.findByRole("dialog", { name: "Sorotan" })
    expect(screen.getAllByRole("link", { name: "Buka di buku" })).toHaveLength(
      3
    )
    expect(screen.queryByText("Fourth")).not.toBeInTheDocument()
  })

  it("invites the member to mark a line when there are none", async () => {
    renderPanel({ status: "ready", highlights: [] })
    expect(
      await screen.findByText(
        "Belum ada sorotan. Tandai kalimat yang kamu suka saat membaca; tiga yang terbaru tertempel di sini."
      )
    ).toBeInTheDocument()
  })

  it("says it needs the internet when offline", async () => {
    renderPanel({ status: "offline" })
    expect(
      await screen.findByText("Sorotan bisa dilihat saat online.")
    ).toBeInTheDocument()
  })

  it("offers another try when loading did not work", async () => {
    const onRetry = renderPanel({ status: "failed" })
    expect(
      await screen.findByText("Sorotan belum bisa dimuat.")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }))
    expect(onRetry).toHaveBeenCalled()
  })
})
