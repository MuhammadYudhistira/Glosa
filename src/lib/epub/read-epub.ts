import { type Genre, suggestGenre } from "@/lib/genre"
import { checkEpubFile } from "@/lib/upload-rules"
import { type Cover, shrinkCover } from "./cover"
import { sha256Hex } from "./hash"
import { type BookMetadata, normalizeMetadata } from "./metadata"
import { EpubError, openZip } from "./zip-loader"

export { EpubError }

export type ParsedEpub = {
  metadata: BookMetadata
  cover: Cover | null
  sha256: string
  suggestedGenre: Genre | null
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
