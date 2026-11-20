import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { ShelfBook } from "@/lib/book-types"
import { HotspotLayer } from "./HotspotLayer"
import { STILL_SIZE, STILL_VIEW } from "./LobbyStill"
import { lobbyHotspots, summarizeLobby } from "./lobby-data"
import { anchorOf } from "./scene/pick-volumes"
import { project } from "./scene/projection"

const onTrolley: ShelfBook = { ...sherlock, id: "t", genre: null }

function renderLayer(
  books: Array<ShelfBook>,
  more: Partial<Parameters<typeof HotspotLayer>[0]> = {}
) {
  const onKey = vi.fn()
  const onTap = vi.fn()
  const onFocusSpot = vi.fn()
  render(
    <HotspotLayer
      hotspots={lobbyHotspots(summarizeLobby(books).counts)}
      view={STILL_VIEW}
      viewport={STILL_SIZE}
      onKey={onKey}
      onTap={onTap}
      onFocusSpot={onFocusSpot}
      {...more}
    />
  )
  return { onKey, onTap, onFocusSpot }
}

describe("HotspotLayer", () => {
  it("names each place by its label alone, without a count", () => {
    renderLayer([sherlock, onTrolley])
    expect(
      screen.getByRole("button", { name: "Misteri & Thriller" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Kotak buku baru" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Sudah dibaca" })
    ).toBeInTheDocument()
  })

  it("starts at the reading chair and ends at the fireplace, corkboard and door", () => {
    renderLayer([sherlock])
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(18)
    expect(buttons[0]).toHaveAccessibleName("Kursi baca")
    expect(buttons.at(-6)).toHaveAccessibleName("Sudah dibaca")
    expect(buttons.at(-5)).toHaveAccessibleName("Kebiasaan baca")
    expect(buttons.at(-4)).toHaveAccessibleName("Toko dekorasi")
    expect(buttons.at(-3)).toHaveAccessibleName("Kilas balik")
    expect(buttons.at(-2)).toHaveAccessibleName("Sorotan")
    expect(buttons.at(-1)).toHaveAccessibleName("Pengaturan")
  })

  it("puts each place's button at its anchor on screen", () => {
    renderLayer([sherlock])
    const anchor = screen.getByRole("button", { name: "Kursi baca" })
      .parentElement as HTMLElement
    const { x, y } = project(anchorOf("meja-baca"), STILL_VIEW, STILL_SIZE)
    expect(anchor.style.left).toBe(`${x}%`)
    expect(anchor.style.top).toBe(`${y}%`)
  })

  it("draws dots only in the still image", () => {
    renderLayer([sherlock])
    for (const button of screen.getAllByRole("button")) {
      expect(button).not.toHaveAttribute("data-dot")
    }
  })

  it("makes a dot of each place in the still image, and taps through it", () => {
    const { onTap } = renderLayer([sherlock], { dots: true })
    const buttons = screen.getAllByRole("button")
    for (const button of buttons) expect(button).toHaveAttribute("data-dot")
    fireEvent.click(screen.getByRole("button", { name: "Meja tulis" }), {
      detail: 1,
    })
    expect(onTap).toHaveBeenCalledWith("meja-admin")
  })

  it("tells a press from Enter or Space (a click without a pointer)", () => {
    const { onKey, onTap } = renderLayer([sherlock])
    fireEvent.click(screen.getByRole("button", { name: "Meja tulis" }), {
      detail: 0,
    })
    expect(onKey).toHaveBeenCalledWith("meja-admin")
    expect(onTap).not.toHaveBeenCalled()
  })

  it("shows a speech bubble above its place", () => {
    renderLayer([sherlock], {
      bubbles: { "meja-baca": <p>Halo dari kursi</p> },
    })
    expect(screen.getByText("Halo dari kursi")).toBeInTheDocument()
  })

  it("picks the place on focus, but not on the focus a press brings", () => {
    const { onFocusSpot } = renderLayer([sherlock])
    const button = screen.getByRole("button", { name: "Meja tulis" })
    button.focus()
    expect(onFocusSpot).toHaveBeenCalledWith("meja-admin")
    onFocusSpot.mockClear()
    button.blur()
    fireEvent.pointerDown(button)
    button.focus()
    expect(onFocusSpot).not.toHaveBeenCalled()
  })

  it("does not pick a pressed dot when the press takes focus from another place", () => {
    const { onFocusSpot } = renderLayer([sherlock], { dots: true })
    const before = screen.getByRole("button", { name: "Kursi baca" })
    const pressed = screen.getByRole("button", { name: "Meja tulis" })
    before.focus()
    onFocusSpot.mockClear()
    // A press: pointerdown on the dot, then the other place blurs, then it focuses.
    fireEvent.pointerDown(pressed)
    pressed.focus()
    expect(onFocusSpot).not.toHaveBeenCalled()
  })
})
