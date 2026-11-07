import { type Page, expect, test } from "@playwright/test"
import { SHERLOCK, markFinished, seedBook } from "./helpers/books"
import { makeEpub } from "./helpers/epub"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

const SHORT = { title: "Buku Pendek", author: "Penguji" }

/** A member with Sherlock and a short book of three chapters. */
async function memberWithBooks(page: Page) {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const sherlock = await seedBook(userId)
  const short = await seedBook(userId, {
    ...SHORT,
    file: await makeEpub({
      ...SHORT,
      subjects: [],
      cover: false,
      chapters: ["Bab 1", "Bab 2", "Bab 3"].map((title) => ({
        title,
        body: `<h1>${title}</h1><p>Isi ${title}.</p>`,
      })),
    }),
  })
  return { sherlock, short }
}

async function openShelf(page: Page, query = "") {
  await page.goto(`/shelf${query}`)
  await hydrated(page)
  await expect(page.getByRole("navigation", { name: "Koleksi" })).toBeVisible({
    timeout: 30_000,
  })
}

async function openAtTheEnd(page: Page, bookId: string) {
  await page.goto(`/read/${bookId}`)
  await toTheEnd(page)
}

/** On the reader's page: waits for the book, then slides to its last page. */
async function toTheEnd(page: Page) {
  const place = page.getByRole("status", {
    name: "Posisi baca",
    includeHidden: true,
  })
  await expect(place).toHaveText(/^\d+%$/, { timeout: 30_000 })
  await page.getByRole("slider", { name: "Posisi dalam buku" }).fill("1")
}

test("a collection gathers the books put in it", async ({ page }) => {
  await memberWithBooks(page)
  await openShelf(page)
  const chips = page.getByRole("navigation", { name: "Koleksi" })

  await chips.getByRole("button", { name: "+ Koleksi baru" }).click()
  const dialog = page.getByRole("dialog", { name: "Koleksi baru" })
  await dialog.getByLabel("Nama koleksi").fill("Bacaan santai")
  await dialog.getByRole("button", { name: "Buat" }).click()
  await expect(page.getByText("Koleksi “Bacaan santai” dibuat.")).toBeVisible()
  await expect(
    chips.getByRole("link", { name: "Bacaan santai · 0" })
  ).toHaveAttribute("aria-current", "page")
  await expect(page.getByText("Belum ada buku di bagian ini.")).toBeVisible()

  await chips.getByRole("link", { name: /^Semua/ }).click()
  await page.getByRole("button", { name: new RegExp(SHERLOCK.title) }).click()
  const detail = page.getByRole("dialog", { name: SHERLOCK.title })
  await detail.getByLabel("Bacaan santai").check()
  await expect(detail.getByText("Koleksi disimpan.")).toBeVisible()
  // Escape closes the details and nothing more: the shelf stays open.
  await page.keyboard.press("Escape")
  await expect(detail).toBeHidden()
  await expect(chips).toBeVisible()
  await expect(page).toHaveURL(/\/shelf/)

  await chips.getByRole("link", { name: "Bacaan santai · 1" }).click()
  await expect(
    page.getByRole("button", { name: new RegExp(SHERLOCK.title) })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: new RegExp(SHORT.title) })
  ).toHaveCount(0)
})

test("finishing a book puts it on Sudah dibaca", async ({ page }) => {
  test.setTimeout(90_000)
  await memberWithBooks(page)
  // The shelf is loaded first, so the way back finds it cached.
  await openShelf(page)
  await page.getByRole("button", { name: new RegExp(SHORT.title) }).click()
  await page
    .getByRole("dialog", { name: SHORT.title })
    .getByRole("link", { name: "Mulai membaca" })
    .click()
  await toTheEnd(page)
  const prompt = page.getByRole("complementary", { name: "Buku selesai" })
  await expect(prompt).toBeVisible()
  await prompt.getByRole("button", { name: "Ya, selesai" }).click()
  const card = page.getByRole("dialog", { name: `Selesai: ${SHORT.title}` })
  await expect(card).toBeVisible()
  await card.getByRole("button", { name: "Nanti" }).click()
  await expect(card).toBeHidden()
  await expect(prompt).toHaveCount(0)

  // Back like the Android gesture does, which preloads nothing.
  await page.goBack()
  const chips = page.getByRole("navigation", { name: "Koleksi" })
  await expect(chips).toBeVisible({ timeout: 30_000 })
  await chips.getByRole("link", { name: "Sudah dibaca · 1" }).click()
  await expect(
    page.getByRole("button", { name: new RegExp(SHORT.title) })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: new RegExp(SHERLOCK.title) })
  ).toHaveCount(0)
})

test("Belum is remembered: the reader does not ask again", async ({ page }) => {
  test.setTimeout(90_000)
  const { short } = await memberWithBooks(page)
  await openAtTheEnd(page, short)
  const prompt = page.getByRole("complementary", { name: "Buku selesai" })
  await prompt.getByRole("button", { name: "Belum" }).click()
  await expect(prompt).toHaveCount(0)

  // Opened afresh: the server now says "Belum".
  await openAtTheEnd(page, short)
  // Give the prompt every chance to come back before saying it did not.
  await page.waitForTimeout(1500)
  await expect(prompt).toHaveCount(0)
})

test("Nanti hides the prompt for this visit only", async ({ page }) => {
  test.setTimeout(90_000)
  const { short } = await memberWithBooks(page)
  await openAtTheEnd(page, short)
  const prompt = page.getByRole("complementary", { name: "Buku selesai" })
  await expect(prompt).toBeVisible()
  await prompt.getByRole("button", { name: "Nanti" }).click()
  await expect(prompt).toHaveCount(0)

  // Opened again: nothing was saved, so it asks again.
  await openAtTheEnd(page, short)
  await expect(prompt).toBeVisible()
})

test("the display cabinet opens Sudah dibaca", async ({ page }) => {
  const { short } = await memberWithBooks(page)
  await markFinished(short)
  await page.goto("/lobby")
  await hydrated(page)
  const scene = page.getByRole("region", { name: "Adegan lobi" })
  await scene
    .getByRole("button", { name: "Sudah dibaca · 1 buku" })
    .press("Enter")
  await expect(page).toHaveURL(/\/shelf\?koleksi=selesai$/)
  await expect(
    page.getByRole("button", { name: new RegExp(SHORT.title) })
  ).toBeVisible()
})
