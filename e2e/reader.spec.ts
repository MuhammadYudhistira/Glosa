import { type Page, expect, test } from "@playwright/test"
import {
  SHERLOCK,
  readerSettingsOf,
  seedBook,
  storedPercentage,
} from "./helpers/books"
import {
  createConfirmedMember,
  hydrated,
  signIn,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

const SPECKLED_BAND = "The Adventure of the Speckled Band"

/** A signed-in member with Sherlock on their shelf. */
async function memberWithBook(page: Page) {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  return { member, userId, bookId }
}

/** Waits until foliate has shown the book: the position appears only then. */
async function bookShown(page: Page) {
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )
}

test("the place read on one device is offered on another", async ({
  page,
  browser,
}) => {
  // Two devices, two book opens and the sync pause do not fit in the default 30 s.
  test.setTimeout(90_000)
  const { member, bookId } = await memberWithBook(page)

  await page.goto("/shelf")
  await hydrated(page)
  await page.getByRole("button", { name: new RegExp(SHERLOCK.title) }).click()
  await page
    .getByRole("dialog", { name: SHERLOCK.title })
    .getByRole("link", { name: "Mulai membaca" })
    .click()
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))
  await bookShown(page)

  await page.getByRole("button", { name: "Daftar isi" }).click()
  await page
    .getByRole("dialog", { name: "Daftar isi" })
    .getByRole("button", { name: SPECKLED_BAND })
    .click()
  await expect(page.getByRole("status", { name: "Bab saat ini" })).toHaveText(
    SPECKLED_BAND
  )
  // Sent after the five-second pause (spec §10 step 2).
  await expect
    .poll(() => storedPercentage(bookId), { timeout: 20_000 })
    .toBeGreaterThan(40)

  // A second device: a fresh browser context signed in as the same member.
  const other = await browser.newContext()
  try {
    const second = await other.newPage()
    await signIn(second, member)
    await expect(second).toHaveURL(/\/lobby/)
    await second.goto(`/read/${bookId}`)
    await bookShown(second)
    await expect(
      second.getByText(/^Lanjutkan dari \d+% \(dibaca di perangkat lain\)\?$/)
    ).toBeVisible()
    // The reader never jumps by itself.
    await expect(
      second.getByRole("status", { name: "Bab saat ini" })
    ).not.toHaveText(SPECKLED_BAND)

    await second.getByRole("button", { name: "Lompat" }).click()
    await expect(
      second.getByRole("status", { name: "Bab saat ini" })
    ).toHaveText(SPECKLED_BAND)
  } finally {
    await other.close()
  }
})

test("turning pages by key or tap saves the new place", async ({
  page,
  isMobile,
}) => {
  const { bookId } = await memberWithBook(page)
  await page.goto(`/read/${bookId}`)
  await bookShown(page)
  // Opening the book is not reading (plan 1C, decision 8): even after the
  // five-second pause nothing reaches the server. A fixed wait is the only
  // way to show that something does not happen.
  await page.waitForTimeout(6_000)
  expect(await storedPercentage(bookId)).toBeNull()

  const viewport = page.viewportSize()!
  for (let turn = 0; turn < 3; turn++) {
    if (isMobile) {
      await page.touchscreen.tap(viewport.width * 0.85, viewport.height / 2)
    } else {
      await page.keyboard.press("ArrowRight")
    }
  }
  await expect
    .poll(() => storedPercentage(bookId), { timeout: 20_000 })
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

/** A finger swipe that slows down before it lifts, as real ones do. */
async function swipe(page: Page, fromX: number, toX: number, y: number) {
  const cdp = await page.context().newCDPSession(page)
  const at = (t: number) => [{ x: fromX + (toX - fromX) * t, y, id: 1 }]
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: at(0),
  })
  for (let step = 1; step <= 12; step++) {
    await page.waitForTimeout(16)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: at(1 - (1 - step / 12) ** 3),
    })
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  })
  await cdp.detach()
}

test("a swipe or the wheel turns exactly one page", async ({
  page,
  isMobile,
}) => {
  const { bookId } = await memberWithBook(page)
  await page.goto(`/read/${bookId}`)
  await bookShown(page)
  // Away from the first page, so turning back stays inside the section.
  await page.keyboard.press("PageDown")
  await expect.poll(() => pageInSection(page)).toBeGreaterThan(1)
  const start = await pageInSection(page)
  const { width, height } = page.viewportSize()!
  const y = height / 2

  if (isMobile) {
    // Shorter than half the page, which foliate alone needed.
    await swipe(page, width * 0.75, width * 0.75 - 150, y)
    await expect.poll(() => pageInSection(page)).toBe(start + 1)
    await swipe(page, width * 0.25, width * 0.25 + 150, y)
    await expect.poll(() => pageInSection(page)).toBe(start)
  } else {
    // One trackpad flick: a burst of shrinking deltas, a frame apart. Sent
    // from the page itself, as Playwright's own round trips can stall for
    // longer than a pause between two gestures.
    await page.evaluate(async () => {
      const view = document.querySelector("foliate-view") as unknown as {
        renderer: { getContents: () => Array<{ doc: Document }> }
      }
      const doc = view.renderer.getContents()[0].doc
      const Wheel = (doc.defaultView as unknown as typeof window).WheelEvent
      for (let event = 0; event < 30; event++) {
        doc.body.dispatchEvent(
          new Wheel("wheel", {
            deltaY: Math.max(2, 80 * 0.85 ** event),
            bubbles: true,
          })
        )
        await new Promise((resolve) => setTimeout(resolve, 16))
      }
    })
    await expect.poll(() => pageInSection(page)).toBe(start + 1)
    await page.mouse.move(width / 2, y)
    await page.waitForTimeout(300)
    await page.mouse.wheel(0, -120)
    await expect.poll(() => pageInSection(page)).toBe(start)
  }
})

test("on a wide screen the edges show and turn, Space reads on, and pages slide", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Mouse, keyboard and a wide screen")
  await page.setViewportSize({ width: 1920, height: 1080 })
  const { bookId } = await memberWithBook(page)
  await page.goto(`/read/${bookId}`)
  await bookShown(page)
  // foliate's shadow root is closed to locators.
  const slides = () =>
    page.evaluate(() =>
      (
        document.querySelector("foliate-view") as unknown as {
          renderer: Element
        }
      ).renderer.hasAttribute("animated")
    )
  expect(await slides()).toBe(true)
  await page.keyboard.press("PageDown")
  await expect.poll(() => pageInSection(page)).toBeGreaterThan(1)
  const start = await pageInSection(page)

  await page.keyboard.press("Space")
  await expect.poll(() => pageInSection(page)).toBe(start + 1)
  await page.keyboard.press("Shift+Space")
  await expect.poll(() => pageInSection(page)).toBe(start)

  const right = page.locator(".reader-turn-right")
  await expect(right).toHaveAttribute("data-shown", "false")
  await page.mouse.move(1920 * 0.9, 540)
  await expect(right).toHaveAttribute("data-shown", "true")
  await page.mouse.move(1920 * 0.5, 540)
  await expect(right).toHaveAttribute("data-shown", "false")

  // The far band lies outside the book's frame on a screen this wide.
  await page.mouse.click(1920 - 20, 540)
  await expect.poll(() => pageInSection(page)).toBe(start + 1)
  await page.mouse.click(20, 540)
  await expect.poll(() => pageInSection(page)).toBe(start)

  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect.poll(slides).toBe(false)
})

test("display settings follow the member", async ({ page }) => {
  const { userId, bookId } = await memberWithBook(page)
  await page.goto(`/read/${bookId}`)
  await bookShown(page)
  const reader = page.locator("main.reader-page")
  await expect(reader).toHaveAttribute("data-theme", "sepia")

  await page.getByRole("button", { name: "Tampilan" }).click()
  const panel = page.getByRole("dialog", { name: "Tampilan" })
  await panel.getByText("Gelap", { exact: true }).click()
  await panel.getByRole("button", { name: "Perbesar huruf" }).click()
  await expect(reader).toHaveAttribute("data-theme", "dark")
  await expect
    .poll(() => readerSettingsOf(userId))
    .toMatchObject({ theme: "dark", fontSize: 110 })

  await page.reload()
  await bookShown(page)
  await expect(reader).toHaveAttribute("data-theme", "dark")
})
