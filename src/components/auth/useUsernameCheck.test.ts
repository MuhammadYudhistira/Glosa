import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type UsernameChecker, useUsernameCheck } from "./useUsernameCheck"

describe("useUsernameCheck", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("stays idle for an empty value", () => {
    const check = vi.fn<UsernameChecker>()
    const { result } = renderHook(() => useUsernameCheck("", check))
    expect(result.current).toEqual({ state: "idle" })
    expect(check).not.toHaveBeenCalled()
  })

  it("reports local problems without asking the server", () => {
    const check = vi.fn<UsernameChecker>()
    const { result } = renderHook(() => useUsernameCheck("ab", check))
    expect(result.current).toEqual({ state: "invalid", problem: "too_short" })
    expect(check).not.toHaveBeenCalled()
  })

  it("checks availability after the debounce delay", async () => {
    const check = vi
      .fn<UsernameChecker>()
      .mockResolvedValue({ available: true, problem: null })
    const { result } = renderHook(() =>
      useUsernameCheck("ani_baca", check, 400)
    )
    expect(result.current).toEqual({ state: "checking" })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(check).toHaveBeenCalledWith("ani_baca")
    expect(result.current).toEqual({ state: "available" })
  })

  it("reports a taken username", async () => {
    const check = vi
      .fn<UsernameChecker>()
      .mockResolvedValue({ available: false, problem: null })
    const { result } = renderHook(() =>
      useUsernameCheck("ani_baca", check, 400)
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(result.current).toEqual({ state: "taken" })
  })

  it("only checks the last value while typing", async () => {
    const check = vi
      .fn<UsernameChecker>()
      .mockResolvedValue({ available: true, problem: null })
    const { rerender } = renderHook(
      ({ value }) => useUsernameCheck(value, check, 400),
      {
        initialProps: { value: "ani" },
      }
    )
    rerender({ value: "ani_" })
    rerender({ value: "ani_b" })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(check).toHaveBeenCalledTimes(1)
    expect(check).toHaveBeenCalledWith("ani_b")
  })
})
