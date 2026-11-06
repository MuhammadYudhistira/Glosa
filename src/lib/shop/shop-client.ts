import { useEffect, useMemo, useSyncExternalStore } from "react"
import type { ActionResult } from "@/lib/action-result"
import { habitSync } from "@/lib/habit/habit-client"
import { onMemberDataWiped } from "@/lib/local/device"
import { loadShopCache, saveShopCache } from "@/lib/local/shop-cache"
import { buyLobbyItemFn, loadLobbyFn, placeLobbyItemFn } from "@/server/shop"
import { type SlotId, itemOf } from "./catalog"
import type { LobbyState, Placements, ShopView } from "./types"

const EMPTY: ShopView = { status: "loading", state: null, preview: null }
let view: ShopView = EMPTY
const listeners = new Set<() => void>()

function setView(next: Partial<ShopView>) {
  view = { ...view, ...next }
  for (const listener of listeners) listener()
}

/** For tests: the state the hooks read. */
export const shopStateForTests = (): ShopView => view

let cacheRead: Promise<void> | null = null
/** Bumped by every refresh and every wipe; an older refresh drops its answer. */
let refreshSeq = 0
/** Bumped only by a wipe; work begun before one must not touch the new store. */
let wipeEpoch = 0

onMemberDataWiped(() => {
  wipeEpoch++
  refreshSeq++
  cacheRead = null
  setView(EMPTY)
})

/** This device's last state, once per tab, so the lobby shows it offline. */
function readCache(): Promise<void> {
  const epoch = wipeEpoch
  cacheRead ??= loadShopCache()
    .then((cache) => {
      if (epoch !== wipeEpoch) return
      // A refresh that finished first already has the newer answer.
      setView({ state: view.state ?? cache })
    })
    .catch((error: unknown) => {
      cacheRead = null
      console.error("reading the lobby shop on this device failed", error)
    })
  return cacheRead
}

async function keep(state: LobbyState, seq: number) {
  if (seq !== refreshSeq) return
  await saveShopCache(state)
  if (seq !== refreshSeq) return
  setView({ state, status: "ready" })
}

/**
 * Sends the waiting reading time, so its minutes count, then loads the
 * balance and the items (plan 3C, decision 9). Never rejects.
 */
export async function refreshShop(): Promise<void> {
  const seq = ++refreshSeq
  try {
    await readCache()
    await habitSync().flush()
    const answer = await loadLobbyFn()
    if (seq !== refreshSeq) return
    if (!answer.ok) {
      console.error("loading the lobby shop was refused", answer.code)
      setView({ status: "failed" })
      return
    }
    await keep(answer.state, seq)
  } catch (error) {
    if (seq !== refreshSeq) return
    console.error("refreshing the lobby shop failed", error)
    setView({ status: "failed" })
  }
}

/** Buys an item; the server places it. "owned" counts as bought (spec 3C §6.4). */
export async function buyItem(itemId: string): Promise<ActionResult> {
  let result: ActionResult
  try {
    result = await buyLobbyItemFn({ data: { itemId } })
  } catch {
    return { ok: false, code: "unknown" }
  }
  if (result.ok || result.code === "owned" || result.code === "not_enough") {
    setView({ preview: null })
    await refreshShop()
  }
  return !result.ok && result.code === "owned" ? { ok: true } : result
}

/** Places an owned item, or takes the slot's item off: shown at once. */
export async function placeItem(
  slot: SlotId,
  itemId: string | null
): Promise<ActionResult> {
  const before = view.state
  if (!before) return { ok: false, code: "offline" }
  const epoch = wipeEpoch
  refreshSeq++ // an older refresh must not undo the placement shown now
  const placed: Placements = { ...before.placed }
  if (itemId) placed[slot] = itemId
  else delete placed[slot]
  setView({ state: { ...before, placed }, preview: null })
  let result: ActionResult
  try {
    result = await placeLobbyItemFn({ data: { slot, itemId } })
  } catch {
    result = { ok: false, code: "unknown" }
  }
  if (epoch !== wipeEpoch) return result // the member's data was wiped meanwhile
  if (!result.ok) {
    // Only the slot goes back: a refresh may have landed meanwhile.
    const now = view.state
    if (now) {
      const back: Placements = { ...now.placed }
      const was = before.placed[slot]
      if (was) back[slot] = was
      else delete back[slot]
      setView({ state: { ...now, placed: back } })
    }
    return result
  }
  if (view.state) await saveShopCache(view.state)
  // A refresh begun before this place dropped its answer (balance, owned).
  await refreshShop()
  return result
}

/** Tries an item on in its slot, for the 3D preview; null ends it. */
export function previewItem(itemId: string | null): void {
  if (view.preview === itemId) return
  setView({ preview: itemId })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The shop for the panel. */
export function useShop(): ShopView {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => view,
    () => EMPTY
  )
  useEffect(() => {
    void readCache()
  }, [])
  return snapshot
}

/** What the lobby shows in each slot: the items placed, and one tried on. */
export function useLobbyDecor(): Placements {
  const snapshot = useShop()
  return useMemo(() => {
    const placed: Placements = { ...snapshot.state?.placed }
    const tried = snapshot.preview ? itemOf(snapshot.preview) : undefined
    if (tried) placed[tried.slot] = tried.id
    return placed
  }, [snapshot])
}
