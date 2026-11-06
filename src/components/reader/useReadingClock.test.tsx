import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useReadingClock } from "./useReadingClock"

const mocks = vi.hoisted(() => ({
  recordReadingTime: vi.fn(() => Promise.resolve()),
  flush: vi.fn(() => Promise.resolve()),
}))
vi.mock("@/lib/habit/habit-client", () => ({
  recordReadingTime: mocks.recordReadingTime,
  habitSync: () => ({ flush: mocks.flush }),
}))

const BOOK = "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e"
const T0 = new Date(2026, 10, 6, 9, 0).getTime()
const recorded = () =>
  mocks.recordReadingTime.mock.calls.flatMap(
    (call) => (call as unknown as [string, Array<{ ms: number }>])[1]
  )
const total = () => recorded().reduce((sum, piece) => sum + piece.ms, 0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("useReadingClock", () => {
  it("records a page when the next one shows", () => {
    const { result } = renderHook(() => useReadingClock(BOOK, false))
    act(() => result.current.onPage())
    vi.setSystemTime(T0 + 20_000)
    act(() => result.current.onPage())
    expect(mocks.recordReadingTime).toHaveBeenLastCalledWith(BOOK, [
      { day: expect.any(String) as string, ms: 20_000 },
    ])
  })

  it("saves every 30 seconds while a page stays", () => {
    const { result } = renderHook(() => useReadingClock(BOOK, false))
    act(() => result.current.onPage())
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(total()).toBe(30_000)
  })

  it("stops while paused, and saves and sends when the reader closes", async () => {
    const { result, rerender, unmount } = renderHook(
      ({ paused }) => useReadingClock(BOOK, paused),
      { initialProps: { paused: false } }
    )
    act(() => result.current.onPage())
    vi.setSystemTime(T0 + 10_000)
    rerender({ paused: true })
    vi.setSystemTime(T0 + 200_000)
    rerender({ paused: false })
    vi.setSystemTime(T0 + 206_000)
    unmount()
    expect(total()).toBe(16_000)
    await vi.waitFor(() => expect(mocks.flush).toHaveBeenCalled())
  })

  it("stops while the tab is hidden", () => {
    const { result } = renderHook(() => useReadingClock(BOOK, false))
    act(() => result.current.onPage())
    vi.setSystemTime(T0 + 8_000)
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    })
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    vi.setSystemTime(T0 + 100_000)
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    vi.setSystemTime(T0 + 104_000)
    act(() => result.current.onPage())
    expect(total()).toBe(12_000)
  })
})
