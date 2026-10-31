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
