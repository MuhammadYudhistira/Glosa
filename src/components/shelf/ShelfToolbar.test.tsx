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
    const { rerender } = render(<ShelfToolbar q="alice" sort="opened" />)
    const input = screen.getByLabelText("Cari judul atau penulis")
    expect(input).toHaveValue("alice")
    rerender(<ShelfToolbar q="bob" sort="opened" />)
    expect(input).toHaveValue("bob")
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  it("pushes typed text to the URL once after the debounce", () => {
    render(<ShelfToolbar q="" sort="opened" />)
    const input = screen.getByLabelText("Cari judul atau penulis")
    fireEvent.change(input, { target: { value: "emma" } })
    expect(navigate).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(navigate).toHaveBeenCalledTimes(1)
  })
})
