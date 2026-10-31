import { type Page, expect, test } from "@playwright/test"
import { seedBook } from "./helpers/books"
import { makeEpub } from "./helpers/epub"
import {
  createConfirmedMember,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

const BOOK = { title: "Buku Tiga Bab", author: "Penguji" }
const CHAPTERS = ["Bab 1: Awal", "Bab 2: Tengah", "Bab 3: Akhir"]
const PARAGRAPH =
  "Kalimat ini mengisi halaman supaya bab ini lebih panjang dari layar, sehingga pembaca harus menggulir untuk sampai di ujungnya. "

/** A member reading a three-chapter book in the scrolled flow. */
async function readScrolled(page: Page) {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId, {
    ...BOOK,
    file: await makeEpub({
      ...BOOK,
      subjects: [],
      cover: false,
      chapters: CHAPTERS.map((title) => ({
        title,
        body: `<h1>${title}</h1>${`<p>${PARAGRAPH.repeat(4)}</p>`.repeat(25)}`,
      })),
    }),
  })
  await page.goto(`/read/${bookId}`)
  await expect(
    page.getByRole("status", { name: "Posisi baca", includeHidden: true })
  ).toHaveText(/^\d+%$/, { timeout: 30_000 })
  await page.getByRole("button", { name: "Tampilan" }).click()
  const panel = page.getByRole("dialog", { name: "Tampilan" })
  await panel.getByText("Gulir", { exact: true }).click()
  await page.keyboard.press("Escape")
  await expect(panel).toBeHidden()
}

/** The section shown, by its place in the spine. */
const sectionShown = (page: Page) =>
  page.evaluate(() => {
    const view = document.querySelector("foliate-view") as unknown as {
      lastLocation: { section?: { current: number } } | null
    }
    return view.lastLocation?.section?.current ?? null
  })

/** Over the text, away from the bars. */
async function overText(page: Page) {
  const size = page.viewportSize()
  if (!size) throw new Error("no viewport")
  return { x: size.width / 2, y: size.height / 2 }
}

/** Scrolls down with the wheel until the end of the section shows. */
async function wheelToEnd(page: Page) {
  const { x, y } = await overText(page)
  await page.mouse.move(x, y)
  await expect(async () => {
    await page.mouse.wheel(0, 2000)
    await expect(
      page.getByRole("button", { name: /^Akhir (bab|bagian)/ })
    ).toBeVisible({ timeout: 500 })
  }).toPass({ timeout: 20_000 })
}

/** A finger dragged up (negative dy) or down over the text. */
async function drag(page: Page, dy: number) {
  const { x, y } = await overText(page)
  const client = await page.context().newCDPSession(page)
  const steps = 8
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  })
  for (let step = 1; step <= steps; step++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y + (dy * step) / steps }],
    })
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  })
  await client.detach()
}

test("scrolling on past a chapter's end opens the next one", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000)
  await readScrolled(page)
  await expect.poll(() => sectionShown(page)).toBe(0)

  await wheelToEnd(page)
  const edge = page.getByRole("button", {
    name: "Akhir bab · Gulir terus ke Bab 2: Tengah",
  })
  await expect(edge).toBeVisible()
  // The scroll that reached the end does not move on by itself.
  await page.waitForTimeout(400)
  expect(await sectionShown(page)).toBe(0)

  if (isMobile) await drag(page, -200)
  else {
    for (let notch = 0; notch < 4; notch++) {
      await page.mouse.wheel(0, 100)
      await page.waitForTimeout(50)
    }
  }
  await expect.poll(() => sectionShown(page)).toBe(1)
  await expect(edge).toBeHidden()
})

test("the marker moves on when pressed, and says where the book ends", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await readScrolled(page)

  await wheelToEnd(page)
  await page
    .getByRole("button", { name: "Akhir bab · Gulir terus ke Bab 2: Tengah" })
    .click()
  await expect.poll(() => sectionShown(page)).toBe(1)

  await wheelToEnd(page)
  await page
    .getByRole("button", { name: "Akhir bab · Gulir terus ke Bab 3: Akhir" })
    .click()
  await expect.poll(() => sectionShown(page)).toBe(2)

  const { x, y } = await overText(page)
  await page.mouse.move(x, y)
  await expect(async () => {
    await page.mouse.wheel(0, 2000)
    await expect(page.getByText("Akhir buku", { exact: true })).toBeVisible({
      timeout: 500,
    })
  }).toPass({ timeout: 20_000 })
})

test("pulling past a chapter's start opens the one before at its end", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000)
  await readScrolled(page)
  await wheelToEnd(page)
  await page
    .getByRole("button", { name: "Akhir bab · Gulir terus ke Bab 2: Tengah" })
    .click()
  await expect.poll(() => sectionShown(page)).toBe(1)
  await page.waitForTimeout(400)

  if (isMobile) await drag(page, 200)
  else {
    for (let notch = 0; notch < 4; notch++) {
      await page.mouse.wheel(0, -100)
      await page.waitForTimeout(50)
    }
  }
  await expect.poll(() => sectionShown(page)).toBe(0)
  // At the end of the chapter before, where the way on shows again.
  await expect(
    page.getByRole("button", {
      name: "Akhir bab · Gulir terus ke Bab 2: Tengah",
    })
  ).toBeVisible()
})
