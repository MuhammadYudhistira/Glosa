import {
  BlobReader,
  BlobWriter,
  TextWriter,
  ZipReader,
  configure,
} from "@zip.js/zip.js"
import type { EpubLoader } from "foliate-js/epub.js"
import type { FileProblem } from "@/lib/upload-rules"

export class EpubError extends Error {
  constructor(readonly code: FileProblem) {
    super(code)
  }
}

export type ZipLoader = EpubLoader & { close: () => Promise<unknown> }

/** The same zip loader foliate-js uses in view.js, without its PDF/MOBI handling. */
export async function openZip(file: Blob): Promise<ZipLoader> {
  configure({ useWebWorkers: false })
  const reader = new ZipReader(new BlobReader(file))
  const entries = await reader.getEntries()
  const byName = new Map(entries.map((entry) => [entry.filename, entry]))
  return {
    // Directory entries have no getData: zip.js types them as `directory: true`.
    loadText: (name: string) => {
      const entry = byName.get(name)
      return entry && !entry.directory ? entry.getData(new TextWriter()) : null
    },
    loadBlob: (name: string, type?: string) => {
      const entry = byName.get(name)
      return entry && !entry.directory
        ? entry.getData(new BlobWriter(type))
        : null
    },
    getSize: (name: string) => byName.get(name)?.uncompressedSize ?? 0,
    close: () => reader.close(),
  }
}
