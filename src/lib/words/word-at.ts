import { isLookupWord, normalizeWord } from "./normalize"
import { MAX_SENTENCE_LENGTH } from "./types"

/** Letters, marks and digits, with apostrophes and hyphens inside a word. */
const WORD_CHAR = /[\p{L}\p{M}\p{N}'’-]/u
const EDGE_CHAR = /['’-]/u
const TERMINALS = new Set([".", "!", "?", "…"])
const CLOSERS = /["'”’)\]]/u
/** Periods that do not end a sentence: "Mr. Holmes". */
const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "st",
  "jr",
  "sr",
  "prof",
  "rev",
  "mt",
  "vs",
  "etc",
])
/** Elements whose text makes one paragraph for the sentence and the next words. */
const BLOCKS =
  "p, li, blockquote, dd, dt, td, th, h1, h2, h3, h4, h5, h6, figcaption, pre, div"
/** Half of a surrogate pair: the cut to 500 characters can split an emoji. */
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g
/** C0 control characters other than whitespace; the database refuses NUL. */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000E-\u001F]/g
/** How far outside a word's box a tap still counts, in pixels. */
const SLOP = 1

export type Bounds = { start: number; end: number }

/** The word around a caret at `offset`, or null on a space or punctuation. */
export function wordBounds(text: string, offset: number): Bounds | null {
  let at = offset
  if (!WORD_CHAR.test(text.charAt(at))) at -= 1
  if (at < 0 || !WORD_CHAR.test(text.charAt(at))) return null
  let start = at
  while (start > 0 && WORD_CHAR.test(text.charAt(start - 1))) start -= 1
  let end = at + 1
  while (end < text.length && WORD_CHAR.test(text.charAt(end))) end += 1
  while (start < end && EDGE_CHAR.test(text.charAt(start))) start += 1
  while (end > start && EDGE_CHAR.test(text.charAt(end - 1))) end -= 1
  return start < end ? { start, end } : null
}

/** Whether the stop at `index` ends a sentence: not "Mr.", and followed by a space or the end. */
function endsSentence(text: string, index: number): boolean {
  if (text.charAt(index) === ".") {
    const before = /(\p{L}+)$/u.exec(text.slice(Math.max(0, index - 8), index))
    if (before && ABBREVIATIONS.has(before[1].toLowerCase())) return false
  }
  let next = index + 1
  while (next < text.length && CLOSERS.test(text.charAt(next))) next += 1
  return next >= text.length || /\s/u.test(text.charAt(next))
}

/**
 * The sentence holding text[start, end) (spec 2 §6.2): from the last stop
 * before it to the first after it, or the paragraph's edges, cut to `max`
 * characters around the word. Clean enough for the database: no half
 * characters, no control characters.
 */
export function sentenceAround(
  text: string,
  start: number,
  end: number,
  max = MAX_SENTENCE_LENGTH
): string {
  let from = 0
  for (let i = start - 1; i >= 0; i -= 1) {
    if (TERMINALS.has(text.charAt(i)) && endsSentence(text, i)) {
      from = i + 1
      while (from < start && CLOSERS.test(text.charAt(from))) from += 1
      break
    }
  }
  let to = text.length
  for (let i = end; i < text.length; i += 1) {
    if (TERMINALS.has(text.charAt(i)) && endsSentence(text, i)) {
      to = i + 1
      while (to < text.length && CLOSERS.test(text.charAt(to))) to += 1
      break
    }
  }
  if (to - from > max) {
    from = Math.max(
      from,
      Math.min(Math.round((start + end - max) / 2), to - max)
    )
    to = Math.min(to, from + max)
  }
  return text
    .slice(from, to)
    .replace(LONE_SURROGATE, "")
    .replace(CONTROL, "")
    .replace(/\s+/gu, " ")
    .trim()
}

/** Up to `count` words right after text[end] in the paragraph, for phrasal verbs (spec 2 §6.2). */
export function nextWords(text: string, end: number, count = 2): Array<string> {
  const words: Array<string> = []
  let rest = text.slice(end, end + 200)
  while (words.length < count) {
    const match = /^\s+([\p{L}\p{M}'’-]+)/u.exec(rest)
    if (!match) break
    const word = normalizeWord(match[1])
    if (!isLookupWord(word)) break
    words.push(word)
    rest = rest.slice(match[0].length)
  }
  return words
}

/** Duck-typed: both are missing in some browsers, and in the book's frame they belong to another window. */
type CaretDocument = {
  caretPositionFromPoint?: (
    x: number,
    y: number
  ) => { offsetNode: Node; offset: number } | null
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}

function caretAt(
  doc: Document,
  x: number,
  y: number
): { node: Node; offset: number } | null {
  const caret = doc as unknown as CaretDocument
  if (typeof caret.caretPositionFromPoint === "function") {
    const position = caret.caretPositionFromPoint(x, y)
    return position
      ? { node: position.offsetNode, offset: position.offset }
      : null
  }
  if (typeof caret.caretRangeFromPoint === "function") {
    const range = caret.caretRangeFromPoint(x, y)
    return range
      ? { node: range.startContainer, offset: range.startOffset }
      : null
  }
  return null
}

/** The browser puts a caret near any point, margins too: only a tap on the word counts. */
function containsPoint(range: Range, x: number, y: number): boolean {
  return [...range.getClientRects()].some(
    (box) =>
      x >= box.left - SLOP &&
      x <= box.right + SLOP &&
      y >= box.top - SLOP &&
      y <= box.bottom + SLOP
  )
}

/** The paragraph's text and where `node` starts in it. */
function paragraphOf(node: Text): { text: string; offset: number } {
  const doc = node.ownerDocument
  const block = node.parentElement?.closest(BLOCKS) ?? doc.body
  const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let offset = 0
  for (
    let current = walker.nextNode();
    current && current !== node;
    current = walker.nextNode()
  ) {
    offset += (current as Text).data.length
  }
  return { text: block.textContent, offset }
}

export type WordHit = {
  /** Normalized, as it is looked up. */
  word: string
  range: Range
  sentence: string
  next: Array<string>
}

/** The word tapped at (x, y) in a section's document (spec 2 §5, §6.2), or null. */
export function wordAt(doc: Document, x: number, y: number): WordHit | null {
  const caret = caretAt(doc, x, y)
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return null
  const node = caret.node as Text
  const bounds = wordBounds(node.data, caret.offset)
  if (!bounds) return null

  const range = doc.createRange()
  range.setStart(node, bounds.start)
  range.setEnd(node, bounds.end)
  if (!containsPoint(range, x, y)) return null

  const word = normalizeWord(node.data.slice(bounds.start, bounds.end))
  if (!isLookupWord(word)) return null
  const paragraph = paragraphOf(node)
  const start = paragraph.offset + bounds.start
  const end = paragraph.offset + bounds.end
  return {
    word,
    range,
    sentence: sentenceAround(paragraph.text, start, end),
    next: nextWords(paragraph.text, end),
  }
}
