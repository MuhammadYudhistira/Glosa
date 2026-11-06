import { z } from "zod"
import { SHOP_ITEMS, SLOT_IDS } from "./catalog"

const ItemIdSchema = z.enum(
  SHOP_ITEMS.map(({ id }) => id) as [string, ...Array<string>]
)
const SlotSchema = z.enum(SLOT_IDS)

export const LobbyStateSchema = z.object({
  earned: z.number().int(),
  spent: z.number().int(),
  balance: z.number().int(),
  owned: z.array(z.string()),
  placed: z.partialRecord(SlotSchema, z.string()),
})

export const BuySchema = z.object({ itemId: ItemIdSchema })
export const PlaceSchema = z.object({
  slot: SlotSchema,
  itemId: ItemIdSchema.nullable(),
})
