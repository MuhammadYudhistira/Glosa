import type { ShelfBook } from "@/lib/book-types"
import { GENRE_LABELS, TROLLEY_LABEL } from "@/lib/genre"
import { type ShelfFilter, countBooks } from "@/lib/shelf"
import { HOTSPOT_SPOTS, type HotspotId } from "./scene/layout"

export const RECENT_LIMIT = 5

/** What the lobby shows from the shelf (spec 1D §3.2). */
export type LobbySummary = {
  counts: Record<ShelfFilter, number>
  trolley: Array<ShelfBook>
  /** Books opened before, last opened first. */
  recent: Array<ShelfBook>
  /** The book the reading table opens: the one opened last on the server. */
  lastRead: ShelfBook | null
}

export function summarizeLobby(books: ReadonlyArray<ShelfBook>): LobbySummary {
  const opened = books
    .filter((book) => book.lastOpenedAt !== null)
    .sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""))
  return {
    counts: countBooks(books),
    trolley: books.filter((book) => book.genre === null),
    recent: opened.slice(0, RECENT_LIMIT),
    lastRead: opened.length > 0 ? opened[0] : null,
  }
}

/** What a hotspot says (spec 1D §5.1). */
export type HotspotModel = {
  id: HotspotId
  label: string
  /** Books in a zone; null where there is no count. */
  count: number | null
  /** The trolley's badge; null when it is empty. */
  badge: number | null
  /** A zone without books. */
  dim: boolean
}

export function lobbyHotspots(
  counts: Record<ShelfFilter, number>
): Array<HotspotModel> {
  return HOTSPOT_SPOTS.map(({ id }): HotspotModel => {
    const plain = { id, count: null, badge: null, dim: false }
    if (id === "meja-baca") return { ...plain, label: "Meja Baca" }
    if (id === "meja-admin") return { ...plain, label: "Meja Admin" }
    if (id === "troli") {
      return {
        ...plain,
        label: TROLLEY_LABEL,
        badge: counts.troli > 0 ? counts.troli : null,
      }
    }
    return {
      ...plain,
      label: GENRE_LABELS[id],
      count: counts[id],
      dim: counts[id] === 0,
    }
  })
}
