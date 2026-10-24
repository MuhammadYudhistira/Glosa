import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { type Annotation, MAX_NOTE_LENGTH } from "@/lib/annotations/types"
import { useWideScreen } from "@/lib/use-wide-screen"

/**
 * A highlight's note (spec 2 §6.6): a dialog on wide screens, a bottom sheet
 * on phones. Closing it in any way keeps what was typed; the page decides
 * what an empty note means. Give it a `key` per annotation.
 */
export function NoteEditor({
  annotation,
  onClose,
  finalFocus,
}: {
  annotation: Annotation | null
  onClose: (note: string) => void
  finalFocus: () => HTMLElement | null
}) {
  const wide = useWideScreen()
  const [text, setText] = useState(annotation?.note ?? "")
  if (!annotation) return null
  const close = () => onClose(text)
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="word-sheet-backdrop" />
        <DialogPrimitive.Popup
          aria-label="Catatan"
          className={wide ? "note-dialog" : "word-sheet note-sheet"}
          finalFocus={finalFocus}
        >
          <DialogPrimitive.Title className="font-heading text-lg">
            Catatan
          </DialogPrimitive.Title>
          <blockquote className="vocab-sentence">
            {annotation.excerpt}
          </blockquote>
          <textarea
            aria-label="Isi catatan"
            className="note-input"
            value={text}
            maxLength={MAX_NOTE_LENGTH}
            rows={6}
            onChange={(event) => setText(event.target.value)}
          />
          <Button size="lg" className="justify-self-end" onClick={close}>
            Selesai
          </Button>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
