import { expect, test } from "@playwright/test"
import { seedBook } from "./helpers/books"
import { HABIT_ZONE, seedReadingTime, todayInZone } from "./helpers/habit"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"
import { placedItems } from "./helpers/shop"

test.use({ timezoneId: HABIT_ZONE })

test("buying a rug places it on the server, and taking it off removes it", async ({
  page,
}) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  await seedReadingTime(userId, bookId, todayInZone(), 3600) // 60 coins

  await page.goto("/lobby")
  await hydrated(page)
  const scene = page.getByRole("region", { name: "Adegan lobi" })
  await scene.getByRole("button", { name: "Toko lobi" }).press("Enter")
  await expect(page).toHaveURL(/\/shop$/)
  await expect(page.getByRole("heading", { name: "Toko lobi" })).toBeVisible()
  const balance = page.locator(".shop-balance")
  await expect(balance).toHaveText("60 koin")

  const round = page.getByRole("listitem", { name: "Karpet bundar" })
  await expect(round.getByRole("button", { name: "Beli" })).toBeDisabled()
  await expect(round.getByText("Kurang 60 koin")).toBeVisible()

  const woven = page.getByRole("listitem", { name: "Karpet anyaman" })
  await woven.getByRole("button", { name: "Beli" }).click()
  const dialog = page.getByRole("dialog")
  await expect(
    dialog.getByText("Beli Karpet anyaman seharga 60 koin?")
  ).toBeVisible()
  await dialog.getByRole("button", { name: "Beli" }).click()
  await expect(woven.getByText("Terpasang")).toBeVisible()
  await expect(balance).toHaveText("0 koin")
  expect(await placedItems(userId)).toEqual({ rug: "rug_woven" })

  await woven.getByRole("button", { name: "Lepas" }).click()
  await expect(woven.getByRole("button", { name: "Pasang" })).toBeVisible()
  await expect.poll(() => placedItems(userId)).toEqual({})
})

test("a member who has not read yet is asked to read", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto("/shop")
  await expect(page.getByText("Baca untuk mendapat koin")).toBeVisible()
  await expect(
    page
      .getByRole("listitem", { name: "Karpet anyaman" })
      .getByRole("button", { name: "Beli" })
  ).toBeDisabled()
})
