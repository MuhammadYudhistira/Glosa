import { type Page, expect, test } from "@playwright/test"
import { seedBook } from "./helpers/books"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"
import { savedWordsOf, tapWord } from "./helpers/words"

// The dev project's dictionary changes with each import, so these tests
// check what the reader does with a word, not what the word means (plan 2A,
// decision 12).

async function memberReading(page: Page) {
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

test("a tapped word is saved, listed in Kosakata, and opens its place again", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000)
  const { userId, bookId } = await memberReading(page)

  const word = await tapWord(page, isMobile)
  const popup = page.getByRole("dialog", { name: `Arti ${word}` })
  await expect(popup).toBeVisible()
  await expect(
    popup.getByRole("link", { name: "Wiktionary · CC BY-SA" })
  ).toBeVisible()
  await popup.getByRole("button", { name: "Simpan" }).click()
  await expect(popup.getByRole("button", { name: "Tersimpan" })).toBeVisible()

  // Sent two seconds after the last change (spec 2 §7).
  await expect
    .poll(async () => (await savedWordsOf(userId)).length, { timeout: 20_000 })
    .toBe(1)
  const [saved] = await savedWordsOf(userId)
  expect(saved.sentence.toLowerCase()).toContain(word)
  expect(saved.cfi).not.toBeNull()

  await page.keyboard.press("Escape")
  await expect(popup).toBeHidden()

  // Kosakata: the tab bar on phones, the card catalogue in the lobby on desktop.
  if (isMobile) {
    await page.goto("/lobby")
    await hydrated(page)
    await page
      .getByRole("navigation", { name: "Navigasi anggota" })
      .last()
      .getByRole("link", { name: "Kosakata" })
      .click()
  } else {
    await page.goto("/lobby")
    await hydrated(page)
    await page
      .getByRole("region", { name: "Adegan lobi" })
      .getByRole("button", { name: "Kosakata", exact: true })
      .press("Enter")
  }
  await expect(page).toHaveURL(/\/vocabulary$/)
  const card = page.getByRole("article", { name: saved.headword })
  await expect(card).toBeVisible()

  await card.getByRole("link", { name: "Buka di buku" }).click()
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )
  // The other device's place is not offered over the word's.
  await expect(page.getByText(/dibaca di perangkat lain/)).toBeHidden()
  // The saved word is underlined where it was found (spec 2 §6.5).
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const view = document.querySelector("foliate-view") as unknown as {
            renderer: { getContents: () => Array<{ doc: Document }> }
          }
          const frame = view.renderer.getContents().at(0)?.doc.defaultView as
            | (Window & { CSS: { highlights: Map<string, { size: number }> } })
            | null
            | undefined
          return frame?.CSS.highlights.get("glosa-saved")?.size ?? 0
        }),
      { timeout: 15_000 }
    )
    .toBeGreaterThan(0)
})

test("a deleted word comes back with Urungkan", async ({ page, isMobile }) => {
  const { userId } = await memberReading(page)
  await tapWord(page, isMobile)
  await page.getByRole("button", { name: "Simpan" }).click()
  await expect
    .poll(async () => (await savedWordsOf(userId)).length, { timeout: 20_000 })
    .toBe(1)
  const [saved] = await savedWordsOf(userId)

  await page.goto("/vocabulary")
  await hydrated(page)
  const card = page.getByRole("article", { name: saved.headword })
  await card.getByRole("button", { name: `Hapus ${saved.headword}` }).click()
  await expect(card).toBeHidden()
  await page.getByRole("button", { name: "Urungkan" }).click()
  await expect(
    page.getByRole("article", { name: saved.headword })
  ).toBeVisible()
  // Whichever reached the server, the word is there in the end.
  await expect
    .poll(async () => (await savedWordsOf(userId)).length, { timeout: 20_000 })
    .toBe(1)
})

test("turning the page closes the meaning", async ({ page, isMobile }) => {
  // Keys in a meaning never turn pages, and on phones its sheet covers the
  // book; the wheel over the book still turns it beside the popover.
  test.skip(isMobile, "the sheet is modal: the book is out of reach")
  await memberReading(page)
  const word = await tapWord(page, isMobile)
  const popup = page.getByRole("dialog", { name: `Arti ${word}` })
  await expect(popup).toBeVisible()
  const place = () =>
    page.evaluate(
      () =>
        (
          document.querySelector("foliate-view") as unknown as {
            lastLocation: { cfi: string }
          }
        ).lastLocation.cfi
    )
  const before = await place()
  const { width, height } = page.viewportSize()!
  // Low on the page, clear of the popover under the word.
  await page.mouse.move(width / 2, height - 100)
  await page.mouse.wheel(0, 200)
  await expect.poll(place).not.toBe(before)
  await expect(popup).toBeHidden()
})

test("a tap beside the text still turns the page", async ({
  page,
  isMobile,
}) => {
  await memberReading(page)
  const pageNumber = () =>
    page.evaluate(
      () =>
        (
          document.querySelector("foliate-view") as unknown as {
            renderer: { page: number }
          }
        ).renderer.page
    )
  const before = await pageNumber()
  const { width, height } = page.viewportSize()!
  if (isMobile) await page.touchscreen.tap(width - 4, height / 2)
  else await page.mouse.click(width - 4, height / 2)
  await expect.poll(pageNumber).toBeGreaterThan(before)
  await expect(page.getByRole("dialog")).toBeHidden()
})

test("a place that is not in the book opens the last one, and says so", async ({
  page,
}) => {
  const { bookId } = await memberReading(page)
  await page.goto(
    `/read/${bookId}?cfi=${encodeURIComponent("epubcfi(/6/999!/4/2/1:0)")}`
  )
  await expect(
    page.getByText("Posisi itu tidak ditemukan di buku ini")
  ).toBeVisible({ timeout: 30_000 })
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))
})
