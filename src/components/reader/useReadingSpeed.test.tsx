import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadSpeedSamples, saveSpeedSamples } from "@/lib/local/reading-speed"
import type { ReaderLocation } from "./ReaderView"
import { useReadingSpeed } from "./useReadingSpeed"

vi.mock("@/lib/local/reading-speed", () => ({
  loadSpeedSamples: vi.fn(() => Promise.resolve([])),
  saveSpeedSamples: vi.fn(() => Promise.resolve()),
}))

const place = (
  cfi: string,
  minutesLeft: number,
  turned = true
): ReaderLocation => ({
  fraction: 0,
  cfi,
  chapter: null,
  chapterHref: null,
  pageText: "",
  turned,
  atBookEnd: false,
  time: { section: minutesLeft, total: minutesLeft },
})

/** Reads `pages` pages forwards, `msEach` on each, one foliate minute apiece. */
function readPages(
  record: (location: ReaderLocation) => void,
  pages: number,
  msEach: number
) {
  for (let page = 0; page <= pages; page++) {
    act(() => record(place(`page-${page}`, 100 - page)))
    vi.advanceTimersByTime(msEach)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(loadSpeedSamples).mockResolvedValue([])
  vi.mocked(saveSpeedSamples).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useReadingSpeed", () => {
  it("keeps foliate's speed until ten pages are read, then learns", async () => {
    const { result } = renderHook(() => useReadingSpeed())
    await act(async () => {})
    readPages(result.current.record, 9, 120_000)
    expect(result.current.ratio).toBe(1)
    readPages(result.current.record, 1, 120_000)
    expect(result.current.ratio).toBe(2)
    expect(vi.mocked(saveSpeedSamples).mock.lastCall?.[0]).toHaveLength(10)
  })

  it("does not measure a jump, nor a relocate at the same place", async () => {
    const { result } = renderHook(() => useReadingSpeed())
    await act(async () => {})
    act(() => result.current.record(place("a", 50)))
    vi.advanceTimersByTime(30_000)
    // A touch snaps the page at the same place: the page still shows.
    act(() => result.current.record(place("a", 50)))
    vi.advanceTimersByTime(30_000)
    act(() => result.current.record(place("b", 49)))
    expect(vi.mocked(saveSpeedSamples).mock.lastCall?.[0]).toEqual([
      { expected: 1, actual: 1 },
    ])
    vi.advanceTimersByTime(30_000)
    act(() => result.current.record(place("z", 10, false)))
    vi.advanceTimersByTime(30_000)
    act(() => result.current.record(place("y", 9)))
    expect(vi.mocked(saveSpeedSamples).mock.lastCall?.[0]).toEqual([
      { expected: 1, actual: 1 },
      { expected: 1, actual: 0.5 },
    ])
  })

  it("starts from the pages measured before", async () => {
    vi.mocked(loadSpeedSamples).mockResolvedValue(
      Array.from({ length: 10 }, () => ({ expected: 1, actual: 3 }))
    )
    const { result } = renderHook(() => useReadingSpeed())
    await act(async () => {})
    expect(result.current.ratio).toBe(3)
  })
})
