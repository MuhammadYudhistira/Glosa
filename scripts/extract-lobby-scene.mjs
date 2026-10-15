// Extracts the placeholder lobby scene from the design mockup into standalone SVGs.
// The final illustration (spec §7) will replace public/lobby/scene.svg.
//
// Output (same viewBox so they overlay exactly):
//   public/lobby/scene.svg         the scene without zone label badges
//   public/lobby/scene-labels.svg  only the zone label badges (<g class="hs">)
// The labels live in their own file so the UI can fade them out when the camera
// zooms in (CSS cannot reach inside an <img> SVG).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const html = readFileSync("docs/superpowers/specs/mockups/lobi.html", "utf8")
const match = html.match(
  /<svg width="0" height="0" style="position:absolute">([\s\S]*?)<\/svg>\s*<div class="stage">/
)
if (!match) throw new Error("Scene definitions not found in the lobby mockup")

const escapeAmp = (s) =>
  s.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, "&amp;")

// Splits `<g class="hs" ...>...</g>` groups out of the markup, matching nested
// <g> tags by depth counting.
function splitLabelGroups(markup) {
  const open = '<g class="hs"'
  const tag = /<g[\s>]|<\/g>/g
  let rest = ""
  const groups = []
  let pos = 0
  for (;;) {
    const start = markup.indexOf(open, pos)
    if (start === -1) break
    rest += markup.slice(pos, start)
    tag.lastIndex = start
    let depth = 0
    let end = -1
    let m
    while ((m = tag.exec(markup))) {
      if (m[0] === "</g>") depth--
      else depth++
      if (depth === 0) {
        end = m.index + m[0].length
        break
      }
    }
    if (end === -1) throw new Error("Unbalanced label group")
    groups.push(markup.slice(start, end))
    pos = end
  }
  rest += markup.slice(pos)
  return { rest, groups }
}

const { rest, groups } = splitLabelGroups(match[1])
const expected = (match[1].match(/class="hs"/g) ?? []).length
if (groups.length !== expected || groups.length === 0) {
  throw new Error(
    `Label group mismatch: extracted ${groups.length}, source ${expected}`
  )
}

const head =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">'
const scene = `${head}${escapeAmp(rest)}<use href="#scene" width="1600" height="900"/></svg>\n`
const labels = `${head}${escapeAmp(groups.join("\n"))}</svg>\n`

mkdirSync("public/lobby", { recursive: true })
writeFileSync("public/lobby/scene.svg", scene)
writeFileSync("public/lobby/scene-labels.svg", labels)
console.log(`public/lobby/scene.svg (${(scene.length / 1024).toFixed(0)} KB)`)
console.log(
  `public/lobby/scene-labels.svg (${(labels.length / 1024).toFixed(1)} KB, ${groups.length} labels)`
)
