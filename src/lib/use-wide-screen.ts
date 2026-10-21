import { useSyncExternalStore } from "react"

/** The desktop layout's breakpoint: Tailwind's `lg`, as in styles.css. */
export const WIDE_QUERY = "(min-width: 1024px)"

function wideQuery(): MediaQueryList | null {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
    ? window.matchMedia(WIDE_QUERY)
    : null
}

/** Whether the screen has the desktop layout now (for event handlers). */
export function isWideScreen(): boolean {
  return wideQuery()?.matches ?? false
}

function subscribe(onChange: () => void): () => void {
  const list = wideQuery()
  list?.addEventListener("change", onChange)
  return () => list?.removeEventListener("change", onChange)
}

/**
 * Whether the screen has the desktop layout. False on the server and in the
 * first render, so CSS, not this, decides what the page looks like (spec 1F,
 * decision 6).
 */
export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, isWideScreen, () => false)
}
