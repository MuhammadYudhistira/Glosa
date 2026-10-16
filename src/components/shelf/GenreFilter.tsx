import { Link } from "@tanstack/react-router"
import { SHELF_FILTERS, type ShelfFilter } from "@/lib/shelf"
import { cn } from "@/lib/utils"

export function GenreFilter({
  active,
  counts,
}: {
  active: ShelfFilter
  counts: Record<ShelfFilter, number>
}) {
  return (
    <nav aria-label="Filter genre" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2 pb-1">
        {SHELF_FILTERS.map(({ value, label }) => (
          <li key={value} className="shrink-0">
            <Link
              to="/shelf"
              search={(prev) => ({
                ...prev,
                genre: value === "semua" ? undefined : value,
              })}
              aria-current={active === value ? "page" : undefined}
              className={cn(
                "genre-chip",
                counts[value] === 0 && active !== value && "opacity-60"
              )}
            >
              {label} <span className="tabular-nums">· {counts[value]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
