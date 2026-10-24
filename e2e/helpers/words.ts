import type { Page } from "@playwright/test"
import { admin } from "./members"

/**
 * A word of at least four letters that shows on the current page, and where
 * it sits in the window. foliate's frame is reached through its renderer;
 * its shadow root is closed to locators.
 */
export async function visibleWord(
  page: Page
): Promise<{ word: string; x: number; y: number }> {
  const found = await page.evaluate(() => {
    const view = document.querySelector("foliate-view") as unknown as {
      renderer: { getContents: () => Array<{ doc: Document }> }
    }
    const doc = view.renderer.getContents()[0].doc
    const frame = doc.defaultView?.frameElement?.getBoundingClientRect()
    if (!frame) return null
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text
      for (const match of text.data.matchAll(/\b[A-Za-z]{4,}\b/g)) {
        const range = doc.createRange()
        range.setStart(text, match.index)
        range.setEnd(text, match.index + match[0].length)
        const box = range.getBoundingClientRect()
        const x = frame.left + box.left + box.width / 2
        const y = frame.top + box.top + box.height / 2
        // Clear of the bars and of the window's edges.
        if (
          box.width > 0 &&
          x > 40 &&
          x < innerWidth - 40 &&
          y > 90 &&
          y < innerHeight - 110
        ) {
          return { word: match[0].toLowerCase(), x, y }
        }
      }
    }
    return null
  })
  if (!found) throw new Error("No word shows on this page")
  return found
}

/** Taps (or clicks) a word on the page and returns it, lower case. */
export async function tapWord(page: Page, isMobile: boolean): Promise<string> {
  // A page turn slides: wait until the word holds still before aiming at it.
  let last = await visibleWord(page)
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150)
    const now = await visibleWord(page)
    const still = now.word === last.word && now.x === last.x && now.y === last.y
    last = now
    if (still) break
  }
  const { word, x, y } = last
  if (isMobile) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
  return word
}

export async function savedWordsOf(
  userId: string
): Promise<Array<{ headword: string; sentence: string; cfi: string | null }>> {
  const { data, error } = await admin()
    .from("saved_words")
    .select("headword, sentence, cfi")
    .eq("user_id", userId)
  if (error) throw error
  return data
}
