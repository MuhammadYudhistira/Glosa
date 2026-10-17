import { expect, test, type Page } from "@playwright/test"
import { SHERLOCK, seedBook } from "./helpers/books"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

/** Whether the book's iframe has drawn its text in the reader's own serif. */
async function readerFontLoaded(page: Page): Promise<boolean> {
  for (const frame of page.frames()) {
    if (!frame.url().startsWith("blob:")) continue
    const loaded = await frame.evaluate(async () => {
      await document.fonts.ready
      return [...document.fonts].some(
        (face) =>
          face.family.replaceAll('"', "") === "Glosa Serif" &&
          face.status === "loaded"
      )
    })
    if (loaded) return true
  }
  return false
}

test("a book saved for offline reading opens without a connection", async ({
  page,
  context,
}) => {
  const errors: Array<string> = []
  page.on("pageerror", (error) => errors.push(error.message))

  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const bookId = await seedBook(await userIdOf(member.email))

  await page.goto("/shelf")
  await hydrated(page)
  // The service worker precaches the app and takes control (clients.claim).
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    null,
    {
      timeout: 30_000,
    }
  )

  const book = page.getByRole("button", { name: new RegExp(SHERLOCK.title) })
  const detail = page.getByRole("dialog", { name: SHERLOCK.title })
  await book.click()
  await detail.getByRole("button", { name: "Simpan offline" }).click()
  await expect(detail.getByText("Tersimpan untuk offline.")).toBeVisible({
    timeout: 30_000,
  })
  await page.keyboard.press("Escape")
  await expect(page.getByText("Tersedia offline")).toBeVisible()

  await context.setOffline(true)
  await page.goto("/shelf")
  await expect(
    page.getByText(
      "Kamu sedang offline. Rak ditampilkan dari salinan terakhir di perangkat ini."
    )
  ).toBeVisible()

  await book.click()
  await detail.getByRole("link", { name: "Mulai membaca" }).click()
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )
  await expect(
    page.getByRole("heading", { name: SHERLOCK.title })
  ).toBeVisible()

  // The book's blob: iframe cannot reach the service worker; the page hands
  // it the fonts (spec 1D §8).
  await expect
    .poll(() => readerFontLoaded(page), { timeout: 15_000 })
    .toBe(true)

  expect(errors).toEqual([])
})
