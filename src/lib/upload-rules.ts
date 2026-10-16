export const MAX_EPUB_BYTES = 50 * 1024 * 1024
export const MAX_COVER_BYTES = 2 * 1024 * 1024
export const COVER_WIDTH = 400
/** Pending uploads older than this are abandoned: they no longer count toward the quota. */
export const PENDING_TTL_MS = 60 * 60 * 1000

export const METADATA_LIMITS = {
  title: 300,
  author: 300,
  description: 2000,
  language: 35,
  subjects: 30,
  subject: 200,
} as const

export type FileProblem = "not_epub" | "too_large" | "epub_invalid"

/** Checks made before the file is opened. */
export function checkEpubFile(file: {
  name: string
  size: number
}): FileProblem | null {
  if (!/\.epub$/i.test(file.name)) return "not_epub"
  if (file.size === 0) return "epub_invalid"
  if (file.size > MAX_EPUB_BYTES) return "too_large"
  return null
}

export function clampText(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

function decodeEntity(match: string, entity: string): string {
  if (entity.startsWith("#")) {
    const code = /^#x/i.test(entity)
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10)
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : ""
  }
  const key = entity.toLowerCase()
  return Object.hasOwn(NAMED_ENTITIES, key) ? NAMED_ENTITIES[key] : match
}

/** EPUB descriptions are often HTML. Keep plain text, at most 2000 characters (spec §4). */
export function cleanDescription(
  html: string | null | undefined
): string | null {
  if (!html) return null
  const text = html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/\s+/g, " ")
    .trim()
  return text ? clampText(text, METADATA_LIMITS.description) : null
}
