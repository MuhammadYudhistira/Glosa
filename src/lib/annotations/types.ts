/** Highlight colours (spec 2 §4.3); a bookmark has none. */
export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

export const ANNOTATION_KINDS = ["highlight", "bookmark"] as const
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number]

export const MAX_NOTE_LENGTH = 2000
export const MAX_EXCERPT_LENGTH = 1000
/** Changes sent in one request (spec 2 §4.3). */
export const MAX_ANNOTATION_BATCH = 50

/**
 * A highlight or a bookmark (spec 2 §4.3), as the server and this device keep
 * it. The id is made on the device. A deletion is a tombstone: `deletedAt`
 * set, so it reaches the member's other devices too.
 */
export type Annotation = {
  id: string
  bookId: string
  kind: AnnotationKind
  /** A range for a highlight, a point for a bookmark. */
  cfi: string
  color: HighlightColor | null
  /** Empty when there is no note; only highlights have one. */
  note: string
  /** The text, for the panel. */
  excerpt: string
  createdAt: string
  /** The device's clock at the last change: the newest change wins. */
  updatedAt: string
  deletedAt: string | null
}

export type AnnotationResult = "ok" | "limit_reached" | "invalid"

type Failed = { ok: false; code: string }
export type AnnotationSyncAnswer =
  { ok: true; results: Array<AnnotationResult> } | Failed
export type AnnotationsAnswer =
  { ok: true; annotations: Array<Annotation> } | Failed
