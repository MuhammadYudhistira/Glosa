// Extracts the placeholder lobby scene from the design mockup into a standalone SVG.
// The final illustration (spec §7) will replace public/lobby/scene.svg.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const html = readFileSync("docs/superpowers/specs/mockups/lobi.html", "utf8")
const match = html.match(
  /<svg width="0" height="0" style="position:absolute">([\s\S]*?)<\/svg>\s*<div class="stage">/
)
if (!match) throw new Error("Scene definitions not found in the lobby mockup")

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">${match[1].replace(/&(?!(?:amp|lt|gt|quot|apos|#d+|#x[0-9a-f]+);)/gi, "&amp;")}<use href="#scene" width="1600" height="900"/></svg>\n`
mkdirSync("public/lobby", { recursive: true })
writeFileSync("public/lobby/scene.svg", svg)
console.log(`public/lobby/scene.svg (${(svg.length / 1024).toFixed(0)} KB)`)
