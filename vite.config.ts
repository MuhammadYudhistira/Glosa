import { type Plugin, defineConfig, loadEnv } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const FOLIATE_UNUSED =
  /[\\/]foliate-js[\\/](?:pdf|mobi|fb2|comic-book|tts|vendor[\\/](?:zip|fflate))\.js$/
const FOLIATE_UNUSED_ID = "\0glosa-foliate-unused"

/**
 * Glosa opens EPUBs only, through its own zip loader (plan 1C, decision 10).
 * foliate's view.js still imports its PDF, MOBI, FB2, comic and TTS modules
 * lazily; an empty module in their place keeps megabytes (pdf.js) out of the
 * build and the offline cache.
 */
function foliateEpubOnly(): Plugin {
  return {
    name: "glosa:foliate-epub-only",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer || !/[\\/]foliate-js[\\/]/.test(importer)) return null
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      })
      return resolved && FOLIATE_UNUSED.test(resolved.id)
        ? FOLIATE_UNUSED_ID
        : null
    },
    load(id) {
      return id === FOLIATE_UNUSED_ID ? "export {}" : null
    },
  }
}

export default defineConfig(({ command, mode }) => {
  // Make .env / .env.local values visible to server code through process.env.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""))
  return {
    resolve: { tsconfigPaths: true },
    optimizeDeps: { exclude: ["foliate-js"] },
    // Maps for Sentry only: no sourceMappingURL in the files; the image build
    // uploads them, then deletes them (spec 1E §5).
    build: { sourcemap: "hidden" },
    plugins: [
      foliateEpubOnly(),
      devtools({ consolePiping: { enabled: false } }),
      tailwindcss(),
      // Also prerender the app shell (dist/client/_shell.html): the service
      // worker serves it for navigations while offline (plan 1C, decision 4).
      // Build only: with it on, the dev server stops rendering pages on the
      // server, unlike production.
      tanstackStart({ spa: { enabled: command === "build" } }),
      viteReact(),
    ],
  }
})
