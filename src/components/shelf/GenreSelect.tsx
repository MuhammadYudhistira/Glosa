import { useNavigate } from "@tanstack/react-router"
import { useId } from "react"
import { SHELF_FILTERS, type ShelfFilter } from "@/lib/shelf"

/** The genres and the trolley, as a choice beside the search (spec Tahap 3 §4.3). */
export function GenreSelect({
  value,
  counts,
}: {
  value: ShelfFilter
  counts: Record<ShelfFilter, number>
}) {
  const navigate = useNavigate({ from: "/shelf" })
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted-foreground">
        Tampilkan genre
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const next = SHELF_FILTERS.find(
            (filter) => filter.value === event.target.value
          )?.value
          void navigate({
            search: (prev) => ({
              ...prev,
              genre: next === undefined || next === "semua" ? undefined : next,
            }),
            replace: true,
          })
        }}
        className="native-select"
      >
        {SHELF_FILTERS.map((filter) => (
          <option key={filter.value} value={filter.value}>
            {filter.label} · {counts[filter.value]}
          </option>
        ))}
      </select>
    </div>
  )
}
