import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { ShelfBook } from "@/lib/book-types"
import { HotspotLayer } from "./HotspotLayer"
import { STILL_SIZE, STILL_VIEW } from "./LobbyStill"
import { lobbyHotspots, summarizeLobby } from "./lobby-data"
import { spotOf } from "./scene/layout"
import { project } from "./scene/projection"

const onTrolley: ShelfBook = { ...sherlock, id: "t", genre: null }

function renderLayer(books: Array<ShelfBook>, bubble?: string) {
  const onActivate = vi.fn()
  render(
    <HotspotLayer
      hotspots={lobbyHotspots(summarizeLobby(books).counts)}
      view={STILL_VIEW}
      viewport={STILL_SIZE}
      bubbles={bubble ? { "meja-baca": <p>{bubble}</p> } : undefined}
      onActivate={onActivate}
    />
  )
  return onActivate
}

describe("HotspotLayer", () => {
  it("names the zones and the trolley with their book counts", () => {
    renderLayer([sherlock, onTrolley])
    expect(
      screen.getByRole("button", { name: "Misteri & Thriller · 1 buku" })
    ).not.toHaveAttribute("data-empty")
    expect(
      screen.getByRole("button", { name: "Fiksi & Sastra · 0 buku" })
    ).toHaveAttribute("data-empty")
    expect(
      screen.getByRole("button", { name: "Troli Buku Baru · 1 buku" })
    ).toBeInTheDocument()
  })

  it("names an empty trolley without a count", () => {
    renderLayer([sherlock])
    expect(
      screen.getByRole("button", { name: "Troli Buku Baru" })
    ).toBeInTheDocument()
  })

  it("starts at the reading table and ends at the admin desk", () => {
    renderLayer([sherlock])
    const buttons = screen.getAllByRole("button")
    expect(buttons[0]).toHaveAccessibleName("Meja Baca")
    expect(buttons.at(-1)).toHaveAccessibleName("Meja Admin")
  })

  it("puts each hotspot where its spot appears on screen", () => {
    renderLayer([sherlock])
    const anchor = screen.getByRole("button", { name: "Meja Baca" })
      .parentElement as HTMLElement
    const { x, y } = project(spotOf("meja-baca").label, STILL_VIEW, STILL_SIZE)
    expect(anchor.style.left).toBe(`${x}%`)
    expect(anchor.style.top).toBe(`${y}%`)
  })

  it("acts on a tap and shows a speech bubble above its hotspot", () => {
    const onActivate = renderLayer([sherlock], "Halo dari meja baca")
    fireEvent.click(screen.getByRole("button", { name: "Meja Admin" }))
    expect(onActivate).toHaveBeenCalledWith("meja-admin")
    expect(screen.getByText("Halo dari meja baca")).toBeInTheDocument()
  })
})
