import { act, render, renderHook, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GREETING_MS, Greeting, useGreetingShown } from "./Greeting"

describe("Greeting", () => {
  afterEach(() => vi.useRealTimers())

  it("welcomes the member back by name", () => {
    render(<Greeting name="Ani Baca" />)
    expect(screen.getByText("Selamat datang kembali, Ani Baca!")).toBeVisible()
  })

  it("is shown for a while, then goes by itself", () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useGreetingShown(true))
    expect(result.current).toBe(true)
    act(() => void vi.advanceTimersByTime(GREETING_MS))
    expect(result.current).toBe(false)
  })

  it("is not shown when the visit has no greeting", () => {
    const { result } = renderHook(() => useGreetingShown(false))
    expect(result.current).toBe(false)
  })
})
