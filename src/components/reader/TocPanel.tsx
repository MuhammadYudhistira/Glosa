import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { TocItem } from "@/lib/reader-types"

export function TocPanel({
  open,
  onOpenChange,
  toc,
  currentHref,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  toc: ReadonlyArray<TocItem>
  currentHref: string | null
  onSelect: (href: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Daftar isi</DialogTitle>
        </DialogHeader>
        {toc.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Buku ini tidak punya daftar isi.
          </p>
        ) : (
          <TocList items={toc} currentHref={currentHref} onSelect={onSelect} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TocList({
  items,
  currentHref,
  onSelect,
}: {
  items: ReadonlyArray<TocItem>
  currentHref: string | null
  onSelect: (href: string) => void
}) {
  return (
    <ol className="space-y-0.5 text-sm">
      {items.map((item, index) => (
        <li key={`${item.href}#${index}`}>
          <button
            type="button"
            aria-current={item.href === currentHref ? "true" : undefined}
            onClick={() => onSelect(item.href)}
            className="toc-item"
          >
            {item.label.trim() || "Tanpa judul"}
          </button>
          {item.subitems && item.subitems.length > 0 && (
            <div className="pl-4">
              <TocList
                items={item.subitems}
                currentHref={currentHref}
                onSelect={onSelect}
              />
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}
