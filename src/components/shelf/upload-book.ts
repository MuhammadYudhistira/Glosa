import type { ActionResult } from "@/lib/action-result"
import type { UploadRequest, UploadTicket } from "@/lib/book-types"
import type { ParsedEpub } from "@/lib/epub/read-epub"
import type { Genre, GenreSource } from "@/lib/genre"
import { putFile } from "@/lib/xhr-upload"

export type UploadDeps = {
  requestUpload: (input: { data: UploadRequest }) => Promise<UploadTicket>
  confirmUpload: (input: { data: { bookId: string } }) => Promise<ActionResult>
  put?: typeof putFile
}

/** Reserve → upload EPUB and cover straight to Storage → confirm (spec §5). */
export async function uploadBook(
  file: File,
  parsed: ParsedEpub,
  choice: { genre: Genre | null; genreSource: GenreSource | null },
  deps: UploadDeps,
  onProgress: (fraction: number) => void
): Promise<ActionResult> {
  const put = deps.put ?? putFile
  const { metadata, cover } = parsed
  const ticket = await deps.requestUpload({
    data: {
      sha256: parsed.sha256,
      epubBytes: file.size,
      cover: cover ? { bytes: cover.blob.size, type: cover.type } : null,
      title: metadata.title,
      author: metadata.author,
      description: metadata.description,
      language: metadata.language,
      subjects: metadata.subjects,
      genre: choice.genre,
      genreSource: choice.genreSource,
    },
  })
  if (!ticket.ok) return ticket

  const total = file.size + (cover?.blob.size ?? 0)
  try {
    await put(ticket.epubUploadUrl, file, "application/epub+zip", (fraction) =>
      onProgress((fraction * file.size) / total)
    )
    if (cover && ticket.coverUploadUrl) {
      await put(ticket.coverUploadUrl, cover.blob, cover.type, (fraction) =>
        onProgress((file.size + fraction * cover.blob.size) / total)
      )
    }
  } catch {
    return { ok: false, code: "upload_interrupted" }
  }
  onProgress(1)
  return deps.confirmUpload({ data: { bookId: ticket.bookId } })
}
