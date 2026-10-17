// Writes dist/client/sw.js from pwa/sw.template.js after `vite build`, with the
// files to precache: the app shell, every built asset (scripts, styles, woff2
// fonts) and the public icons and lobby images.
import { createHash } from "node:crypto"
import { readFile, readdir, stat, writeFile } from "node:fs/promises"
import { join, relative, sep } from "node:path"

const CLIENT_DIR = "dist/client"
// Source maps, woff (every browser here takes woff2), build metadata in dot
// folders (not served), the worker itself and crawler files.
const SKIP = [
  /\.map$/,
  /\.woff$/,
  /(^|\/)\./,
  /^sw\.js$/,
  /^robots\.txt$/,
  /\.xml$/,
]

async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? filesIn(path) : [path]
    })
  )
  return nested.flat()
}

const files = (await filesIn(CLIENT_DIR))
  .map((path) => relative(CLIENT_DIR, path).split(sep).join("/"))
  .filter((path) => !SKIP.some((pattern) => pattern.test(path)))
  .sort()
if (!files.includes("_shell.html")) {
  throw new Error(
    "dist/client/_shell.html is missing: is the SPA shell enabled in vite.config.ts?"
  )
}

const hash = createHash("sha256")
let bytes = 0
for (const file of files) {
  const path = join(CLIENT_DIR, file)
  hash.update(file).update(await readFile(path))
  bytes += (await stat(path)).size
}
const version = hash.digest("hex").slice(0, 12)

const template = await readFile("pwa/sw.template.js", "utf8")
const source = template
  .replace('"__GLOSA_VERSION__"', JSON.stringify(version))
  .replace(
    "__GLOSA_PRECACHE__",
    JSON.stringify(files.map((file) => `/${file}`))
  )
if (source.includes("__GLOSA_")) {
  throw new Error("pwa/sw.template.js still has a placeholder")
}
await writeFile(join(CLIENT_DIR, "sw.js"), source)
console.log(
  `sw.js: ${files.length} files precached (${(bytes / 1024 / 1024).toFixed(1)} MB), version ${version}`
)
