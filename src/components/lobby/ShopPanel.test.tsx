import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ShopView } from "@/lib/shop/types"
import { ShopPanel } from "./ShopPanel"

const ready = (
  changes: Partial<ShopView["state"] & object> = {}
): ShopView => ({
  status: "ready",
  preview: null,
  state: {
    earned: 310,
    spent: 60,
    balance: 250,
    owned: ["rug_woven", "rug_round"],
    placed: { rug: "rug_woven" },
    ...changes,
  },
})

const panel = (props: Partial<Parameters<typeof ShopPanel>[0]> = {}) => {
  const handlers = {
    onRetry: vi.fn(),
    onBuy: vi.fn(() => Promise.resolve({ ok: true as const })),
    onPlace: vi.fn(() => Promise.resolve({ ok: true as const })),
    onPreview: vi.fn(),
  }
  render(<ShopPanel view={ready()} offline={false} {...handlers} {...props} />)
  return { ...handlers, ...props }
}

const item = (name: string) => screen.getByRole("listitem", { name })

describe("ShopPanel", () => {
  it("shows the balance and how coins are earned", () => {
    panel()
    expect(screen.getByRole("heading", { name: "Toko lobi" })).toBeVisible()
    // The cat costs 250 too: the balance is the one in .shop-balance.
    expect(
      screen.getByText("250 koin", { selector: ".shop-balance" })
    ).toBeVisible()
    expect(
      screen.getByText(
        "1 koin per menit baca, +50 per buku selesai (dibaca minimal 1 jam)"
      )
    ).toBeVisible()
  })

  it("groups the items by slot, with their prices", () => {
    panel()
    expect(screen.getAllByRole("region")).toHaveLength(6)
    const pet = screen.getByRole("region", { name: "Teman" })
    expect(within(pet).getAllByRole("listitem")).toHaveLength(3)
    expect(within(item("Kucing tidur")).getByText("250 koin")).toBeVisible()
  })

  it("says which item is placed, which can be placed, and which can be bought", () => {
    panel()
    expect(within(item("Karpet anyaman")).getByText("Terpasang")).toBeVisible()
    expect(
      within(item("Karpet anyaman")).getByRole("button", { name: "Lepas" })
    ).toBeEnabled()
    expect(
      within(item("Karpet bundar")).getByRole("button", { name: "Pasang" })
    ).toBeEnabled()
    expect(
      within(item("Kucing tidur")).getByRole("button", { name: "Beli" })
    ).toBeEnabled()
  })

  it("says how many coins are missing", () => {
    panel()
    const sofa = item("Sofa jendela")
    expect(within(sofa).getByRole("button", { name: "Beli" })).toBeDisabled()
    expect(within(sofa).getByText("Kurang 150 koin")).toBeVisible()
  })

  it("asks before buying, then buys", async () => {
    const { onBuy } = panel()
    fireEvent.click(
      within(item("Kucing tidur")).getByRole("button", { name: "Beli" })
    )
    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByText("Beli Kucing tidur seharga 250 koin?")
    ).toBeVisible()
    fireEvent.click(within(dialog).getByRole("button", { name: "Beli" }))
    await waitFor(() => expect(onBuy).toHaveBeenCalledWith("pet_cat"))
  })

  it("buys nothing when the question is turned down", async () => {
    const { onBuy } = panel()
    fireEvent.click(
      within(item("Kucing tidur")).getByRole("button", { name: "Beli" })
    )
    fireEvent.click(await screen.findByRole("button", { name: "Batal" }))
    expect(onBuy).not.toHaveBeenCalled()
  })

  it("says the coins ran short when another device spent them", async () => {
    panel({
      onBuy: vi.fn(() =>
        Promise.resolve({ ok: false as const, code: "not_enough" })
      ),
    })
    fireEvent.click(
      within(item("Kucing tidur")).getByRole("button", { name: "Beli" })
    )
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Beli",
      })
    )
    // The message sits in the item that was acted on, not in the header.
    expect(
      await within(item("Kucing tidur")).findByRole("alert")
    ).toHaveTextContent("Koinmu belum cukup.")
    expect(screen.getAllByRole("alert")).toHaveLength(1)
  })

  it("places and takes off", async () => {
    const { onPlace } = panel()
    fireEvent.click(
      within(item("Karpet bundar")).getByRole("button", { name: "Pasang" })
    )
    await waitFor(() =>
      expect(onPlace).toHaveBeenCalledWith("rug", "rug_round")
    )
    fireEvent.click(
      within(item("Karpet anyaman")).getByRole("button", { name: "Lepas" })
    )
    await waitFor(() => expect(onPlace).toHaveBeenLastCalledWith("rug", null))
  })

  it("tries an item on in the lobby", () => {
    const { onPreview } = panel()
    fireEvent.click(
      within(item("Kucing tidur")).getByRole("button", {
        name: "Lihat di lobi",
      })
    )
    expect(onPreview).toHaveBeenCalledWith("pet_cat")
  })

  it("asks to read when there are no coins", () => {
    panel({
      view: ready({ earned: 0, spent: 0, balance: 0, owned: [], placed: {} }),
    })
    expect(screen.getByText("Baca untuk mendapat koin")).toBeVisible()
  })

  it("locks every button offline", () => {
    panel({ offline: true })
    expect(
      screen.getAllByText("Perlu koneksi internet").length
    ).toBeGreaterThan(0)
    for (const name of ["Beli", "Pasang", "Lepas"]) {
      for (const button of screen.queryAllByRole("button", { name })) {
        expect(button).toBeDisabled()
      }
    }
  })

  it("loads, and offers to try again when loading failed without a copy", () => {
    const { onRetry } = panel({
      view: { status: "failed", state: null, preview: null },
    })
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }))
    expect(onRetry).toHaveBeenCalled()
  })

  it("cannot try again offline, and says why", () => {
    const { onRetry } = panel({
      offline: true,
      view: { status: "failed", state: null, preview: null },
    })
    const retry = screen.getByRole("button", { name: "Coba lagi" })
    expect(retry).toBeDisabled()
    fireEvent.click(retry)
    expect(onRetry).not.toHaveBeenCalled()
    expect(screen.getByText("Perlu koneksi internet")).toBeVisible()
  })
})
