import { type Page, expect, test } from "@playwright/test"
import { seedBook } from "./helpers/books"
import { makeEpub } from "./helpers/epub"
import {
  createConfirmedMember,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"
import { startReading, turnPages } from "./helpers/reading"

const SPECKLED_BAND = "The Adventure of the Speckled Band"
const NOTE = "Isi catatan kaki ini terbuka di popup."
const FOOTNOTE_BOOK = { title: "Buku Catatan Kaki", author: "Penguji" }

/** The middle of an element of the shown section, in this window. */
async function pointOf(page: Page, id: string) {
  const point = await page.evaluate((target) => {
    const view = document.querySelector("foliate-view") as unknown as {
      renderer: { getContents: () => Array<{ doc: Document }> }
    }
    const doc = view.renderer.getContents()[0].doc
    const element = doc.getElementById(target)
    const frame = doc.defaultView?.frameElement?.getBoundingClientRect()
    if (!element || !frame) return null
    const box = element.getBoundingClientRect()
    return {
      x: frame.left + box.left + box.width / 2,
      y: frame.top + box.top + box.height / 2,
    }
  }, id)
  if (!point) throw new Error(`#${id} does not show`)
  return point
}

test("a footnote opens in a popup and the page stays", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000)
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId, {
    ...FOOTNOTE_BOOK,
    file: await makeEpub({
      ...FOOTNOTE_BOOK,
      subjects: [],
      cover: false,
      body: `<h1>Bab 1</h1><p>Kalimat pertama dengan catatan<a epub:type="noteref" id="r1" href="#n1">1</a> di ujungnya.</p><aside epub:type="footnote" id="n1"><p>${NOTE} <a epub:type="backlink" href="#r1">↩</a></p></aside>`,
    }),
  })
  await page.goto(`/read/${bookId}`)
  // On a phone the popup is a modal sheet, which hides the footer from the roles.
  const place = page.getByRole("status", {
    name: "Posisi baca",
    includeHidden: true,
  })
  await expect(place).toHaveText(/^\d+%$/, { timeout: 30_000 })
  const before = await place.textContent()

  const { x, y } = await pointOf(page, "r1")
  if (isMobile) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)

  const popup = page.getByRole("dialog", { name: "Catatan kaki" })
  await expect(popup).toHaveText(NOTE)
  await expect(place).toHaveText(before ?? "")
  await page.keyboard.press("Escape")
  await expect(popup).toBeHidden()
})

test("Kembali goes back to the place before a jump from the contents", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await startReading(page)
  const chapter = page.getByRole("status", { name: "Bab saat ini" })
  const before = (await chapter.textContent()) ?? ""
  const back = page.getByRole("button", { name: "Kembali", exact: true })
  const jumpToSpeckledBand = async () => {
    await page.getByRole("button", { name: "Daftar isi" }).click()
    const contents = page.getByRole("dialog", { name: "Daftar isi" })
    await contents.getByRole("button", { name: SPECKLED_BAND }).click()
    await expect(chapter).toHaveText(SPECKLED_BAND)
    // Keys pressed while the panel still closes do not reach the book.
    await expect(contents).toBeHidden()
  }

  await expect(back).toBeHidden()
  await jumpToSpeckledBand()
  await back.click()
  await expect(chapter).toHaveText(before)
  await expect(back).toBeHidden()

  // Five page turns after a jump put the button away (spec 2 §6.7).
  await jumpToSpeckledBand()
  await turnPages(page, "PageDown", 4)
  await expect(back).toBeVisible()
  await turnPages(page, "PageDown", 1)
  await expect(back).toBeHidden()
})
