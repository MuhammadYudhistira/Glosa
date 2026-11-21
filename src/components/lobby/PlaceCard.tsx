import { useId } from "react"
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
  onClose,
  onLeave,
  className,
}: {
  name: string
  status: string
  statusId: string
  /** `keyboard`: Enter or Space on the button, a click without a pointer. */
  onOpen: (how: { keyboard: boolean }) => void
  /** Escape inside the card. */
  onClose?: () => void
  /** Focus left the card for `next` (null: nothing, or another window). */
  onLeave?: (next: EventTarget | null) => void
  className?: string
}) {
  const nameId = useId()
  return (
    <div
      role="group"
      aria-labelledby={nameId}
      className={cn("lobby-card lobby-overlay", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose?.()
      }}
      onBlur={(event) => {
        const next = event.relatedTarget
        if (next instanceof Node && event.currentTarget.contains(next)) return
        onLeave?.(next)
      }}
    >
      <div className="min-w-0">
        <p id={nameId} className="lobby-card-name truncate">
          {name}
        </p>
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
