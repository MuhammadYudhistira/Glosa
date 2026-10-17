import { UploadIcon } from "lucide-react"
import { useId } from "react"
import { StorageMeter } from "@/components/shelf/StorageMeter"
import { Panel } from "@/components/ui/panel"
import type { StorageUsage } from "@/lib/book-types"
import { cn } from "@/lib/utils"
import { useOnline } from "@/lib/use-online"

/** Upload and storage, beside the scene's admin desk (spec 1D §5.2). */
export function AdminDeskCard({
  usage,
  onUpload,
  className,
}: {
  usage: StorageUsage
  onUpload: () => void
  className?: string
}) {
  const online = useOnline()
  const hintId = useId()
  return (
    <Panel className={cn("lobby-panel space-y-3", className)}>
      <h2 className="lobby-panel-title">Meja Admin</h2>
      <button
        type="button"
        aria-label="Bawa buku"
        aria-describedby={hintId}
        className="lobby-drop"
        onClick={onUpload}
        disabled={!online}
      >
        <UploadIcon aria-hidden="true" className="mx-auto size-6" />
        <span className="mt-1 block text-base font-bold">Bawa buku</span>
        <span id={hintId} className="block text-xs text-muted-foreground">
          EPUB, maksimal 50 MB per file
        </span>
      </button>
      <StorageMeter usage={usage} />
      {!online && <p className="text-xs text-stamp">Butuh internet.</p>}
    </Panel>
  )
}
