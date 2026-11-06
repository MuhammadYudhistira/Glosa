import { expect, test } from "@playwright/test"
import { seedBook } from "./helpers/books"
import {
  HABIT_ZONE,
  seedReadingTime,
  setDailyGoal,
  storedSeconds,
  todayInZone,
} from "./helpers/habit"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"
import { startReading, turnPages } from "./helpers/reading"

test.use({ timezoneId: HABIT_ZONE })

test("reading a page reaches the server as today's time", async ({ page }) => {
  const { userId } = await startReading(page)
  // A page shown for more than five seconds counts.
  await page.waitForTimeout(7_000)
  await turnPages(page, "PageDown", 1)
  // Leaving the reader sends the time at once.
  await page.goto("/lobby")
  await expect
    .poll(() => storedSeconds(userId, todayInZone()), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(5)
})

test("the plant opens Kebiasaan baca with today's streak", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  const today = todayInZone()
  await seedReadingTime(userId, bookId, today, 600)

  await page.goto("/lobby")
  await hydrated(page)
  const scene = page.getByRole("region", { name: "Adegan lobi" })
  await scene.getByRole("button", { name: "Kebiasaan baca" }).press("Enter")
  await expect(page).toHaveURL(/\/habits$/)
  await expect(
    page.getByRole("heading", { name: "Kebiasaan baca" })
  ).toBeVisible()
  await expect(page.getByText("hari membaca beruntun")).toBeVisible()
  const label = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: HABIT_ZONE,
  }).format(new Date())
  await expect(page.getByLabel(`${label}: 10 menit`)).toHaveAttribute(
    "data-state",
    "read"
  )
})

test("the reader says once that today's goal is reached", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  await setDailyGoal(userId, 5)
  // Four seconds short of the goal, read on another device.
  await seedReadingTime(userId, bookId, todayInZone(), 296, 5)

  await page.goto(`/read/${bookId}`)
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )
  await expect(
    page.getByRole("img", { name: "4 dari 5 menit hari ini" })
  ).toBeVisible({ timeout: 20_000 })
  await turnPages(page, "PageDown", 1)
  await page.waitForTimeout(8_000)
  await turnPages(page, "PageDown", 1)
  await expect(
    page.getByText("Target hari ini tercapai. Selamat membaca terus.")
  ).toBeVisible({ timeout: 15_000 })
  expect(
    await page.evaluate(() => localStorage.getItem("glosa:habit-toast"))
  ).toBe(todayInZone())
})

test("the goals set in the panel are kept", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto("/habits")
  await hydrated(page)
  await page.getByLabel("Target menit per hari").selectOption("20")
  await page.getByLabel("Target buku per tahun").fill("12")
  await page.getByLabel("Target buku per tahun").press("Enter")
  await expect(page.getByText("0 / 12 buku selesai")).toBeVisible()
  await page.reload()
  await hydrated(page)
  await expect(page.getByLabel("Target menit per hari")).toHaveValue("20")
  await expect(page.getByLabel("Target buku per tahun")).toHaveValue("12")
})
