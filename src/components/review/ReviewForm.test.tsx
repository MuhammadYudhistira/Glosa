import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ReviewForm } from "./ReviewForm"

const mocks = vi.hoisted(() => ({
  saveReviewFn: vi.fn(),
  deleteReviewFn: vi.fn(),
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/reviews", () => mocks)
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
const base = {
  bookId: BOOK,
  initial: null,
  words: [] as Array<string>,
  offline: false,
  onSaved: vi.fn(),
  onCancel: vi.fn(),
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("ReviewForm", () => {
  it("needs a star before Simpan", async () => {
    render(<ReviewForm {...base} />)
    const save = screen.getByRole("button", { name: "Simpan" })
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "4 bintang" }))
    expect(save).toBeEnabled()
  })

  it("sends the stars, the difficulty and the trimmed note, then reports the review", async () => {
    mocks.saveReviewFn.mockResolvedValue({ ok: true })
    const onSaved = vi.fn()
    render(<ReviewForm {...base} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole("button", { name: "5 bintang" }))
    fireEvent.click(screen.getByRole("button", { name: "Sulit" }))
    fireEvent.change(screen.getByLabelText("Catatan"), {
      target: { value: "  Seru.  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }))
    expect(mocks.saveReviewFn).toHaveBeenCalledWith({
      data: { bookId: BOOK, rating: 5, difficulty: "hard", note: "Seru." },
    })
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 5,
          difficulty: "hard",
          note: "Seru.",
        })
      )
    )
  })

  it("lets the difficulty be cleared again and sends a blank note as null", async () => {
    mocks.saveReviewFn.mockResolvedValue({ ok: true })
    render(<ReviewForm {...base} />)
    fireEvent.click(screen.getByRole("button", { name: "2 bintang" }))
    fireEvent.click(screen.getByRole("button", { name: "Mudah" }))
    fireEvent.click(screen.getByRole("button", { name: "Mudah" }))
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }))
    expect(mocks.saveReviewFn).toHaveBeenCalledWith({
      data: { bookId: BOOK, rating: 2, difficulty: null, note: null },
    })
  })

  it("starts from the review that exists and deletes it", async () => {
    mocks.deleteReviewFn.mockResolvedValue({ ok: true })
    const onSaved = vi.fn()
    const initial = {
      rating: 3,
      difficulty: "medium" as const,
      note: "Cukup",
      updatedAt: "2026-11-01T00:00:00Z",
    }
    render(<ReviewForm {...base} initial={initial} onSaved={onSaved} />)
    expect(screen.getByRole("button", { name: "3 bintang" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByLabelText("Catatan")).toHaveValue("Cukup")
    fireEvent.click(screen.getByRole("button", { name: "Hapus ulasan" }))
    expect(mocks.deleteReviewFn).toHaveBeenCalledWith({
      data: { bookId: BOOK },
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(null))
  })

  it("has no Hapus ulasan without a review", () => {
    render(<ReviewForm {...base} />)
    expect(screen.queryByRole("button", { name: "Hapus ulasan" })).toBeNull()
  })

  it("blocks saving and deleting offline, and says why", () => {
    render(
      <ReviewForm
        {...base}
        offline
        initial={{ rating: 3, difficulty: null, note: null, updatedAt: "x" }}
      />
    )
    expect(screen.getByRole("button", { name: "Simpan" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Hapus ulasan" })).toBeDisabled()
    expect(screen.getByText("Perlu koneksi internet")).toBeInTheDocument()
  })

  it("shows a counter near the limit and stops at 2,000 characters", () => {
    render(<ReviewForm {...base} />)
    const note = screen.getByLabelText("Catatan")
    expect(screen.queryByText(/\/ 2\.000/)).toBeNull()
    fireEvent.change(note, { target: { value: "a".repeat(1850) } })
    expect(screen.getByText("1.850 / 2.000")).toBeInTheDocument()
    expect(note).toHaveAttribute("maxlength", "2000")
  })

  it("lists the words of the book with a link to all of them", () => {
    render(<ReviewForm {...base} words={["alpha", "beta"]} />)
    expect(screen.getByText("Kata dari buku ini")).toBeInTheDocument()
    expect(screen.getByText("alpha")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Lihat semua" })
    ).toBeInTheDocument()
  })

  it("leaves the words out when there are none", () => {
    render(<ReviewForm {...base} />)
    expect(screen.queryByText("Kata dari buku ini")).toBeNull()
  })

  it("shows the refusal of the server in words, without the word gagal", async () => {
    mocks.saveReviewFn.mockResolvedValue({
      ok: false,
      code: "review_not_finished",
    })
    render(<ReviewForm {...base} />)
    fireEvent.click(screen.getByRole("button", { name: "1 bintang" }))
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tandai buku ini selesai dulu"
    )
  })
})
