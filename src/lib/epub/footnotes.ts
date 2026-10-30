/**
 * Footnotes (spec 2 §6.7). Which links point at a note follows foliate-js's
 * footnotes.js (MIT), which does not export its test. The note's text is
 * read here, so the book's own markup never enters the app's page (plan 2C,
 * decision 1).
 */

const OPS = "http://www.idpf.org/2007/ops"
const REF_TYPES = ["biblioref", "glossref", "noteref"]
const REF_ROLES = ["doc-biblioref", "doc-glossref", "doc-noteref"]
const INLINE = "a, span, sup, sub, em, strong, i, b, small, big"
const BLOCKS = "p, div, li, blockquote, dd, dt, aside, section"

/** A note shown in the popup stops after this many characters (plan 2C, decision 2). */
export const FOOTNOTE_MAX_LENGTH = 2000

const wordsOf = (value: string | null) =>
  new Set(value?.split(/\s+/).filter(Boolean) ?? [])
// XHTML has epub:type in its namespace; a section parsed as HTML has it as a name.
const typesOf = (el: Element) =>
  wordsOf(el.getAttributeNS(OPS, "type") ?? el.getAttribute("epub:type"))
const rolesOf = (el: Element) => wordsOf(el.getAttribute("role"))
const isBacklink = (a: Element) =>
  typesOf(a).has("backlink") || rolesOf(a).has("doc-backlink")

function isRaised(el: Element | null): boolean {
  if (!el) return false
  if (el.matches("sup")) return true
  const align =
    el.ownerDocument.defaultView?.getComputedStyle(el).verticalAlign ?? ""
  return (
    align === "super" ||
    align === "top" ||
    align === "text-top" ||
    /^\d/.test(align)
  )
}

/** Whether a link points at a note rather than at another place to read. */
export function isFootnoteLink(a: Element): boolean {
  const types = typesOf(a)
  const roles = rolesOf(a)
  if (
    REF_ROLES.some((role) => roles.has(role)) ||
    REF_TYPES.some((type) => types.has(type))
  )
    return true
  if (isBacklink(a)) return false
  // Unmarked notes: a raised number, as most books set them.
  return (
    isRaised(a) ||
    (a.children.length === 1 && isRaised(a.children[0])) ||
    isRaised(a.parentElement)
  )
}

/** The fragment of a link's href, without the "#"; null when it has none. */
function fragmentOf(a: Element): string | null {
  const href = a.getAttribute("href") ?? ""
  const at = href.indexOf("#")
  if (at < 0) return null
  try {
    return decodeURIComponent(href.slice(at + 1))
  } catch {
    return href.slice(at + 1)
  }
}

/** The note a link's target belongs to: the target, or the block around it. */
function noteOf(target: Element): Element | null {
  let note = target
  while (note.matches(INLINE) && note.parentElement) note = note.parentElement
  if (note !== note.ownerDocument.body) return note
  // A bare anchor before its note.
  const next = target.nextElementSibling
  return next && !next.matches(INLINE) ? next : null
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim()

/**
 * The note's paragraphs, without its links back to the text; null when it has
 * no text. Links back are the marked ones and any link to `referenceId`, the
 * id of the link that was clicked (Gutenberg does not mark them).
 */
export function footnoteText(
  target: Element,
  referenceId?: string
): Array<string> | null {
  const note = noteOf(target)
  if (!note) return null
  const copy = note.cloneNode(true) as Element
  for (const a of copy.querySelectorAll("a")) {
    if (isBacklink(a) || (referenceId && fragmentOf(a) === referenceId))
      a.remove()
  }
  // A line break is a word break, or verse would run its words together.
  for (const br of copy.querySelectorAll("br"))
    br.replaceWith(br.ownerDocument.createTextNode(" "))
  // The innermost blocks are the paragraphs; a note without blocks is one.
  const blocks = [...copy.querySelectorAll(BLOCKS)].filter(
    (block) => !block.querySelector(BLOCKS)
  )
  const parts = (blocks.length > 0 ? blocks : [copy])
    .map((block) => clean(block.textContent))
    .filter((part) => part !== "")
  const paragraphs: Array<string> = []
  let left = FOOTNOTE_MAX_LENGTH
  for (const part of parts) {
    if (left <= 0) break
    const chars = Array.from(part)
    paragraphs.push(
      chars.length > left ? `${chars.slice(0, left).join("").trimEnd()}…` : part
    )
    left -= chars.length
  }
  return paragraphs.length > 0 ? paragraphs : null
}
