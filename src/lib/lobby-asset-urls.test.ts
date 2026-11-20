import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

// Files under public/ keep their names, and the service worker serves them
// cache-first by path, so a changed file would be shown stale after a deploy.
// Lobby images and models therefore live in src/assets/lobby and are imported
// through Vite, which gives them content-hashed URLs.
const ROOT = join(__dirname, "../..")
const SKIP_FILE = /\.test\.(ts|tsx)$|routeTree\.gen\.ts$/

function files(dir: string): Array<string> {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

describe("lobby asset URLs", () => {
  it("has no literal /lobby/ runtime URL in src", () => {
    const found: Array<string> = []
    for (const path of files(join(ROOT, "src"))) {
      if (!/\.(ts|tsx)$/.test(path) || SKIP_FILE.test(path)) continue
      readFileSync(path, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
          if (/["'`]\/lobby\//.test(line)) {
            const name = relative(ROOT, path).split("\\").join("/")
            found.push(`${name}:${index + 1}: ${line.trim()}`)
          }
        })
    }
    expect(found).toEqual([])
  })

  it("keeps nothing under public/lobby", () => {
    let leftovers: Array<string> = []
    try {
      leftovers = files(join(ROOT, "public/lobby"))
    } catch {
      // the folder is gone, which is what we want
    }
    expect(leftovers).toEqual([])
  })
})
