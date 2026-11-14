import { expect, test } from "@playwright/test"
import { annotationsOf, selectWords } from "./helpers/annotations"
import { SHERLOCK } from "./helpers/books"
import { hydrated } from "./helpers/members"
import { startReading } from "./helpers/reading"

// These projects run without WebGL: the lobby shows its still image and
// hotspots are pressed with the keyboard (as in lobby.spec.ts).

test("a highlight reaches the corkboard, the highlights page, the book and a quote card", async ({
  page,
}) => {
  test.setTimeout(180_000)
  const { userId } = await startReading(page)
  const picked = await selectWords(page)
  await page
    .getByRole("dialog", { name: "Teks terpilih" })
    .getByRole("button", { name: "Highlight" })
    .click()
  // The page reads highlights from the server: wait until it is saved.
  await expect
    .poll(async () => (await annotationsOf(userId)).length, {
      timeout: 30_000,
    })
    .toBe(1)

  await page.goto("/lobby")
  await hydrated(page)
  const scene = page.getByRole("region", { name: "Adegan ruang baca" })
  await scene
    .getByRole("button", { name: "Sorotan", exact: true })
    .press("Enter")
  const board = page.getByRole("dialog", { name: "Sorotan" })
  const quote = new RegExp(picked.text.split(/\s+/).join("\\s+"))
  await expect(board.getByText(quote)).toBeVisible()

  await board.getByRole("link", { name: "Lihat semua" }).click()
  await expect(page).toHaveURL(/\/highlights$/)
  const popup = page.getByRole("main", { name: "Sorotan & catatan" })
  await expect(popup.getByText(quote)).toBeVisible()
  await expect(
    popup.getByRole("listitem").getByText(SHERLOCK.title)
  ).toBeVisible()

  await popup.getByRole("link", { name: "Buka di buku" }).click()
  await expect(page).toHaveURL(/\/read\/[^?]+\?.*cfi=/)
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )

  await page.goBack()
  await expect(page).toHaveURL(/\/highlights$/)
  await page
    .getByRole("main", { name: "Sorotan & catatan" })
    .getByRole("button", { name: "Buat kartu kutipan" })
    .click()
  await expect(
    page.getByRole("dialog", { name: "Bagikan kutipan" })
  ).toBeVisible()
})
