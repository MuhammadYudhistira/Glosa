import { expect, test, type Page } from "@playwright/test"
import { SHERLOCK, seedBook } from "./helpers/books"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

// Spec 1F: on desktop Rak Saya and Pengaturan open over the lobby; on phones
// they stay pages. Without WebGL here, the lobby shows its still image.

const popupOf = (page: Page, name: string) => page.getByRole("main", { name })
const navOf = (page: Page) =>
  page.getByRole("navigation", { name: "Navigasi anggota" })
/** The scene by class: behind a popup it is aria-hidden, so out of getByRole. */
const sceneOf = (page: Page) => page.locator(".lobby-scene")

async function memberInLobby(page: Page) {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await hydrated(page)
  await expect(page).toHaveURL(/\/lobby/)
  return member
}

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "the popups are for desktop")

  test("Rak Saya and Pengaturan open over the lobby, which stays mounted", async ({
    page,
  }) => {
    await memberInLobby(page)
    await sceneOf(page).evaluate((element) => {
      element.dataset.e2eMark = "lobi"
    })

    await navOf(page).getByRole("link", { name: "Rak Saya" }).click()
    await expect(page).toHaveURL(/\/shelf$/)
    await expect(
      popupOf(page, "Rak Saya").getByRole("heading", {
        name: "Rak Saya",
        level: 1,
      })
    ).toBeFocused()
    await expect(page.getByRole("region", { name: "Adegan lobi" })).toHaveCount(
      0
    )

    await navOf(page).getByRole("link", { name: "Pengaturan" }).click()
    await expect(
      popupOf(page, "Pengaturan").getByRole("heading", {
        name: "Pengaturan",
        level: 1,
      })
    ).toBeFocused()

    await page.keyboard.press("Escape")
    await expect(page).toHaveURL(/\/lobby$/)
    await expect(popupOf(page, "Pengaturan")).toHaveCount(0)
    await expect(
      navOf(page).getByRole("link", { name: "Pengaturan" })
    ).toBeFocused()
    // The same scene element all along: the lobby was never mounted again.
    await expect(sceneOf(page)).toHaveAttribute("data-e2e-mark", "lobi")
  })

  test("Back and the close button close the popup; a refresh keeps it over the lobby", async ({
    page,
  }) => {
    await memberInLobby(page)
    await navOf(page).getByRole("link", { name: "Rak Saya" }).click()
    await expect(popupOf(page, "Rak Saya")).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/lobby$/)
    await expect(popupOf(page, "Rak Saya")).toHaveCount(0)

    await page.goto("/shelf")
    await hydrated(page)
    await expect(popupOf(page, "Rak Saya")).toBeVisible()
    await expect(sceneOf(page)).toBeAttached()
    await page.getByRole("button", { name: "Tutup Rak Saya" }).click()
    await expect(page).toHaveURL(/\/lobby$/)

    await page.goto("/settings")
    await hydrated(page)
    await expect(popupOf(page, "Pengaturan")).toBeVisible()
    // The dimmed lobby in the bottom-left corner, left of the panel and
    // below the floating menu.
    await page.mouse.click(20, 700)
    await expect(page).toHaveURL(/\/lobby$/)
  })

  test("the account menu shows above the map and closes on its way to Pengaturan", async ({
    page,
  }) => {
    await memberInLobby(page)
    await page.getByLabel("Menu akun").click()
    const link = page
      .locator(".lobby-account-menu")
      .getByRole("link", { name: "Pengaturan" })
    await expect(link).toBeVisible()
    const onTop = await link.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2
      )
      return hit !== null && element.contains(hit)
    })
    expect(onTop).toBe(true)

    await link.click()
    await expect(popupOf(page, "Pengaturan")).toBeVisible()
    await expect(page.locator(".lobby-account")).not.toHaveAttribute("open")
  })

  test("Escape returns the focus to the 3D hotspot that opened Rak Saya", async ({
    page,
  }) => {
    await memberInLobby(page)
    const hotspot = page
      .getByRole("region", { name: "Adegan lobi" })
      .getByRole("button", { name: "Fiksi & Sastra · 0 buku" })
    await hotspot.focus()
    await hotspot.press("Enter")
    await expect(page).toHaveURL(/\/shelf\?genre=fiksi_sastra$/)
    await expect(popupOf(page, "Rak Saya")).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(page).toHaveURL(/\/lobby$/)
    await expect(popupOf(page, "Rak Saya")).toHaveCount(0)
    await expect(
      page
        .getByRole("region", { name: "Adegan lobi" })
        .getByRole("button", { name: "Fiksi & Sastra · 0 buku" })
    ).toBeFocused()
  })

  test("a search result picked over Rak Saya shows the book in the lobby", async ({
    page,
  }) => {
    const member = await memberInLobby(page)
    await seedBook(await userIdOf(member.email))
    await page.goto("/shelf")
    await hydrated(page)
    await expect(popupOf(page, "Rak Saya")).toBeVisible()

    await page.getByLabel("Cari di rakmu").fill("sherlock")
    await page
      .getByRole("list", { name: "Hasil pencarian" })
      .getByRole("button", { name: new RegExp(SHERLOCK.title) })
      .click()
    await expect(page).toHaveURL(/\/lobby$/)
    await expect(
      page.getByRole("region", { name: SHERLOCK.title })
    ).toBeVisible()
  })
})

test("on phones Rak Saya and Pengaturan stay pages", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phones only")
  await memberInLobby(page)

  await navOf(page).getByRole("link", { name: "Rak Saya" }).click()
  await expect(page).toHaveURL(/\/shelf$/)
  await expect(
    page.getByRole("heading", { name: "Rak Saya", level: 1 })
  ).toBeVisible()
  await expect(sceneOf(page)).toBeHidden()
  await expect(
    page.getByRole("button", { name: "Tutup Rak Saya" })
  ).toBeHidden()
  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(/\/shelf$/)

  await navOf(page).getByRole("link", { name: "Pengaturan" }).click()
  await expect(
    page.getByRole("heading", { name: "Pengaturan", level: 1 })
  ).toBeVisible()
  await expect(sceneOf(page)).toBeHidden()
})
