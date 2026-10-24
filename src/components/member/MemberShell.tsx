import { Link, useRouterState } from "@tanstack/react-router"
import {
  BookOpenIcon,
  LanguagesIcon,
  LibraryIcon,
  SettingsIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { Logo } from "@/components/ui/logo"

const LINKS = [
  { to: "/lobby", label: "Lobi", short: "Lobi", Icon: LibraryIcon },
  { to: "/shelf", label: "Rak Saya", short: "Rak", Icon: BookOpenIcon },
  {
    to: "/vocabulary",
    label: "Kosakata",
    short: "Kosakata",
    Icon: LanguagesIcon,
  },
  {
    to: "/settings",
    label: "Pengaturan",
    short: "Pengaturan",
    Icon: SettingsIcon,
  },
] as const

/**
 * The reader is full screen; the card page comes before membership, so links
 * there would only lead back to it (plan 1D, decision 6).
 */
export function hasShell(pathname: string): boolean {
  return !pathname.startsWith("/read/") && pathname !== "/welcome"
}

const isCurrent = (pathname: string, to: string) =>
  pathname === to || pathname.startsWith(`${to}/`)

/** Pages with the lobby behind them on desktop (spec 1F §3, spec 2 §6.4). */
const OVER_LOBBY = ["/lobby", "/shelf", "/vocabulary", "/settings"]

/** Sidebar from 1024 px, tab bar below (spec 1D §5.3). */
export function MemberShell({ children }: { children: ReactNode }) {
  // Follow the resolved location, not the pending one: the page being left
  // still renders while the next route's beforeLoad and loaders run.
  const pathname = useRouterState({
    select: (state) => (state.resolvedLocation ?? state.location).pathname,
  })
  const shown = hasShell(pathname)
  // Over the lobby's scene the menu floats as a card, like the top bar and
  // the panels there (owner's choice after the 1D review). Rak Saya and
  // Pengaturan open over the lobby too (spec 1F).
  const floating =
    shown && OVER_LOBBY.some((to) => isCurrent(pathname, to)) ? "" : undefined

  // The wrapper around children is always there, so showing or hiding the
  // navigation never remounts the page (e.g. the WebGL lobby on its way out).
  return (
    <>
      {shown && (
        <nav
          aria-label="Navigasi anggota"
          className="member-sidebar"
          data-floating={floating}
        >
          {floating === undefined && <Logo className="mb-6 size-10" />}
          {LINKS.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              className="member-nav-link"
              aria-current={isCurrent(pathname, to) ? "page" : undefined}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      )}
      <div
        className="member-main"
        data-shell={shown ? "" : undefined}
        data-floating={floating}
      >
        {children}
      </div>
      {shown && (
        <nav aria-label="Navigasi anggota" className="member-tabbar">
          {LINKS.map(({ to, label, short, Icon }) => (
            <Link
              key={to}
              to={to}
              className="member-tab"
              aria-label={short === label ? undefined : label}
              aria-current={isCurrent(pathname, to) ? "page" : undefined}
            >
              <Icon aria-hidden="true" className="size-5" />
              <span>{short}</span>
            </Link>
          ))}
        </nav>
      )}
    </>
  )
}
