import { isLookupWord, normalizeWord } from "@/lib/words/normalize"

/** The most words sent for one section at once (spec 3D §3.2). */
export const MAX_WORDS_PER_PART = 5000

/**
 * A section's distinct words, each spelled the way the reader looks it up
 * (spec 3D §3.2), sorted. Splits like measureCoverage does.
 */
export function sectionWords(text: string): Array<string> {
  const words = new Set<string>()
  for (const raw of text.split(/[^\p{L}\p{M}'’-]+/u)) {
    const word = normalizeWord(raw)
    if (isLookupWord(word)) words.add(word)
  }
  return [...words].sort()
}

/** The words in parts of at most `size`; a section without words is one empty part. */
export function wordParts(
  words: ReadonlyArray<string>,
  size: number = MAX_WORDS_PER_PART
): Array<Array<string>> {
  if (words.length === 0) return [[]]
  const parts: Array<Array<string>> = []
  for (let i = 0; i < words.length; i += size) parts.push(words.slice(i, i + size))
  return parts
}

/** A section document's text, outside scripts and styles, joined by spaces. */
export function textOfDocument(doc: Document): string {
  // An SVG page has no body.
  const root = (doc.body as HTMLElement | null) ?? doc.documentElement
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const pieces: Array<string> = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest("script, style")) continue
    pieces.push((node as Text).data)
  }
  return pieces.join(" ")
}
