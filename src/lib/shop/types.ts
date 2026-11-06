import type { SlotId } from "./catalog"

/** The item in each slot that has one. */
export type Placements = Partial<Record<SlotId, string>>

/** What lobby_state answers (spec 3C §5.2). */
export type LobbyState = {
  earned: number
  spent: number
  balance: number
  owned: Array<string>
  placed: Placements
}

export type LobbyAnswer =
  { ok: true; state: LobbyState } | { ok: false; code: string }

/** The shop as the lobby and the panel see it. `preview`: an item tried on. */
export type ShopView = {
  status: "loading" | "ready" | "failed"
  state: LobbyState | null
  preview: string | null
}
