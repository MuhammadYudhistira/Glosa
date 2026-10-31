import { Link } from "@tanstack/react-router"
import { PencilIcon } from "lucide-react"
import type { Collection } from "@/lib/book-types"
import { COLLECTION_LABELS } from "@/lib/shelf"
import { cn } from "@/lib/utils"

/**
 * Rak Saya's main row (spec Tahap 3 §4.3): Semua, the automatic collections,
 * the member's own in the order they were made, and the way to make one.
 */
export function CollectionBar({
  active,
  collections,
  counts,
  canEdit,
  onCreate,
  onEdit,
}: {
  /** The collection shown, after activeCollection; undefined is Semua. */
  active: string | undefined
  collections: ReadonlyArray<Collection>
  counts: Record<string, number>
  /** Online: collections can be made and changed. */
  canEdit: boolean
  onCreate: () => void
  onEdit: (collection: Collection) => void
}) {
  const chips: Array<{ value: string | undefined; label: string }> = [
    { value: undefined, label: "Semua" },
    { value: "sedang", label: COLLECTION_LABELS.sedang },
    { value: "selesai", label: COLLECTION_LABELS.selesai },
    ...collections.map(({ id, name }) => ({ value: id, label: name })),
  ]
  const editable = collections.find((collection) => collection.id === active)
  return (
    <nav aria-label="Koleksi" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex items-center gap-2 pb-1">
        {chips.map(({ value, label }) => {
          const count = counts[value ?? "semua"] ?? 0
          return (
            <li key={value ?? "semua"} className="shrink-0">
              <Link
                to="/shelf"
                search={(prev) => ({ ...prev, koleksi: value })}
                activeOptions={{ explicitUndefined: true }}
                aria-current={active === value ? "page" : undefined}
                className={cn(
                  "genre-chip",
                  count === 0 && active !== value && "opacity-60"
                )}
              >
                {label} <span className="tabular-nums">· {count}</span>
              </Link>
            </li>
          )
        })}
        {editable && (
          <li className="shrink-0">
            <button
              type="button"
              className="collection-edit"
              aria-label={`Ubah koleksi ${editable.name}`}
              disabled={!canEdit}
              onClick={() => onEdit(editable)}
            >
              <PencilIcon aria-hidden="true" />
            </button>
          </li>
        )}
        <li className="shrink-0">
          <button
            type="button"
            className="genre-chip collection-new"
            disabled={!canEdit}
            onClick={onCreate}
          >
            + Koleksi baru
          </button>
        </li>
      </ul>
    </nav>
  )
}
