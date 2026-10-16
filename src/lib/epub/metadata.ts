import {
  METADATA_LIMITS,
  clampText,
  cleanDescription,
} from "@/lib/upload-rules"

export type BookMetadata = {
  title: string
  author: string
  language: string | null
  description: string | null
  subjects: Array<string>
}

const tidy = (text: string) => text.replace(/\s+/g, " ").trim()

/** foliate gives a string or a language map such as { ja: "草枕", en: "Kusamakura" }. */
function localized(value: unknown): string | null {
  if (typeof value === "string") return value
  if (value && typeof value === "object") {
    const map = value as Record<string, unknown>
    const preferred =
      typeof map.en === "string"
        ? map.en
        : Object.values(map).find((v) => typeof v === "string")
    return typeof preferred === "string" ? preferred : null
  }
  return null
}

/** Contributors and subjects are strings or objects with a (localized) name. */
function nameOf(value: unknown): string | null {
  if (value && typeof value === "object" && "name" in value) {
    return localized(value.name)
  }
  return localized(value)
}

function list(value: unknown): Array<unknown> {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function names(value: unknown): Array<string> {
  const seen = new Set<string>()
  for (const item of list(value)) {
    const name = nameOf(item)
    if (name && tidy(name)) seen.add(tidy(name))
  }
  return [...seen]
}

/** Maps foliate-js book.metadata to what Glosa stores (spec §5). */
export function normalizeMetadata(
  raw: unknown,
  fileName: string
): BookMetadata {
  const metadata = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >
  const fromFile = tidy(fileName.replace(/\.epub$/i, "").replace(/[_-]+/g, " "))
  const title =
    tidy(localized(metadata.title) ?? "") || fromFile || "Tanpa judul"
  const language = tidy(localized(list(metadata.language)[0]) ?? "")

  return {
    title: clampText(title, METADATA_LIMITS.title),
    author: clampText(
      names(metadata.author).join(", "),
      METADATA_LIMITS.author
    ),
    language: language ? language.slice(0, METADATA_LIMITS.language) : null,
    description: cleanDescription(localized(metadata.description)),
    subjects: names(metadata.subject)
      .slice(0, METADATA_LIMITS.subjects)
      .map((subject) => clampText(subject, METADATA_LIMITS.subject)),
  }
}
