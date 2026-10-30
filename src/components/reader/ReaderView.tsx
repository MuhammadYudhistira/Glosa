import type {
  DrawAnnotationDetail,
  FoliateRenderer,
  RelocateDetail,
  View,
} from "foliate-js/view.js"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { BOOKMARK_EXCERPT_LENGTH, excerptOf } from "@/lib/annotations/changes"
import { HIGHLIGHT_FILL, drawHighlight } from "@/lib/annotations/draw"
import { endRect, rectAt, selectedRange } from "@/lib/annotations/selection"
import type { Annotation } from "@/lib/annotations/types"
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
import { type WordHit, wordAt } from "@/lib/words/word-at"
import type { HighlightTap } from "./AnnotationPopup"
import { loadReaderFonts } from "./reader-fonts"
import {
  type ReaderMove,
  type TapAction,
  createWheelPager,
  isControlTarget,
  isTypingTarget,
  keyMove,
  selectionAction,
  swipeVelocity,
  tapAction,
} from "./reader-input"
import type { TextSelection } from "./SelectionMenu"
import type { WordRect, WordTap } from "./WordPopup"

export type ReaderLocation = {
  fraction: number
  cfi: string
  chapter: string | null
  chapterHref: string | null
  /** The start of the page's text: a bookmark's excerpt. */
  pageText: string
}

export type ReaderControls = {
  goTo: (target: string) => Promise<void>
  goToFraction: (fraction: number) => Promise<void>
  move: (move: ReaderMove) => Promise<void>
  /** Drops the text selected in the book. */
  clearSelection: () => void
  /** Whether the book has this place (spec 2 §8). Never rejects. */
  canOpen: (cfi: string) => Promise<boolean>
  /** The chapter of each place, for the annotations panel. Never rejects. */
  chaptersOf: (cfis: ReadonlyArray<string>) => Promise<Array<string | null>>
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
  /** A tap on a highlight (spec 2 §6.1, step 2). */
  onHighlight: (tap: HighlightTap) => void
  /** Text selected, or the selection gone (spec 2 §6.6). */
  onSelection: (selection: TextSelection | null) => void
  /** A tap beside the words while a popup shows: it closes, the page stays. */
  onDismiss: () => void
  /** `target` is not a place in this book (spec 2 §8). */
  onTargetMissing: () => void
  onError: (error: unknown) => void
}

/** Room above and below the text for the reader's bars, which overlay the book. */
const BAR_SPACE = "64px"
const MAX_LINE_LENGTH = "720px"
/** A selection that has stopped changing this long gets its menu (plan 2B, decision 9). */
const SELECTION_SETTLE_MS = 300

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

/**
 * Whether the book has the place a CFI points at: its section exists and the
 * path inside it leads somewhere. Never rejects.
 */
async function canOpen(view: View, cfi: string): Promise<boolean> {
  try {
    const resolved = view.resolveNavigation(cfi)
    if (
      resolved === undefined ||
      resolved.index < 0 ||
      resolved.index >= view.book.sections.length
    )
      return false
    const { anchor } = resolved
    if (!anchor) return true
    const doc = await view.book.sections[resolved.index].createDocument?.()
    if (!doc) return false
    // foliate resolves the path lazily and throws when it leads nowhere.
    return Boolean(anchor(doc))
  } catch {
    return false
  }
}

/**
 * The chapter of each place (plan 2B, decision 13). Each section's document
 * is read once per call. Never rejects: a place it cannot find has none.
 */
async function chaptersOf(
  view: View,
  cfis: ReadonlyArray<string>
): Promise<Array<string | null>> {
  const docs = new Map<number, Promise<Document | undefined>>()
  const docOf = (index: number) => {
    let doc = docs.get(index)
    if (!doc) {
      doc = Promise.resolve(view.book.sections[index]?.createDocument?.())
      docs.set(index, doc)
    }
    return doc
  }
  return Promise.all(
    cfis.map(async (cfi) => {
      try {
        const resolved = view.resolveNavigation(cfi)
        if (!resolved || resolved.index < 0) return null
        const doc = await docOf(resolved.index)
        const target = doc && resolved.anchor ? resolved.anchor(doc) : null
        let range: Range | undefined
        if (target instanceof Range) range = target
        else if (doc && target instanceof Node) {
          range = doc.createRange()
          range.selectNodeContents(target)
        }
        const label = view
          .getProgressOf(resolved.index, range)
          .tocItem?.label?.trim()
        return label ? label : null
      } catch {
        return null
      }
    })
  )
}

/** How a highlight looks: drawn again when this changes. */
const lookOf = (highlight: Annotation) =>
  `${highlight.color ?? ""} ${highlight.note === "" ? "" : "note"}`

const drawFailed = (error: unknown) =>
  console.error("drawing a highlight failed", error)

/**
 * Brings the overlay in line with the highlights wanted: gone ones are
 * cleared, new or changed ones drawn. A section not shown has no overlay;
 * its highlights are drawn when it loads ("create-overlay").
 */
function redrawHighlights(
  view: View,
  wanted: ReadonlyMap<string, Annotation>,
  drawn: Map<string, string>
) {
  for (const cfi of [...drawn.keys()]) {
    if (wanted.has(cfi)) continue
    drawn.delete(cfi)
    view.deleteAnnotation({ value: cfi }).catch(drawFailed)
  }
  for (const [cfi, highlight] of wanted) {
    const look = lookOf(highlight)
    if (drawn.get(cfi) === look) continue
    drawn.set(cfi, look)
    view.addAnnotation({ value: cfi }).catch(drawFailed)
  }
}

function toLocation(detail: RelocateDetail): ReaderLocation {
  const label = detail.tocItem?.label?.trim()
  return {
    fraction: detail.fraction,
    cfi: detail.cfi,
    chapter: label ? label : null,
    chapterHref: detail.tocItem?.href ?? null,
    pageText: excerptOf(
      detail.range?.toString() ?? "",
      BOOKMARK_EXCERPT_LENGTH
    ),
  }
}

/** Renders one EPUB with foliate-js (spec §9). Opens the file once per `file`. */
export function ReaderView({
  file,
  start,
  target,
  settings,
  wordOpen,
  popupOpen,
  savedForms,
  highlights,
  ...callbacks
}: {
  file: Blob
  /** CFI to open at; null opens at the start of the text. */
  start: string | null
  /** A place asked for (Kosakata's "Buka di buku"); opened instead of `start`. */
  target: string | null
  settings: ReaderSettings
  /** A word's meaning shows: the tapped word stays lit. */
  wordOpen: boolean
  /** Any popup shows: a tap beside the words closes it. */
  popupOpen: boolean
  savedForms: SavedForms
  /** The book's highlights, drawn over the text. */
  highlights: ReadonlyArray<Annotation>
} & Callbacks) {
  const hostRef = useRef<HTMLElement>(null)
  const viewRef = useRef<View | null>(null)
  const callbacksRef = useRef(callbacks)
  const settingsRef = useRef(settings)
  const fontsRef = useRef<FontSources | null>(null)
  // Read once on purpose: the start position applies only when a file opens.
  const startRef = useRef(start)
  const targetRef = useRef(target)
  const popupOpenRef = useRef(popupOpen)
  const savedFormsRef = useRef(savedForms)
  // The highlights wanted, by CFI, and how each one is drawn now.
  const highlightsRef = useRef<ReadonlyMap<string, Annotation>>(new Map())
  const drawnRef = useRef(new Map<string, string>())
  const [hoverTurn, setHoverTurn] = useState<"left" | "right" | null>(null)

  useEffect(() => {
    callbacksRef.current = callbacks
    settingsRef.current = settings
    popupOpenRef.current = popupOpen
    savedFormsRef.current = savedForms
  })

  useEffect(() => {
    highlightsRef.current = new Map(
      highlights.map((highlight) => [highlight.cfi, highlight])
    )
    const view = viewRef.current
    if (view) redrawHighlights(view, highlightsRef.current, drawnRef.current)
  }, [highlights])

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
    // Whether the page was told about a selection it has not been told is gone.
    let selectionShown = false
    // A new book: nothing of it is drawn yet.
    drawnRef.current = new Map()

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

    const clearSelection = () => {
      selectionShown = false
      for (const { doc } of view?.renderer.getContents?.() ?? []) {
        doc?.getSelection()?.removeAllRanges()
      }
    }

    /** Closes whatever popup shows, the selection menu with its selection. */
    const dismiss = () => {
      if (selectionShown) clearSelection()
      call().onDismiss()
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
      if (event.defaultPrevented) return
      // A popup is open: this click only closes it (spec 2 decision 9).
      if (popupOpenRef.current || selectionShown) {
        dismiss()
        return
      }
      tapAt(event.clientX)
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
      const tapOf = (hit: WordHit): WordTap => ({
        word: hit.word,
        sentence: hit.sentence,
        next: hit.next,
        cfi: cfiOf(index, hit.range),
        rect: rectInWindow(hit.range.getBoundingClientRect()),
      })

      // A selection gets its menu once it holds still (spec 2 §6.6).
      let pointerHeld = false
      let settle: ReturnType<typeof setTimeout> | undefined
      const reportSelection = () => {
        const selected = selectedRange(doc)
        const cfi = selected ? cfiOf(index, selected.range) : null
        // No CFI means no usable selection: close a menu that is open.
        const action = selectionAction(!!selected, !!cfi, selectionShown)
        if (action === "clear") {
          selectionShown = false
          call().onSelection(null)
        }
        if (action !== "show" || !selected || !cfi) return
        selectionShown = true
        call().onSelection({
          cfi,
          text: selected.text,
          rect: rectInWindow(endRect(selected.range)),
        })
      }
      const reportLater = (ms: number) => {
        clearTimeout(settle)
        settle = setTimeout(reportSelection, ms)
      }
      doc.addEventListener("pointerdown", () => {
        pointerHeld = true
      })
      doc.addEventListener("pointerup", () => {
        pointerHeld = false
        reportLater(0)
      })
      doc.addEventListener("pointercancel", () => {
        pointerHeld = false
      })
      // A phone's selection handles send no touch events to the page.
      doc.addEventListener("selectionchange", () => {
        if (!pointerHeld) reportLater(SELECTION_SETTLE_MS)
      })

      // In order (spec 2 §6.1): links (foliate), the selection, a highlight,
      // a word, then the zones.
      doc.addEventListener("click", (click) => {
        // foliate follows links itself and marks those clicks handled.
        if (click.defaultPrevented) return
        // Text is selected (a drag just ended): its menu follows once it holds still.
        if (doc.getSelection()?.toString()) return
        // The selection menu is open and this tap undid the selection: it
        // only puts the menu away (plan 2B, decision 10).
        if (selectionShown) {
          dismiss()
          return
        }
        const hit = wordAt(doc, click.clientX, click.clientY)
        // The overlay is foliate's; its own click listener comes after this one (plan 2B, decision 8).
        const overlayer = view?.renderer
          .getContents?.()
          .find((content) => content.doc === doc)?.overlayer
        const [cfi, range] = overlayer?.hitTest(click) ?? []
        if (cfi && range) {
          call().onHighlight({
            cfi,
            rect: rectInWindow(rectAt(range, click.clientX, click.clientY)),
            word: hit ? tapOf(hit) : null,
          })
          return
        }
        if (hit) {
          showActiveWord(doc, hit.range)
          call().onWord(tapOf(hit))
          return
        }
        if (popupOpenRef.current) {
          dismiss()
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

    // A section's overlay is new: draw its highlights (spec 2 §6.6).
    const onCreateOverlay = (event: Event) => {
      const { index } = (event as CustomEvent<{ index: number }>).detail
      if (!view) return
      for (const [cfi, highlight] of highlightsRef.current) {
        if (view.resolveNavigation(cfi)?.index !== index) continue
        drawnRef.current.set(cfi, lookOf(highlight))
        view.addAnnotation({ value: cfi }).catch(drawFailed)
      }
    }

    const onDrawAnnotation = (event: Event) => {
      const { draw, annotation } = (event as CustomEvent<DrawAnnotationDetail>)
        .detail
      const highlight = highlightsRef.current.get(annotation.value)
      if (!highlight) return
      draw(drawHighlight, {
        color: HIGHLIGHT_FILL[highlight.color ?? "yellow"],
        note: highlight.note !== "",
      })
    }

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
        view.addEventListener("create-overlay", onCreateOverlay)
        view.addEventListener("draw-annotation", onDrawAnnotation)
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
        const reachable = wanted !== null && (await canOpen(view, wanted))
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
            clearSelection,
            chaptersOf: (cfis) => chaptersOf(current, cfis),
            canOpen: (cfi) => canOpen(current, cfi),
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
