declare module "foliate-js/epub.js" {
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
    getCover(): Promise<Blob | null>
    destroy(): void
  }
}
