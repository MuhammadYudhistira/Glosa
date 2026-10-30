import type { Page } from "@playwright/test"
import { admin } from "./members"

/**
 * Selects the first few words that show on the current page, as a drag
 * would, and returns them with the middle of the first word in this window.
 * foliate's frame is reached through its renderer; its shadow root is closed
 * to locators.
 */
export async function selectWords(
  page: Page,
  count = 3
): Promise<{ text: string; x: number; y: number }> {
  const found = await page.evaluate((wordCount) => {
    const view = document.querySelector("foliate-view") as unknown as {
      renderer: { getContents: () => Array<{ doc: Document }> }
    }
    const doc = view.renderer.getContents()[0].doc
    const frame = doc.defaultView?.frameElement?.getBoundingClientRect()
    if (!frame) return null
    const words = new RegExp(
      `\\b[A-Za-z]{3,}(?:\\s+[A-Za-z]{3,}){${wordCount - 1}}\\b`,
      "g"
    )
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text
      for (const match of text.data.matchAll(words)) {
        const range = doc.createRange()
        range.setStart(text, match.index)
        range.setEnd(text, match.index + match[0].length)
        const lines = range.getClientRects()
        if (lines.length !== 1) continue
        const box = lines[0]
        const x = frame.left + box.left + 8
        const y = frame.top + box.top + box.height / 2
        // Clear of the bars and of the window's edges.
        if (
          x > 40 &&
          x + box.width < innerWidth - 40 &&
          y > 90 &&
          y < innerHeight - 110
        ) {
          const selection = doc.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)
          return { text: match[0], x, y }
        }
      }
    }
    return null
  }, count)
  if (!found) throw new Error("No run of words shows on this page")
  return found
}

export async function annotationsOf(userId: string): Promise<
  Array<{
    kind: string
    color: string | null
    note: string
    excerpt: string
    deleted_at: string | null
  }>
> {
  const { data, error } = await admin()
    .from("annotations")
    .select("kind, color, note, excerpt, deleted_at")
    .eq("user_id", userId)
  if (error) throw error
  return data
}
