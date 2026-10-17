import { existsSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")

// The service worker exists only in the production build (plan 1C, Task 11).
const PREVIEW_URL = "http://localhost:4173"

// The lobby draws its 3D scene only in the "lobby-3d" project; elsewhere it
// shows the still image, so every test that passes through /lobby stays fast
// (plan 1D, decision 7).
const NO_WEBGL = { args: ["--disable-3d-apis"] }
// Chromium without a GPU draws WebGL with SwiftShader, on the CPU.
const SWIFTSHADER = {
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
}
const OWN_PROJECT = /(offline|lobby-3d)\.spec\.ts/

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // Dev-mode SSR + cloud round-trips are slow when 4 workers hit a cold dev server.
  expect: { timeout: 15_000 },
  // Some steps wait up to 30 s (uploads, opening a book), so a whole test needs more than the 30 s default.
  timeout: 60_000,
  globalTeardown: "./e2e/global-teardown.ts",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], launchOptions: NO_WEBGL },
      testIgnore: OWN_PROJECT,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], launchOptions: NO_WEBGL },
      testIgnore: OWN_PROJECT,
    },
    {
      name: "offline",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: PREVIEW_URL,
        launchOptions: NO_WEBGL,
      },
      testMatch: /offline\.spec\.ts/,
    },
    {
      name: "lobby-3d",
      // SwiftShader is CPU-heavy: in parallel it would starve the other projects.
      dependencies: ["desktop", "mobile", "offline"],
      use: { ...devices["Desktop Chrome"], launchOptions: SWIFTSHADER },
      testMatch: /lobby-3d\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run build && npm run preview -- --port 4173 --strictPort",
      url: PREVIEW_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
})
