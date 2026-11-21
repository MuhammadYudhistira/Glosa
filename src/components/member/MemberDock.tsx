import { Link } from "@tanstack/react-router"
import { useCallback, useLayoutEffect, useRef } from "react"
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

  // Puts the pill behind the current tab without animating. Returns the box,
  // or null when there is nothing to measure (no current tab, or the dock is
  // display: none on a wide screen and every box is 0 wide).
  const place = useCallback(() => {
    const nav = navRef.current
    const pill = pillRef.current
    if (!nav || !pill) return null
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]')
    if (!active) {
      pill.hidden = true
      return null
    }
    pill.hidden = false
    const box = { left: active.offsetLeft, width: active.offsetWidth }
    if (box.width === 0) return null
    pill.style.left = `${box.left}px`
    pill.style.width = `${box.width}px`
    return box
  }, [])

  // A route change: place the pill, then slide it from where it was.
  useLayoutEffect(() => {
    const pill = pillRef.current
    const box = place()
    const before = last.current
    last.current = box
    if (!pill || !box || !before) return
    // jsdom has no matchMedia.
    const still =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (still || typeof pill.animate !== "function") return
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
  }, [current, place])

  // The tabs move with the viewport (rotation, resize, font load) and the dock
  // is 0 wide while hidden on a wide screen: re-place the pill, no animation.
  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      const box = place()
      if (box) last.current = box
    })
    observer.observe(nav)
    return () => observer.disconnect()
  }, [place])

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
