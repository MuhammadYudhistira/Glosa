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
  for (let i = 0; i < words.length; i += size)
    parts.push(words.slice(i, i + size))
  return parts
}

const BLOCK =
  "address, article, aside, blockquote, body, br, dd, details, div, dl, dt, figcaption, figure, footer, h1, h2, h3, h4, h5, h6, header, hr, li, main, nav, ol, p, pre, section, summary, table, td, th, tr, ul"

/**
 * A section document's text, outside scripts and styles. Inline elements do
 * not split a word (a drop cap, <span>W</span>ord); a space goes only where
 * a block element or a line break begins or ends.
 */
export function textOfDocument(doc: Document): string {
  // An SVG page has no body.
  const root = (doc.body as HTMLElement | null) ?? doc.documentElement
  const walker = doc.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
  )
  let text = ""
  let skipping: Element | null = null
  let lineBreak = false
  let lastBlock: Element | null | undefined
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (skipping?.contains(node)) continue
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      if (element.matches("script, style")) skipping = element
      else if (element.localName === "br") lineBreak = true
      continue
    }
    const data = (node as Text).data
    if (data === "") continue
    // A new block (or a line break) between two texts is a gap; an inline
    // element inside one block is not.
    const block = node.parentElement?.closest(BLOCK) ?? null
    if (text !== "" && (lineBreak || block !== lastBlock)) text += " "
    text += data
    lineBreak = false
    lastBlock = block
  }
  return text
}
