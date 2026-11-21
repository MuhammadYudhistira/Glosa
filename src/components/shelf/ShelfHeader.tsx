import { PlusIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react"

/** Rak Saya's title with its three icon buttons (spec poles mobile §3.1). */
export function ShelfHeader({
  searching,
  onSearch,
  onFilter,
  filtersActive,
  onBring,
}: {
  searching: boolean
  onSearch: () => void
  onFilter: () => void
  /** A genre or an order other than the default is chosen. */
  filtersActive: boolean
  /** Missing on an empty shelf, which has its own button. */
  onBring?: () => void
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      <h1 className="font-heading text-3xl font-bold">Rak Saya</h1>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="shelf-icon-button"
          aria-label="Cari"
          aria-expanded={searching}
          onClick={onSearch}
        >
          <SearchIcon aria-hidden="true" />
        </button>
        <button
          type="button"
          className="shelf-icon-button"
          aria-label="Saring"
          data-active={filtersActive ? "" : undefined}
          onClick={onFilter}
        >
          <SlidersHorizontalIcon aria-hidden="true" />
        </button>
        {onBring && (
          <button
            type="button"
            className="shelf-icon-button"
            data-primary=""
            aria-label="Bawa buku"
            onClick={onBring}
          >
            <PlusIcon aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  )
}
