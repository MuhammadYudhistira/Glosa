import { expect, test, type Page } from "@playwright/test"
import { SHERLOCK, markOpened, seedBook, setGenre } from "./helpers/books"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

// These projects run without WebGL, so the lobby shows its still image (plan
// 1D, decision 7). On phones that image is cropped at the sides; hotspots are
// pressed with the keyboard, which reaches every one of them (spec 1D §6).

/** A signed-in member with The Adventures of Sherlock Holmes on the trolley. */
async function memberWithBook(page: Page): Promise<string> {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  return seedBook(await userIdOf(member.email))
}

async function openLobby(page: Page) {
  await page.goto("/lobby")
  await hydrated(page)
  return page.getByRole("region", { name: "Adegan lobi" })
}

test("zones count the books and open the shelf; the reading table opens the last book", async ({
  page,
}) => {
  const bookId = await memberWithBook(page)
  await setGenre(bookId, "misteri_thriller")
  await markOpened(bookId)

  const scene = await openLobby(page)
  await expect(scene).toHaveAttribute("data-quality", "diam")
  await expect(
    scene.getByRole("button", { name: "Fiksi & Sastra · 0 buku" })
  ).toBeAttached()
  await scene
    .getByRole("button", { name: "Meja Baca", exact: true })
    .press("Enter")
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))

  const again = await openLobby(page)
  await again
    .getByRole("button", { name: "Misteri & Thriller · 1 buku" })
    .press("Enter")
  await expect(page).toHaveURL(/\/shelf\?genre=misteri_thriller$/)
  await expect(
    page.getByRole("button", { name: new RegExp(SHERLOCK.title) })
  ).toBeVisible()
})

test("trolley books get their shelf from the lobby", async ({ page }) => {
  await memberWithBook(page)
  const scene = await openLobby(page)
  await scene
    .getByRole("button", { name: "Troli Buku Baru · 1 buku" })
    .press("Enter")

  const dialog = page.getByRole("dialog", { name: "Susun buku" })
  await dialog
    .getByLabel(`Genre untuk ${SHERLOCK.title}`)
    .selectOption("fiksi_sastra")
  await expect(dialog.getByText("Dipindahkan ke Fiksi & Sastra.")).toBeVisible()
  await expect(
    dialog.getByText("Troli kosong. Semua buku sudah punya rak.")
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(
    scene.getByRole("button", { name: "Fiksi & Sastra · 1 buku" })
  ).toBeAttached()
  await expect(
    scene.getByRole("button", { name: "Troli Buku Baru", exact: true })
  ).toBeAttached()
})

test("a new member is greeted, and the admin desk opens the upload", async ({
  page,
}) => {
  await signInAndOnboard(page, await createConfirmedMember())
  await hydrated(page)
  await expect(
    page
      .getByText("Rakmu masih kosong. Bawa buku pertamamu ke sini!")
      .filter({ visible: true })
  ).toBeVisible()

  const scene = page.getByRole("region", { name: "Adegan lobi" })
  await scene
    .getByRole("button", { name: "Meja Baca", exact: true })
    .press("Enter")
  await expect(scene.getByText(/Belum ada buku yang dibaca/)).toBeAttached()
  await scene
    .getByRole("button", { name: "Meja Admin", exact: true })
    .press("Enter")
  await expect(
    page.getByRole("dialog", { name: "Bawa buku ke rak" })
  ).toBeVisible()
})

test("on desktop the search opens a book's details beside the scene", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the panels are for desktop")
  const bookId = await memberWithBook(page)
  await openLobby(page)
  await page.getByLabel("Cari di rakmu").fill("sherlock")
  await page
    .getByRole("list", { name: "Hasil pencarian" })
    .getByRole("button", { name: new RegExp(SHERLOCK.title) })
    .click()
  const detail = page.getByRole("region", { name: SHERLOCK.title })
  await detail.getByRole("link", { name: "Mulai membaca" }).click()
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))
})

test("on phones the sheet continues the last book and the tab bar leads to the shelf", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "the sheet and the tab bar are for phones")
  const bookId = await memberWithBook(page)
  await markOpened(bookId)
  await openLobby(page)

  const sheet = page.getByRole("region", { name: "Lanjutkan membaca" })
  await expect(sheet).toContainText(SHERLOCK.title)
  await sheet.getByRole("link", { name: "Mulai membaca" }).click()
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))

  await openLobby(page)
  await page
    .getByRole("navigation", { name: "Navigasi anggota" })
    .getByRole("link", { name: "Rak Saya" })
    .click()
  await expect(page).toHaveURL(/\/shelf$/)
})
