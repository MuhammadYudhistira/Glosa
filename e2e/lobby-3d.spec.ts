import { devices, expect, test, type Page } from "@playwright/test"
import sharp from "sharp"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
} from "./helpers/members"

// Real WebGL through SwiftShader: every frame is drawn on the CPU, so these
// tests are slow and run one at a time.
test.describe.configure({ mode: "serial" })

const sceneOf = (page: Page) =>
  page.getByRole("region", { name: "Adegan ruang baca" })

/** The middle of a place's (unseen) button: where its anchor shows on the canvas. */
async function centreOf(page: Page, name: string) {
  const box = await sceneOf(page)
    .getByRole("button", { name, exact: true })
    .boundingBox()
  if (!box) throw new Error(`no button ${name}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Share of the screenshot painted with the magenta void of the test mode. */
async function voidShare(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png)
    .raw()
    .toBuffer({ resolveWithObject: true })
  let count = 0
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 200 && data[i + 1] < 60 && data[i + 2] > 200) count++
  }
  return count / (info.width * info.height)
}

async function drag(page: Page, dx: number, dy: number) {
  const box = await sceneOf(page).boundingBox()
  if (!box) throw new Error("the lobby scene has no box")
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx * box.width * 0.45, y + dy * box.height * 0.45, {
    steps: 2,
  })
  await page.mouse.up()
}

/** Drags the 8 directions; checks the room stays on screen and whether the view changed. */
async function sweep(page: Page, label: string): Promise<{ moved: boolean }> {
  const baseline = await page.screenshot({ timeout: 120_000 })
  let moved = false
  for (const [direction, dx, dy] of DIRECTIONS) {
    for (let k = 0; k < 3; k++) await drag(page, dx, dy)
    const png = await page.screenshot({ timeout: 120_000 })
    // The room is a diorama on a dark backdrop: some void is fine, but the
    // room must never leave the screen.
    expect(
      await voidShare(png),
      `${label}, geser ke ${direction}`
    ).toBeLessThan(0.9)
    if (!png.equals(baseline)) moved = true
  }
  return { moved }
}

const DIRECTIONS = [
  ["kiri", 1, 0],
  ["kanan", -1, 0],
  ["atas", 0, 1],
  ["bawah", 0, -1],
  ["kiri atas", 1, 1],
  ["kiri bawah", 1, -1],
  ["kanan bawah", -1, -1],
  ["kanan atas", -1, 1],
] as const

test("the room never leaves the screen", async ({ page }) => {
  test.setTimeout(1_500_000)
  await page.addInitScript(() =>
    Object.assign(window, { __GLOSA_LOBBY_TEST__: true })
  )
  await signInAndOnboard(page, await createConfirmedMember())
  await hydrated(page)
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute("data-quality", "diam")
  await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
  // Only the canvas may show the void: hide the HTML laid over it.
  await page.addStyleTag({
    content: ".lobby-overlay { display: none !important; }",
  })

  // Desktop, a very wide screen (21:9) and a phone held upright.
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1680, height: 720 },
    { width: 390, height: 844 },
  ]) {
    const size = `${viewport.width}×${viewport.height}`
    await page.setViewportSize(viewport)
    const box = await scene.boundingBox()
    if (!box) throw new Error("the lobby scene has no box")
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    // At zoom 1 the narrower axis does not pan, so zoom in first.
    for (let i = 0; i < 2; i++) await page.mouse.wheel(0, -600)
    const inn = await sweep(page, `${size}, zoomed in`)
    expect(inn.moved, `${size}: zoomed in, no drag moved the camera`).toBe(true)
  }
})

test("a hotspot on the 3D scene opens the upload", async ({ page }) => {
  test.setTimeout(300_000)
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = sceneOf(page)
  await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
  const desk = await centreOf(page, "Meja tulis")
  // The mouse is a fine pointer: one click opens (no name card).
  await page.mouse.click(desk.x, desk.y)
  await expect(
    page.getByRole("dialog", { name: "Bawa buku ke rak" })
  ).toBeVisible()
})

test("with reduced motion the 3D lobby stays still", async ({ page }) => {
  test.setTimeout(300_000)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute("data-quality", "diam")
  await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
  // Still quality acts at once: no walk first.
  const at = await centreOf(page, "Kilas balik")
  await page.mouse.click(at.x, at.y)
  await expect(page).toHaveURL(/\/recap$/)
})

test("the 3D scene stays loaded behind Rak Saya", async ({ page }) => {
  test.setTimeout(300_000)
  await signInAndOnboard(page, await createConfirmedMember())
  const canvas = sceneOf(page).locator("canvas")
  await expect(canvas).toBeVisible({ timeout: 120_000 })
  await canvas.evaluate((element) => {
    element.dataset.e2eMark = "1"
  })

  await page
    .getByRole("navigation", { name: "Navigasi utama" })
    .getByRole("link", { name: "Rak Saya" })
    .click()
  await expect(page.getByRole("main", { name: "Rak Saya" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(/\/lobby$/)
  // The same canvas: WebGL was not started again (spec 1F §3).
  await expect(sceneOf(page).locator("canvas")).toHaveAttribute(
    "data-e2e-mark",
    "1"
  )
})

test("at the start view every hotspot sits inside the scene", async ({
  page,
}) => {
  test.setTimeout(300_000)
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = sceneOf(page)
  await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
  const sceneBox = await scene.boundingBox()
  if (!sceneBox) throw new Error("the lobby scene has no box")
  const buttons = scene.getByRole("button")
  const count = await buttons.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i)
    if (!(await button.isVisible())) continue
    const box = await button.boundingBox()
    if (!box) continue
    const name = (await button.getAttribute("aria-label")) ?? `#${i}`
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    expect(cx, name).toBeGreaterThanOrEqual(sceneBox.x)
    expect(cx, name).toBeLessThanOrEqual(sceneBox.x + sceneBox.width)
    expect(cy, name).toBeGreaterThanOrEqual(sceneBox.y)
    expect(cy, name).toBeLessThanOrEqual(sceneBox.y + sceneBox.height)
  }
})

test("the mouse over a place names it in the room, and a click opens it", async ({
  page,
}) => {
  test.setTimeout(300_000)
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = sceneOf(page)
  await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
  const desk = await centreOf(page, "Meja tulis")
  await page.mouse.move(desk.x, desk.y)
  await expect(scene.locator(".lobby-hover-name")).toHaveText("Meja tulis")
  await page.mouse.move(2, 2)
  await expect(scene.locator(".lobby-hover-name")).toHaveCount(0)
})

test.describe("on a phone held upright", () => {
  // The device's browser type is fixed by the project; the rest is a Pixel 5.
  const { defaultBrowserType: _browser, ...pixel } = devices["Pixel 5"]
  test.use(pixel)

  test("a tap names a place, a second tap opens it, a tap on empty space closes the card", async ({
    page,
  }) => {
    test.setTimeout(300_000)
    await signInAndOnboard(page, await createConfirmedMember())
    const scene = sceneOf(page)
    await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
    const card = page.locator(".lobby-card")
    const sceneBox = (await scene.boundingBox())!
    // The room fills the scene's height: Kilas balik's anchor is on screen.
    const at = await centreOf(page, "Kilas balik")
    expect(at.x).toBeGreaterThan(sceneBox.x)
    expect(at.x).toBeLessThan(sceneBox.x + sceneBox.width)

    await page.touchscreen.tap(at.x, at.y)
    await expect(card).toContainText("Kilas balik")
    await expect(page).toHaveURL(/\/lobby$/)

    await page.touchscreen.tap(sceneBox.x + 6, sceneBox.y + 6)
    await expect(card).toHaveCount(0)

    await page.touchscreen.tap(at.x, at.y)
    await expect(card).toContainText("Kilas balik")
    await page.touchscreen.tap(at.x, at.y)
    await expect(page).toHaveURL(/\/recap$/)
  })

  test("Pusatkan shows only after the camera has moved", async ({ page }) => {
    test.setTimeout(300_000)
    await signInAndOnboard(page, await createConfirmedMember())
    const scene = sceneOf(page)
    await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
    const center = scene.getByRole("button", { name: "Pusatkan" })
    await expect(center).toHaveCount(0)
    const box = (await scene.boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 120, y, { steps: 4 })
    await page.mouse.up()
    await expect(center).toBeVisible()
    await center.click()
    await expect(center).toHaveCount(0)
  })

  test("the room waits behind a page as it was left, with no reload", async ({
    page,
  }) => {
    test.setTimeout(300_000)
    await signInAndOnboard(page, await createConfirmedMember())
    const scene = sceneOf(page)
    const canvas = scene.locator("canvas")
    await expect(canvas).toBeVisible({ timeout: 120_000 })
    await canvas.evaluate((element) => {
      element.dataset.e2eMark = "1"
    })
    // Away from the first view: "Pusatkan" shows while the camera stays there.
    const box = (await scene.boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 120, y, { steps: 4 })
    await page.mouse.up()
    const center = scene.getByRole("button", { name: "Pusatkan" })
    await expect(center).toBeVisible()

    const tabs = page.getByRole("navigation", { name: "Navigasi utama" })
    await tabs.getByRole("link", { name: "Rak Saya" }).click()
    await expect(page.getByRole("main", { name: "Rak Saya" })).toBeVisible()
    await tabs.getByRole("link", { name: "Ruang baca" }).click()
    await expect(page).toHaveURL(/\/lobby$/)
    // The same canvas, live at once, the camera where it was.
    await expect(canvas).toHaveAttribute("data-e2e-mark", "1")
    await expect(scene).toHaveAttribute("data-live", "true")
    await expect(center).toBeVisible()
  })
})
