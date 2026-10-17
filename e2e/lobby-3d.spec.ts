import { expect, test, type Page } from "@playwright/test"
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
  page.getByRole("region", { name: "Adegan lobi" })

/** Pixels of the magenta void the test mode paints outside the map. */
async function voidPixels(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png)
    .raw()
    .toBuffer({ resolveWithObject: true })
  let count = 0
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 200 && data[i + 1] < 60 && data[i + 2] > 200) count++
  }
  return count
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

/** Drags the 8 directions; checks for void each time and whether the view changed. */
async function sweep(page: Page, label: string): Promise<{ moved: boolean }> {
  const baseline = await page.screenshot({ timeout: 120_000 })
  let moved = false
  for (const [direction, dx, dy] of DIRECTIONS) {
    for (let k = 0; k < 3; k++) await drag(page, dx, dy)
    const png = await page.screenshot({ timeout: 120_000 })
    expect(await voidPixels(png), `${label}, geser ke ${direction}`).toBe(0)
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

test("the camera never shows anything outside the map", async ({ page }) => {
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
    // Zoom out as far as it goes. At very wide sizes that view can be fixed
    // (nothing left to pan), so only the sizes that can pan must move.
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 1500)
    const out = await sweep(page, `${size}, zoomed out`)
    if (viewport.width !== 1680) {
      expect(out.moved, `${size}: zoomed out, no drag moved the camera`).toBe(
        true
      )
    }
    // Zoomed in part of the way every size can pan.
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -500)
    const inn = await sweep(page, `${size}, zoomed in`)
    expect(inn.moved, `${size}: zoomed in, no drag moved the camera`).toBe(true)
  }
})

test("a hotspot on the 3D scene opens the upload", async ({ page }) => {
  test.setTimeout(300_000)
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = sceneOf(page)
  await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
  await scene.getByRole("button", { name: "Meja Admin", exact: true }).click()
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
})
