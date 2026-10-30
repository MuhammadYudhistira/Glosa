/**
 * Text the book itself sets centred, right-aligned or unhyphenated keeps its
 * place (plan 2C, decision 9). The reader's `p { text-align }` would beat what
 * `p` only inherits from a `footer` or `hgroup`, so those paragraphs are
 * marked and `readerCss` skips them.
 */

const BLOCKS = "p, li, blockquote, dd"
const ALIGNS = new Set(["center", "right", "end", "-webkit-center"])
// Not "manual": it is the initial value, so every container that the book
// leaves alone has it and would keep the book's (no) hyphenation.
const NO_HYPHENS = new Set(["none"])

export const KEEP_ALIGN = "data-glosa-keep-align"
export const KEEP_HYPHENS = "data-glosa-keep-hyphens"

/** Marks the section's paragraphs whose container the book aligns or hyphenates its own way. Never throws. */
export function markKeptLayout(doc: Document): void {
  try {
    const win = doc.defaultView
    if (!win) return
    // One measurement per parent, however many blocks it holds.
    const decided = new Map<Element, { align: boolean; hyphens: boolean }>()
    for (const block of doc.querySelectorAll(BLOCKS)) {
      const parent = block.parentElement
      if (!parent) continue
      let keep = decided.get(parent)
      if (!keep) {
        const style = win.getComputedStyle(parent)
        const hyphens =
          style.getPropertyValue("hyphens") ||
          style.getPropertyValue("-webkit-hyphens")
        keep = {
          align: ALIGNS.has(style.textAlign),
          hyphens: NO_HYPHENS.has(hyphens),
        }
        decided.set(parent, keep)
      }
      if (keep.align) block.setAttribute(KEEP_ALIGN, "")
      if (keep.hyphens) block.setAttribute(KEEP_HYPHENS, "")
    }
  } catch {
    // A section that cannot be measured is left as the settings have it.
  }
}
