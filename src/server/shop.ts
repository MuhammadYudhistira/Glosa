import { createServerFn } from "@tanstack/react-start"
import type { ActionResult } from "@/lib/action-result"
import type { SlotId } from "@/lib/shop/catalog"
import { BuySchema, LobbyStateSchema, PlaceSchema } from "@/lib/shop/schemas"
import type { LobbyAnswer } from "@/lib/shop/types"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })

/** The DB's answers; not_found would read "Buku ini…" (plan 3C, decision 3). */
const answerOf = (answer: unknown): ActionResult =>
  answer === "ok"
    ? { ok: true }
    : answer === "not_found"
      ? fail("item_missing")
      : answer === "owned" || answer === "not_enough" || answer === "not_owned"
        ? fail(answer)
        : fail("unknown")

/** The balance, the items owned and placed (spec 3C §5.2). */
export const loadLobbyFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<LobbyAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")
    const { data, error } = await supabase.rpc("lobby_state")
    if (error) {
      logServerError("lobby_state failed", error)
      return fail("unknown")
    }
    const parsed = LobbyStateSchema.safeParse(data)
    if (!parsed.success) {
      logServerError("lobby_state answered something else", parsed.error)
      return fail("unknown")
    }
    return { ok: true, state: parsed.data }
  }
)

export const buyLobbyItemFn = createServerFn({ method: "POST" })
  .validator((data: { itemId: string }) => BuySchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("buy_lobby_item", {
      p_item: data.itemId,
    })
    if (error) {
      logServerError("buy_lobby_item failed", error)
      return fail("unknown")
    }
    return answerOf(answer)
  })

export const placeLobbyItemFn = createServerFn({ method: "POST" })
  .validator((data: { slot: SlotId; itemId: string | null }) =>
    PlaceSchema.parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("place_lobby_item", {
      p_slot: data.slot,
      p_item: data.itemId as string,
    })
    if (error) {
      logServerError("place_lobby_item failed", error)
      return fail("unknown")
    }
    return answerOf(answer)
  })
