import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type LookupOutcome, lookUp } from "@/lib/words/lookup"
import { useWordLookup } from "./useWordLookup"

vi.mock("@/lib/words/lookup", () => ({ lookUp: vi.fn() }))

const found: LookupOutcome = {
  kind: "result",
  result: { word: "ran", entries: [], phrases: [] },
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(lookUp).mockReset()
})

describe("useWordLookup", () => {
  it("loads quietly for 150 ms, then shows it is still loading", async () => {
    let answer: (outcome: LookupOutcome) => void = () => {}
    vi.mocked(lookUp).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve
      })
    )
    const { result } = renderHook(() => useWordLookup("ran", ["up"]))
    expect(result.current.state).toEqual({ kind: "loading", slow: false })
    expect(lookUp).toHaveBeenCalledWith("ran", ["up"])

    await act(() => vi.advanceTimersByTimeAsync(150))
    expect(result.current.state).toEqual({ kind: "loading", slow: true })
    await act(async () => answer(found))
    expect(result.current.state).toEqual(found)
  })

  it("looks the word up again on retry", async () => {
    vi.mocked(lookUp)
      .mockResolvedValueOnce({ kind: "failed" })
      .mockResolvedValueOnce(found)
    const { result } = renderHook(() => useWordLookup("ran", []))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.state).toEqual({ kind: "failed" })
    act(() => result.current.retry())
    expect(result.current.state).toEqual({ kind: "loading", slow: false })
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.state).toEqual(found)
  })

  it("does nothing without a word", () => {
    renderHook(() => useWordLookup(null, []))
    expect(lookUp).not.toHaveBeenCalled()
  })
})
