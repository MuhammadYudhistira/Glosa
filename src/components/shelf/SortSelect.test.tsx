import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SortSelect } from "./SortSelect"

const navigate = vi.fn()

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}))

describe("SortSelect", () => {
  beforeEach(() => {
    navigate.mockReset()
  })

  it("keeps the collection's own order out of the URL", () => {
    render(<SortSelect sort="finished" defaultSort="finished" />)
    const select = screen.getByLabelText("Urutkan")
    fireEvent.change(select, { target: { value: "opened" } })
    const first = navigate.mock.calls[0][0] as {
      search: (prev: object) => object
    }
    expect(first.search({})).toEqual({ sort: "opened" })
    fireEvent.change(select, { target: { value: "finished" } })
    const second = navigate.mock.calls[1][0] as {
      search: (prev: object) => object
    }
    expect(second.search({ sort: "opened" })).toEqual({ sort: undefined })
  })
})
