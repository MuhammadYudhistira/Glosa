import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useRecap } from "./recap-client"

const mocks = vi.hoisted(() => ({ loadRecapFn: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/recap", () => mocks)

const range = { from: "2026-10-01", to: "2026-10-31" }
const recap = {
  days: [],
  books: [],
  lookedUp: 0,
  saved: 0,
  topMeeting: null,
  firstDay: null,
}

beforeEach(() => {
  // Not UTC, whatever the machine's zone is.
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
    () =>
      ({
        resolvedOptions: () => ({ timeZone: "Asia/Jakarta" }),
      }) as unknown as Intl.DateTimeFormat
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe("useRecap", () => {
  it("asks in the browser's zone and shows the answer", async () => {
    mocks.loadRecapFn.mockResolvedValue({ ok: true, recap })
    const { result } = renderHook(() => useRecap(range, true))
    await waitFor(() => expect(result.current.state.status).toBe("ready"))
    expect(mocks.loadRecapFn).toHaveBeenCalledTimes(1)
  })

  it("retries once in UTC when Postgres does not know the zone", async () => {
    mocks.loadRecapFn
      .mockResolvedValueOnce({ ok: false, code: "recap_invalid" })
      .mockResolvedValueOnce({ ok: true, recap })
    const { result } = renderHook(() => useRecap(range, true))
    await waitFor(() => expect(result.current.state.status).toBe("ready"))
    expect(mocks.loadRecapFn).toHaveBeenCalledTimes(2)
    expect(mocks.loadRecapFn.mock.calls[1][0].data.timeZone).toBe("UTC")
  })

  it("gives up after the UTC retry", async () => {
    mocks.loadRecapFn.mockResolvedValue({ ok: false, code: "recap_invalid" })
    const { result } = renderHook(() => useRecap(range, true))
    await waitFor(() => expect(result.current.state.status).toBe("unavailable"))
    expect(mocks.loadRecapFn).toHaveBeenCalledTimes(2)
  })

  it("does not retry other refusals", async () => {
    mocks.loadRecapFn.mockResolvedValue({ ok: false, code: "unknown" })
    const { result } = renderHook(() => useRecap(range, true))
    await waitFor(() => expect(result.current.state.status).toBe("unavailable"))
    expect(mocks.loadRecapFn).toHaveBeenCalledTimes(1)
  })
})
