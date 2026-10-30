import { type Page, expect, test } from "@playwright/test"
import { annotationsOf, selectWords } from "./helpers/annotations"
import { startReading } from "./helpers/reading"

/** Opens the annotations tab of the reader's panel. */
async function openAnnotations(page: Page) {
  await page.getByRole("button", { name: "Daftar isi dan anotasi" }).click()
  const panel = page.getByRole("dialog", { name: "Daftar isi dan anotasi" })
  await panel.getByRole("tab", { name: "Anotasi" }).click()
  return panel
}

test("a selection becomes a highlight with a note, which stays and can be deleted", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(120_000)
  const { userId } = await startReading(page)
  // A page turn slides: let it settle before selecting.
  await page.waitForTimeout(800)

  const picked = await selectWords(page)
  const menu = page.getByRole("dialog", { name: "Teks terpilih" })
  await menu.getByRole("button", { name: "Highlight" }).click()
  await expect(menu).toBeHidden()
  // Sent two seconds after the last change (spec 2 §7).
  await expect
    .poll(async () => await annotationsOf(userId), { timeout: 20_000 })
    .toEqual([
      expect.objectContaining({
        kind: "highlight",
        color: "yellow",
        // Kept on one line (excerptOf).
        excerpt: picked.text.replace(/\s+/g, " "),
      }),
    ])

  // A tap on the highlight opens its popup (spec 2 §6.1, step 2).
  if (isMobile) await page.touchscreen.tap(picked.x, picked.y)
  else await page.mouse.click(picked.x, picked.y)
  const popup = page.getByRole("dialog", { name: "Highlight" })
  await popup.getByRole("button", { name: "Hijau" }).click()
  await popup.getByRole("button", { name: "Catatan" }).click()
  const editor = page.getByRole("dialog", { name: "Catatan" })
  await editor.getByRole("textbox", { name: "Isi catatan" }).fill("Catatan uji")
  // Pressed, not clicked: on a phone the dev-only devtools button sits over
  // the sheet's button.
  await editor.getByRole("button", { name: "Selesai" }).press("Enter")
  await expect(editor).toBeHidden()
  await expect
    .poll(async () => (await annotationsOf(userId))[0], { timeout: 20_000 })
    .toMatchObject({ color: "green", note: "Catatan uji" })

  // Still there after a reload, from this device and from the server.
  await page.reload()
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )
  const panel = await openAnnotations(page)
  const item = panel.getByRole("listitem").filter({ hasText: "Catatan uji" })
  await expect(item).toContainText(picked.text)
  await item.getByRole("button", { name: "Hapus anotasi" }).click()
  await expect(item).toBeHidden()
  await expect
    .poll(async () => (await annotationsOf(userId))[0]?.deleted_at ?? null, {
      timeout: 20_000,
    })
    .not.toBeNull()
})

test("the bookmark button marks the page, and the panel lists it", async ({
  page,
}) => {
  const { userId } = await startReading(page)
  await page.getByRole("button", { name: "Bookmark halaman ini" }).click()
  await expect(
    page.getByRole("button", { name: "Hapus bookmark" })
  ).toHaveAttribute("aria-pressed", "true")
  await expect
    .poll(async () => (await annotationsOf(userId)).map((a) => a.kind), {
      timeout: 20_000,
    })
    .toEqual(["bookmark"])

  const panel = await openAnnotations(page)
  await expect(
    panel.getByRole("listitem").filter({ hasText: "Bookmark" })
  ).toBeVisible()
})
