import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Collection } from "@/lib/book-types"
import { CollectionDialog } from "./CollectionDialog"

const mocks = vi.hoisted(() => ({
  createCollectionFn: vi.fn(),
  renameCollectionFn: vi.fn(),
  deleteCollectionFn: vi.fn(),
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/collections", () => mocks)

const santai: Collection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Bacaan santai",
  createdAt: "2026-10-20T00:00:00+00:00",
}

afterEach(() => {
  vi.clearAllMocks()
})

function renderDialog(editing: Collection | null) {
  const onDone = vi.fn()
  render(
    <CollectionDialog
      open
      editing={editing}
      onOpenChange={vi.fn()}
      onDone={onDone}
    />
  )
  return onDone
}

describe("CollectionDialog", () => {
  it("makes a collection and opens it", async () => {
    mocks.createCollectionFn.mockResolvedValueOnce({ ok: true, id: santai.id })
    const onDone = renderDialog(null)
    fireEvent.change(screen.getByLabelText("Nama koleksi"), {
      target: { value: "  Bacaan santai " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Buat" }))
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({
        notice: "Koleksi “Bacaan santai” dibuat.",
        koleksi: santai.id,
      })
    )
    expect(mocks.createCollectionFn).toHaveBeenCalledWith({
      data: { name: "Bacaan santai" },
    })
  })

  it("says why a name is refused", async () => {
    mocks.createCollectionFn.mockResolvedValueOnce({
      ok: false,
      code: "collection_duplicate",
    })
    const onDone = renderDialog(null)
    fireEvent.change(screen.getByLabelText("Nama koleksi"), {
      target: { value: "Bacaan santai" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Buat" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sudah ada koleksi dengan nama itu."
    )
    expect(onDone).not.toHaveBeenCalled()
  })

  it("does not send an empty name", () => {
    renderDialog(null)
    fireEvent.click(screen.getByRole("button", { name: "Buat" }))
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nama koleksi harus 1–40 karakter."
    )
    expect(mocks.createCollectionFn).not.toHaveBeenCalled()
  })

  it("renames a collection", async () => {
    mocks.renameCollectionFn.mockResolvedValueOnce({ ok: true })
    const onDone = renderDialog(santai)
    const input = screen.getByLabelText("Nama koleksi")
    expect(input).toHaveValue("Bacaan santai")
    fireEvent.change(input, { target: { value: "Santai" } })
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }))
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({ notice: "Nama koleksi diganti." })
    )
  })

  it("deletes a collection after asking, and goes back to Semua", async () => {
    mocks.deleteCollectionFn.mockResolvedValueOnce({ ok: true })
    const onDone = renderDialog(santai)
    fireEvent.click(screen.getByRole("button", { name: "Hapus koleksi" }))
    expect(
      screen.getByText("Hapus koleksi “Bacaan santai”? Bukunya tetap di rak.")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ya, hapus" }))
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({
        notice: "Koleksi “Bacaan santai” dihapus.",
        koleksi: null,
      })
    )
  })

  it("counts a collection already gone as deleted", async () => {
    mocks.deleteCollectionFn.mockResolvedValueOnce({
      ok: false,
      code: "collection_missing",
    })
    const onDone = renderDialog(santai)
    fireEvent.click(screen.getByRole("button", { name: "Hapus koleksi" }))
    fireEvent.click(screen.getByRole("button", { name: "Ya, hapus" }))
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({
        notice: "Koleksi “Bacaan santai” dihapus.",
        koleksi: null,
      })
    )
  })

  it("says a renamed collection is gone", async () => {
    mocks.renameCollectionFn.mockResolvedValueOnce({
      ok: false,
      code: "collection_missing",
    })
    const onDone = renderDialog(santai)
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Koleksi ini sudah tidak ada."
    )
    expect(onDone).not.toHaveBeenCalled()
  })

  it("ignores a second submit while saving, and keeps the button focusable", async () => {
    let finish: (value: { ok: true }) => void = () => undefined
    mocks.renameCollectionFn.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    renderDialog(santai)
    const save = screen.getByRole("button", { name: "Simpan" })
    fireEvent.click(save)
    fireEvent.click(save)
    expect(mocks.renameCollectionFn).toHaveBeenCalledOnce()
    expect(save).toBeEnabled()
    expect(save).toHaveAttribute("aria-busy", "true")
    await act(async () => finish({ ok: true }))
  })
})
