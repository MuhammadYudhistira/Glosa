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
  await page.keyboard.press("PageDown")
  await page.keyboard.press("PageDown")
  return { userId, bookId }
}
