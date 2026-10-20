import { defineConfig } from "vite"

// Builds the Storage sweep (spec 1E §6) into dist/sweep.mjs. Packages stay
// external: the image ships the app's production node_modules.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  // public/ already went to dist/client with the app build.
  publicDir: false,
  build: {
    ssr: "src/server/sweep/main.ts",
    outDir: "dist",
    emptyOutDir: false,
    target: "node24",
    sourcemap: "hidden",
    rolldownOptions: { output: { entryFileNames: "sweep.mjs" } },
  },
})
