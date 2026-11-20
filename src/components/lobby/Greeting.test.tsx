import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GREETING_MS, Greeting } from "./Greeting"

describe("Greeting", () => {
  afterEach(() => vi.useRealTimers())

  it("welcomes the member back and goes away by itself", () => {
    vi.useFakeTimers()
    render(<Greeting name="Ani Baca" />)
    expect(screen.getByText("Selamat datang kembali, Ani Baca!")).toBeVisible()
    act(() => void vi.advanceTimersByTime(GREETING_MS))
    expect(screen.queryByText(/Selamat datang kembali/)).toBeNull()
  })
})
