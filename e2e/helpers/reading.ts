import { type Page, expect } from "@playwright/test"
import { seedBook } from "./books"
import { createConfirmedMember, signInAndOnboard, userIdOf } from "./members"

/** A new member with one book, open in the reader past its title page. */
export async function startReading(page: Page) {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  await page.goto(`/read/${bookId}`)
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )
  // Away from the title page, into the text.
  await turnPages(page, "PageDown", 2)
  return { userId, bookId }
}

type Landing = { landedPage?: number; watchingLanding?: boolean }

/**
 * Turns `count` pages within the section and waits until the reader has
 * landed. Each turn slides for 300 ms and the reader learns the new place
 * only when it ends, so a click made sooner acts on the page being left.
 * The page landed on is the paginator's page at the last relocate.
 * `count` must be an exact page delta within the section: a turn across a
 * section boundary lands on another page number and the wait times out.
 */
export async function turnPages(
  page: Page,
  key: "PageDown" | "PageUp",
  count: number
) {
  const before = await page.evaluate(() => {
    const view = document.querySelector("foliate-view") as unknown as
      (EventTarget & { renderer: { page: number } }) | null
    if (!view) throw new Error("the reader is not open")
    const landing = window as unknown as Landing
    if (!landing.watchingLanding) {
      landing.watchingLanding = true
      view.addEventListener("relocate", () => {
        landing.landedPage = view.renderer.page
      })
    }
    landing.landedPage = view.renderer.page
    return view.renderer.page
  })
  // One turn at a time: foliate drops a turn asked for while the last one
  // still slides, so keys pressed at once land on fewer pages than asked.
  for (let turn = 1; turn <= count; turn++) {
    await page.keyboard.press(key)
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as Landing).landedPage)
      )
      .toBe(key === "PageDown" ? before + turn : before - turn)
  }
}

/** The middle of an element of the shown section, in this window. */
export async function pointOf(page: Page, id: string) {
  const point = await page.evaluate((target) => {
    const view = document.querySelector("foliate-view") as unknown as {
      renderer: { getContents: () => Array<{ doc: Document }> }
    }
    const doc = view.renderer.getContents()[0].doc
    const element = doc.getElementById(target)
    const frame = doc.defaultView?.frameElement?.getBoundingClientRect()
    if (!element || !frame) return null
    const box = element.getBoundingClientRect()
    return {
      x: frame.left + box.left + box.width / 2,
      y: frame.top + box.top + box.height / 2,
    }
  }, id)
  if (!point) throw new Error(`#${id} does not show`)
  return point
}
