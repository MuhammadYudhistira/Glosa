import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

// The reading room's wording (spec 3F §4, §7): no library vocabulary in UI text.
const BANNED =
  /perpustakaan|(?<![\w$/])lobi(?![\w$])|anggota|buku tamu|petugas/i

/** Lines that may keep a banned word, each with the reason. */
const ALLOWED: Array<{ file: RegExp; line: RegExp; reason: string }> = [
  {
    file: /src\/routes\/(_member\/(_lobi\.tsx|read\.\$bookId\.tsx|_lobi\/.*)|routeTree\.gen\.ts)$/,
    line: /_lobi|\blobi\.use|getRouteApi|LobiLayout|const lobi\b/,
    reason:
      "route ids and variable names; the URL and route files do not change (spec 3F §4.3)",
  },
]

const ROOT = join(__dirname, "../..")
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|\.output)(\/|$)/
const SKIP_FILE = /\.test\.(ts|tsx)$|routeTree\.gen\.ts$|database\.types\.ts$/

function files(dir: string): Array<string> {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (SKIP_DIR.test(relative(ROOT, path))) return []
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)

describe("reading-room wording", () => {
  it("keeps library vocabulary out of UI text", () => {
    const targets = [
      ...files(join(ROOT, "src")).filter(
        (path) => /\.(ts|tsx)$/.test(path) && !SKIP_FILE.test(path)
      ),
      ...files(join(ROOT, "supabase/templates")).filter((path) =>
        path.endsWith(".html")
      ),
    ]
    const found: Array<string> = []
    for (const path of targets) {
      const name = relative(ROOT, path).split("\\").join("/")
      readFileSync(path, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (isComment(line) || !BANNED.test(line)) return
          const allowed = ALLOWED.some(
            (rule) => rule.file.test(name) && rule.line.test(line)
          )
          if (!allowed) found.push(`${name}:${index + 1}: ${line.trim()}`)
        })
    }
    expect(found).toEqual([])
  })
})
