import { fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import { renderWithRouter } from "@/test/router"
import { TrolleyPanel } from "./TrolleyPanel"

vi.mock("@/components/shelf/useSaveGenre", () => ({
  useSaveGenre: () => ({
    save: vi.fn(async () => ({ ok: true })),
    saving: false,
  }),
}))

const onTrolley = { ...sherlock, genre: null }

function renderPanel(books = [onTrolley]) {
  const onSaved = vi.fn()
  renderWithRouter(
    <TrolleyPanel open onOpenChange={vi.fn()} books={books} onSaved={onSaved} />
  )
  return onSaved
}

describe("TrolleyPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("gives a trolley book its shelf", async () => {
    const onSaved = renderPanel()
    const dialog = await screen.findByRole("dialog", { name: "Susun buku" })
    fireEvent.change(screen.getByLabelText(`Genre untuk ${sherlock.title}`), {
      target: { value: "fiksi_sastra" },
    })
    expect(
      await screen.findByText("Dipindahkan ke Fiksi & Sastra.")
    ).toBeInTheDocument()
    expect(onSaved).toHaveBeenCalled()
    expect(dialog).toBeInTheDocument()
  })

  it("says when the trolley is empty", async () => {
    renderPanel([])
    expect(
      await screen.findByText("Troli kosong. Semua buku sudah punya rak.")
    ).toBeInTheDocument()
  })

  it("needs a connection to sort books", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    renderPanel()
    expect(await screen.findByText("Butuh internet.")).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })
})
