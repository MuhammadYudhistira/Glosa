import { existsSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")

// The service worker exists only in the production build (plan 1C, Task 11).
const PREVIEW_URL = "http://localhost:4173"

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // Dev-mode SSR + cloud round-trips are slow when 4 workers hit a cold dev server.
  expect: { timeout: 15_000 },
  globalTeardown: "./e2e/global-teardown.ts",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /offline\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore: /offline\.spec\.ts/,
    },
    {
      name: "offline",
      use: { ...devices["Desktop Chrome"], baseURL: PREVIEW_URL },
      testMatch: /offline\.spec\.ts/,
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
