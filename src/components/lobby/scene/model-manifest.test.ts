import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { MODEL_KEYS, MODELS } from "./model-manifest"

const dir = resolve(__dirname, "../../../../public/lobby/models")
const entries = MODEL_KEYS.map((key) => [key, MODELS[key]] as const)

describe("model manifest", () => {
  it("has an entry for every key", () => {
    expect(Object.keys(MODELS).sort()).toEqual([...MODEL_KEYS].sort())
  })

  it("has a file on disk for every model that has one", () => {
    for (const [key, entry] of entries) {
      if (entry.file === null) continue
      expect(entry.file, key).toMatch(/^[a-z0-9-]+\.glb$/)
      expect(
        existsSync(resolve(dir, entry.file)),
        `${key}: ${entry.file}`
      ).toBe(true)
    }
  })

  it("marks models without a file as made in code", () => {
    for (const [key, entry] of entries) {
      expect(entry.file === null, key).toBe(entry.source === "code")
    }
  })

  it("stays within 3 MB in all, once per file", () => {
    const files = new Set(entries.flatMap(([, e]) => (e.file ? [e.file] : [])))
    const bytes = [...files].reduce(
      (sum, f) => sum + statSync(resolve(dir, f)).size,
      0
    )
    expect(bytes).toBeLessThanOrEqual(3 * 1024 * 1024)
  })

  it("credits every model file in LICENSE.md", () => {
    const text = readFileSync(resolve(dir, "LICENSE.md"), "utf8")
    expect(text).toContain("CC0")
    for (const [, entry] of entries) {
      if (entry.file) expect(text, entry.file).toContain(entry.file)
    }
  })
})
