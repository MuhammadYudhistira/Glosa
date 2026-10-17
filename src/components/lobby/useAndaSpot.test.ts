import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ANDA_START } from "./scene/layout"
import { useAndaSpot } from "./useAndaSpot"

describe("useAndaSpot", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("starts at the entrance and remembers the last spot for the session", async () => {
    const first = renderHook(() => useAndaSpot())
    expect(first.result.current[0]).toEqual(ANDA_START)
    act(() => first.result.current[1]([19.5, 28.2]))
    expect(first.result.current[0]).toEqual([19.5, 28.2])
    first.unmount()

    const second = renderHook(() => useAndaSpot())
    await vi.waitFor(() =>
      expect(second.result.current[0]).toEqual([19.5, 28.2])
    )
  })

  it("ignores a broken saved spot", () => {
    sessionStorage.setItem("glosa:lobby-anda", "{oops")
    const { result } = renderHook(() => useAndaSpot())
    expect(result.current[0]).toEqual(ANDA_START)
  })
})
