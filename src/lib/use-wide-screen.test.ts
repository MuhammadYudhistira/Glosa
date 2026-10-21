import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { isWideScreen, useWideScreen } from "./use-wide-screen"

describe("useWideScreen", () => {
  afterEach(() => unstubWideScreen())

  it("follows the desktop breakpoint as it is crossed", () => {
    const media = stubWideScreen(false)
    const { result } = renderHook(() => useWideScreen())
    expect(result.current).toBe(false)
    act(() => media.set(true))
    expect(result.current).toBe(true)
    expect(isWideScreen()).toBe(true)
  })

  it("is false where matchMedia does not exist", () => {
    expect(isWideScreen()).toBe(false)
    const { result } = renderHook(() => useWideScreen())
    expect(result.current).toBe(false)
  })
})
