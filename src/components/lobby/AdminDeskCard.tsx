import { StorageMeter } from "@/components/shelf/StorageMeter"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"
import type { StorageUsage } from "@/lib/book-types"
import { useOnline } from "@/lib/use-online"

/** Upload and storage, beside the scene's admin desk (spec 1D §5.2). */
export function AdminDeskCard({
  usage,
  onUpload,
}: {
  usage: StorageUsage
  onUpload: () => void
}) {
  const online = useOnline()
  return (
    <Panel className="lobby-panel space-y-3">
      <h2 className="lobby-panel-title">Meja Admin</h2>
      <StorageMeter usage={usage} />
      <Button className="w-full" onClick={onUpload} disabled={!online}>
        Bawa buku
      </Button>
      {!online && <p className="text-xs text-stamp">Butuh internet.</p>}
    </Panel>
  )
}
