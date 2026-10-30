import { ReaderPopup, type WordRect } from "./ReaderPopup"

/** A footnote opened from its link (spec 2 §6.7): its text, beside the link. */
export type FootnoteTap = { paragraphs: Array<string>; rect: WordRect }

/**
 * A footnote in the popup the meanings use: a popover beside the link on
 * wide screens, a bottom sheet on phones. The page stays where it is.
 */
export function FootnotePopup({
  note,
  onClose,
  finalFocus,
}: {
  note: FootnoteTap | null
  onClose: () => void
  finalFocus: () => HTMLElement | null
}) {
  if (!note) return null
  return (
    <ReaderPopup
      rect={note.rect}
      label="Catatan kaki"
      onClose={onClose}
      finalFocus={finalFocus}
    >
      <div className="word-card footnote-card">
        {note.paragraphs.map((paragraph, index) => (
          // The paragraphs never change while the popup shows.
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </ReaderPopup>
  )
}
