import { POPUP_PATHS } from "@/components/lobby/LobbyPopup"

export type PageTransition = "ke-halaman" | "ke-ruang" | "antar-halaman"

const ROOM = "/lobby"
/** The pages with the phone's dock: the room and the pages over it. */
const DOCK_PAGES = new Set([ROOM, ...POPUP_PATHS])

/**
 * Whether the browser can scope a view transition by type. router-core only
 * passes the types when it can; without it a plain startViewTransition would
 * cross-fade the whole page on every navigation, so we ask for none then.
 */
export function supportsTransitionTypes(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("selector(:active-view-transition-type(a))")
  )
}

/**
 * The view transition for a navigation on a phone (spec poles mobile §5), or
 * false for none: wide screens, reduced motion, a change of query only, and
 * pages without the dock (the reader, sign-in, the card page).
 */
export function transitionTypes(
  from: string | undefined,
  to: string,
  env: { wide: boolean; reducedMotion: boolean }
): Array<PageTransition> | false {
  if (env.wide || env.reducedMotion || from === undefined || from === to) {
    return false
  }
  if (!DOCK_PAGES.has(from) || !DOCK_PAGES.has(to)) return false
  if (from === ROOM) return ["ke-halaman"]
  if (to === ROOM) return ["ke-ruang"]
  return ["antar-halaman"]
}
