import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Collection } from "@/lib/book-types"
import { BookCollections } from "./BookCollections"
import { sherlock } from "./fixtures"

const mocks = vi.hoisted(() => ({ setBookCollectionsFn: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/collections", () => mocks)

const santai: Collection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Bacaan santai",
  createdAt: "2026-10-20T00:00:00+00:00",
}
const klasik: Collection = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Klasik",
  createdAt: "2026-10-21T00:00:00+00:00",
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("BookCollections", () => {
  it("ticks the collections the book is in, and saves a new tick", async () => {
    mocks.setBookCollectionsFn.mockResolvedValueOnce({ ok: true })
    const onSaved = vi.fn()
    render(
      <BookCollections
        book={{ ...sherlock, collectionIds: [santai.id] }}
        collections={[santai, klasik]}
        onSaved={onSaved}
      />
    )
    expect(screen.getByLabelText("Bacaan santai")).toBeChecked()
    expect(screen.getByLabelText("Klasik")).not.toBeChecked()
    fireEvent.click(screen.getByLabelText("Klasik"))
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(mocks.setBookCollectionsFn).toHaveBeenCalledWith({
      data: { bookId: sherlock.id, collectionIds: [santai.id, klasik.id] },
    })
    expect(screen.getByText("Koleksi disimpan.")).toBeInTheDocument()
  })

  it("puts the tick back when saving fails", async () => {
    mocks.setBookCollectionsFn.mockResolvedValueOnce({
      ok: false,
      code: "not_found",
    })
    render(
      <BookCollections
        book={sherlock}
        collections={[santai]}
        onSaved={vi.fn()}
      />
    )
    fireEvent.click(screen.getByLabelText("Bacaan santai"))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Buku ini tidak ada di rakmu."
    )
    expect(screen.getByLabelText("Bacaan santai")).not.toBeChecked()
  })

  it("says where collections are made when there are none", () => {
    render(
      <BookCollections book={sherlock} collections={[]} onSaved={vi.fn()} />
    )
    expect(
      screen.getByText("Belum ada koleksi. Buat koleksi dari Rak Saya.")
    ).toBeInTheDocument()
  })

  it("sends only collections the shelf still shows", async () => {
    mocks.setBookCollectionsFn.mockResolvedValueOnce({ ok: true })
    const gone = "33333333-3333-4333-8333-333333333333"
    render(
      <BookCollections
        book={{ ...sherlock, collectionIds: [gone, santai.id] }}
        collections={[santai, klasik]}
        onSaved={vi.fn()}
      />
    )
    fireEvent.click(screen.getByLabelText("Klasik"))
    await waitFor(() => expect(mocks.setBookCollectionsFn).toHaveBeenCalled())
    expect(mocks.setBookCollectionsFn).toHaveBeenCalledWith({
      data: { bookId: sherlock.id, collectionIds: [santai.id, klasik.id] },
    })
  })

  it("takes the shelf's membership again when it changes", () => {
    const { rerender } = render(
      <BookCollections
        book={{ ...sherlock, collectionIds: [] }}
        collections={[santai, klasik]}
        onSaved={vi.fn()}
      />
    )
    expect(screen.getByLabelText("Klasik")).not.toBeChecked()
    rerender(
      <BookCollections
        book={{ ...sherlock, collectionIds: [klasik.id] }}
        collections={[santai, klasik]}
        onSaved={vi.fn()}
      />
    )
    expect(screen.getByLabelText("Klasik")).toBeChecked()
  })

  it("does not say the name is wrong when the list changed", async () => {
    mocks.setBookCollectionsFn.mockResolvedValueOnce({
      ok: false,
      code: "collections_changed",
    })
    render(
      <BookCollections
        book={sherlock}
        collections={[santai]}
        onSaved={vi.fn()}
      />
    )
    fireEvent.click(screen.getByLabelText("Bacaan santai"))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Daftar koleksi berubah. Muat ulang rak, lalu coba lagi."
    )
  })

  it("ignores a click while saving, and keeps the box focusable", async () => {
    let finish: (value: { ok: true }) => void = () => undefined
    mocks.setBookCollectionsFn.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    render(
      <BookCollections
        book={sherlock}
        collections={[santai, klasik]}
        onSaved={vi.fn()}
      />
    )
    const box = screen.getByLabelText("Bacaan santai")
    fireEvent.click(box)
    fireEvent.click(screen.getByLabelText("Klasik"))
    expect(mocks.setBookCollectionsFn).toHaveBeenCalledOnce()
    expect(box).toBeEnabled()
    expect(box).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByLabelText("Klasik")).not.toBeChecked()
    await act(async () => finish({ ok: true }))
    expect(box).toHaveAttribute("aria-disabled", "false")
  })

  it("is locked when the shelf came from the offline copy", () => {
    render(
      <BookCollections
        book={sherlock}
        collections={[santai]}
        offline
        onSaved={vi.fn()}
      />
    )
    expect(screen.getByLabelText("Bacaan santai")).toBeDisabled()
  })
})
