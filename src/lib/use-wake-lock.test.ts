import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useWakeLock } from "./use-wake-lock"

let visibility: DocumentVisibilityState = "visible"

/** A lock the browser hands out; `release` is what the hook calls. */
function fakeSentinel() {
  return { release: vi.fn(() => Promise.resolve()), addEventListener: vi.fn() }
}

function stubWakeLock(request: () => Promise<unknown>) {
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request: vi.fn(request) },
  })
  return (
    navigator as unknown as { wakeLock: { request: ReturnType<typeof vi.fn> } }
  ).wakeLock.request
}

const settle = () =>
  act(async () => {
    await Promise.resolve()
  })

function show(state: DocumentVisibilityState) {
  visibility = state
  document.dispatchEvent(new Event("visibilitychange"))
}

beforeEach(() => {
  visibility = "visible"
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, "wakeLock")
})

describe("useWakeLock", () => {
  it("keeps the screen on while the tab shows, and lets go when done", async () => {
    const sentinel = fakeSentinel()
    const request = stubWakeLock(() => Promise.resolve(sentinel))
    const { unmount } = renderHook(() => useWakeLock(true))
    await settle()
    expect(request).toHaveBeenCalledWith("screen")
    unmount()
    expect(sentinel.release).toHaveBeenCalled()
  })

  it("lets go when the tab hides and asks again when it shows", async () => {
    const first = fakeSentinel()
    const second = fakeSentinel()
    const request = stubWakeLock(
      vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    )
    renderHook(() => useWakeLock(true))
    await settle()
    await act(async () => show("hidden"))
    expect(first.release).toHaveBeenCalled()
    await act(async () => show("visible"))
    await settle()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it("does nothing while inactive", async () => {
    const request = stubWakeLock(() => Promise.resolve(fakeSentinel()))
    renderHook(() => useWakeLock(false))
    await settle()
    expect(request).not.toHaveBeenCalled()
  })

  it("says nothing when the browser refuses or has no Wake Lock", async () => {
    stubWakeLock(() =>
      Promise.reject(new DOMException("no", "NotAllowedError"))
    )
    const refused = renderHook(() => useWakeLock(true))
    await settle()
    refused.unmount()
    Reflect.deleteProperty(navigator, "wakeLock")
    const missing = renderHook(() => useWakeLock(true))
    await settle()
    missing.unmount()
  })
})
