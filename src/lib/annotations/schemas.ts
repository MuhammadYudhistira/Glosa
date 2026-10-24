import { z } from "zod"
import { MAX_CFI_LENGTH } from "@/lib/progress"
import { StoredText } from "@/lib/stored-text"
import {
  ANNOTATION_KINDS,
  type Annotation,
  HIGHLIGHT_COLORS,
  MAX_ANNOTATION_BATCH,
  MAX_EXCERPT_LENGTH,
  MAX_NOTE_LENGTH,
} from "./types"

const Stamp = z.iso.datetime({ offset: true })

export const AnnotationSchema = z
  .object({
    id: z.uuid(),
    bookId: z.uuid(),
    kind: z.enum(ANNOTATION_KINDS),
    cfi: StoredText.min(1).max(MAX_CFI_LENGTH),
    color: z.enum(HIGHLIGHT_COLORS).nullable(),
    note: StoredText.max(MAX_NOTE_LENGTH),
    excerpt: StoredText.max(MAX_EXCERPT_LENGTH),
    createdAt: Stamp,
    updatedAt: Stamp,
    deletedAt: Stamp.nullable(),
  })
  // The table's own rules: a highlight has a colour, only a highlight has a note.
  .refine((entry) => (entry.kind === "highlight") === (entry.color !== null), {
    message: "color",
  })
  .refine((entry) => entry.kind === "highlight" || entry.note === "", {
    message: "note",
  })

export const AnnotationSyncSchema = z.object({
  entries: z.array(AnnotationSchema).min(1).max(MAX_ANNOTATION_BATCH),
})

export const BookAnnotationsSchema = z.object({ bookId: z.uuid() })

/**
 * Whether the server will take this change. One it would refuse never enters
 * the queue (plan 2B, decision 2).
 */
export function isValidAnnotation(annotation: Annotation): boolean {
  return AnnotationSchema.safeParse(annotation).success
}
