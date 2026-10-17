import { Button } from "@/components/ui/button"
import { formatPercent } from "@/lib/progress"
import type { Position } from "@/lib/reader-types"

/** The other device's newer place, offered once; the reader never jumps by itself (spec §10). */
export function JumpOffer({
  offer,
  onJump,
  onDismiss,
}: {
  offer: Position | null
  onJump: () => void
  onDismiss: () => void
}) {
  if (!offer) return null
  return (
    <aside aria-label="Posisi dari perangkat lain" className="reader-toast">
      <output className="text-sm">
        Lanjutkan dari {formatPercent(offer.percentage)} (dibaca di perangkat
        lain)?
      </output>
      <div className="flex gap-2">
        <Button size="lg" onClick={onJump}>
          Lompat
        </Button>
        <Button size="lg" variant="ghost" onClick={onDismiss}>
          Abaikan
        </Button>
      </div>
    </aside>
  )
}
