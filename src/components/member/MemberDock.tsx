import { Link } from "@tanstack/react-router"
import { useLayoutEffect, useRef } from "react"
import { useTyping } from "@/lib/use-typing"
import { LINKS, isCurrent } from "./MemberShell"

const SLIDE_MS = 250
const EASE = "cubic-bezier(0.22, 0.8, 0.24, 1)"

/**
 * The phone's floating dock (spec poles mobile §4): a glass pill; only the
 * current tab shows its name, on a green pill that slides between tabs.
 */
export function MemberDock({ pathname }: { pathname: string }) {
  const typing = useTyping()
  const navRef = useRef<HTMLElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const last = useRef<{ left: number; width: number } | null>(null)
  const current = LINKS.findIndex(({ to }) => isCurrent(pathname, to))

  useLayoutEffect(() => {
    const nav = navRef.current
    const pill = pillRef.current
    if (!nav || !pill) return
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]')
    if (!active) {
      pill.hidden = true
      last.current = null
      return
    }
    pill.hidden = false
    const box = { left: active.offsetLeft, width: active.offsetWidth }
    pill.style.left = `${box.left}px`
    pill.style.width = `${box.width}px`
    const before = last.current
    last.current = box
    // jsdom has no matchMedia.
    const still =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (
      !before ||
      still ||
      typeof pill.animate !== "function" ||
      box.width === 0
    )
      return
    const dx = before.left - box.left
    const sx = before.width / box.width
    if (dx === 0 && sx === 1) return
    pill.animate(
      [
        { transform: `translateX(${dx}px) scaleX(${sx})` },
        { transform: "none" },
      ],
      { duration: SLIDE_MS, easing: EASE }
    )
  }, [current])

  return (
    <nav
      ref={navRef}
      aria-label="Navigasi utama"
      className="member-dock"
      data-typing={typing ? "" : undefined}
    >
      <span ref={pillRef} className="member-dock-pill" aria-hidden="true" />
      {LINKS.map(({ to, label, short, Icon }) => {
        const here = isCurrent(pathname, to)
        return (
          <Link
            key={to}
            to={to}
            className="member-dock-tab"
            aria-label={label}
            aria-current={here ? "page" : undefined}
          >
            <Icon aria-hidden="true" className="size-5" />
            {here && <span className="member-dock-label">{short}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
