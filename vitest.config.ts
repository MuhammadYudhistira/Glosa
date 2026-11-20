import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [viteReact()],
  resolve: { tsconfigPaths: true },
  // Same as vite.config.ts: models are imported as asset URLs.
  assetsInclude: [/\.glb(\?.*)?$/],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    passWithNoTests: true,
  },
})
