import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useWordFlush, wordSync } from "./word-sync-client"

let finishClaim: () => void = () => {}
vi.mock("@/lib/local/device", () => ({
  claimLocalData: vi.fn(
    () => new Promise<void>((resolve) => (finishClaim = resolve))
  ),
}))
vi.mock("@/server/words", () => ({
  syncSavedWordsFn: vi.fn(),
  savedWordFormsFn: vi.fn(),
}))

function Probe() {
  useWordFlush("u1")
  return null
}

describe("useWordFlush", () => {
  it("flushes only after the device is claimed", async () => {
    const flush = vi.spyOn(wordSync(), "flush").mockResolvedValue()
    render(<Probe />)
    await Promise.resolve()
    expect(flush).not.toHaveBeenCalled()
    finishClaim()
    await vi.waitFor(() => expect(flush).toHaveBeenCalledOnce())
  })
})
