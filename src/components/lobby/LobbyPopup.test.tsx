import { act, fireEvent, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { renderWithRouter } from "@/test/router"
import { LobbyPopup, isPopupPath } from "./LobbyPopup"

const shelf = (
  <LobbyPopup label="Rak Saya">
    <h1>Rak Saya</h1>
    <div role="dialog" aria-label="Detail buku">
      <button type="button">Di dialog</button>
    </div>
  </LobbyPopup>
)

describe("LobbyPopup", () => {
  afterEach(() => unstubWideScreen())

  it("knows which pages open over the lobby", () => {
    expect(isPopupPath("/shelf")).toBe(true)
    expect(isPopupPath("/settings")).toBe(true)
    expect(isPopupPath("/lobby")).toBe(false)
    expect(isPopupPath("/read/abc")).toBe(false)
  })

  it("is the labelled main area and takes the focus to its heading on desktop", async () => {
    stubWideScreen(true)
    renderWithRouter(shelf, "/shelf")
    const main = await screen.findByRole("main", { name: "Rak Saya" })
    const heading = within(main).getByRole("heading", { level: 1 })
    await vi.waitFor(() => expect(heading).toHaveFocus())
    expect(heading).toHaveAttribute("tabindex", "-1")
  })

  it("leaves the focus alone on phones, where it is a page", async () => {
    stubWideScreen(false)
    renderWithRouter(shelf, "/shelf")
    const main = await screen.findByRole("main", { name: "Rak Saya" })
    expect(within(main).getByRole("heading", { level: 1 })).not.toHaveFocus()
  })

  it.each([
    [
      "its close button",
      () =>
        fireEvent.click(screen.getByRole("button", { name: "Tutup Rak Saya" })),
    ],
    [
      "the dimmed lobby",
      () => {
        const backdrop = document.querySelector(".lobby-popup-backdrop")
        if (!backdrop) throw new Error("no backdrop")
        fireEvent.click(backdrop)
      },
    ],
    ["Escape", () => fireEvent.keyDown(document.body, { key: "Escape" })],
  ])("closes to the lobby with %s", async (_how, act_) => {
    stubWideScreen(true)
    const { router } = renderWithRouter(shelf, "/shelf")
    await screen.findByRole("main", { name: "Rak Saya" })
    await act(async () => act_())
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe("/lobby")
    )
  })

  it("leaves Escape to a dialog over it, to the top bar, and to phones", async () => {
    const media = stubWideScreen(true)
    const { router } = renderWithRouter(
      <>
        <header className="lobby-topbar">
          <input aria-label="Cari di rakmu" />
        </header>
        {shelf}
      </>,
      "/shelf"
    )
    await screen.findByRole("main", { name: "Rak Saya" })
    fireEvent.keyDown(screen.getByRole("button", { name: "Di dialog" }), {
      key: "Escape",
    })
    fireEvent.keyDown(screen.getByLabelText("Cari di rakmu"), {
      key: "Escape",
    })
    media.set(false)
    fireEvent.keyDown(document.body, { key: "Escape" })
    await act(async () => {})
    expect(router.state.location.pathname).toBe("/shelf")
  })

  it("gives the focus back to what opened it", async () => {
    stubWideScreen(true)
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Buka rak
          </button>
          {open && (
            <LobbyPopup label="Rak Saya">
              <h1>Rak Saya</h1>
              <button type="button" onClick={() => setOpen(false)}>
                Selesai
              </button>
            </LobbyPopup>
          )}
        </>
      )
    }
    renderWithRouter(<Harness />, "/shelf")
    const opener = await screen.findByRole("button", { name: "Buka rak" })
    opener.focus()
    fireEvent.click(opener)
    const heading = await screen.findByRole("heading", { level: 1 })
    await vi.waitFor(() => expect(heading).toHaveFocus())
    fireEvent.click(screen.getByRole("button", { name: "Selesai" }))
    expect(opener).toHaveFocus()
  })

  it("falls back to the lobby's search when the opener is gone", async () => {
    stubWideScreen(true)
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <input aria-label="Cari di rakmu" data-lobby-search="" />
          {open && (
            <LobbyPopup label="Rak Saya">
              <h1>Rak Saya</h1>
              <button type="button" onClick={() => setOpen(false)}>
                Selesai
              </button>
            </LobbyPopup>
          )}
        </>
      )
    }
    renderWithRouter(<Harness />, "/shelf")
    fireEvent.click(await screen.findByRole("button", { name: "Selesai" }))
    expect(screen.getByLabelText("Cari di rakmu")).toHaveFocus()
  })
})
