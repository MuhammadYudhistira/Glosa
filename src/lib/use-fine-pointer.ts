import { useSyncExternalStore } from "react"

/** A mouse or a trackpad that can hover: the desktop's behaviour in the lobby (spec 3G §3.2). */
export const FINE_QUERY = "(hover: hover) and (pointer: fine)"

function fineQuery(): MediaQueryList | null {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
    ? window.matchMedia(FINE_QUERY)
    : null
}

function subscribe(onChange: () => void): () => void {
  const list = fineQuery()
  list?.addEventListener("change", onChange)
  return () => list?.removeEventListener("change", onChange)
}

/** False on the server and in the first render: phones' behaviour first. */
export function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => fineQuery()?.matches ?? false,
    () => false
  )
}
