import { Tabs } from "@base-ui/react/tabs"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { Annotation } from "@/lib/annotations/types"
import type { TocItem } from "@/lib/reader-types"
import { AnnotationList } from "./AnnotationList"

/** The table of contents and the book's annotations, as two tabs (spec 2 §6.6). */
export function TocPanel({
  open,
  onOpenChange,
  toc,
  currentHref,
  onSelect,
  annotations,
  chaptersOf,
  onSelectPlace,
  onDeleteAnnotation,
  onShareAnnotation,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  toc: ReadonlyArray<TocItem>
  currentHref: string | null
  onSelect: (href: string) => void
  annotations: ReadonlyArray<Annotation>
  chaptersOf: Parameters<typeof AnnotationList>[0]["chaptersOf"]
  onSelectPlace: (cfi: string) => void
  onDeleteAnnotation: (annotation: Annotation) => void
  onShareAnnotation: (annotation: Annotation) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-md">
        <DialogTitle className="sr-only">Daftar isi dan anotasi</DialogTitle>
        <Tabs.Root defaultValue="toc" className="grid gap-3">
          <Tabs.List className="reader-tabs">
            <Tabs.Tab value="toc" className="reader-tab">
              Daftar isi
            </Tabs.Tab>
            <Tabs.Tab value="annotations" className="reader-tab">
              Anotasi
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="toc">
            {toc.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Buku ini tidak punya daftar isi.
              </p>
            ) : (
              <TocList
                items={toc}
                currentHref={currentHref}
                onSelect={onSelect}
              />
            )}
          </Tabs.Panel>
          <Tabs.Panel value="annotations">
            <AnnotationList
              annotations={annotations}
              chaptersOf={chaptersOf}
              onSelect={onSelectPlace}
              onDelete={onDeleteAnnotation}
              onShare={onShareAnnotation}
            />
          </Tabs.Panel>
        </Tabs.Root>
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
