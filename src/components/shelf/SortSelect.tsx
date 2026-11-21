import { useNavigate } from "@tanstack/react-router"
import { useId } from "react"
import { SHELF_SORTS, type ShelfSort, isShelfSort } from "@/lib/shelf"

export function SortSelect({
  sort,
  defaultSort,
}: {
  sort: ShelfSort
  /** The collection's own order, which stays out of the URL. */
  defaultSort: ShelfSort
}) {
  const navigate = useNavigate({ from: "/shelf" })
  const sortId = useId()
  return (
    <div>
      <label
        htmlFor={sortId}
        className="mb-1 block text-xs text-muted-foreground"
      >
        Urutkan
      </label>
      <select
        id={sortId}
        value={sort}
        onChange={(event) => {
          const value = event.target.value
          void navigate({
            search: (prev) => ({
              ...prev,
              sort:
                isShelfSort(value) && value !== defaultSort ? value : undefined,
            }),
            replace: true,
          })
        }}
        className="native-select"
      >
        {SHELF_SORTS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
