import { readFile } from "node:fs/promises"
import { type Download, type Page, expect, test } from "@playwright/test"
import { selectWords } from "./helpers/annotations"
import { startReading } from "./helpers/reading"

/** A PNG's size, from its IHDR chunk. */
async function pngSize(download: Download) {
  const bytes = await readFile(await download.path())
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

async function saveImage(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Bagikan kutipan" })
  const save = dialog.getByRole("button", { name: "Simpan gambar" })
  await expect(save).toBeEnabled()
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    save.click(),
  ])
  return download
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

test("a selection becomes a quote card, saved as a story and as a square", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await startReading(page)
  const picked = await selectWords(page)
  await page
    .getByRole("dialog", { name: "Teks terpilih" })
    .getByRole("button", { name: "Bagikan" })
    .click()

  const dialog = page.getByRole("dialog", { name: "Bagikan kutipan" })
  const preview = dialog.getByRole("img", { name: /^Kartu kutipan/ })
  await expect(preview).toHaveAttribute(
    "aria-label",
    new RegExp(escape(picked.text.replace(/\s+/g, " ")))
  )

  const story = await saveImage(page)
  expect(story.suggestedFilename()).toMatch(/^glosa-[a-z0-9-]+\.png$/)
  expect(await pngSize(story)).toEqual({ width: 1080, height: 1920 })

  await dialog
    .getByRole("group", { name: "Ukuran" })
    .getByRole("button", { name: "Persegi" })
    .click()
  await expect(preview).toHaveAttribute("height", "1080")
  const square = await saveImage(page)
  expect(await pngSize(square)).toEqual({ width: 1080, height: 1080 })

  await dialog.getByRole("button", { name: "Tutup" }).click()
  await expect(dialog).toBeHidden()
})

test("a highlight in the annotations panel can be made into a card", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await startReading(page)
  const picked = await selectWords(page)
  await page
    .getByRole("dialog", { name: "Teks terpilih" })
    .getByRole("button", { name: "Highlight" })
    .click()

  await page.getByRole("button", { name: "Daftar isi dan anotasi" }).click()
  const panel = page.getByRole("dialog", { name: "Daftar isi dan anotasi" })
  await panel.getByRole("tab", { name: "Anotasi" }).click()
  await panel.getByRole("button", { name: /^Bagikan highlight/ }).click()

  const dialog = page.getByRole("dialog", { name: "Bagikan kutipan" })
  await expect(
    dialog.getByRole("img", { name: /^Kartu kutipan/ })
  ).toHaveAttribute(
    "aria-label",
    new RegExp(escape(picked.text.replace(/\s+/g, " ")))
  )
  expect(await pngSize(await saveImage(page))).toEqual({
    width: 1080,
    height: 1920,
  })
})

test("a word of the quote gets its meanings, on both layouts", async ({
  page,
}) => {
  test.setTimeout(180_000)
  await startReading(page)
  await selectWords(page, 4)
  await page
    .getByRole("dialog", { name: "Teks terpilih" })
    .getByRole("button", { name: "Bagikan" })
    .click()

  const dialog = page.getByRole("dialog", { name: "Bagikan kutipan" })
  const words = dialog
    .getByRole("group", { name: "Kata di kutipan" })
    .getByRole("button")
  const meanings = dialog.getByRole("group", {
    name: "Arti di kartu (pilih 1–3)",
  })

  // The words come from the seeded book, the meanings from the shared
  // dictionary: take the first word that has some (by keyboard, as the
  // buttons are visually hidden).
  const count = await words.count()
  let found = false
  for (let i = 0; i < count && !found; i += 1) {
    const word = words.nth(i)
    await word.focus()
    await word.press("Enter")
    found = await meanings
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false)
  }
  expect(found, "one of the quote's words has a meaning").toBe(true)

  const spare = meanings
    .locator('button[aria-pressed="false"]:not([disabled])')
    .first()
  if ((await spare.count()) > 0) {
    const name = (await spare.textContent()) ?? ""
    await spare.click()
    // The same meaning may sit under two parts of speech.
    await expect(
      meanings.locator('button[aria-pressed="true"]', { hasText: name }).first()
    ).toBeVisible()
  }

  expect(await pngSize(await saveImage(page))).toEqual({
    width: 1080,
    height: 1920,
  })

  await dialog
    .getByRole("group", { name: "Layout" })
    .getByRole("button", { name: "Glosa" })
    .click()
  expect(await pngSize(await saveImage(page))).toEqual({
    width: 1080,
    height: 1920,
  })
})
