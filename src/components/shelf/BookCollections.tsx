import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { bookMessage } from "@/lib/book-messages"
import type { Collection, ShelfBook } from "@/lib/book-types"
import { useOnline } from "@/lib/use-online"
import { setBookCollectionsFn } from "@/server/collections"

/**
 * The book's collections as a checklist (spec Tahap 3 §4.1). Every tick is
 * saved at once, like the genre beside it (plan 3A, decision 3).
 */
export function BookCollections({
  book,
  collections,
  offline = false,
  onSaved,
}: {
  book: ShelfBook
  collections: ReadonlyArray<Collection>
  /** The shelf came from the snapshot kept on this device. */
  offline?: boolean
  onSaved: () => void
}) {
  const save = useServerFn(setBookCollectionsFn)
  const online = useOnline()
  const [chosen, setChosen] = useState<ReadonlyArray<string>>(
    book.collectionIds
  )
  // The shelf's membership, to take over again when it loads anew.
  const [seen, setSeen] = useState(book.collectionIds.join())
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<"idle" | "saved" | { code: string }>(
    "idle"
  )

  const shelfIds = book.collectionIds.join()
  if (seen !== shelfIds && !busy) {
    setSeen(shelfIds)
    setChosen(book.collectionIds)
  }

  async function toggle(id: string) {
    // Ignored while a tick is saving: the box stays focusable meanwhile.
    if (busy) return
    const previous = chosen
    const next = chosen.includes(id)
      ? chosen.filter((other) => other !== id)
      : [...chosen, id]
    setChosen(next)
    setBusy(true)
    setState("idle")
    try {
      const result = await save({
        // Only collections this shelf shows: a deleted one or another
        // member's id would be refused as a whole.
        data: {
          bookId: book.id,
          collectionIds: collections
            .map((collection) => collection.id)
            .filter((other) => next.includes(other)),
        },
      })
      if (result.ok) {
        setState("saved")
        onSaved()
      } else {
        setChosen(previous)
        setState({ code: result.code })
      }
    } catch {
      setChosen(previous)
      setState({ code: "unknown" })
    }
    setBusy(false)
  }

  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-bold">Koleksi</legend>
      {collections.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Belum ada koleksi. Buat koleksi dari Rak Saya.
        </p>
      ) : (
        <ul className="space-y-1">
          {collections.map((collection) => (
            <li key={collection.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-mint"
                  checked={chosen.includes(collection.id)}
                  disabled={!online || offline}
                  aria-disabled={busy}
                  onChange={() => void toggle(collection.id)}
                />
                {collection.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <output className="block min-h-4 text-xs text-muted-foreground">
        {state === "saved" ? "Koleksi disimpan." : ""}
      </output>
      {typeof state === "object" && (
        <p role="alert" className="text-xs text-stamp">
          {bookMessage(state.code)}
        </p>
      )}
    </fieldset>
  )
}
