import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ShelfHeader } from "./ShelfHeader"

describe("ShelfHeader", () => {
  it("names its icon buttons and says when the search is open", () => {
    const onSearch = vi.fn()
    const onFilter = vi.fn()
    const onBring = vi.fn()
    render(
      <ShelfHeader
        searching={false}
        onSearch={onSearch}
        onFilter={onFilter}
        filtersActive
        onBring={onBring}
      />
    )
    expect(
      screen.getByRole("heading", { name: "Rak Saya" })
    ).toBeInTheDocument()
    const search = screen.getByRole("button", { name: "Cari" })
    expect(search).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(search)
    fireEvent.click(screen.getByRole("button", { name: "Saring" }))
    fireEvent.click(screen.getByRole("button", { name: "Bawa buku" }))
    expect(onSearch).toHaveBeenCalledOnce()
    expect(onFilter).toHaveBeenCalledOnce()
    expect(onBring).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "Saring" })).toHaveAttribute(
      "data-active"
    )
  })

  it("has no bring button on an empty shelf", () => {
    render(
      <ShelfHeader
        searching
        onSearch={vi.fn()}
        onFilter={vi.fn()}
        filtersActive={false}
      />
    )
    expect(screen.queryByRole("button", { name: "Bawa buku" })).toBeNull()
    expect(screen.getByRole("button", { name: "Cari" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })
})
