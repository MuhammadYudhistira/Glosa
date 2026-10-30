import { type Page, expect, test } from "@playwright/test"
import { annotationsOf, selectWords } from "./helpers/annotations"
import { startReading, turnPages } from "./helpers/reading"

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
  // startReading waits until its page turns have landed.

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
  // Pressed on a phone, where the dev-only devtools button sits over the
  // sheet's button.
  const done = editor.getByRole("button", { name: "Selesai" })
  if (isMobile) await done.press("Enter")
  else await done.click()
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
  await item.getByRole("button", { name: /^Hapus highlight/ }).click()
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

test("the bookmark button, pressed again, takes the bookmark off", async ({
  page,
}) => {
  test.setTimeout(120_000)
  const { userId } = await startReading(page)
  // The section's first page, where the mark seemed not to hold (a click
  // made while the turns still slid; see turnPages).
  await turnPages(page, "PageUp", (await pageInSection(page)) - 1)
  await page.getByRole("button", { name: "Bookmark halaman ini" }).click()
  // Sent two seconds after the last change (spec 2 §7): the page keeps the
  // mark that long and more.
  await expect
    .poll(async () => (await annotationsOf(userId)).length, {
      timeout: 20_000,
    })
    .toBe(1)
  // Saved, and the page still holds it (plan 2B, decision 16).
  const remove = page.getByRole("button", { name: "Hapus bookmark" })
  await expect(remove).toHaveAttribute("aria-pressed", "true")

  await remove.click()
  await expect(
    page.getByRole("button", { name: "Bookmark halaman ini" })
  ).toHaveAttribute("aria-pressed", "false")
  // A tombstone, not a missing row (spec 2 §7).
  await expect
    .poll(async () => (await annotationsOf(userId))[0]?.deleted_at ?? null, {
      timeout: 20_000,
    })
    .not.toBeNull()
})

/** The paginator's page within the current section. */
function pageInSection(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (
        document.querySelector("foliate-view") as unknown as {
          renderer: { page: number }
        }
      ).renderer.page
  )
}

test("turning the page with a selection leaves nothing to swallow the next tap", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(120_000)
  await startReading(page)
  await selectWords(page)
  const menu = page.getByRole("dialog", { name: "Teks terpilih" })
  await expect(menu).toBeVisible()

  // Waits until the turn has landed, so the slide is over.
  await turnPages(page, "PageDown", 1)
  await expect(menu).toBeHidden()
  const turned = await pageInSection(page)

  // The far edge, beside the text: it must turn the page, not be swallowed.
  const { width, height } = page.viewportSize()!
  if (isMobile) await page.touchscreen.tap(width - 4, height / 2)
  else await page.mouse.click(width - 4, height / 2)
  await expect.poll(() => pageInSection(page)).toBeGreaterThan(turned)
})
