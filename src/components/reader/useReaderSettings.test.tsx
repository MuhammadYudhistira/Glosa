import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DEFAULT_READER_SETTINGS,
  type ReaderSettings,
} from "@/lib/reader-settings"
import {
  cacheReaderSettings,
  cachedReaderSettings,
} from "@/lib/reader-settings-cache"
import { useReaderSettings } from "./useReaderSettings"

const { saveReaderSettingsFn } = vi.hoisted(() => ({
  saveReaderSettingsFn: vi.fn(),
}))

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}))
vi.mock("@/server/reading", () => ({ saveReaderSettingsFn }))

const dark: ReaderSettings = { ...DEFAULT_READER_SETTINGS, theme: "dark" }
const large: ReaderSettings = { ...DEFAULT_READER_SETTINGS, fontSize: 150 }

type Deferred = {
  promise: Promise<{ ok: boolean }>
  resolve: (value: { ok: boolean }) => void
}
function deferred(): Deferred {
  let resolve!: (value: { ok: boolean }) => void
  const promise = new Promise<{ ok: boolean }>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

/** Lets pending promise callbacks run without advancing the fake clock. */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  saveReaderSettingsFn.mockReset()
  saveReaderSettingsFn.mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useReaderSettings", () => {
  it("applies a change at once, keeps it dirty, and saves after 800 ms", async () => {
    const { result } = renderHook(() => useReaderSettings(large, true))
    expect(result.current.settings).toEqual(large)
    saveReaderSettingsFn.mockClear()

    act(() => result.current.update({ theme: "dark" }))
    expect(result.current.settings.theme).toBe("dark")
    expect(cachedReaderSettings()).toEqual({
      settings: { ...large, theme: "dark" },
      dirty: true,
    })
    await flush()
    expect(saveReaderSettingsFn).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(saveReaderSettingsFn).toHaveBeenCalledTimes(1)
    expect(saveReaderSettingsFn).toHaveBeenCalledWith({
      data: { ...large, theme: "dark" },
    })
    expect(cachedReaderSettings()).toEqual({
      settings: { ...large, theme: "dark" },
      dirty: false,
    })
  })

  it("never marks newer settings saved when an older save resolves late", async () => {
    const first = deferred()
    saveReaderSettingsFn.mockReturnValueOnce(first.promise)
    saveReaderSettingsFn.mockResolvedValueOnce({ ok: true })
    const { result } = renderHook(() =>
      useReaderSettings(DEFAULT_READER_SETTINGS, true)
    )

    act(() => result.current.update({ theme: "dark" }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    const settings2 = {
      ...DEFAULT_READER_SETTINGS,
      theme: "dark" as const,
      fontSize: 120,
    }
    act(() => result.current.update({ fontSize: 120 }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(saveReaderSettingsFn).toHaveBeenCalledTimes(2)
    expect(saveReaderSettingsFn).toHaveBeenLastCalledWith({ data: settings2 })

    await flush()
    first.resolve({ ok: true })
    await flush()
    expect(cachedReaderSettings()).toEqual({
      settings: settings2,
      dirty: false,
    })
  })

  it("keeps newer settings dirty while the newer save is still pending", async () => {
    const first = deferred()
    const second = deferred()
    saveReaderSettingsFn
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { result } = renderHook(() =>
      useReaderSettings(DEFAULT_READER_SETTINGS, true)
    )

    act(() => result.current.update({ theme: "dark" }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    act(() => result.current.update({ fontSize: 120 }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })

    const settings2 = {
      ...DEFAULT_READER_SETTINGS,
      theme: "dark" as const,
      fontSize: 120,
    }
    first.resolve({ ok: true })
    await flush()
    expect(cachedReaderSettings()).toEqual({ settings: settings2, dirty: true })

    second.resolve({ ok: true })
    await flush()
    expect(cachedReaderSettings()).toEqual({
      settings: settings2,
      dirty: false,
    })
  })

  it("sends a pending change at once when the reader closes", async () => {
    const { result, unmount } = renderHook(() =>
      useReaderSettings(DEFAULT_READER_SETTINGS, true)
    )

    act(() => result.current.update({ margin: "wide" }))
    unmount()
    expect(saveReaderSettingsFn).toHaveBeenCalledTimes(1)
    expect(saveReaderSettingsFn).toHaveBeenCalledWith({
      data: { ...DEFAULT_READER_SETTINGS, margin: "wide" },
    })
  })

  it("sends dirty settings from this device once when the reader opens online", async () => {
    cacheReaderSettings(dark, true)
    renderHook(() => useReaderSettings(large, true))
    await flush()
    expect(saveReaderSettingsFn).toHaveBeenCalledTimes(1)
    expect(saveReaderSettingsFn).toHaveBeenCalledWith({ data: dark })
  })

  it("keeps dirty settings for later when the reader opens offline", async () => {
    cacheReaderSettings(dark, true)
    renderHook(() => useReaderSettings(large, false))
    await flush()
    expect(saveReaderSettingsFn).not.toHaveBeenCalled()
    expect(cachedReaderSettings()).toEqual({ settings: dark, dirty: true })
  })
})
