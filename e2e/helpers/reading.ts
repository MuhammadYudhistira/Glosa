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
  for (let turn = 0; turn < count; turn++) await page.keyboard.press(key)
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Landing).landedPage))
    .toBe(key === "PageDown" ? before + count : before - count)
}
