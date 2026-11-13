import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ANDA_START, HOTSPOT_SPOTS, walkBlockers } from "./scene/layout"
import { useAndaSpot } from "./useAndaSpot"

// Where Anda stands to use the trolley: a free spot in the room.
const TROLLEY = HOTSPOT_SPOTS.find((spot) => spot.id === "troli")!.stand
// The middle of a piece of furniture Anda walks around.
const [box] = walkBlockers()
const IN_FURNITURE = [(box.x0 + box.x1) / 2, (box.z0 + box.z1) / 2]

describe("useAndaSpot", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("starts at the entrance and remembers the last spot for the session", async () => {
    const first = renderHook(() => useAndaSpot())
    expect(first.result.current[0]).toEqual(ANDA_START)
    act(() => first.result.current[1](TROLLEY))
    expect(first.result.current[0]).toEqual(TROLLEY)
    first.unmount()

    const second = renderHook(() => useAndaSpot())
    await vi.waitFor(() => expect(second.result.current[0]).toEqual(TROLLEY))
  })

  it("ignores a broken saved spot", () => {
    sessionStorage.setItem("glosa:lobby-anda", "{oops")
    const { result } = renderHook(() => useAndaSpot())
    expect(result.current[0]).toEqual(ANDA_START)
  })

  it.each([
    ["outside the room (the old atrium's)", [17, 17]],
    ["inside the furniture", IN_FURNITURE],
  ])("starts at the entrance when the saved spot is %s", async (_, saved) => {
    sessionStorage.setItem("glosa:lobby-anda", JSON.stringify(saved))
    const { result } = renderHook(() => useAndaSpot())
    // Give the saved spot its chance to load.
    await act(async () => {})
    expect(result.current[0]).toEqual(ANDA_START)
  })
})
