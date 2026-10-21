import { useNavigate } from "@tanstack/react-router"
import { XIcon } from "lucide-react"
import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { isWideScreen } from "@/lib/use-wide-screen"
import { cn } from "@/lib/utils"

/** The pages that open over the lobby on desktop (spec 1F §3). */
export const POPUP_PATHS: ReadonlyArray<string> = ["/shelf", "/settings"]

export const isPopupPath = (pathname: string): boolean =>
  POPUP_PATHS.includes(pathname)

/** Where the focus goes when the popup's opener is gone (spec 1F §4.3). */
const FALLBACK_FOCUS = "[data-lobby-search]"
/** What handles Escape itself: dialogs over the popup and the top bar. */
const OWN_ESCAPE = '[role="dialog"], [role="alertdialog"], .lobby-topbar'

/**
 * Rak Saya or Pengaturan: a glass panel over the lobby on desktop, a plain
 * page on phones. CSS decides which (spec 1F §4, §5); the focus and Escape
 * are handled on desktop only.
 */
export function LobbyPopup({
  label,
  className,
  bodyClassName,
  children,
}: {
  /** The page's name, as in its h1: "Rak Saya", "Pengaturan". */
  label: string
  /** On the panel, e.g. its max width. */
  className?: string
  /** On the column that holds the content, e.g. its gap. */
  bodyClassName?: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const close = () => void navigate({ to: "/lobby" })

  // Taken before a popup on its way out hands the focus back, so going from
  // Rak Saya to Pengaturan remembers the link that was used.
  useLayoutEffect(() => {
    const active = document.activeElement
    openerRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null
  }, [])

  useEffect(() => {
    if (isWideScreen()) {
      const heading = mainRef.current?.querySelector("h1")
      if (heading) {
        heading.tabIndex = -1
        heading.focus({ preventScroll: true })
      }
    }
    return () => {
      if (!isWideScreen()) return
      const opener = openerRef.current
      // A link in the closed account menu is still connected, but hidden.
      // jsdom has no checkVisibility, hence the optional call.
      /* eslint-disable @typescript-eslint/no-unnecessary-condition */
      const back =
        opener?.isConnected && opener.checkVisibility?.() !== false
          ? opener
          : document.querySelector<HTMLElement>(FALLBACK_FOCUS)
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
      back?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return
      if (!isWideScreen()) return
      if (event.target instanceof Element && event.target.closest(OWN_ESCAPE)) {
        return
      }
      event.preventDefault()
      void navigate({ to: "/lobby" })
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [navigate])

  return (
    <>
      {/* Mouse only: Escape and the close button do the same for everyone. */}
      <div
        aria-hidden="true"
        className="lobby-popup-backdrop"
        onClick={close}
      />
      <main
        ref={mainRef}
        aria-label={label}
        className={cn("lobby-popup", className)}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Tutup ${label}`}
          className="lobby-popup-close"
          onClick={close}
        >
          <XIcon />
        </Button>
        <div className={cn("flex flex-col", bodyClassName)}>{children}</div>
      </main>
    </>
  )
}
