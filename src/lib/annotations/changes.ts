import {
  type Annotation,
  type HighlightColor,
  MAX_EXCERPT_LENGTH,
  MAX_NOTE_LENGTH,
} from "./types"

/** A bookmark's excerpt: the start of its page (plan 2B, decision 16). */
export const BOOKMARK_EXCERPT_LENGTH = 200

// Two changes within one millisecond still get different times, so a sent
// change is never mistaken for the one made after it.
let last = 0

/** Now, as an ISO time, later than any time this tab gave before. */
export function stamp(): string {
  last = Math.max(Date.now(), last + 1)
  return new Date(last).toISOString()
}

// eslint-disable-next-line no-control-regex -- control characters are the point
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

// A lone surrogate would make the excerpt text Postgres jsonb refuses.
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

/** Book text on one line, cut to `max` characters with an ellipsis. */
export function excerptOf(text: string, max = MAX_EXCERPT_LENGTH): string {
  const flat = text
    .replace(CONTROL, "")
    .replace(LONE_SURROGATE, "")
    .replace(/\s+/g, " ")
    .trim()
  if (flat.length <= max) return flat
  // A cut between the two halves of an emoji would leave half of it behind.
  const cut = flat.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, "")
  return `${cut.trimEnd()}…`
}

type Place = { bookId: string; cfi: string; text: string }

export function newHighlight(
  { bookId, cfi, text }: Place,
  color: HighlightColor = "yellow"
): Annotation {
  const now = stamp()
  return {
    id: crypto.randomUUID(),
    bookId,
    kind: "highlight",
    cfi,
    color,
    note: "",
    excerpt: excerptOf(text),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}

export function newBookmark({ bookId, cfi, text }: Place): Annotation {
  const now = stamp()
  return {
    id: crypto.randomUUID(),
    bookId,
    kind: "bookmark",
    cfi,
    color: null,
    note: "",
    excerpt: excerptOf(text, BOOKMARK_EXCERPT_LENGTH),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}

/** A new colour or note. An empty note removes the note, not the highlight (spec 2 §6.6). */
export function edited(
  annotation: Annotation,
  changes: { color?: HighlightColor; note?: string }
): Annotation {
  // A bookmark has no colour and no note.
  if (annotation.kind === "bookmark") {
    return { ...annotation, updatedAt: stamp() }
  }
  return {
    ...annotation,
    color: changes.color ?? annotation.color,
    note:
      changes.note === undefined
        ? annotation.note
        : // Cut first, without leaving half an emoji, then trim.
          changes.note
            .slice(0, MAX_NOTE_LENGTH)
            .replace(/[\uD800-\uDBFF]$/, "")
            .trim(),
    updatedAt: stamp(),
  }
}

/** The tombstone that deletes an annotation on every device. */
export function deleted(annotation: Annotation): Annotation {
  const now = stamp()
  return { ...annotation, updatedAt: now, deletedAt: now }
}
