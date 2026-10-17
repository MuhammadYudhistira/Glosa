import type { ReactNode } from "react"
import type { StorageUsage } from "@/lib/book-types"
import { StorageMeter } from "./StorageMeter"

export function ShelfHeader({
  usage,
  actions,
}: {
  usage: StorageUsage
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-heading text-3xl font-bold">Rak Saya</h1>
      </div>
      <div className="flex w-full flex-wrap items-end gap-4 sm:w-auto">
        <StorageMeter usage={usage} />
        {actions}
      </div>
    </header>
  )
}
