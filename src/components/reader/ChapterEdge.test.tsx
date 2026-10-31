import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChapterEdge } from "./ChapterEdge"
import type { ChapterEdgeState } from "./ReaderView"

const END: ChapterEdgeState = {
  side: "end",
  progress: 0,
  label: "Bab 5: Perjalanan Pulang",
  bookEnd: false,
}

function renderEdge(edge: ChapterEdgeState | null, onMove = vi.fn()) {
  render(
    <ChapterEdge
      edge={edge}
      chromeShown={false}
      backShown={false}
      onMove={onMove}
    />
  )
  return onMove
}

describe("ChapterEdge", () => {
  it("shows nothing away from an edge", () => {
    const { container } = render(
      <ChapterEdge edge={null} chromeShown backShown={false} onMove={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("names the next chapter and moves on when pressed", () => {
    const onMove = renderEdge(END)
    const button = screen.getByRole("button", {
      name: "Akhir bab · Gulir terus ke Bab 5: Perjalanan Pulang",
    })
    fireEvent.click(button)
    expect(onMove).toHaveBeenCalledWith("next")
  })

  it("says the plain words when the contents have no name", () => {
    renderEdge({ ...END, label: null })
    expect(
      screen.getByRole("button", {
        name: "Akhir bagian · Gulir terus untuk lanjut",
      })
    ).toBeInTheDocument()
  })

  it("goes back from the start", () => {
    const onMove = renderEdge({
      side: "start",
      progress: 0.4,
      label: "Bab 3: Kota Lama",
      bookEnd: false,
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Tarik ke bawah ke Bab 3: Kota Lama" })
    )
    expect(onMove).toHaveBeenCalledWith("prev")
  })

  it("has the plain words for the start too", () => {
    renderEdge({ side: "start", progress: 0.4, label: null, bookEnd: false })
    expect(
      screen.getByRole("button", {
        name: "Tarik ke bawah ke bagian sebelumnya",
      })
    ).toBeInTheDocument()
  })

  it("only says so at the end of the book", () => {
    renderEdge({ ...END, label: null, bookEnd: true })
    expect(screen.getByText("Akhir buku")).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("fills its bar as the member pulls", () => {
    const { container } = render(
      <ChapterEdge
        edge={{ ...END, progress: 0.5 }}
        chromeShown={false}
        backShown={false}
        onMove={vi.fn()}
      />
    )
    const fill = container.querySelector<HTMLElement>(".chapter-edge-fill")
    expect(fill?.style.transform).toBe("scaleX(0.5)")
  })
})
