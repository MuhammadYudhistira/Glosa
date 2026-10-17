// The 3D lobby on its own page, without the app (plan 1D, Task 5):
//   node scripts/lobby-harness.mjs serve         open it in a browser
//   node scripts/lobby-harness.mjs shot <file>   1440 × 900 screenshot (PNG)
//   node scripts/lobby-harness.mjs still         public/lobby/lobby-still*.{avif,webp}
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { chromium } from "@playwright/test"
import sharp from "sharp"
import { createServer } from "vite"

const PORT = 5199
const PAGE = `http://localhost:${PORT}/scripts/lobby-harness/index.html`
// Chromium without a GPU draws WebGL with SwiftShader, on the CPU.
const GL_ARGS = [
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
]
// Same size as STILL_SIZE in src/components/lobby/LobbyStill.tsx.
const STILL = { width: 2560, height: 1440 }
const STILL_MAX_BYTES = 250 * 1024

async function render(viewport) {
  const browser = await chromium.launch({ args: GL_ARGS })
  try {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    const failed = new Promise((resolve) => page.once("pageerror", resolve))
    await page.goto(`${PAGE}?mode=still`, { timeout: 120_000 })
    const ready = page
      .waitForSelector("body[data-ready]", { timeout: 300_000 })
      .then(() => null)
    ready.catch(() => {}) // no unhandled rejection once the browser closes
    const early = await Promise.race([ready, failed])
    if (early) throw new Error(early.message)
    if (errors.length > 0) throw new Error(errors.join("\n"))
    const books = await page.evaluate(() => document.body.dataset.books)
    console.log(`books on the shelves: ${books}`)
    return await page.screenshot({ timeout: 300_000 })
  } finally {
    await browser.close()
  }
}

async function shot(path) {
  mkdirSync(dirname(path), { recursive: true })
  await sharp(await render({ width: 1440, height: 900 })).toFile(path)
  console.log(`wrote ${path}`)
}

async function still() {
  const png = await render(STILL)
  for (const width of [STILL.width, STILL.width / 2]) {
    const name = `lobby-still${width === STILL.width ? "" : `-${width}`}`
    const image = sharp(png).resize({ width })
    const avif = await image
      .clone()
      .avif({ quality: 50, effort: 6 })
      .toFile(`public/lobby/${name}.avif`)
    const webp = await image
      .clone()
      .webp({ quality: 75 })
      .toFile(`public/lobby/${name}.webp`)
    console.log(
      `${name}: avif ${Math.round(avif.size / 1024)} kB, webp ${Math.round(webp.size / 1024)} kB`
    )
    if (avif.size > STILL_MAX_BYTES) {
      throw new Error(`${name}.avif is over 250 kB (spec 1D §10)`)
    }
  }
}

const [command, file] = process.argv.slice(2)
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: "warn",
  resolve: { alias: { "@": resolve("src") } },
  server: { port: PORT, strictPort: true },
})
await server.listen()

if (command === "serve") {
  console.log(`${PAGE}   (?mode=still or ?mode=test)`)
} else {
  try {
    if (command === "shot") await shot(file ?? "lobby.png")
    else if (command === "still") await still()
    else throw new Error(`Unknown command: ${command}`)
  } finally {
    await server.close()
  }
}
