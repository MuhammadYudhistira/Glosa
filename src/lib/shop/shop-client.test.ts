import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"

import { localDb } from "@/lib/local/db"
import { clearLocalData } from "@/lib/local/device"
import { loadShopCache, saveShopCache } from "@/lib/local/shop-cache"
import {
  buyItem,
  placeItem,
  previewItem,
  refreshShop,
  shopStateForTests,
  useLobbyDecor,
} from "./shop-client"

const server = vi.hoisted(() => ({
  loadLobbyFn: vi.fn(),
  buyLobbyItemFn: vi.fn(),
  placeLobbyItemFn: vi.fn(),
}))
vi.mock("@/server/shop", () => server)
const flush = vi.hoisted(() => vi.fn(() => Promise.resolve()))
vi.mock("@/lib/habit/habit-client", () => ({
  habitSync: () => ({ flush }),
}))

const state = (changes = {}) => ({
  earned: 300,
  spent: 60,
  balance: 240,
  owned: ["rug_woven"],
  placed: { rug: "rug_woven" },
  ...changes,
})

describe("shop client", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await clearLocalData() // also resets the store through onMemberDataWiped
  })

  it("sends the reading time, then loads and keeps the state", async () => {
    server.loadLobbyFn.mockResolvedValue({ ok: true, state: state() })
    await refreshShop()
    expect(flush).toHaveBeenCalledBefore(server.loadLobbyFn)
    expect(shopStateForTests()).toMatchObject({
      status: "ready",
      state: state(),
    })
    expect(await loadShopCache()).toEqual(state())
  })

  it("keeps the cached state when loading fails", async () => {
    await saveShopCache(state({ balance: 7 }))
    server.loadLobbyFn.mockResolvedValue({ ok: false, code: "unknown" })
    await refreshShop()
    expect(shopStateForTests()).toMatchObject({
      status: "failed",
      state: { balance: 7 },
    })
  })

  it("refreshes after a purchase, also when the coins ran short", async () => {
    server.loadLobbyFn.mockResolvedValue({ ok: true, state: state() })
    server.buyLobbyItemFn.mockResolvedValue({ ok: false, code: "not_enough" })
    expect(await buyItem("pet_cat")).toEqual({ ok: false, code: "not_enough" })
    expect(server.loadLobbyFn).toHaveBeenCalledTimes(1)
  })

  it("takes an item already owned as bought", async () => {
    server.loadLobbyFn.mockResolvedValue({ ok: true, state: state() })
    server.buyLobbyItemFn.mockResolvedValue({ ok: false, code: "owned" })
    expect(await buyItem("rug_woven")).toEqual({ ok: true })
  })

  it("places at once and puts it back when the server refuses", async () => {
    server.loadLobbyFn.mockResolvedValue({ ok: true, state: state() })
    await refreshShop()
    let answer!: (value: unknown) => void
    server.placeLobbyItemFn.mockReturnValue(
      new Promise((resolve) => (answer = resolve))
    )
    const placing = placeItem("rug", null)
    await vi.waitFor(() =>
      expect(shopStateForTests().state?.placed).toEqual({})
    )
    answer({ ok: false, code: "unknown" })
    expect(await placing).toEqual({ ok: false, code: "unknown" })
    expect(shopStateForTests().state?.placed).toEqual({ rug: "rug_woven" })
  })

  it("shows an item tried on in its slot, over the one placed", async () => {
    server.loadLobbyFn.mockResolvedValue({ ok: true, state: state() })
    await refreshShop()
    const { result } = renderHook(() => useLobbyDecor())
    expect(result.current).toEqual({ rug: "rug_woven" })
    act(() => previewItem("pet_cat"))
    expect(result.current).toEqual({ rug: "rug_woven", pet: "pet_cat" })
    act(() => previewItem(null))
    expect(result.current).toEqual({ rug: "rug_woven" })
  })

  it("forgets everything when the member's data is wiped", async () => {
    server.loadLobbyFn.mockResolvedValue({ ok: true, state: state() })
    await refreshShop()
    await clearLocalData()
    expect(shopStateForTests()).toEqual({
      status: "loading",
      state: null,
      preview: null,
    })
    expect(await localDb().meta.get("lobbyShop")).toBeUndefined()
  })
})
