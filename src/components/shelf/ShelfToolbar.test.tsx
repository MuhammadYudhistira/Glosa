import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ShelfToolbar } from "./ShelfToolbar"

const navigate = vi.fn()

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}))

describe("ShelfToolbar", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigate.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("follows ?q= changes that did not come from typing", () => {
    const { rerender } = render(
      <ShelfToolbar q="alice" sort="opened" defaultSort="opened" />
    )
    const input = screen.getByLabelText("Cari judul atau penulis")
    expect(input).toHaveValue("alice")
    rerender(<ShelfToolbar q="bob" sort="opened" defaultSort="opened" />)
    expect(input).toHaveValue("bob")
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  it("pushes typed text to the URL once after the debounce", () => {
    render(<ShelfToolbar q="" sort="opened" defaultSort="opened" />)
    const input = screen.getByLabelText("Cari judul atau penulis")
    fireEvent.change(input, { target: { value: "emma" } })
    expect(navigate).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it("keeps the collection's own order out of the URL", () => {
    render(<ShelfToolbar q="" sort="finished" defaultSort="finished" />)
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
