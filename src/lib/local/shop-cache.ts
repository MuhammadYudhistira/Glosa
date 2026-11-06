import { LobbyStateSchema } from "@/lib/shop/schemas"
import type { LobbyState } from "@/lib/shop/types"
import { localDb } from "./db"

/** In meta, so wiping the member's data drops it (plan 3C, decision 8). */
const CACHE_KEY = "lobbyShop"

export async function loadShopCache(): Promise<LobbyState | null> {
  const stored = await localDb().meta.get(CACHE_KEY)
  const parsed = LobbyStateSchema.safeParse(stored?.value)
  return parsed.success ? parsed.data : null
}

export async function saveShopCache(state: LobbyState): Promise<void> {
  await localDb().meta.put({ key: CACHE_KEY, value: state })
}
