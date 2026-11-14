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
    scene.getByRole("button", { name: "Fiksi & Sastra · 0 buku" })
  ).toBeAttached()
  await scene
    .getByRole("button", { name: "Kursi baca", exact: true })
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
    .getByRole("button", { name: "Kotak buku baru · 1 buku" })
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
    scene.getByRole("button", { name: "Fiksi & Sastra · 1 buku" })
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

test("no two room labels overlap, and none covers the greeting", async ({
  page,
  isMobile,
}) => {
  // Owner, 2026-11-13: an empty shelf at 1440 × 900 stacked its labels.
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = await openLobby(page)
  const welcome = page
    .getByText("Rakmu masih kosong. Bawa buku pertamamu ke sini!")
    .filter({ visible: true })
  await expect(welcome).toBeVisible()
  // The labels are placed once the scene's size is measured.
  await expect(scene.locator('button[data-look="unplaced"]')).toHaveCount(0)
  const boxes = await scene
    .locator("button.lobby-hotspot")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const { left, right, top, bottom } = button.getBoundingClientRect()
        return {
          name: button.textContent,
          mark: button.dataset.look === "mark",
          seen: getComputedStyle(button).opacity !== "0",
          left,
          right,
          top,
          bottom,
        }
      })
    )
  // Every label shows, as a pill or a mark (owner, 2026-11-14: none hides).
  expect(boxes).toHaveLength(18)
  expect(boxes.filter((box) => !box.seen).map((box) => box.name)).toEqual([])
  const meet = (
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number }
  ) =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  // A pill meets nothing; two marks may touch but never cover each other.
  const centre = (box: (typeof boxes)[number]) => [
    (box.left + box.right) / 2,
    (box.top + box.bottom) / 2,
  ]
  const overlapping = boxes.flatMap((a, i) =>
    boxes.slice(i + 1).flatMap((b) => {
      if (a.mark && b.mark) {
        const [ax, ay] = centre(a)
        const [bx, by] = centre(b)
        return Math.hypot(ax - bx, ay - by) < 7 ? [`${a.name} / ${b.name}`] : []
      }
      return meet(a, b) ? [`${a.name} / ${b.name}`] : []
    })
  )
  expect(overlapping).toEqual([])
  if (!isMobile) {
    // The greeting and its EPUB note sit beside the desk card, clear of every label.
    const stack = (await welcome.locator("..").boundingBox())!
    const area = {
      left: stack.x,
      right: stack.x + stack.width,
      top: stack.y,
      bottom: stack.y + stack.height,
    }
    expect(boxes.filter((box) => meet(box, area)).map((b) => b.name)).toEqual(
      []
    )
  }
})
