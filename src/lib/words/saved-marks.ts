import { normalizeWord } from "./normalize"

/** The highlights' names; readerCss styles them inside the book. */
export const SAVED_HIGHLIGHT = "glosa-saved"
export const ACTIVE_HIGHLIGHT = "glosa-active"

/** Every form of every saved word, and how many words the longest has (at most 3). */
export type SavedForms = { set: ReadonlySet<string>; maxWords: number }
export const NO_SAVED_FORMS: SavedForms = { set: new Set(), maxWords: 0 }

export function savedFormsOf(forms: Record<string, Array<string>>): SavedForms {
  const set = new Set(Object.values(forms).flat())
  let maxWords = 0
  for (const form of set) maxWords = Math.max(maxWords, form.split(" ").length)
  return { set, maxWords: Math.min(maxWords, 3) }
}

const TOKEN = /[\p{L}\p{M}'’-]+/gu
/** Words with only spaces between them: a phrase never spans punctuation. */
const SPACED = /^[\p{L}\p{M}'’-]+(?:\s+[\p{L}\p{M}'’-]+)*$/u

/** Where the saved forms are in a text: single words, or phrases of up to 3 words, longest first. */
export function findSavedSpans(
  text: string,
  forms: SavedForms
): Array<{ start: number; end: number }> {
  if (forms.set.size === 0) return []
  const tokens = [...text.matchAll(TOKEN)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }))
  const spans: Array<{ start: number; end: number }> = []
  let i = 0
  while (i < tokens.length) {
    let taken = 0
    for (let n = Math.min(forms.maxWords, tokens.length - i); n >= 1; n -= 1) {
      const piece = text.slice(tokens[i].start, tokens[i + n - 1].end)
      if (n > 1 && !SPACED.test(piece)) continue
      if (forms.set.has(normalizeWord(piece))) {
        spans.push({ start: tokens[i].start, end: tokens[i + n - 1].end })
        taken = n
        break
      }
    }
    i += Math.max(taken, 1)
  }
  return spans
}

/** The Custom Highlight API of the book's frame, which may not have one. */
type HighlightScope = {
  CSS?: { highlights?: Pick<Map<string, unknown>, "set" | "delete"> }
  Highlight?: new (...ranges: Array<Range>) => unknown
}

const scopeOf = (doc: Document) =>
  doc.defaultView as unknown as HighlightScope | null

/**
 * Underlines the saved words in a section (spec 2 §6.5) without touching its
 * DOM, so CFIs stay valid. Browsers without the API show no underline.
 */
export function markSavedWords(
  doc: Document,
  forms: SavedForms,
  scope: HighlightScope | null = scopeOf(doc)
): void {
  const registry = scope?.CSS?.highlights
  const Highlight = scope?.Highlight
  if (!registry || !Highlight) return
  const ranges: Array<Range> = []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text
    if (text.parentElement?.closest("script, style")) continue
    for (const { start, end } of findSavedSpans(text.data, forms)) {
      const range = doc.createRange()
      range.setStart(text, start)
      range.setEnd(text, end)
      ranges.push(range)
    }
  }
  registry.set(SAVED_HIGHLIGHT, new Highlight(...ranges))
}

/** Lights the tapped word while its meaning shows (spec 2 §6.2); null clears it. */
export function showActiveWord(
  doc: Document,
  range: Range | null,
  scope: HighlightScope | null = scopeOf(doc)
): void {
  const registry = scope?.CSS?.highlights
  const Highlight = scope?.Highlight
  if (!registry || !Highlight) return
  if (range) registry.set(ACTIVE_HIGHLIGHT, new Highlight(range))
  else registry.delete(ACTIVE_HIGHLIGHT)
}

type IdleWindow = {
  requestIdleCallback?: (
    task: () => void,
    options: { timeout: number }
  ) => number
  cancelIdleCallback?: (id: number) => void
  setTimeout: (task: () => void, ms: number) => number
  clearTimeout: (id: number) => void
}

/** Runs once the browser is idle, so turning a page never waits for it. Returns a cancel. */
export function whenIdle(win: Window, task: () => void): () => void {
  const idle = win as unknown as IdleWindow
  if (typeof idle.requestIdleCallback === "function") {
    const id = idle.requestIdleCallback(task, { timeout: 1000 })
    return () => idle.cancelIdleCallback?.(id)
  }
  const id = idle.setTimeout(task, 50)
  return () => idle.clearTimeout(id)
}
