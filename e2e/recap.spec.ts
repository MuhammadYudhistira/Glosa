import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { markFinished, seedBook } from "./helpers/books"
import { HABIT_ZONE, seedReadingTime, todayInZone } from "./helpers/habit"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

test.use({ timezoneId: HABIT_ZONE })

test("the recap of this month shows the seeded numbers and shares a story image", async ({
  page,
}) => {
  test.setTimeout(90_000)
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  await markFinished(bookId)
  await seedReadingTime(userId, bookId, todayInZone(), 5400)

  await page.goto("/recap")
  await hydrated(page)
  await expect(page.getByRole("heading", { name: "Kilas balik" })).toBeVisible()
  await expect(page.getByText("sejauh ini")).toBeVisible()
  await expect(page.getByText("1 buku selesai")).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText("1 jam 30 menit")).toBeVisible()
  await expect(page.getByRole("link", { name: /Sherlock/ })).toBeVisible()

  await page.getByRole("button", { name: "Bagikan" }).click()
  const dialog = page.getByRole("dialog", { name: "Bagikan kilas balik" })
  const save = dialog.getByRole("button", { name: "Simpan gambar" })
  await expect(save).toBeEnabled({ timeout: 30_000 })
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    save.click(),
  ])
  const bytes = await readFile(await download.path())
  expect({
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  }).toEqual({ width: 1080, height: 1920 })
})

test("a month with no reading says so and has no Bagikan", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto("/recap")
  await hydrated(page)
  await expect(page.getByText(/^Belum ada bacaan di /)).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole("button", { name: "Bagikan" })).toHaveCount(0)
})

test("the habit panel opens the recap", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto("/habits")
  await hydrated(page)
  await page.getByRole("link", { name: "Kilas balik" }).click()
  await expect(page).toHaveURL(/\/recap$/)
})
