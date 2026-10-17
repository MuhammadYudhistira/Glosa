import { type Page, expect, test } from "@playwright/test"
import {
  SHERLOCK,
  readerSettingsOf,
  seedBook,
  storedPercentage,
} from "./helpers/books"
import {
  createConfirmedMember,
  hydrated,
  signIn,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

const SPECKLED_BAND = "The Adventure of the Speckled Band"

/** A signed-in member with Sherlock on their shelf. */
async function memberWithBook(page: Page) {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  return { member, userId, bookId }
}

/** Waits until foliate has shown the book: the position appears only then. */
async function bookShown(page: Page) {
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )
}

test("the place read on one device is offered on another", async ({
  page,
  browser,
}) => {
  const { member, bookId } = await memberWithBook(page)

  await page.goto("/shelf")
  await hydrated(page)
  await page.getByRole("button", { name: new RegExp(SHERLOCK.title) }).click()
  await page
    .getByRole("dialog", { name: SHERLOCK.title })
    .getByRole("link", { name: "Mulai membaca" })
    .click()
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))
  await bookShown(page)

  await page.getByRole("button", { name: "Daftar isi" }).click()
  await page
    .getByRole("dialog", { name: "Daftar isi" })
    .getByRole("button", { name: SPECKLED_BAND })
    .click()
  await expect(page.getByRole("status", { name: "Bab saat ini" })).toHaveText(
    SPECKLED_BAND
  )
  // Sent after the five-second pause (spec §10 step 2).
  await expect
    .poll(() => storedPercentage(bookId), { timeout: 20_000 })
    .toBeGreaterThan(40)

  // A second device: a fresh browser context signed in as the same member.
  const other = await browser.newContext()
  try {
    const second = await other.newPage()
    await signIn(second, member)
    await expect(second).toHaveURL(/\/lobby/)
    await second.goto(`/read/${bookId}`)
    await bookShown(second)
    await expect(
      second.getByText(/^Lanjutkan dari \d+% \(dibaca di perangkat lain\)\?$/)
    ).toBeVisible()
    // The reader never jumps by itself.
    await expect(
      second.getByRole("status", { name: "Bab saat ini" })
    ).not.toHaveText(SPECKLED_BAND)

    await second.getByRole("button", { name: "Lompat" }).click()
    await expect(
      second.getByRole("status", { name: "Bab saat ini" })
    ).toHaveText(SPECKLED_BAND)
  } finally {
    await other.close()
  }
})

test("turning pages by key or tap saves the new place", async ({
  page,
  isMobile,
}) => {
  const { bookId } = await memberWithBook(page)
  await page.goto(`/read/${bookId}`)
  await bookShown(page)
  // Opening the book is not reading (plan 1C, decision 8): even after the
  // five-second pause nothing reaches the server. A fixed wait is the only
  // way to show that something does not happen.
  await page.waitForTimeout(6_000)
  expect(await storedPercentage(bookId)).toBeNull()

  const viewport = page.viewportSize()!
  for (let turn = 0; turn < 3; turn++) {
    if (isMobile) {
      await page.touchscreen.tap(viewport.width * 0.85, viewport.height / 2)
    } else {
      await page.keyboard.press("ArrowRight")
    }
  }
  await expect
    .poll(() => storedPercentage(bookId), { timeout: 20_000 })
    .not.toBeNull()
})

test("display settings follow the member", async ({ page }) => {
  const { userId, bookId } = await memberWithBook(page)
  await page.goto(`/read/${bookId}`)
  await bookShown(page)
  const reader = page.locator("main.reader-page")
  await expect(reader).toHaveAttribute("data-theme", "sepia")

  await page.getByRole("button", { name: "Tampilan" }).click()
  const panel = page.getByRole("dialog", { name: "Tampilan" })
  await panel.getByText("Gelap", { exact: true }).click()
  await panel.getByRole("button", { name: "Perbesar huruf" }).click()
  await expect(reader).toHaveAttribute("data-theme", "dark")
  await expect
    .poll(() => readerSettingsOf(userId))
    .toMatchObject({ theme: "dark", fontSize: 110 })

  await page.reload()
  await bookShown(page)
  await expect(reader).toHaveAttribute("data-theme", "dark")
})
