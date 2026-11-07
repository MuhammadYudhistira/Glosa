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
import { footnoteText, isFootnoteLink } from "@/lib/epub/footnotes"
import { markKeptLayout } from "@/lib/epub/keep-layout"
import { finiteTime } from "@/lib/reading-speed"
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
import {
  type AtEdge,
  type EdgeSide,
  type Pull,
  type PullStep,
  WHEEL_IDLE_MS,
  WHEEL_LINE,
  adjacentSection,
  chapterLabel,
  createEdgePull,
} from "./chapter-edge"
import { textOfDocument } from "@/lib/vocab/words"
import { loadReaderFonts } from "./reader-fonts"
import {
  type ReaderMove,
  type TapAction,
  createWheelPager,
  isControlTarget,
  isTurn,
  isTypingTarget,
  keyMove,
  selectionAction,
  swipeVelocity,
  tapAction,
} from "./reader-input"
import type { FootnoteTap } from "./FootnotePopup"
import type { TextSelection } from "./SelectionMenu"
import type { WordRect, WordTap } from "./WordPopup"

export type ReaderLocation = {
  fraction: number
  cfi: string
  chapter: string | null
  chapterHref: string | null
  /** The section's index in the spine; null when foliate does not say. */
  section: number | null
  /** The start of the page's text: a bookmark's excerpt. */
  pageText: string
  /** The member turned the page or scrolled here: not a jump or a new layout. */
  turned: boolean
  /** At the end of the last section in the reading order (spec Tahap 3 §4.4). */
  atBookEnd: boolean
  /** Minutes left in the section and the book at foliate's speed. */
  time: { section: number; total: number } | null
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
  /** A section's text, for the words read (plan 3D, decision 5). Never rejects. */
  sectionText: (index: number) => Promise<string | null>
  /** The book's cover from the EPUB, or null. Never rejects. */
  cover: () => Promise<Blob | null>
}

export type ReaderReady = { controls: ReaderControls; toc: Array<TocItem> }

/** The scroll at a section's edge, in the scrolled flow (spec pindah bab §3). */
export type ChapterEdgeState = {
  side: EdgeSide
  /** How far the member has pulled past it, 0–1. */
  progress: number
  /** The contents' name for where the move lands, or null for the plain words. */
  label: string | null
  /** The end of the last section: nowhere to move on to. */
  bookEnd: boolean
}

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
  /** A footnote link: its note shows instead of a jump (spec 2 §6.7). */
  onFootnote: (note: FootnoteTap) => void
  /** The member follows a link away from this place; called before foliate moves. */
  onJump: () => void
  /** `target` is not a place in this book (spec 2 §8). */
  onTargetMissing: () => void
  /** The scroll reached a section's edge, is pulled past it, or left it. */
  onChapterEdge: (edge: ChapterEdgeState | null) => void
  onError: (error: unknown) => void
}

/** Room above and below the text for the reader's bars, which overlay the book. */
const BAR_SPACE = "64px"
const MAX_LINE_LENGTH = "720px"
/** A selection that has stopped changing this long gets its menu (plan 2B, decision 9). */
const SELECTION_SETTLE_MS = 300

/** A box in a section's frame, in this window's coordinates. */
function rectInWindow(doc: Document, box: DOMRect): WordRect {
  const frame = doc.defaultView?.frameElement?.getBoundingClientRect()
  return {
    left: box.left + (frame?.left ?? 0),
    top: box.top + (frame?.top ?? 0),
    width: box.width,
    height: box.height,
  }
}

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
  // foliate shows two columns when the page is wide enough; "single" keeps
  // one (plan 2C, decision 10).
  renderer.setAttribute(
    "max-column-count",
    settings.spread === "single" ? "1" : "2"
  )
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

/** A section's text from its own document; null when it cannot be read. */
async function sectionText(view: View, index: number): Promise<string | null> {
  try {
    const doc = await view.book.sections[index]?.createDocument?.()
    return doc ? textOfDocument(doc) : null
  } catch {
    return null
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

/**
 * The contents in order, each entry with its section (spec pindah bab §4.2).
 * An entry whose place the book lacks is left out.
 */
function tocBySection(
  view: View,
  toc: ReadonlyArray<TocItem>
): Array<{ label: string; index: number }> {
  return toc.flatMap((item) => {
    let index: number | undefined
    try {
      index = view.resolveNavigation(item.href)?.index
    } catch {
      index = undefined
    }
    const own =
      index !== undefined && index >= 0 ? [{ label: item.label, index }] : []
    return [...own, ...tocBySection(view, item.subitems ?? [])]
  })
}

/** A wheel's distance in pixels, whichever unit it came in. */
function wheelPixels(event: WheelEvent, page: number): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return WHEEL_LINE
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return page
  return 1
}

/**
 * A wheel event's time. timeStamp counts from its own window's start, and
 * every section has its own frame: made absolute, times from any of them
 * compare.
 */
function wheelTime(event: WheelEvent): number {
  return (event.view ?? window).performance.timeOrigin + event.timeStamp
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

/**
 * A footnote's paragraphs (spec 2 §6.7), read from its section's document;
 * null when the link's place holds no note. Never rejects.
 */
async function footnoteOf(
  view: View,
  href: string,
  referenceId: string
): Promise<Array<string> | null> {
  try {
    const resolved = view.resolveNavigation(href)
    if (!resolved || resolved.index < 0 || !resolved.anchor) return null
    const doc = await view.book.sections[resolved.index]?.createDocument?.()
    const target = doc ? resolved.anchor(doc) : null
    return target instanceof Element
      ? footnoteText(target, referenceId || undefined)
      : null
  } catch {
    return null
  }
}

export function toLocation(
  detail: RelocateDetail,
  reason: string | null | undefined,
  readerTurning: boolean,
  atBookEnd: boolean
): ReaderLocation {
  const label = detail.tocItem?.label?.trim()
  return {
    // foliate gives NaN for a one-page section in paged flow.
    fraction: Number.isFinite(detail.fraction) ? detail.fraction : 0,
    cfi: detail.cfi,
    chapter: label ? label : null,
    chapterHref: detail.tocItem?.href ?? null,
    section: detail.section?.current ?? null,
    pageText: excerptOf(
      detail.range?.toString() ?? "",
      BOOKMARK_EXCERPT_LENGTH
    ),
    turned: isTurn(reason, readerTurning),
    atBookEnd,
    time: finiteTime(detail.time),
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
      host.removeEventListener("touchstart", onPullStart)
      host.removeEventListener("touchmove", onPullMove)
      host.removeEventListener("touchend", onPullEnd)
      host.removeEventListener("touchcancel", onPullEnd)
      scrolling?.removeEventListener("scroll", onRendererScroll)
      clearTimeout(wheelIdle)
      cancelAnimationFrame(edgeFrame)
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
      if (event.ctrlKey) return
      if (settingsRef.current.flow !== "paginated") {
        pullByWheel(event)
        return
      }
      const unit = wheelPixels(event, host.clientHeight)
      const direction = wheelPager(
        event.deltaX * unit,
        event.deltaY * unit,
        wheelTime(event)
      )
      if (!direction) return
      interact()
      void move(direction)
    }

    // Scrolling on past a section's edge moves to the next or the previous
    // one (spec pindah bab §3).
    const edgePull = createEdgePull()
    let tocEntries: Array<{ label: string; index: number }> = []
    // The pull shown, and the edge the page was last told about.
    let shownPull: Pull | null = null
    let toldEdge = "null"
    // Where the scroll stood when last measured: a wheel's own scroll is
    // already done when the wheel is heard.
    let knownAt: AtEdge = { start: false, end: false }
    let wheelIdle: ReturnType<typeof setTimeout> | undefined
    let edgeFrame = 0
    // The renderer heard for scrolls; it exists only once the book has opened.
    let scrolling: FoliateRenderer | null = null

    /**
     * Where the scroll stands; null where no pull applies: the paged flow, a
     * fixed layout and vertical writing.
     */
    const edgeOf = (): AtEdge | null => {
      const renderer = view?.renderer
      if (settingsRef.current.flow !== "scrolled" || !renderer) return null
      const { start: top, end: bottom, viewSize, sideProp } = renderer
      if (sideProp !== "height") return null
      if (top === undefined || bottom === undefined || viewSize === undefined)
        return null
      // The same measure foliate turns by.
      return { start: top <= 0, end: viewSize - bottom <= 2 }
    }

    /** The section a move toward `side` lands on, or null at the book's ends. */
    const targetOf = (side: EdgeSide): number | null => {
      const index = view?.lastLocation?.section?.current
      if (!view || index === undefined) return null
      const linear = view.book.sections.map((section) => section.linear)
      return adjacentSection(linear, index, side === "end" ? 1 : -1)
    }

    const reportEdge = () => {
      const at = edgeOf()
      knownAt = at ?? { start: false, end: false }
      // The end shows once reached; the start only while pulled (spec §3.2).
      const side = at ? (shownPull?.side ?? (at.end ? "end" : null)) : null
      let edge: ChapterEdgeState | null = null
      if (side) {
        const landing = targetOf(side)
        const dir = side === "end" ? 1 : -1
        if (landing !== null || side === "end") {
          edge = {
            side,
            progress: landing === null ? 0 : (shownPull?.progress ?? 0),
            label:
              landing === null
                ? null
                : chapterLabel(
                    tocEntries,
                    landing,
                    dir,
                    view?.lastLocation?.tocItem?.label ?? null
                  ),
            bookEnd: landing === null,
          }
        }
      }
      const told = JSON.stringify(edge)
      if (told === toldEdge) return
      toldEdge = told
      call().onChapterEdge(edge)
    }

    const forgetPull = () => {
      clearTimeout(wheelIdle)
      edgePull.reset()
      shownPull = null
    }

    const onPull = (step: PullStep) => {
      if (step === "next" || step === "prev") {
        shownPull = null
        reportEdge()
        if (targetOf(step === "next" ? "end" : "start") === null) return
        interact()
        void move(step)
        return
      }
      shownPull = step
      reportEdge()
    }

    /** A pull counts only over the text, with nothing open over it. */
    const pullableEdge = () =>
      popupOpenRef.current || selectionShown ? null : edgeOf()

    const pullByWheel = (event: WheelEvent) => {
      const at = pullableEdge()
      if (!at) return
      const pixels = event.deltaY * wheelPixels(event, host.clientHeight)
      onPull(edgePull.wheel(pixels, knownAt, at, wheelTime(event)))
      clearTimeout(wheelIdle)
      wheelIdle = setTimeout(() => {
        shownPull = null
        reportEdge()
      }, WHEEL_IDLE_MS)
    }

    const onPullStart = (event: TouchEvent) => {
      const at = pullableEdge()
      if (!at || event.touches.length !== 1) {
        edgePull.touchEnd()
        return
      }
      edgePull.touchStart(event.touches[0].screenY, at)
    }
    const onPullMove = (event: TouchEvent) => {
      const at = pullableEdge()
      if (!at || event.touches.length !== 1) return
      onPull(edgePull.touchMove(event.touches[0].screenY, at))
    }
    const onPullEnd = () => {
      edgePull.touchEnd()
      if (!shownPull) return
      shownPull = null
      reportEdge()
    }

    // foliate scrolls many times a frame: the edge is read once per frame.
    const onRendererScroll = () => {
      if (edgeFrame) return
      edgeFrame = requestAnimationFrame(() => {
        edgeFrame = 0
        reportEdge()
      })
    }

    const onSectionLoad = (event: Event) => {
      const { doc, index } = (
        event as CustomEvent<{ doc: Document; index: number }>
      ).detail
      // The book's own layout, before anything reads it: it depends on the
      // book's CSS only, so a change of settings does not need it again.
      markKeptLayout(doc)
      doc.addEventListener("keydown", onKey)
      doc.addEventListener("pointerdown", interact)
      doc.addEventListener("wheel", interact, { passive: true })
      doc.addEventListener("wheel", onWheel, { passive: true })
      if (swipes) {
        doc.addEventListener("touchstart", swipes.touchstart, { passive: true })
        doc.addEventListener("touchend", swipes.touchend)
      }
      // A new section: a pull past the last one's edge is over.
      forgetPull()
      doc.addEventListener("touchstart", onPullStart, { passive: true })
      doc.addEventListener("touchmove", onPullMove, { passive: true })
      doc.addEventListener("touchend", onPullEnd)
      doc.addEventListener("touchcancel", onPullEnd)
      // The frame's own coordinates, moved into this window's.
      const frameBox = () =>
        doc.defaultView?.frameElement?.getBoundingClientRect()
      const inWindow = (x: number) => x + (frameBox()?.left ?? 0)
      const toWindow = (box: DOMRect) => rectInWindow(doc, box)
      const tapOf = (hit: WordHit): WordTap => ({
        word: hit.word,
        sentence: hit.sentence,
        next: hit.next,
        cfi: cfiOf(index, hit.range),
        rect: toWindow(hit.range.getBoundingClientRect()),
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
          rect: toWindow(endRect(selected.range)),
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
            rect: toWindow(rectAt(range, click.clientX, click.clientY)),
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

    // foliate's view listens to its renderer first and keeps the new place in
    // lastLocation; the renderer's event also says why it moved (plan 2C,
    // decision 6).
    const onRendererRelocate = (event: Event) => {
      const place = view?.lastLocation
      if (!place) return
      const { reason } = (event as CustomEvent<{ reason?: string | null }>)
        .detail
      call().onRelocate(
        toLocation(
          place,
          reason,
          // Paged turns always relocate once on their own (the padding page);
          // only the scrolled flow can cross a section by navigation alone.
          turning && settingsRef.current.flow === "scrolled",
          view?.renderer.atEnd === true
        )
      )
      reportEdge()
    }

    // A link in the book, before foliate follows it: a footnote opens in a
    // popup (spec 2 §6.7), any other link is a jump the member can come back from.
    const showFootnote = async (a: Element, href: string) => {
      const current = view
      if (!current) return
      const placeBefore = current.lastLocation?.cfi
      const paragraphs = await footnoteOf(current, href, a.id)
      if (isCancelled()) return
      // The member moved while the note was read: it is stale.
      if (current.lastLocation?.cfi !== placeBefore) return
      if (paragraphs) {
        call().onFootnote({
          paragraphs,
          rect: rectInWindow(a.ownerDocument, a.getBoundingClientRect()),
        })
        return
      }
      // No note to show there: the link goes where it points (plan 2C, decision 3).
      call().onJump()
      await current.goTo(href)
    }
    const onLink = (event: Event) => {
      const { a, href } = (event as CustomEvent<{ a: Element; href: string }>)
        .detail
      if (!isFootnoteLink(a)) {
        call().onJump()
        return
      }
      event.preventDefault()
      showFootnote(a, href).catch((error: unknown) => {
        console.error("Footnote failed", error)
      })
    }

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
    host.addEventListener("touchstart", onPullStart, { passive: true })
    host.addEventListener("touchmove", onPullMove, { passive: true })
    host.addEventListener("touchend", onPullEnd)
    host.addEventListener("touchcancel", onPullEnd)

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
        view.addEventListener("link", onLink)
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
        // After open, which made the renderer and put foliate's listener first.
        view.renderer.addEventListener("relocate", onRendererRelocate)
        scrolling = view.renderer
        scrolling.addEventListener("scroll", onRendererScroll)
        tocEntries = tocBySection(view, opened.book.toc ?? [])
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
        const epub = opened.book
        call().onReady({
          controls: {
            goTo: async (place) => {
              await current.goTo(place)
            },
            goToFraction: (fraction) => current.goToFraction(fraction),
            move,
            clearSelection,
            chaptersOf: (cfis) => chaptersOf(current, cfis),
            sectionText: (index) => sectionText(current, index),
            canOpen: (cfi) => canOpen(current, cfi),
            cover: () => epub.getCover().catch(() => null),
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
