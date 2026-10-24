import { Popover } from "@base-ui/react/popover"
import { CopyIcon, HighlighterIcon, StickyNoteIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type WordRect, anchorAt } from "./ReaderPopup"

/** Text selected in the book, and where the selection ends. */
export type TextSelection = { cfi: string; text: string; rect: WordRect }

/**
 * Highlight · Catatan · Salin beside a selection (spec 2 §6.6). It leaves the
 * focus in the book, so a phone keeps the selection's handles.
 */
export function SelectionMenu({
  selection,
  onHighlight,
  onNote,
  onCopy,
  onClose,
}: {
  selection: TextSelection | null
  onHighlight: () => void
  onNote: () => void
  onCopy: () => void
  onClose: () => void
}) {
  if (!selection) return null
  return (
    <Popover.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchorAt(selection.rect)}
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          className="word-positioner"
        >
          <Popover.Popup
            aria-label="Teks terpilih"
            className="selection-menu"
            initialFocus={false}
            finalFocus={false}
          >
            <Button size="lg" variant="ghost" onClick={onHighlight}>
              <HighlighterIcon aria-hidden="true" />
              Highlight
            </Button>
            <Button size="lg" variant="ghost" onClick={onNote}>
              <StickyNoteIcon aria-hidden="true" />
              Catatan
            </Button>
            <Button size="lg" variant="ghost" onClick={onCopy}>
              <CopyIcon aria-hidden="true" />
              Salin
            </Button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
