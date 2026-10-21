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
    sections: Array<unknown>
    toc?: Array<TocItem> | null
    dir?: string
    getCover(): Promise<Blob | null>
    destroy(): void
  }
}

declare module "foliate-js/view.js" {
  import type { EPUB } from "foliate-js/epub.js"

  export type RelocateDetail = {
    /** Position in the whole book, 0–1. */
    fraction: number
    cfi: string
    tocItem?: { label?: string; href?: string } | null
  }

  /** foliate-paginator (reflowable) or foliate-fxl (fixed layout, no setStyles). */
  export interface FoliateRenderer extends HTMLElement {
    setStyles?: (styles: string) => void
    /** Lays the current section out again (the paginator calls it on resize). */
    render?: () => void
    getContents?: () => Array<{ doc: Document | null }>
    /** Settles a swipe on a page; the paginator calls it when a touch ends. */
    snap?: (vx: number, vy: number) => void
  }

  /** The <foliate-view> element; importing the module defines it. */
  export class View extends HTMLElement {
    book: EPUB
    renderer: FoliateRenderer
    open(book: EPUB): Promise<void>
    init(options: {
      lastLocation?: string | null
      showTextStart?: boolean
    }): Promise<void>
    close(): void
    goTo(target: string): Promise<unknown>
    goToFraction(fraction: number): Promise<void>
    goLeft(): Promise<void>
    goRight(): Promise<void>
    prev(): Promise<void>
    next(): Promise<void>
  }
}
