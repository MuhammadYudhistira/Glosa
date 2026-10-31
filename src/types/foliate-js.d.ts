declare module "foliate-js/epub.js" {
  import type { TocItem } from "@/lib/reader-types"

  export type EpubLoader = {
    loadText: (name: string) => Promise<string> | null
    loadBlob: (name: string, type?: string) => Promise<Blob> | null
    getSize: (name: string) => number
  }

  export class EPUB {
    constructor(loader: EpubLoader)
    init(): Promise<EPUB>
    /** Readium-webpub-like metadata; values may be strings, language maps or arrays. */
    metadata: unknown
    sections: Array<{
      createDocument?: () => Promise<Document>
      /** "no" for a section out of the reading order. */
      linear?: string
    }>
    toc?: Array<TocItem> | null
    dir?: string
    getCover(): Promise<Blob | null>
    destroy(): void
  }
}

declare module "foliate-js/view.js" {
  import type { EPUB } from "foliate-js/epub.js"
  import type { Overlayer } from "foliate-js/overlayer.js"

  export type RelocateDetail = {
    /** Position in the whole book, 0–1. */
    fraction: number
    cfi: string
    tocItem?: { label?: string; href?: string } | null
    /** The section shown now, by its index in the spine. */
    section?: { current: number; total: number }
    /** The text shown now. */
    range?: Range
    /** Minutes left in the section and the book at foliate's speed (1,600 characters a minute). */
    time?: { section: number; total: number }
  }

  /** foliate asks how to draw an annotation added with addAnnotation. */
  export type DrawAnnotationDetail = {
    draw: <T>(
      draw: (rects: DOMRectList, options: T) => SVGElement,
      options: T
    ) => void
    annotation: { value: string }
  }

  /** foliate-paginator (reflowable) or foliate-fxl (fixed layout, no setStyles). */
  export interface FoliateRenderer extends HTMLElement {
    setStyles?: (styles: string) => void
    /** Lays the current section out again (the paginator calls it on resize). */
    render?: () => void
    getContents?: () => Array<{
      doc: Document | null
      index?: number
      overlayer?: Overlayer
    }>
    /** Settles a swipe on a page; the paginator calls it when a touch ends. */
    snap?: (vx: number, vy: number) => void
    /** The paginator's scroll, in pixels along its scrolling side. */
    start?: number
    end?: number
    /** The whole section's length along that side. */
    viewSize?: number
    /** "height" when it scrolls down the page, "width" for vertical writing. */
    sideProp?: string
  }

  /** The <foliate-view> element; importing the module defines it. */
  export class View extends HTMLElement {
    book: EPUB
    renderer: FoliateRenderer
    /** The place shown now; set before "relocate" is sent. */
    lastLocation: RelocateDetail | null
    open(book: EPUB): Promise<void>
    init(options: {
      lastLocation?: string | null
      showTextStart?: boolean
    }): Promise<void>
    close(): void
    goTo(target: string): Promise<unknown>
    /** The CFI of a range in section `index`. */
    getCFI(index: number, range?: Range): string
    /** Draws (or, with remove, clears) an annotation; `value` is its CFI. */
    addAnnotation(
      annotation: { value: string },
      remove?: boolean
    ): Promise<unknown>
    deleteAnnotation(annotation: { value: string }): Promise<unknown>
    /** The table-of-contents entry a range in section `index` belongs to. */
    getProgressOf(
      index: number,
      range?: Range
    ): { tocItem?: { label?: string } | null }
    /** Where a CFI or href leads; index -1 when the book has no such place. */
    resolveNavigation(
      target: string
    ): { index: number; anchor?: (doc: Document) => unknown } | undefined
    goToFraction(fraction: number): Promise<void>
    goLeft(): Promise<void>
    goRight(): Promise<void>
    prev(): Promise<void>
    next(): Promise<void>
  }
}

declare module "foliate-js/epubcfi.js" {
  /** The start (or, with `toEnd`, the end) of a range CFI; a point stays as it is. */
  export function collapse(cfi: string, toEnd?: boolean): string
  /** Negative, zero or positive, by place in the book. */
  export function compare(a: string, b: string): number
}

declare module "foliate-js/overlayer.js" {
  export class Overlayer {
    static highlight(
      rects: ArrayLike<DOMRect>,
      options?: { color?: string }
    ): SVGElement
    /** The annotation drawn under a point, in the section's coordinates. */
    hitTest(point: { x: number; y: number }): [string, Range] | []
  }
}
