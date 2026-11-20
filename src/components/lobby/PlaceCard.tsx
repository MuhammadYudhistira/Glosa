import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The name card of a picked place (spec 3G §3.5): its name, one line about
 * its state, and "Buka". `statusId` is what the focused place's button is
 * described by, so a screen reader says the line too (spec 3G §3.3).
 */
export function PlaceCard({
  name,
  status,
  statusId,
  onOpen,
  className,
}: {
  name: string
  status: string
  statusId: string
  /** `keyboard`: Enter or Space on the button, a click without a pointer. */
  onOpen: (how: { keyboard: boolean }) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Tempat dipilih"
      className={cn("lobby-card lobby-overlay", className)}
    >
      <div className="min-w-0">
        <p className="lobby-card-name truncate">{name}</p>
        <p id={statusId} className="lobby-card-status">
          {status}
        </p>
      </div>
      <Button
        size="lg"
        onClick={(event) => onOpen({ keyboard: event.detail === 0 })}
      >
        Buka
      </Button>
    </div>
  )
}
