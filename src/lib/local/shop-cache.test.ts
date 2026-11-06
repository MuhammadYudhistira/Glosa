// @vitest-environment node
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import { localDb } from "./db"
import { loadShopCache, saveShopCache } from "./shop-cache"

const STATE = {
  earned: 300,
  spent: 60,
  balance: 240,
  owned: ["rug_woven"],
  placed: { rug: "rug_woven" },
}

describe("shop cache", () => {
  beforeEach(async () => {
    await localDb().meta.clear()
  })

  it("is empty at first", async () => {
    expect(await loadShopCache()).toBeNull()
  })

  it("keeps the last state", async () => {
    await saveShopCache(STATE)
    expect(await loadShopCache()).toEqual(STATE)
  })

  it("ignores what is not a state", async () => {
    await localDb().meta.put({ key: "lobbyShop", value: { balance: "x" } })
    expect(await loadShopCache()).toBeNull()
  })
})
