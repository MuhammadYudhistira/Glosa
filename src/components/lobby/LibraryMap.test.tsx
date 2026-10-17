import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import { LibraryMap } from "./LibraryMap"
import { lobbyHotspots, summarizeLobby } from "./lobby-data"

const hotspots = lobbyHotspots(summarizeLobby([sherlock]).counts)

describe("LibraryMap", () => {
  it("sends the camera to a place picked on the map", () => {
    const onSelect = vi.fn()
    render(
      <LibraryMap hotspots={hotspots} anda={[17, 17]} onSelect={onSelect} />
    )
    expect(screen.getAllByRole("button")).toHaveLength(11)
    fireEvent.click(screen.getByRole("button", { name: "Meja Baca di peta" }))
    expect(onSelect).toHaveBeenCalledWith("meja-baca")
  })

  it("marks each kind of place as its legend shows", () => {
    const { container } = render(
      <LibraryMap hotspots={hotspots} anda={[17, 17]} onSelect={vi.fn()} />
    )
    expect(screen.getByText("ketuk untuk pindah")).toBeInTheDocument()
    const kindOf = (name: string) =>
      screen.getByRole("button", { name }).getAttribute("data-kind")
    expect(kindOf("Fiksi & Sastra di peta")).toBe("zone")
    expect(kindOf("Meja Baca di peta")).toBe("meja-baca")
    expect(kindOf("Meja Admin di peta")).toBe("meja-admin")
    expect(kindOf("Troli Buku Baru di peta")).toBe("troli")
    const legend = container.querySelector(".lobby-legend")
    expect(legend).toHaveTextContent(
      "Rak bukuMeja BacaMeja AdminTroli Buku BaruPosisi Anda"
    )
  })

  it("turns its spots off while no 3D camera can move", () => {
    const onSelect = vi.fn()
    render(
      <LibraryMap
        hotspots={hotspots}
        anda={[17, 17]}
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
    fireEvent.click(screen.getByRole("button", { name: "Meja Baca di peta" }))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("marks where 'Anda' stands", () => {
    render(
      <LibraryMap hotspots={hotspots} anda={[17, 17]} onSelect={vi.fn()} />
    )
    expect(screen.getByText("Anda").parentElement).toHaveStyle({
      left: "50%",
      top: "50%",
    })
  })
})
