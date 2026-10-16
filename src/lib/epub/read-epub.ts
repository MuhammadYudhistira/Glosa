import {
  BlobReader,
  BlobWriter,
  TextWriter,
  ZipReader,
  configure,
} from "@zip.js/zip.js"
import { type Genre, suggestGenre } from "@/lib/genre"
import { type FileProblem, checkEpubFile } from "@/lib/upload-rules"
import { type Cover, shrinkCover } from "./cover"
import { sha256Hex } from "./hash"
import { type BookMetadata, normalizeMetadata } from "./metadata"

export type ParsedEpub = {
  metadata: BookMetadata
  cover: Cover | null
  sha256: string
  suggestedGenre: Genre | null
}

export class EpubError extends Error {
  constructor(readonly code: FileProblem) {
    super(code)
  }
}

/** The same zip loader foliate-js uses in view.js, without its PDF/MOBI handling. */
async function openZip(file: Blob) {
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

/**
 * Opens an EPUB in the browser (spec §5 step 1): metadata, a shrunk cover,
 * SHA-256 and a genre guess. Throws EpubError for files that cannot come in.
 */
export async function readEpub(file: File): Promise<ParsedEpub> {
  const problem = checkEpubFile(file)
  if (problem) throw new EpubError(problem)

  let zip: Awaited<ReturnType<typeof openZip>>
  try {
    zip = await openZip(file)
  } catch {
    throw new EpubError("epub_invalid")
  }
  try {
    const { EPUB } = await import("foliate-js/epub.js")
    let book: InstanceType<typeof EPUB>
    try {
      book = await new EPUB(zip).init()
    } catch {
      throw new EpubError("epub_invalid")
    }
    if (book.sections.length === 0) throw new EpubError("epub_invalid")

    const metadata = normalizeMetadata(book.metadata, file.name)
    const cover = await book
      .getCover()
      .then((blob) => (blob ? shrinkCover(blob) : null))
      .catch(() => null)
    return {
      metadata,
      cover,
      sha256: await sha256Hex(await file.arrayBuffer()),
      suggestedGenre: suggestGenre(metadata.subjects),
    }
  } finally {
    await zip.close().catch(() => undefined)
  }
}
