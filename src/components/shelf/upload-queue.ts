import { bookMessage } from "@/lib/book-messages"
import type { Genre, GenreSource } from "@/lib/genre"

export type UploadStatus = "reading" | "ready" | "uploading" | "done" | "failed"

export type UploadItem = {
  id: string
  fileName: string
  status: UploadStatus
  progress: number
  title: string | null
  author: string | null
  suggestedGenre: Genre | null
  genre: Genre | null
  genreSource: GenreSource | null
  code: string | null
}

export type UploadAction =
  | { type: "added"; files: ReadonlyArray<{ id: string; fileName: string }> }
  | {
      type: "read"
      id: string
      title: string
      author: string
      suggestedGenre: Genre | null
    }
  | { type: "genre_chosen"; id: string; genre: Genre | null }
  | { type: "started"; id: string }
  | { type: "progressed"; id: string; progress: number }
  | { type: "finished"; id: string }
  | { type: "failed"; id: string; code: string }
  | { type: "retried"; id: string }
  | { type: "cleared" }

/** Failures caused by the file itself; a new attempt with the same file cannot help. */
const FINAL_CODES = new Set([
  "not_epub",
  "epub_invalid",
  "too_large",
  "duplicate",
])

export function canRetry(item: UploadItem): boolean {
  return (
    item.status === "failed" &&
    item.title !== null &&
    !FINAL_CODES.has(item.code ?? "")
  )
}

/** Done uploads and failures a new attempt cannot fix are dropped by "cleared". */
export function isCleared(item: UploadItem): boolean {
  return item.status === "done" || (item.status === "failed" && !canRetry(item))
}

export function readyItems(
  items: ReadonlyArray<UploadItem>
): Array<UploadItem> {
  return items.filter((item) => item.status === "ready")
}

function update(
  items: Array<UploadItem>,
  id: string,
  change: (item: UploadItem) => UploadItem
): Array<UploadItem> {
  return items.map((item) => (item.id === id ? change(item) : item))
}

export function uploadQueueReducer(
  items: Array<UploadItem>,
  action: UploadAction
): Array<UploadItem> {
  switch (action.type) {
    case "added":
      return [
        ...items,
        ...action.files.map((file): UploadItem => ({
          id: file.id,
          fileName: file.fileName,
          status: "reading",
          progress: 0,
          title: null,
          author: null,
          suggestedGenre: null,
          genre: null,
          genreSource: null,
          code: null,
        })),
      ]
    case "read":
      return update(items, action.id, (item) =>
        item.status === "reading"
          ? {
              ...item,
              status: "ready",
              title: action.title,
              author: action.author,
              suggestedGenre: action.suggestedGenre,
              genre: action.suggestedGenre,
              genreSource: action.suggestedGenre ? "auto" : null,
            }
          : item
      )
    case "genre_chosen":
      return update(items, action.id, (item) =>
        item.status === "ready" || canRetry(item)
          ? {
              ...item,
              genre: action.genre,
              genreSource:
                action.genre === null
                  ? null
                  : action.genre === item.suggestedGenre
                    ? "auto"
                    : "user",
            }
          : item
      )
    case "started":
      return update(items, action.id, (item) =>
        item.status === "ready"
          ? { ...item, status: "uploading", progress: 0, code: null }
          : item
      )
    case "progressed":
      return update(items, action.id, (item) =>
        item.status === "uploading"
          ? { ...item, progress: Math.min(1, Math.max(0, action.progress)) }
          : item
      )
    case "finished":
      return update(items, action.id, (item) =>
        item.status === "uploading"
          ? { ...item, status: "done", progress: 1 }
          : item
      )
    case "failed":
      return update(items, action.id, (item) =>
        item.status === "done"
          ? item
          : { ...item, status: "failed", code: action.code }
      )
    case "retried":
      return update(items, action.id, (item) =>
        canRetry(item)
          ? { ...item, status: "ready", progress: 0, code: null }
          : item
      )
    case "cleared":
      return items.filter((item) => !isCleared(item))
  }
}

export function uploadStatusText(item: UploadItem): string {
  switch (item.status) {
    case "reading":
      return "Membaca file…"
    case "ready":
      return "Siap masuk rak"
    case "uploading":
      return `Mengunggah… ${Math.round(item.progress * 100)}%`
    case "done":
      return "Masuk rak ✓"
    case "failed":
      return bookMessage(item.code)
  }
}

export function queueSummary(items: ReadonlyArray<UploadItem>): string {
  const count = (status: UploadStatus) =>
    items.filter((item) => item.status === status).length
  const reading = count("reading")
  if (reading > 0) return `Membaca ${reading} file…`
  if (count("uploading") > 0) return "Mengunggah buku ke rak…"
  const parts = [
    count("done") > 0 ? `${count("done")} buku masuk rak` : null,
    count("failed") > 0 ? `${count("failed")} gagal` : null,
    count("ready") > 0 ? `${count("ready")} siap` : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? `${parts.join(", ")}.` : ""
}
