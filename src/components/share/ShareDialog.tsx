import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { useWideScreen } from "@/lib/use-wide-screen"

/** The popup that holds a share image, like the quote card's (spec 3E §5.3). */
export function ShareDialog({
  title,
  onClose,
  finalFocus,
  children,
}: {
  title: string
  onClose: () => void
  finalFocus?: () => HTMLElement | null
  children: ReactNode
}) {
  const wide = useWideScreen()
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="word-sheet-backdrop" />
        <DialogPrimitive.Popup
          aria-label={title}
          className={wide ? "quote-dialog" : "quote-sheet"}
          finalFocus={finalFocus}
        >
          <div className="quote-head">
            <DialogPrimitive.Title className="font-heading text-lg">
              {title}
            </DialogPrimitive.Title>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Tutup"
              onClick={onClose}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
