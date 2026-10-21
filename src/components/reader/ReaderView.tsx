import type { FoliateRenderer, RelocateDetail, View } from "foliate-js/view.js"
import { useEffect, useRef } from "react"
import { type OpenedBook, openBookFile } from "@/lib/epub/open-book"
import {
  type FontSources,
  MARGIN_GAP,
  type ReaderSettings,
  THEME_COLORS,
  readerCss,
} from "@/lib/reader-settings"
import type { TocItem } from "@/lib/reader-types"
import { loadReaderFonts } from "./reader-fonts"
import {
  type ReaderMove,
  createWheelPager,
  isTypingTarget,
  keyMove,
  swipeVelocity,
  tapAction,
} from "./reader-input"

export type ReaderLocation = {
  fraction: number
  cfi: string
  chapter: string | null
  chapterHref: string | null
}

export type ReaderControls = {
  goTo: (target: string) => Promise<void>
  goToFraction: (fraction: number) => Promise<void>
  move: (move: ReaderMove) => Promise<void>
}

export type ReaderReady = { controls: ReaderControls; toc: Array<TocItem> }

type Callbacks = {
  onReady: (ready: ReaderReady) => void
  onRelocate: (location: ReaderLocation) => void
  /** Called before every page turn the member makes. */
  onInteract: () => void
  onTapMenu: () => void
  onError: (error: unknown) => void
}

/** Room above and below the text for the reader's bars, which overlay the book. */
const BAR_SPACE = "64px"
const MAX_LINE_LENGTH = "720px"

function applySettings(
  view: View,
  settings: ReaderSettings,
  fonts: FontSources
) {
  const renderer = view.renderer
  renderer.setAttribute("flow", settings.flow)
  renderer.setAttribute("gap", MARGIN_GAP[settings.margin])
  renderer.setAttribute("margin", BAR_SPACE)
  renderer.setAttribute("max-inline-size", MAX_LINE_LENGTH)
  renderer.setStyles?.(readerCss(settings, fonts))
}

/**
 * foliate's paginator lays its section out again whenever its box resizes,
 * even while the section's document is still loading and has no root element
 * yet, and then throws. It lays the section out itself once it has loaded, so
 * a resize during loading can wait for that.
 */
function skipLayoutWhileLoading(renderer: FoliateRenderer) {
  const render = renderer.render?.bind(renderer)
  const getContents = renderer.getContents?.bind(renderer)
  if (!render || !getContents) return
  renderer.render = () => {
    const loading = getContents().some(
      ({ doc }) => doc?.readyState === "loading"
    )
    if (!loading) render()
  }
}

/**
 * Lets foliate settle each swipe by the whole swipe rather than by how fast
 * the finger was moving just before it lifted (see swipeVelocity). Returns
 * the touch listeners that measure the swipe, for the host and every section.
 */
function snapByWholeSwipe(renderer: FoliateRenderer) {
  const snap = renderer.snap?.bind(renderer)
  let start: { x: number; y: number } | null = null
  let swipe: number | null = null
  if (snap) {
    renderer.snap = (vx, vy) => {
      const velocity = swipe
      swipe = null
      snap(velocity ?? vx, vy)
    }
  }
  return {
    touchstart: (event: TouchEvent) => {
      const touches = event.touches
      start =
        touches.length === 1
          ? { x: touches[0].screenX, y: touches[0].screenY }
          : null
      swipe = null
    },
    // foliate snaps on the next frame, after this has run.
    touchend: (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      if (start && event.touches.length === 0)
        swipe = swipeVelocity(touch.screenX - start.x, touch.screenY - start.y)
      start = null
    },
  }
}

function toLocation(detail: RelocateDetail): ReaderLocation {
  const label = detail.tocItem?.label?.trim()
  return {
    fraction: detail.fraction,
    cfi: detail.cfi,
    chapter: label ? label : null,
    chapterHref: detail.tocItem?.href ?? null,
  }
}

/** Renders one EPUB with foliate-js (spec §9). Opens the file once per `file`. */
export function ReaderView({
  file,
  start,
  settings,
  ...callbacks
}: {
  file: Blob
  /** CFI to open at; null opens at the start of the text. */
  start: string | null
  settings: ReaderSettings
} & Callbacks) {
  const hostRef = useRef<HTMLElement>(null)
  const viewRef = useRef<View | null>(null)
  const callbacksRef = useRef(callbacks)
  const settingsRef = useRef(settings)
  const fontsRef = useRef<FontSources | null>(null)
  // Read once on purpose: the start position applies only when a file opens.
  const startRef = useRef(start)

  useEffect(() => {
    callbacksRef.current = callbacks
    settingsRef.current = settings
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false as boolean
    let opened: OpenedBook | null = null
    let view: View | null = null
    const isCancelled = () => cancelled
    const call = () => callbacksRef.current
    const interact = () => call().onInteract()
    let swipes: ReturnType<typeof snapByWholeSwipe> | null = null
    const wheelPager = createWheelPager()

    const move = async (direction: ReaderMove) => {
      if (!view) return
      if (direction === "left") await view.goLeft()
      else if (direction === "right") await view.goRight()
      else if (direction === "prev") await view.prev()
      else await view.next()
    }

    let tornDown = false
    // Shared by cleanup and the early exits; never throws, so the element and
    // the book are always released even if the paginator cannot close.
    const teardown = async () => {
      if (tornDown) return
      tornDown = true
      viewRef.current = null
      document.removeEventListener("keydown", onKey)
      host.removeEventListener("pointerdown", interact)
      host.removeEventListener("wheel", interact)
      host.removeEventListener("wheel", onWheel)
      if (swipes) {
        host.removeEventListener("touchstart", swipes.touchstart)
        host.removeEventListener("touchend", swipes.touchend)
      }
      try {
        view?.close()
      } catch (error) {
        console.error(error)
      }
      view?.remove()
      await opened?.close()
    }

    const onKey = (event: KeyboardEvent) => {
      const direction = keyMove(event.key)
      if (!direction || event.defaultPrevented) return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      interact()
      void move(direction)
    }

    // In paginated flow foliate ignores the wheel; scrolled flow scrolls natively.
    const onWheel = (event: WheelEvent) => {
      if (settingsRef.current.flow !== "paginated" || event.ctrlKey) return
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? host.clientHeight
            : 1
      const direction = wheelPager(
        event.deltaX * unit,
        event.deltaY * unit,
        event.timeStamp
      )
      if (!direction) return
      interact()
      void move(direction)
    }

    const onSectionLoad = (event: Event) => {
      const { doc } = (event as CustomEvent<{ doc: Document }>).detail
      doc.addEventListener("keydown", onKey)
      doc.addEventListener("pointerdown", interact)
      doc.addEventListener("wheel", interact, { passive: true })
      doc.addEventListener("wheel", onWheel, { passive: true })
      if (swipes) {
        doc.addEventListener("touchstart", swipes.touchstart, { passive: true })
        doc.addEventListener("touchend", swipes.touchend)
      }
      doc.addEventListener("click", (click) => {
        // foliate follows links itself and marks those clicks handled.
        if (click.defaultPrevented || doc.getSelection()?.toString()) return
        const frameLeft =
          doc.defaultView?.frameElement?.getBoundingClientRect().left ?? 0
        const box = host.getBoundingClientRect()
        const action = tapAction(frameLeft + click.clientX, box.left, box.width)
        if (action === "menu") {
          call().onTapMenu()
          return
        }
        interact()
        void move(action)
      })
    }

    const onRelocate = (event: Event) =>
      call().onRelocate(
        toLocation((event as CustomEvent<RelocateDetail>).detail)
      )

    document.addEventListener("keydown", onKey)
    host.addEventListener("pointerdown", interact)
    host.addEventListener("wheel", interact, { passive: true })
    host.addEventListener("wheel", onWheel, { passive: true })

    void (async () => {
      try {
        // Fetched while the book opens; never rejects (absolute URLs as fallback).
        const fontsLoading = loadReaderFonts()
        await import("foliate-js/view.js")
        opened = await openBookFile(file)
        if (cancelled) {
          await opened.close()
          return
        }
        view = document.createElement("foliate-view") as View
        view.className = "reader-view"
        view.addEventListener("relocate", onRelocate)
        view.addEventListener("load", onSectionLoad)
        host.append(view)
        await view.open(opened.book)
        if (isCancelled()) {
          await teardown()
          return
        }
        skipLayoutWhileLoading(view.renderer)
        // Before init, which loads the first section and so fires "load".
        swipes = snapByWholeSwipe(view.renderer)
        host.addEventListener("touchstart", swipes.touchstart, {
          passive: true,
        })
        host.addEventListener("touchend", swipes.touchend)
        const fonts = await fontsLoading
        if (isCancelled()) {
          await teardown()
          return
        }
        fontsRef.current = fonts
        applySettings(view, settingsRef.current, fonts)
        viewRef.current = view
        const startAt = startRef.current
        await view.init(
          startAt ? { lastLocation: startAt } : { showTextStart: true }
        )
        if (isCancelled()) {
          await teardown()
          return
        }
        const current = view
        call().onReady({
          controls: {
            goTo: async (target) => {
              await current.goTo(target)
            },
            goToFraction: (fraction) => current.goToFraction(fraction),
            move,
          },
          toc: opened.book.toc ?? [],
        })
      } catch (error) {
        if (!cancelled) call().onError(error)
      }
    })()

    return () => {
      cancelled = true
      void teardown()
    }
  }, [file])

  useEffect(() => {
    const view = viewRef.current
    const fonts = fontsRef.current
    if (view && fonts) applySettings(view, settings, fonts)
  }, [settings])

  return (
    <section
      ref={hostRef}
      aria-label="Isi buku"
      className="reader-host"
      style={{ background: THEME_COLORS[settings.theme].background }}
    />
  )
}
