import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { StorageUsage } from "@/lib/book-types"
import type { ShelfFilter, ShelfSort } from "@/lib/shelf"
import { GenreSelect } from "./GenreSelect"
import { SortSelect } from "./SortSelect"
import { StorageMeter } from "./StorageMeter"

/** Genre, order and storage, out of the page's way (spec poles mobile §3.1). */
export function ShelfFilterSheet({
  open,
  onOpenChange,
  genre,
  counts,
  sort,
  defaultSort,
  usage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  genre: ShelfFilter
  counts: Record<ShelfFilter, number>
  sort: ShelfSort
  defaultSort: ShelfSort
  usage: StorageUsage
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shelf-sheet max-lg:top-auto max-lg:bottom-0 max-lg:max-w-full max-lg:translate-y-0 max-lg:rounded-b-none max-lg:pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle>Saring rak</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <GenreSelect value={genre} counts={counts} />
          <SortSelect sort={sort} defaultSort={defaultSort} />
          <StorageMeter usage={usage} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
