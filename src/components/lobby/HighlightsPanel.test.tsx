import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { HighlightsState } from "@/lib/annotations/highlights-client"
import { MAX_HIGHLIGHTS, type Highlight } from "@/lib/annotations/types"
import type { ShelfBook } from "@/lib/book-types"
import { renderWithRouter } from "@/test/router"
import { HighlightsPanel } from "./HighlightsPanel"

const dialogProps = vi.hoisted(() => [] as Array<Record<string, unknown>>)
vi.mock("@/components/reader/QuoteCardDialog", () => ({
  QuoteCardDialog: (props: Record<string, unknown>) => {
    dialogProps.push(props)
    return <div role="dialog">Kartu kutipan</div>
  },
}))
vi.mock("@/lib/words/word-sync-client", () => ({ useSavedForms: () => ({}) }))

const other: ShelfBook = {
  ...sherlock,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  title: "Alice",
  author: "Carroll",
}
const first: Highlight = {
  id: "h1",
  bookId: sherlock.id,
  cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  color: "yellow",
  note: "Pembuka yang bagus",
  excerpt: "To Sherlock Holmes she is always the woman",
  createdAt: "2026-11-10T08:00:00.000Z",
}
const second: Highlight = {
  ...first,
  id: "h2",
  bookId: other.id,
  color: "pink",
  note: "",
  excerpt: "Down the rabbit hole",
  createdAt: "2026-11-11T08:00:00.000Z",
}

function renderPanel(state: HighlightsState, url = "/highlights") {
  const onRetry = vi.fn()
  const view = renderWithRouter(
    <HighlightsPanel
      state={state}
      books={[sherlock, other]}
      onRetry={onRetry}
    />,
    url
  )
  return { ...view, onRetry }
}
const ready = (...highlights: Array<Highlight>): HighlightsState => ({
  status: "ready",
  highlights,
})

describe("HighlightsPanel", () => {
  it("shows each highlight with its note, book and two actions", async () => {
    renderPanel(ready(first, second))
    expect(await screen.findByText(first.excerpt)).toBeInTheDocument()
    expect(screen.getByText("Pembuka yang bagus")).toBeInTheDocument()
    const links = screen.getAllByRole("link", { name: "Buka di buku" })
    expect(links).toHaveLength(2)
    // Newest first: the second highlight leads.
    const url = new URL(links[1].getAttribute("href") ?? "", "http://x")
    expect(url.pathname).toBe(`/read/${sherlock.id}`)
    expect(url.searchParams.get("cfi")).toBe(first.cfi)
    expect(
      screen.getAllByRole("button", { name: "Buat kartu kutipan" })
    ).toHaveLength(2)
  })

  it("filters by book and by colour and keeps both in the URL", async () => {
    const { router } = renderPanel(ready(first, second))
    await screen.findByText(first.excerpt)
    const book = screen.getByRole("combobox", { name: "Buku" })
    expect(
      within(book)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(expect.arrayContaining(["Semua buku"]))
    fireEvent.change(book, { target: { value: sherlock.id } })
    await waitFor(() =>
      expect(screen.queryByText(second.excerpt)).not.toBeInTheDocument()
    )
    expect(router.state.location.search).toMatchObject({ buku: sherlock.id })
    const colour = screen.getByRole("combobox", { name: "Warna" })
    expect(
      within(colour)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Semua", "Kuning", "Hijau", "Biru", "Merah muda"])
    fireEvent.change(colour, { target: { value: "pink" } })
    await waitFor(() =>
      expect(screen.queryByText(first.excerpt)).not.toBeInTheDocument()
    )
    expect(router.state.location.search).toMatchObject({
      buku: sherlock.id,
      warna: "pink",
    })
  })

  it("starts from the filter in the URL", async () => {
    renderPanel(ready(first, second), `/highlights?warna=pink`)
    expect(await screen.findByText(second.excerpt)).toBeInTheDocument()
    expect(screen.queryByText(first.excerpt)).not.toBeInTheDocument()
  })

  it("opens the quote card for the highlight", async () => {
    dialogProps.length = 0
    renderPanel(ready(first))
    fireEvent.click(
      await screen.findByRole("button", { name: "Buat kartu kutipan" })
    )
    expect(await screen.findByText("Kartu kutipan")).toBeInTheDocument()
    expect(dialogProps.at(-1)).toMatchObject({
      quote: first.excerpt,
      book: {
        id: sherlock.id,
        title: sherlock.title,
        author: sherlock.author,
        finished: false,
        finishDeclined: true,
      },
    })
  })

  it("invites the member to mark a line when there are none", async () => {
    renderPanel(ready())
    expect(
      await screen.findByText(
        "Belum ada sorotan. Tandai kalimat yang kamu suka saat membaca, lalu kembali ke sini."
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
    const { onRetry } = renderPanel({ status: "failed" })
    expect(
      await screen.findByText("Sorotan belum bisa dimuat.")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }))
    expect(onRetry).toHaveBeenCalled()
  })

  it("says so when the newest 500 are all it shows", async () => {
    const many = Array.from({ length: MAX_HIGHLIGHTS }, (_, i) => ({
      ...first,
      id: `m${i}`,
    }))
    renderPanel(ready(...many))
    expect(
      await screen.findByText("Menampilkan 500 sorotan terbaru.")
    ).toBeInTheDocument()
  })
})
