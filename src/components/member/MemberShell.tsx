import { Link, useRouterState } from "@tanstack/react-router"
import { BookOpenIcon, LibraryIcon, SettingsIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Logo } from "@/components/ui/logo"

const LINKS = [
  { to: "/lobby", label: "Lobi", short: "Lobi", Icon: LibraryIcon },
  { to: "/shelf", label: "Rak Saya", short: "Rak", Icon: BookOpenIcon },
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

/** Sidebar from 1024 px, tab bar below (spec 1D §5.3). */
export function MemberShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  if (!hasShell(pathname)) return children

  return (
    <>
      <nav aria-label="Navigasi anggota" className="member-sidebar">
        <Logo className="mb-6 size-10" />
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
      <div className="member-main">{children}</div>
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
    </>
  )
}
