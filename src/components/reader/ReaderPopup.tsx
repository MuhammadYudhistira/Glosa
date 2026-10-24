import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Popover } from "@base-ui/react/popover"
import type { ReactNode } from "react"
import { useWideScreen } from "@/lib/use-wide-screen"

/** Where a tapped word or highlight is, in this window's coordinates. */
export type WordRect = {
  left: number
  top: number
  width: number
  height: number
}

/** A virtual element at the rect, for a popover to sit beside. */
export function anchorAt({ left, top, width, height }: WordRect) {
  const box = {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }
  return { getBoundingClientRect: () => ({ ...box, toJSON: () => box }) }
}

/**
 * A reader popup (spec 2 §6.3, §6.6): a popover beside `rect` on wide
 * screens, a bottom sheet on phones. Escape or a tap outside closes it, and
 * the focus goes back to the book.
 */
export function ReaderPopup({
  rect,
  label,
  onClose,
  finalFocus,
  children,
}: {
  rect: WordRect
  label: string
  onClose: () => void
  finalFocus: () => HTMLElement | null
  children: ReactNode
}) {
  const wide = useWideScreen()
  const onOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  if (wide) {
    return (
      <Popover.Root open onOpenChange={onOpenChange}>
        <Popover.Portal>
          <Popover.Positioner
            anchor={anchorAt(rect)}
            side="bottom"
            sideOffset={8}
            collisionPadding={16}
            className="word-positioner"
          >
            <Popover.Popup
              aria-label={label}
              className="word-popup"
              finalFocus={finalFocus}
            >
              {children}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    )
  }
  return (
    <DialogPrimitive.Root open onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="word-sheet-backdrop" />
        <DialogPrimitive.Popup
          aria-label={label}
          className="word-sheet"
          finalFocus={finalFocus}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
