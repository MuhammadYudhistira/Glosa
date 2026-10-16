import { expect, test } from "@playwright/test"
import { hydrated } from "./helpers/members"

test("the camera zoom runs after a click and a second click skips it", async ({
  page,
}) => {
  await page.goto("/")
  await hydrated(page)
  const canvas = page.locator(".scene-canvas")
  await expect(canvas).toBeVisible()
  await canvas.evaluate((el) => {
    el.addEventListener("transitionrun", () => {
      el.setAttribute("data-zoom-ran", "true")
    })
  })
  await page.getByRole("link", { name: "Masuk" }).click()
  await expect(page).toHaveURL(/\/login/)
  // The click that started the navigation must not have skipped the zoom.
  await expect(canvas).toHaveAttribute("data-zoom-ran", "true")
  await expect
    .poll(() => canvas.evaluate((el) => el.getAnimations().length), {
      timeout: 3_000,
    })
    .toBeGreaterThan(0)
  // A further click while it runs finishes it.
  await page.mouse.click(5, 5)
  await expect
    .poll(
      () =>
        canvas.evaluate(
          (el) =>
            el.getAnimations().filter((a) => a.playState === "running").length
        ),
      { timeout: 3_000 }
    )
    .toBe(0)
})
