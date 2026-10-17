import { useEffect, useState } from "react"
import type { ShelfBook } from "@/lib/book-types"
import { localBookIds } from "@/lib/local/book-files"
import { localPercentages } from "@/lib/local/positions"

const LOCAL_CHANGE_EVENT = "glosa:local-change"

/** Tells every useLocalShelf on the page that this device's copies changed. */
export function announceLocalChange(): void {
  window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT))
}

export type LocalShelf = {
  saved: ReadonlySet<string>
  percentages: ReadonlyMap<string, number>
}

const EMPTY: LocalShelf = { saved: new Set(), percentages: new Map() }

/**
 * What this device holds: books saved for offline reading and the last
 * position read here. Read after mount, so the server render stays the same.
 */
export function useLocalShelf(): LocalShelf {
  const [local, setLocal] = useState<LocalShelf>(EMPTY)

  useEffect(() => {
    let active = true
    const read = () => {
      Promise.all([localBookIds(), localPercentages()]).then(
        ([saved, percentages]) => {
          if (active) setLocal({ saved, percentages })
        },
        (error: unknown) =>
          console.error("reading this device's books failed", error)
      )
    }
    read()
    window.addEventListener(LOCAL_CHANGE_EVENT, read)
    return () => {
      active = false
      window.removeEventListener(LOCAL_CHANGE_EVENT, read)
    }
  }, [])

  return local
}

/** Progress shown on the shelf: this device's position first, else the server's (plan 1C, decision 13). */
export function shelfPercentage(book: ShelfBook, local: LocalShelf): number {
  return local.percentages.get(book.id) ?? book.progress ?? 0
}
