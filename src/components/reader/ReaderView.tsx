import type { FoliateRenderer, RelocateDetail, View } from "foliate-js/view.js"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { type OpenedBook, openBookFile } from "@/lib/epub/open-book"
import {
  type FontSources,
  MARGIN_GAP,
  type ReaderSettings,
  THEME_COLORS,
  readerCss,
} from "@/lib/reader-settings"
import type { TocItem } from "@/lib/reader-types"
import {
  type SavedForms,
  markSavedWords,
  showActiveWord,
  whenIdle,
} from "@/lib/words/saved-marks"
import { wordAt } from "@/lib/words/word-at"
import { loadReaderFonts } from "./reader-fonts"
import {
  type ReaderMove,
  type TapAction,
  createWheelPager,
  isControlTarget,
  isTypingTarget,
  keyMove,
  swipeVelocity,
  tapAction,
} from "./reader-input"
import type { WordRect, WordTap } from "./WordPopup"

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
  /** A tap on a word (spec 2 §6.1, step 4). */
  onWord: (tap: WordTap) => void
  /** A tap beside the words while a meaning shows: it closes, the page stays. */
  onDismissWord: () => void
  /** `target` is not a place in this book (spec 2 §8). */
  onTargetMissing: () => void
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

/**
 * foliate slides from page to page while the renderer is "animated"; it stays
 * still for members who asked their device for less motion. Returns a stop.
 */
function animateUnlessReduced(renderer: FoliateRenderer): () => void {
  if (typeof window.matchMedia !== "function") return () => {}
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
  const apply = () => renderer.toggleAttribute("animated", !reduce.matches)
  apply()
  reduce.addEventListener("change", apply)
  return () => reduce.removeEventListener("change", apply)
}

/** Whether the book has the place a CFI points at. */
function canOpen(view: View, cfi: string): boolean {
  try {
    const resolved = view.resolveNavigation(cfi)
    return (
      resolved !== undefined &&
      resolved.index >= 0 &&
      resolved.index < view.book.sections.length
    )
  } catch {
    return false
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
  target,
  settings,
  wordOpen,
  savedForms,
  ...callbacks
}: {
  file: Blob
  /** CFI to open at; null opens at the start of the text. */
  start: string | null
  /** A place asked for (Kosakata's "Buka di buku"); opened instead of `start`. */
  target: string | null
  settings: ReaderSettings
  /** A word's meaning shows: a tap beside the words closes it. */
  wordOpen: boolean
  savedForms: SavedForms
} & Callbacks) {
  const hostRef = useRef<HTMLElement>(null)
  const viewRef = useRef<View | null>(null)
  const callbacksRef = useRef(callbacks)
  const settingsRef = useRef(settings)
  const fontsRef = useRef<FontSources | null>(null)
  // Read once on purpose: the start position applies only when a file opens.
  const startRef = useRef(start)
  const targetRef = useRef(target)
  const wordOpenRef = useRef(wordOpen)
  const savedFormsRef = useRef(savedForms)
  const [hoverTurn, setHoverTurn] = useState<"left" | "right" | null>(null)

  useEffect(() => {
    callbacksRef.current = callbacks
    settingsRef.current = settings
    wordOpenRef.current = wordOpen
    savedFormsRef.current = savedForms
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
    let stopAnimating = () => {}
    const wheelPager = createWheelPager()
    // The section shown now, whose cursor follows the mouse.
    let sectionDoc: Document | null = null

    const zoneAt = (x: number): TapAction => {
      const box = host.getBoundingClientRect()
      return tapAction(x, box.left, box.width)
    }

    /** A click or tap at x (in this window) turns the page or shows the frame. */
    const tapAt = (x: number) => {
      const action = zoneAt(x)
      if (action === "menu") {
        call().onTapMenu()
        return
      }
      interact()
      void move(action)
    }

    const cfiOf = (index: number, range: Range): string | null => {
      try {
        return view?.getCFI(index, range) ?? null
      } catch {
        return null
      }
    }

    /** A mouse over the outer 30% shows which way a click there turns. */
    const hoverAt = (x: number | null) => {
      const zone = x === null ? null : zoneAt(x)
      const turn = zone === "left" || zone === "right" ? zone : null
      const cursor = turn ? "pointer" : ""
      host.style.cursor = cursor
      if (sectionDoc) sectionDoc.documentElement.style.cursor = cursor
      setHoverTurn(turn)
    }

    // Clicks beside the book's frame: on wide screens foliate leaves a band
    // on each side outside it. Clicks inside the frame stay in its document.
    const onHostClick = (event: MouseEvent) => {
      if (!event.defaultPrevented) tapAt(event.clientX)
    }
    const onHostPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hoverAt(event.clientX)
    }
    const onHostPointerLeave = () => hoverAt(null)

    const turn = async (direction: ReaderMove) => {
      if (!view) return
      if (direction === "left") await view.goLeft()
      else if (direction === "right") await view.goRight()
      else if (direction === "prev") await view.prev()
      else await view.next()
    }

    // foliate drops a turn asked for while the last one still slides, so a
    // quick second press or tap waits for it instead (the latest one only).
    let turning = false
    let queued: ReaderMove | null = null
    const takeQueued = () => {
      const next = queued
      queued = null
      return next
    }
    const move = async (direction: ReaderMove) => {
      if (turning) {
        queued = direction
        return
      }
      turning = true
      try {
        for (let next: ReaderMove | null = direction; next; next = takeQueued())
          await turn(next)
      } finally {
        turning = false
      }
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
      host.removeEventListener("click", onHostClick)
      host.removeEventListener("pointermove", onHostPointerMove)
      host.removeEventListener("pointerleave", onHostPointerLeave)
      stopAnimating()
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
      const direction = keyMove(event.key, event.shiftKey)
      if (!direction || event.defaultPrevented) return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (isTypingTarget(event.target)) return
      if (event.key === " " && isControlTarget(event.target)) return
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
      // timeStamp counts from its own window's start, and every section has
      // its own frame: made absolute, times from any of them compare.
      const origin = (event.view ?? window).performance.timeOrigin
      const direction = wheelPager(
        event.deltaX * unit,
        event.deltaY * unit,
        origin + event.timeStamp
      )
      if (!direction) return
      interact()
      void move(direction)
    }

    const onSectionLoad = (event: Event) => {
      const { doc, index } = (
        event as CustomEvent<{ doc: Document; index: number }>
      ).detail
      doc.addEventListener("keydown", onKey)
      doc.addEventListener("pointerdown", interact)
      doc.addEventListener("wheel", interact, { passive: true })
      doc.addEventListener("wheel", onWheel, { passive: true })
      if (swipes) {
        doc.addEventListener("touchstart", swipes.touchstart, { passive: true })
        doc.addEventListener("touchend", swipes.touchend)
      }
      // The frame's own coordinates, moved into this window's.
      const frameBox = () =>
        doc.defaultView?.frameElement?.getBoundingClientRect()
      const inWindow = (x: number) => x + (frameBox()?.left ?? 0)
      const rectInWindow = (box: DOMRect): WordRect => ({
        left: box.left + (frameBox()?.left ?? 0),
        top: box.top + (frameBox()?.top ?? 0),
        width: box.width,
        height: box.height,
      })
      // In order (spec 2 §6.1): links (foliate), a selection, a word, then the zones.
      doc.addEventListener("click", (click) => {
        // foliate follows links itself and marks those clicks handled.
        if (click.defaultPrevented || doc.getSelection()?.toString()) return
        const hit = wordAt(doc, click.clientX, click.clientY)
        if (hit) {
          showActiveWord(doc, hit.range)
          call().onWord({
            word: hit.word,
            sentence: hit.sentence,
            next: hit.next,
            cfi: cfiOf(index, hit.range),
            rect: rectInWindow(hit.range.getBoundingClientRect()),
          })
          return
        }
        if (wordOpenRef.current) {
          call().onDismissWord()
          return
        }
        tapAt(inWindow(click.clientX))
      })
      const win = doc.defaultView
      if (win) whenIdle(win, () => markSavedWords(doc, savedFormsRef.current))
      doc.addEventListener("pointermove", (pointer) => {
        if (pointer.pointerType !== "mouse") return
        sectionDoc = doc
        hoverAt(inWindow(pointer.clientX))
      })
      // Leaving the document altogether: to the bars, a panel or the window's edge.
      doc.addEventListener("pointerout", (pointer) => {
        if (!pointer.relatedTarget) hoverAt(null)
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
    host.addEventListener("click", onHostClick)
    host.addEventListener("pointermove", onHostPointerMove)
    host.addEventListener("pointerleave", onHostPointerLeave)

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
        stopAnimating = animateUnlessReduced(view.renderer)
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
        const wanted = targetRef.current
        const reachable = wanted !== null && canOpen(view, wanted)
        if (wanted !== null && !reachable) call().onTargetMissing()
        const startAt = reachable ? wanted : startRef.current
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
            goTo: async (place) => {
              await current.goTo(place)
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

  // The tapped word stays lit only while its meaning shows.
  useEffect(() => {
    if (wordOpen) return
    for (const { doc } of viewRef.current?.renderer.getContents?.() ?? []) {
      if (doc) showActiveWord(doc, null)
    }
  }, [wordOpen])

  // A word saved or deleted: the open section underlines again.
  useEffect(() => {
    const contents = viewRef.current?.renderer.getContents?.() ?? []
    const cancels = contents.flatMap(({ doc }) => {
      const win = doc?.defaultView
      return doc && win
        ? [whenIdle(win, () => markSavedWords(doc, savedForms))]
        : []
    })
    return () => {
      for (const cancel of cancels) cancel()
    }
  }, [savedForms])

  const colors = THEME_COLORS[settings.theme]
  return (
    <>
      <section
        ref={hostRef}
        aria-label="Isi buku"
        tabIndex={-1}
        className="reader-host"
        style={{ background: colors.background }}
      />
      {/* Mouse only, and a hint for clicks; keys and taps turn pages as well. */}
      <div
        aria-hidden
        className="reader-turn reader-turn-left"
        data-shown={hoverTurn === "left"}
        style={{ color: colors.text }}
      >
        <ChevronLeftIcon />
      </div>
      <div
        aria-hidden
        className="reader-turn reader-turn-right"
        data-shown={hoverTurn === "right"}
        style={{ color: colors.text }}
      >
        <ChevronRightIcon />
      </div>
    </>
  )
}
