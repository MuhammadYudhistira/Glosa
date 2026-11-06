import { describe, expect, it } from "vitest"
import { SHOP_ITEMS, SLOTS, SLOT_IDS, itemOf } from "./catalog"

describe("shop catalog", () => {
  it("has three items in each of the six slots", () => {
    expect(SLOT_IDS).toEqual(["rug", "lamp", "seat", "wall", "pet", "ceiling"])
    expect(SLOTS.map(({ id }) => id)).toEqual([...SLOT_IDS])
    for (const slot of SLOT_IDS) {
      expect(SHOP_ITEMS.filter((item) => item.slot === slot)).toHaveLength(3)
    }
  })

  it("names every item after its slot, once, at 60–600 coins", () => {
    const ids = SHOP_ITEMS.map(({ id }) => id)
    expect(new Set(ids).size).toBe(18)
    for (const item of SHOP_ITEMS) {
      expect(item.id.startsWith(`${item.slot}_`)).toBe(true)
      expect(item.price).toBeGreaterThanOrEqual(60)
      expect(item.price).toBeLessThanOrEqual(600)
    }
  })

  it("adds up to 760 for the cheapest per slot and 4,330 for all", () => {
    const cheapest = SLOT_IDS.map((slot) =>
      Math.min(
        ...SHOP_ITEMS.filter((item) => item.slot === slot).map((i) => i.price)
      )
    )
    expect(cheapest.reduce((a, b) => a + b, 0)).toBe(760)
    expect(SHOP_ITEMS.reduce((sum, item) => sum + item.price, 0)).toBe(4330)
  })

  it("finds an item by id", () => {
    expect(itemOf("pet_cat")).toMatchObject({
      name: "Kucing tidur",
      price: 250,
    })
    expect(itemOf("nope")).toBeUndefined()
  })
})
