import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { listHighlightsFn } from "@/server/annotations"
import { useHighlights } from "./highlights-client"
import type { Highlight } from "./types"

vi.mock("@/server/annotations", () => ({ listHighlightsFn: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({
  useServerFn: <T>(fn: T) => fn,
}))

const one: Highlight = {
  id: "8b1f7c2e-4a5d-4c3b-9e2f-1a2b3c4d5e6f",
  bookId: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  color: "yellow",
  note: "",
  excerpt: "To Sherlock Holmes",
  createdAt: "2026-10-24T08:00:00.000Z",
}

describe("useHighlights", () => {
  beforeEach(() => {
    vi.mocked(listHighlightsFn).mockReset()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("loads the newest highlights when online", async () => {
    vi.mocked(listHighlightsFn).mockResolvedValue({
      ok: true,
      highlights: [one],
    })
    const { result } = renderHook(() => useHighlights(3, true))
    expect(result.current.state).toEqual({ status: "loading" })
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: "ready",
        highlights: [one],
      })
    )
    expect(listHighlightsFn).toHaveBeenCalledWith({ data: { limit: 3 } })
  })

  it("says offline without asking the server", () => {
    const { result } = renderHook(() => useHighlights(3, false))
    expect(result.current.state).toEqual({ status: "offline" })
    expect(listHighlightsFn).not.toHaveBeenCalled()
  })

  it("fails on a refused answer and asks again on retry", async () => {
    vi.mocked(listHighlightsFn).mockResolvedValueOnce({
      ok: false,
      code: "unknown",
    })
    const { result } = renderHook(() => useHighlights(3, true))
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: "failed" })
    )
    vi.mocked(listHighlightsFn).mockResolvedValueOnce({
      ok: true,
      highlights: [],
    })
    act(() => result.current.retry())
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: "ready", highlights: [] })
    )
  })

  it("fails when the request throws", async () => {
    vi.mocked(listHighlightsFn).mockRejectedValueOnce(new Error("network"))
    const { result } = renderHook(() => useHighlights(3, true))
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: "failed" })
    )
  })
})
