import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import { LibraryMap } from "./LibraryMap"
import { lobbyHotspots, summarizeLobby } from "./lobby-data"
import { ROOM } from "./scene/layout"

/** The middle of the floor: the middle of the map. */
const CENTRE = [ROOM.width / 2, ROOM.depth / 2] as const

const hotspots = lobbyHotspots(summarizeLobby([sherlock]).counts)

describe("LibraryMap", () => {
  it("offers Kilas balik only when it can open it", () => {
    const onRecap = vi.fn()
    const { rerender } = render(
      <LibraryMap
        hotspots={hotspots}
        anda={CENTRE}
        onSelect={vi.fn()}
        onRecap={onRecap}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Kilas balik" }))
    expect(onRecap).toHaveBeenCalled()
    rerender(
      <LibraryMap hotspots={hotspots} anda={CENTRE} onSelect={vi.fn()} />
    )
    expect(screen.queryByRole("button", { name: "Kilas balik" })).toBeNull()
  })

  it("sends the camera to a place picked on the map", () => {
    const onSelect = vi.fn()
    render(<LibraryMap hotspots={hotspots} anda={CENTRE} onSelect={onSelect} />)
    expect(screen.getAllByRole("button")).toHaveLength(18)
    fireEvent.click(screen.getByRole("button", { name: "Kursi baca di peta" }))
    expect(onSelect).toHaveBeenCalledWith("meja-baca")
  })

  it("marks each kind of place as its legend shows", () => {
    const { container } = render(
      <LibraryMap hotspots={hotspots} anda={CENTRE} onSelect={vi.fn()} />
    )
    expect(screen.getByText("ketuk untuk pindah")).toBeInTheDocument()
    const kindOf = (name: string) =>
      screen.getByRole("button", { name }).getAttribute("data-kind")
    expect(kindOf("Fiksi & Sastra di peta")).toBe("zone")
    expect(kindOf("Kursi baca di peta")).toBe("meja-baca")
    expect(kindOf("Meja tulis di peta")).toBe("meja-admin")
    expect(kindOf("Kotak buku baru di peta")).toBe("troli")
    expect(kindOf("Kosakata di peta")).toBe("katalog")
    expect(kindOf("Sudah dibaca di peta")).toBe("lemari")
    expect(kindOf("Kebiasaan baca di peta")).toBe("tanaman")
    expect(kindOf("Toko dekorasi di peta")).toBe("toko")
    const legend = container.querySelector(".lobby-legend")
    expect(legend).toHaveTextContent(
      "Rak bukuKursi bacaMeja tulisKotak buku baruKosakataSudah dibacaKebiasaan bacaKilas balikSorotanPengaturanToko dekorasiPosisi Anda"
    )
  })

  it("marks the fireplace, corkboard and door with their own kinds", () => {
    render(<LibraryMap hotspots={hotspots} anda={CENTRE} onSelect={vi.fn()} />)
    for (const [label, id] of [
      ["Kilas balik", "perapian"],
      ["Sorotan", "papan"],
      ["Pengaturan", "pintu"],
    ]) {
      expect(
        screen.getByRole("button", { name: `${label} di peta` })
      ).toHaveAttribute("data-kind", id)
    }
  })

  it("turns its spots off while no 3D camera can move", () => {
    const onSelect = vi.fn()
    render(
      <LibraryMap
        hotspots={hotspots}
        anda={CENTRE}
        onSelect={onSelect}
        interactive={false}
      />
    )
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled()
    }
    expect(
      screen.getByText("Peta aktif saat adegan 3D tampil.")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Kursi baca di peta" }))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("marks where 'Anda' stands", () => {
    render(<LibraryMap hotspots={hotspots} anda={CENTRE} onSelect={vi.fn()} />)
    expect(screen.getByText("Anda").parentElement).toHaveStyle({
      left: "50%",
      top: "50%",
    })
  })
})
