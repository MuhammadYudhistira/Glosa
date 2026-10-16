import { useId } from "react"
import type { StorageUsage } from "@/lib/book-types"
import { formatUsage, planLabel } from "@/lib/member"

export function StorageMeter({ usage }: { usage: StorageUsage }) {
  const id = useId()
  return (
    <div className="w-full min-w-44 text-xs sm:w-auto">
      <div className="mb-1 flex justify-between gap-3">
        <label htmlFor={id}>Penyimpanan</label>
        <span className="font-bold tracking-wide text-mint">
          {planLabel(usage.plan)}
        </span>
      </div>
      <meter
        id={id}
        min={0}
        max={usage.limitBytes}
        value={usage.usedBytes}
        high={usage.limitBytes * 0.9}
        optimum={0}
        className="storage-meter"
      />
      <p className="mt-1 text-muted-foreground">
        {formatUsage(usage.usedBytes, usage.limitBytes)}
      </p>
    </div>
  )
}
