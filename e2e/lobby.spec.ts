import { expect, test, type Locator, type Page } from "@playwright/test"
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
  return page.getByRole("region", { name: "Adegan ruang baca" })
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
    scene.getByRole("button", { name: "Fiksi & Sastra", exact: true })
  ).toBeAttached()
  await scene
    .getByRole("button", { name: "Kursi baca", exact: true })
    .press("Enter")
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))

  const again = await openLobby(page)
  await again
    .getByRole("button", { name: "Misteri & Thriller", exact: true })
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
    .getByRole("button", { name: "Kotak buku baru", exact: true })
    .press("Enter")

  const dialog = page.getByRole("dialog", { name: "Susun buku" })
  await dialog
    .getByLabel(`Genre untuk ${SHERLOCK.title}`)
    .selectOption("fiksi_sastra")
  await expect(dialog.getByText("Dipindahkan ke Fiksi & Sastra.")).toBeVisible()
  await expect(
    dialog.getByText("Kotak buku baru kosong. Semua buku sudah punya rak.")
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(
    scene.getByRole("button", { name: "Fiksi & Sastra", exact: true })
  ).toBeAttached()
  await expect(
    scene.getByRole("button", { name: "Kotak buku baru", exact: true })
  ).toBeAttached()
})

test("a new member is greeted, and the admin desk opens the upload", async ({
  page,
  isMobile,
}) => {
  await signInAndOnboard(page, await createConfirmedMember())
  await hydrated(page)
  const greeting = "Rakmu masih kosong. Bawa buku pertamamu ke sini!"
  await expect(page.getByText(greeting).filter({ visible: true })).toBeVisible()
  // Once, in its place: the sheet on phones, beside the desk card on
  // desktop (each hides the other's copy), with nothing else in that slot.
  await expect(page.getByText(greeting).filter({ visible: true })).toHaveCount(
    1
  )
  await expect(
    (isMobile
      ? page.getByRole("region", { name: "Lanjutkan membaca" })
      : page.getByRole("complementary", { name: "Panel ruang baca" })
    ).getByText(greeting)
  ).toBeVisible()
  await expect(page.getByRole("heading", { name: "Baru Dibuka" })).toHaveCount(
    0
  )

  const scene = page.getByRole("region", { name: "Adegan ruang baca" })
  await scene
    .getByRole("button", { name: "Kursi baca", exact: true })
    .press("Enter")
  await expect(scene.getByText(/Belum ada buku yang dibaca/)).toBeAttached()
  await scene
    .getByRole("button", { name: "Meja tulis", exact: true })
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
    .getByRole("navigation", { name: "Navigasi utama" })
    .getByRole("link", { name: "Rak Saya" })
    .click()
  await expect(page).toHaveURL(/\/shelf$/)
})

test("the fireplace, the door and the corkboard lead somewhere", async ({
  page,
}) => {
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = await openLobby(page)

  await scene
    .getByRole("button", { name: "Sorotan", exact: true })
    .press("Enter")
  const board = page.getByRole("dialog", { name: "Sorotan" })
  await expect(board.getByText(/Belum ada sorotan\./)).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(board).toBeHidden()

  await scene
    .getByRole("button", { name: "Kilas balik", exact: true })
    .press("Enter")
  await expect(page).toHaveURL(/\/recap$/)
  await expect(page.getByRole("heading", { name: "Kilas balik" })).toBeVisible()

  const again = await openLobby(page)
  await again
    .getByRole("button", { name: "Pengaturan", exact: true })
    .press("Enter")
  await expect(page).toHaveURL(/\/settings$/)
  await expect(
    page.getByRole("main").getByRole("link", { name: "Keluar" })
  ).toBeVisible()
})

test("the room has no fixed labels: every place is an unseen button, and the greeting covers none", async ({
  page,
  isMobile,
}) => {
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = await openLobby(page)
  const buttons = scene.locator("button.lobby-hotspot")
  await expect(buttons).toHaveCount(18)
  // No label is drawn: a button shows nothing but a dot (still image) or its focus ring.
  const labelled = await buttons.evaluateAll(
    (list) =>
      list.filter((button) => {
        const style = getComputedStyle(button)
        return (
          style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
          style.borderTopWidth !== "0px"
        )
      }).length
  )
  expect(labelled).toBe(0)
  await expect(page.locator(".lobby-hotspot-measure")).toHaveCount(0)
  if (!isMobile) {
    const welcome = page
      .getByText("Rakmu masih kosong. Bawa buku pertamamu ke sini!")
      .filter({ visible: true })
    await expect(welcome).toBeVisible()
  }
})

test("focusing a place shows its name card with its state; Buka opens its page", async ({
  page,
}) => {
  await memberWithBook(page)
  const scene = await openLobby(page)
  const card = page.getByRole("group", { name: "Tempat dipilih" })
  await expect(card).toHaveCount(0)
  const trolley = scene.getByRole("button", {
    name: "Kotak buku baru",
    exact: true,
  })
  await trolley.focus()
  await expect(card).toContainText("Kotak buku baru")
  await expect(card).toContainText("1 buku belum diberi genre")
  await expect(trolley).toHaveAccessibleDescription("1 buku belum diberi genre")
  await card.getByRole("button", { name: "Buka" }).click()
  await expect(page.getByRole("dialog", { name: "Susun buku" })).toBeVisible()
  await expect(card).toHaveCount(0)
})

test("Enter on a focused place opens its page at once, with no second step", async ({
  page,
}) => {
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = await openLobby(page)
  await scene
    .getByRole("button", { name: "Pengaturan", exact: true })
    .press("Enter")
  await expect(page).toHaveURL(/\/settings$/)
})

// Without WebGL the scene is at "diam" quality: Anda does not walk or perform
// there (spec 3F §4A.1), so a hotspot acts at once. The walk and the activity
// that follows it are covered by the unit tests only; SwiftShader also ends at
// "diam", so E2E cannot reach a moving quality.
test.describe("a hotspot at still quality", () => {
  const fireplace = (scene: Locator) =>
    scene.getByRole("button", { name: "Kilas balik", exact: true })

  test("at still quality a click and a double click on Kilas balik each open /recap", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "a phone taps once for the name card first")
    await signInAndOnboard(page, await createConfirmedMember())
    const scene = await openLobby(page)
    await expect(scene).toHaveAttribute("data-quality", "diam")
    await fireplace(scene).click()
    await expect(page).toHaveURL(/\/recap$/)

    const again = await openLobby(page)
    await expect(again).toHaveAttribute("data-quality", "diam")
    await fireplace(again).dblclick()
    await expect(page).toHaveURL(/\/recap$/)
  })

  test("Enter on a focused hotspot opens its popup", async ({ page }) => {
    await signInAndOnboard(page, await createConfirmedMember())
    const scene = await openLobby(page)
    await scene
      .getByRole("button", { name: "Sorotan", exact: true })
      .press("Enter")
    await expect(page.getByRole("dialog", { name: "Sorotan" })).toBeVisible()
  })

  test("on a phone a tap on a place shows its card, and a second tap opens it", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "a mouse opens at once")
    await signInAndOnboard(page, await createConfirmedMember())
    const scene = await openLobby(page)
    const card = page.getByRole("group", { name: "Tempat dipilih" })
    await fireplace(scene).click()
    await expect(card).toContainText("Kilas balik")
    await expect(card).toContainText("Rangkuman bacaanmu")
    await expect(page).toHaveURL(/\/lobby$/)
    await fireplace(scene).click()
    await expect(page).toHaveURL(/\/recap$/)
  })

  test("on a phone a tap on empty space closes the card", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "a mouse has no card")
    await signInAndOnboard(page, await createConfirmedMember())
    const scene = await openLobby(page)
    const card = page.getByRole("group", { name: "Tempat dipilih" })
    await fireplace(scene).click()
    await expect(card).toBeVisible()
    const box = (await scene.boundingBox())!
    await page.mouse.click(box.x + 4, box.y + 4)
    await expect(card).toHaveCount(0)
  })
})
