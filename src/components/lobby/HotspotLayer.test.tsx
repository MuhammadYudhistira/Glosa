import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { ShelfBook } from "@/lib/book-types"
import { HotspotLayer } from "./HotspotLayer"
import { layoutLabels, placeLabels } from "./label-layout"
import type * as LabelLayout from "./label-layout"
import { STILL_SIZE, STILL_VIEW } from "./LobbyStill"
import { lobbyHotspots, summarizeLobby } from "./lobby-data"
import { spotOf } from "./scene/layout"
import { project, startView } from "./scene/projection"

// The real layout, watched: how often the layer lays its labels out.
vi.mock("./label-layout", async (importOriginal) => {
  const real = await importOriginal<typeof LabelLayout>()
  return {
    ...real,
    layoutLabels: vi.fn(real.layoutLabels),
    placeLabels: vi.fn(real.placeLabels),
  }
})

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
      screen.getByRole("button", { name: "Kotak buku baru · 1 buku" })
    ).toBeInTheDocument()
  })

  it("names an empty trolley without a count", () => {
    renderLayer([sherlock])
    expect(
      screen.getByRole("button", { name: "Kotak buku baru" })
    ).toBeInTheDocument()
  })

  it("starts at the reading table and ends at the fireplace, corkboard and door", () => {
    renderLayer([sherlock])
    const buttons = screen.getAllByRole("button")
    expect(buttons[0]).toHaveAccessibleName("Kursi baca")
    expect(buttons.at(-6)).toHaveAccessibleName("Sudah dibaca · 0 buku")
    expect(buttons.at(-5)).toHaveAccessibleName("Kebiasaan baca")
    expect(buttons.at(-4)).toHaveAccessibleName("Toko dekorasi")
    expect(buttons.at(-3)).toHaveAccessibleName("Kilas balik")
    expect(buttons.at(-2)).toHaveAccessibleName("Sorotan")
    expect(buttons.at(-1)).toHaveAccessibleName("Pengaturan")
  })

  it("puts each hotspot where its spot appears on screen", () => {
    renderLayer([sherlock])
    const anchor = screen.getByRole("button", { name: "Kursi baca" })
      .parentElement as HTMLElement
    const { x, y } = project(spotOf("meja-baca").label, STILL_VIEW, STILL_SIZE)
    expect(anchor.style.left).toBe(`${x}%`)
    expect(anchor.style.top).toBe(`${y}%`)
  })

  it("acts on a tap and shows a speech bubble above its hotspot", () => {
    const onActivate = renderLayer([sherlock], "Halo dari meja baca")
    fireEvent.click(screen.getByRole("button", { name: "Meja tulis" }), {
      detail: 1,
    })
    expect(onActivate).toHaveBeenCalledWith("meja-admin", { keyboard: false })
    expect(screen.getByText("Halo dari meja baca")).toBeInTheDocument()
  })

  it("tells a press from Enter or Space (a click without a pointer)", () => {
    const onActivate = renderLayer([sherlock])
    fireEvent.click(screen.getByRole("button", { name: "Meja tulis" }), {
      detail: 0,
    })
    expect(onActivate).toHaveBeenCalledWith("meja-admin", { keyboard: true })
  })

  it("keeps every label invisible until its frame is known, still focusable and named", () => {
    // Before the first measure the labels' pixels are unknown: drawn in full
    // at their raw spots they would overlap.
    renderLayer([sherlock])
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(18)
    for (const button of buttons) {
      expect(button).toHaveAttribute("data-look", "hidden")
      expect(button).not.toHaveAttribute("tabindex")
    }
    expect(
      screen.getByRole("button", { name: "Misteri & Thriller · 1 buku" })
    ).toBeInTheDocument()
  })

  it("keeps every label in full where they all fit (a desktop screen)", () => {
    const viewport = { width: 1440, height: 900 }
    render(
      <HotspotLayer
        hotspots={lobbyHotspots(summarizeLobby([sherlock]).counts)}
        view={startView(viewport)}
        viewport={viewport}
        frame={viewport}
        fontPx={14}
        onActivate={vi.fn()}
      />
    )
    for (const button of screen.getAllByRole("button")) {
      expect(button).not.toHaveAttribute("data-look")
    }
  })

  it("lays its labels out again only when the view, the frame or the labels change, from the last layout", () => {
    const viewport = { width: 390, height: 788 }
    const hotspots = lobbyHotspots(summarizeLobby([sherlock]).counts)
    const view = startView(viewport)
    const ui = (props: { view?: typeof view; onActivate?: () => void }) => (
      <HotspotLayer
        hotspots={hotspots}
        view={props.view ?? view}
        viewport={viewport}
        frame={{ ...viewport }}
        fontPx={12}
        onActivate={props.onActivate ?? vi.fn()}
      />
    )
    vi.mocked(layoutLabels).mockClear()
    const { rerender } = render(ui({}))
    expect(layoutLabels).toHaveBeenCalledTimes(1)
    // A new handler and an equal frame: nothing to lay out again.
    rerender(ui({ onActivate: vi.fn() }))
    expect(layoutLabels).toHaveBeenCalledTimes(1)
    // The camera moves: laid out again, holding the looks it had.
    rerender(ui({ view: { ...view, zoom: view.zoom * 1.01 } }))
    expect(layoutLabels).toHaveBeenCalledTimes(2)
    const [, options] = vi.mocked(layoutLabels).mock.calls[1]
    expect(options?.previous).toBe(
      vi.mocked(layoutLabels).mock.results[0].value
    )
  })

  it("measures each label's full pill on the page, and lays out with those sizes", () => {
    // jsdom has no layout: the hidden copies report a size here, as a browser
    // would (a long name, or a wider fallback font).
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const measured =
          this.parentElement?.classList.contains("lobby-hotspot-measure") ??
          false
        return DOMRect.fromRect(
          measured ? { width: 250.2, height: 30.5 } : { width: 0, height: 0 }
        )
      }
    )
    const viewport = { width: 1440, height: 900 }
    vi.mocked(placeLabels).mockClear()
    const { container } = render(
      <HotspotLayer
        hotspots={lobbyHotspots(summarizeLobby([sherlock]).counts)}
        view={startView(viewport)}
        viewport={viewport}
        frame={viewport}
        fontPx={14}
        onActivate={vi.fn()}
      />
    )
    // The copies are for measuring only: no names, no buttons.
    const copies = container.querySelector(".lobby-hotspot-measure")!
    expect(copies).toHaveAttribute("aria-hidden", "true")
    expect(copies.children).toHaveLength(18)
    expect(screen.getAllByRole("button")).toHaveLength(18)
    const sizes = vi.mocked(placeLabels).mock.lastCall?.[5]
    expect(sizes?.get("bisnis_pengembangan_diri")).toEqual({
      width: 251,
      height: 31,
    })
    vi.mocked(Element.prototype.getBoundingClientRect).mockRestore()
  })

  it("shrinks labels with no room to marks, and keeps every one in the tab order", () => {
    // A phone drawing the whole room: too small for every pill.
    const viewport = { width: 390, height: 788 }
    const onActivate = vi.fn()
    render(
      <HotspotLayer
        hotspots={lobbyHotspots(summarizeLobby([sherlock]).counts)}
        view={startView(viewport)}
        viewport={viewport}
        frame={viewport}
        fontPx={12}
        onActivate={onActivate}
      />
    )
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(18)
    const looks = buttons.map((button) => button.getAttribute("data-look"))
    expect(looks).toContain("mark")
    // The reading chair keeps its name; a mark keeps its accessible name.
    expect(
      screen.getByRole("button", { name: "Kursi baca" })
    ).not.toHaveAttribute("data-look")
    for (const button of buttons) {
      expect(button).not.toHaveAttribute("tabindex")
    }
    const mark = buttons.find((b) => b.getAttribute("data-look") === "mark")!
    fireEvent.click(mark, { detail: 1 })
    expect(onActivate).toHaveBeenCalled()
  })
})
