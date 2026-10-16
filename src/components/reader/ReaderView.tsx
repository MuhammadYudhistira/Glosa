import type { RelocateDetail, View } from "foliate-js/view.js"
import { useEffect, useRef } from "react"
import { type OpenedBook, openBookFile } from "@/lib/epub/open-book"
import {
  MARGIN_GAP,
  type ReaderSettings,
  THEME_COLORS,
  readerCss,
} from "@/lib/reader-settings"
import type { TocItem } from "@/lib/reader-types"
import { readerFonts } from "./reader-fonts"
import { type ReaderMove, keyMove, tapAction } from "./reader-input"

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

function applySettings(view: View, settings: ReaderSettings) {
  const renderer = view.renderer
  renderer.setAttribute("flow", settings.flow)
  renderer.setAttribute("gap", MARGIN_GAP[settings.margin])
  renderer.setAttribute("margin", BAR_SPACE)
  renderer.setAttribute("max-inline-size", MAX_LINE_LENGTH)
  renderer.setStyles?.(readerCss(settings, readerFonts()))
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

/**
 * Keys typed into a field or used inside a dialog never turn pages. Duck-typed:
 * events from the book's iframe carry elements from another window.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null
  return (
    typeof element?.closest === "function" &&
    element.closest(
      "input, select, textarea, [contenteditable], [role='dialog']"
    ) !== null
  )
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

    const move = async (direction: ReaderMove) => {
      if (!view) return
      if (direction === "left") await view.goLeft()
      else if (direction === "right") await view.goRight()
      else if (direction === "prev") await view.prev()
      else await view.next()
    }

    const onKey = (event: KeyboardEvent) => {
      const direction = keyMove(event.key)
      if (!direction || event.defaultPrevented) return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      interact()
      void move(direction)
    }

    const onSectionLoad = (event: Event) => {
      const { doc } = (event as CustomEvent<{ doc: Document }>).detail
      doc.addEventListener("keydown", onKey)
      doc.addEventListener("pointerdown", interact)
      doc.addEventListener("wheel", interact, { passive: true })
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

    void (async () => {
      try {
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
        applySettings(view, settingsRef.current)
        viewRef.current = view
        const startAt = startRef.current
        await view.init(
          startAt ? { lastLocation: startAt } : { showTextStart: true }
        )
        if (isCancelled()) return
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
      viewRef.current = null
      document.removeEventListener("keydown", onKey)
      host.removeEventListener("pointerdown", interact)
      host.removeEventListener("wheel", interact)
      view?.close()
      view?.remove()
      void opened?.close()
    }
  }, [file])

  useEffect(() => {
    const view = viewRef.current
    if (view) applySettings(view, settings)
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
