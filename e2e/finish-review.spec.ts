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

/** On the reader's page: waits for the book, then slides to its last page. */
async function toTheEnd(page: Page) {
  const place = page.getByRole("status", {
    name: "Posisi baca",
    includeHidden: true,
  })
  await expect(place).toHaveText(/^\d+%$/, { timeout: 30_000 })
  await page.getByRole("slider", { name: "Posisi dalam buku" }).fill("1")
}

test("finishing a book shows the card, a review is written, and it shows in the details and the sort", async ({
  page,
}) => {
  test.setTimeout(120_000)
  const { sherlock } = await memberWithBooks(page)
  // Another finished, unrated book for the sort; the reader's book gets 5 stars below.
  await markFinished(sherlock)
  await openShelf(page)
  await page.getByRole("button", { name: new RegExp(SHORT.title) }).click()
  await page
    .getByRole("dialog", { name: SHORT.title })
    .getByRole("link", { name: "Mulai membaca" })
    .click()
  await toTheEnd(page)
  await page
    .getByRole("complementary", { name: "Buku selesai" })
    .getByRole("button", { name: "Ya, selesai" })
    .click()

  const card = page.getByRole("dialog", { name: `Selesai: ${SHORT.title}` })
  await expect(card.getByText("Waktu baca")).toBeVisible({ timeout: 30_000 })
  await card.getByRole("button", { name: "Tulis ulasan" }).click()
  await card.getByRole("button", { name: "5 bintang" }).click()
  await card.getByRole("button", { name: "Mudah" }).click()
  await card.getByLabel("Catatan").fill("Pendek tapi manis.")
  await card.getByRole("button", { name: "Simpan" }).click()
  await expect(card.getByRole("button", { name: "Ubah ulasan" })).toBeVisible()
  await card.getByRole("button", { name: "Nanti" }).click()

  await page.goBack()
  await hydrated(page)
  await openShelf(page)
  await page.getByRole("button", { name: new RegExp(SHORT.title) }).click()
  const detail = page.getByRole("dialog", { name: SHORT.title })
  const mine = detail.getByRole("region", { name: "Ulasan saya" })
  await expect(mine.getByText("5 dari 5 bintang")).toBeVisible()
  await expect(mine.getByText("Pendek tapi manis.")).toBeVisible()
  await mine.getByRole("button", { name: "Lihat kartu" }).click()
  await expect(
    page.getByRole("dialog", { name: `Selesai: ${SHORT.title}` })
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")

  // Rating tertinggi: the 5-star book first, the unrated finished one after it.
  await openShelf(page, "?koleksi=selesai&sort=rating")
  const titles = await page
    .getByRole("button", { name: /Sherlock|Buku Pendek/ })
    .allTextContents()
  expect(titles[0]).toContain(SHORT.title)
})

test("a review can be changed and deleted from the book details", async ({
  page,
}) => {
  test.setTimeout(90_000)
  const { sherlock } = await memberWithBooks(page)
  await markFinished(sherlock)
  await openShelf(page)
  await page.getByRole("button", { name: new RegExp(SHERLOCK.title) }).click()
  const detail = page.getByRole("dialog", { name: SHERLOCK.title })
  await detail.getByRole("button", { name: "Tulis ulasan" }).click()
  const form = page.getByRole("dialog", { name: `Selesai: ${SHERLOCK.title}` })
  await form.getByRole("button", { name: "3 bintang" }).click()
  await form.getByRole("button", { name: "Simpan" }).click()
  await expect(detail.getByText("3 dari 5 bintang")).toBeVisible()
  await detail.getByRole("button", { name: "Ubah" }).click()
  await form.getByRole("button", { name: "Hapus ulasan" }).click()
  await expect(detail.getByText("3 dari 5 bintang")).toHaveCount(0)
  await expect(
    detail.getByRole("button", { name: "Tulis ulasan" })
  ).toBeVisible()
})
