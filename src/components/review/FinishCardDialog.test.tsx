import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FinishCardDialog } from "./FinishCardDialog"

const mocks = vi.hoisted(() => ({
  saveReviewFn: vi.fn(),
  deleteReviewFn: vi.fn(),
  finishSummaryFn: vi.fn(),
  shareBuilds: [] as Array<unknown>,
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/reviews", () => mocks)
vi.mock("@/components/share/ShareImage", () => ({
  ShareImage: ({ build }: { build: unknown }) => {
    mocks.shareBuilds.push(build)
    return <div>ShareImage</div>
  },
}))
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

const BOOK = "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e"
const summary = {
  seconds: 6 * 3600 + 20 * 60,
  days: 14,
  lookedUp: 30,
  saved: 9,
  words: ["alpha"],
  coins: 50,
  finishedAt: "2026-11-07T01:00:00Z",
  review: null,
}
const book = { id: BOOK, title: "Buku Pendek", author: "Penguji" }
const loadCover = async () => null
const props = {
  book,
  loadCover,
  fallbackReview: null,
  offline: false,
  onChanged: vi.fn(),
  onClose: vi.fn(),
}

afterEach(() => {
  vi.clearAllMocks()
  mocks.shareBuilds.length = 0
})

describe("FinishCardDialog", () => {
  it("shows a skeleton, then the numbers of the book", async () => {
    mocks.finishSummaryFn.mockResolvedValue({ ok: true, summary })
    render(<FinishCardDialog {...props} />)
    expect(
      screen.getByRole("dialog", { name: "Selesai: Buku Pendek" })
    ).toBeInTheDocument()
    expect(await screen.findByText("6 jam 20 menit")).toBeInTheDocument()
    expect(screen.getByText("dalam 14 hari")).toBeInTheDocument()
    expect(screen.getByText("30")).toBeInTheDocument()
    expect(screen.getByText("9")).toBeInTheDocument()
    expect(screen.getByText("+50 koin")).toBeInTheDocument()
    expect(screen.queryByText(/paham/i)).toBeNull()
  })

  it("keeps zeros but leaves the coin line out without coins", async () => {
    mocks.finishSummaryFn.mockResolvedValue({
      ok: true,
      summary: { ...summary, coins: 0, lookedUp: 0, saved: 0 },
    })
    render(<FinishCardDialog {...props} />)
    await screen.findByText("6 jam 20 menit")
    expect(screen.queryByText(/koin/)).toBeNull()
    expect(screen.getAllByText("0")).toHaveLength(2)
  })

  it("says Ringkasan belum bisa dimuat with the title and still offers the review", async () => {
    mocks.finishSummaryFn.mockResolvedValue({ ok: false, code: "unknown" })
    render(<FinishCardDialog {...props} />)
    expect(
      await screen.findByText("Ringkasan belum bisa dimuat")
    ).toBeInTheDocument()
    expect(screen.getByText("Buku Pendek")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Tulis ulasan" })
    ).toBeInTheDocument()
  })

  it("offers Ubah ulasan when a review exists, from the summary", async () => {
    mocks.finishSummaryFn.mockResolvedValue({
      ok: true,
      summary: {
        ...summary,
        review: { rating: 4, difficulty: null, note: null, updatedAt: "x" },
      },
    })
    render(<FinishCardDialog {...props} />)
    expect(
      await screen.findByRole("button", { name: "Ubah ulasan" })
    ).toBeInTheDocument()
  })

  it("offers Ubah ulasan from the fallback review while the summary is missing", async () => {
    mocks.finishSummaryFn.mockResolvedValue({ ok: false, code: "unknown" })
    render(
      <FinishCardDialog
        {...props}
        fallbackReview={{
          rating: 2,
          difficulty: null,
          note: null,
          updatedAt: "x",
        }}
      />
    )
    expect(
      await screen.findByRole("button", { name: "Ubah ulasan" })
    ).toBeInTheDocument()
  })

  it("opens the form from Tulis ulasan and goes back to the card after saving", async () => {
    mocks.finishSummaryFn.mockResolvedValue({ ok: true, summary })
    mocks.saveReviewFn.mockResolvedValue({ ok: true })
    const onChanged = vi.fn()
    render(<FinishCardDialog {...props} onChanged={onChanged} />)
    fireEvent.click(await screen.findByRole("button", { name: "Tulis ulasan" }))
    fireEvent.click(screen.getByRole("button", { name: "5 bintang" }))
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }))
    expect(
      await screen.findByRole("button", { name: "Ubah ulasan" })
    ).toBeInTheDocument()
    expect(onChanged).toHaveBeenCalled()
  })

  it("closes after saving when it started on the form", async () => {
    mocks.finishSummaryFn.mockResolvedValue({ ok: true, summary })
    mocks.saveReviewFn.mockResolvedValue({ ok: true })
    const onClose = vi.fn()
    render(<FinishCardDialog {...props} start="form" onClose={onClose} />)
    fireEvent.click(await screen.findByRole("button", { name: "3 bintang" }))
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it("closes with Nanti, and Bagikan shows the share image", async () => {
    mocks.finishSummaryFn.mockResolvedValue({ ok: true, summary })
    const onClose = vi.fn()
    render(<FinishCardDialog {...props} onClose={onClose} />)
    fireEvent.click(await screen.findByRole("button", { name: "Bagikan" }))
    expect(screen.getByText("ShareImage")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Kembali" }))
    fireEvent.click(screen.getByRole("button", { name: "Nanti" }))
    expect(onClose).toHaveBeenCalled()
  })

  it("disables Bagikan until the summary is there", () => {
    mocks.finishSummaryFn.mockReturnValue(new Promise(() => undefined))
    render(<FinishCardDialog {...props} />)
    expect(screen.getByRole("button", { name: "Bagikan" })).toBeDisabled()
  })

  it("hands the share image the same build across re-renders", async () => {
    mocks.finishSummaryFn.mockResolvedValue({ ok: true, summary })
    const { rerender } = render(<FinishCardDialog {...props} />)
    fireEvent.click(await screen.findByRole("button", { name: "Bagikan" }))
    rerender(<FinishCardDialog {...props} />)
    rerender(<FinishCardDialog {...props} />)
    expect(new Set(mocks.shareBuilds).size).toBe(1)
  })
})
