import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PLACE_HINT_MS, PlaceHint } from "./PlaceHint"

describe("PlaceHint", () => {
  afterEach(() => vi.useRealTimers())

  it("tells a phone to tap and a mouse to point, then is done after 6 seconds", () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const { rerender } = render(<PlaceHint fine={false} onDone={onDone} />)
    expect(screen.getByText("Ketuk benda untuk melihat namanya")).toBeVisible()
    rerender(<PlaceHint fine onDone={onDone} />)
    expect(
      screen.getByText("Arahkan kursor ke benda untuk melihat namanya")
    ).toBeVisible()
    expect(onDone).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(PLACE_HINT_MS))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
