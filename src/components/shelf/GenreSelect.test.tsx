import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SHELF_FILTERS, type ShelfFilter } from "@/lib/shelf"
import { GenreSelect } from "./GenreSelect"

const navigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))

const counts = Object.fromEntries(
  SHELF_FILTERS.map(({ value }) => [value, 2])
) as Record<ShelfFilter, number>

describe("GenreSelect", () => {
  beforeEach(() => navigate.mockReset())

  it("lists every genre and the trolley with their counts", () => {
    render(<GenreSelect value="semua" counts={counts} />)
    const select = screen.getByLabelText("Tampilkan genre")
    expect(select).toHaveValue("semua")
    expect(
      screen.getByRole("option", { name: "Misteri & Thriller · 2" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Troli Buku Baru · 2" })
    ).toBeInTheDocument()
  })

  it("puts the genre in the URL, and takes Semua out of it", () => {
    render(<GenreSelect value="semua" counts={counts} />)
    const select = screen.getByLabelText("Tampilkan genre")
    fireEvent.change(select, { target: { value: "troli" } })
    const first = navigate.mock.calls[0][0] as {
      search: (prev: object) => object
    }
    expect(first.search({ q: "a" })).toEqual({ q: "a", genre: "troli" })
    fireEvent.change(select, { target: { value: "semua" } })
    const second = navigate.mock.calls[1][0] as {
      search: (prev: object) => object
    }
    expect(second.search({ genre: "troli" })).toEqual({ genre: undefined })
  })
})
