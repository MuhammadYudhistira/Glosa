import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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
})
