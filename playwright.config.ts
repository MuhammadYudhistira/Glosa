import { existsSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")

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
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
