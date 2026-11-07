import { expect, test } from "@playwright/test"
import { seedBook } from "./helpers/books"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"
import { startReading } from "./helpers/reading"
import { seedLookup, seedWordsRead, vocabOf } from "./helpers/vocab"
import { tapWord } from "./helpers/words"

test("a book's details show the share understood and lead to its words", async ({
  page,
}) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  await seedWordsRead(userId, bookId, 997, ["ubiquitous", "mat", "lantern"])
  await seedLookup(userId, bookId, "ubiquitous", 3)
  await seedLookup(userId, bookId, "lantern", 1)
  await seedLookup(userId, bookId, "never-read", 1)

  await page.goto("/shelf")
  await hydrated(page)
  await page
    .getByRole("button", { name: /The Adventures of Sherlock Holmes/ })
    .first()
    .click()
  await expect(
    page.getByText("Paham 99% kata tanpa kamus · 2 kata dicari")
  ).toBeVisible()
  await page.getByRole("link", { name: "Lihat kata" }).click()
  await expect(page).toHaveURL(new RegExp(`/vocabulary\\?buku=${bookId}`))
  const list = page.getByRole("list", { name: "Dicari di buku ini" })
  await expect(list.getByRole("listitem")).toHaveCount(3)
  await expect(list.getByRole("listitem").first()).toContainText("diketuk")
})

test("reading a section for a minute and tapping a word are kept per book", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(240_000)
  const { userId, bookId } = await startReading(page)
  const word = await tapWord(page, isMobile)
  await page.keyboard.press("Escape")
  // Past the 60 s mark, then the reader closes: a section that reaches 60 s
  // as the view goes is kept due, not lost.
  await page.waitForTimeout(70_000)
  // Leaving through the app unmounts the reader, which hands over the last time.
  await page.getByRole("link", { name: "Kembali ke rak" }).click()
  await expect(page).not.toHaveURL(/\/read\//)
  // Let the last time reach this device's storage before the page reloads.
  await page.waitForTimeout(3_000)
  // The book opened again takes up the due section, in idle time.
  await page.goto(`/read/${bookId}`)
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )
  await expect
    .poll(async () => (await vocabOf(userId, bookId)).sections.length, {
      timeout: 30_000,
    })
    .toBeGreaterThan(0)
  await expect
    .poll(
      async () =>
        (await vocabOf(userId, bookId)).lookups.map((row) => row.word),
      { timeout: 30_000 }
    )
    .toContain(word.toLowerCase())
})
