import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ShelfSearch } from "./ShelfSearch"

const navigate = vi.fn()

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}))

describe("ShelfSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigate.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("follows ?q= changes that did not come from typing", () => {
    const { rerender } = render(<ShelfSearch q="alice" />)
    const input = screen.getByLabelText("Cari judul atau penulis")
    expect(input).toHaveValue("alice")
    rerender(<ShelfSearch q="bob" />)
    expect(input).toHaveValue("bob")
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  it("pushes typed text to the URL once after the debounce", () => {
    render(<ShelfSearch q="" />)
    const input = screen.getByLabelText("Cari judul atau penulis")
    fireEvent.change(input, { target: { value: "emma" } })
    expect(navigate).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it("takes the focus when opened from the search button", () => {
    render(<ShelfSearch q="" autoFocus />)
    expect(screen.getByLabelText("Cari judul atau penulis")).toHaveFocus()
  })
})
