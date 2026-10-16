import { beforeEach, describe, expect, it } from "vitest"
import {
  cacheReaderSettings,
  cachedReaderSettings,
  initialReaderSettings,
} from "./reader-settings-cache"
import { DEFAULT_READER_SETTINGS } from "./reader-settings"

const dark = { ...DEFAULT_READER_SETTINGS, theme: "dark" as const }
const large = { ...DEFAULT_READER_SETTINGS, fontSize: 150 }

beforeEach(() => {
  localStorage.clear()
})

describe("initialReaderSettings", () => {
  it("prefers changes this device has not saved yet", () => {
    cacheReaderSettings(dark, true)
    expect(initialReaderSettings(large)).toEqual(dark)
  })

  it("otherwise follows the account and remembers it", () => {
    cacheReaderSettings(dark, false)
    expect(initialReaderSettings(large)).toEqual(large)
    expect(cachedReaderSettings()).toEqual({ settings: large, dirty: false })
  })

  it("uses this device's copy when the server is out of reach", () => {
    cacheReaderSettings(dark, false)
    expect(initialReaderSettings(null)).toEqual(dark)
  })

  it("falls back to the defaults, and repairs broken copies", () => {
    expect(initialReaderSettings(null)).toEqual(DEFAULT_READER_SETTINGS)
    localStorage.setItem(
      "glosa:reader-settings",
      JSON.stringify({ settings: { theme: "neon" }, dirty: true })
    )
    expect(initialReaderSettings(null)).toEqual(DEFAULT_READER_SETTINGS)
  })
})
