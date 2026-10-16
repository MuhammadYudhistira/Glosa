import { describe, expect, it } from "vitest"
import {
  DEFAULT_READER_SETTINGS,
  type FontSources,
  parseReaderSettings,
  readerCss,
  stepFontSize,
  stepLineHeight,
} from "./reader-settings"

const face = (family: string) => ({
  family,
  fallback: "serif",
  regular: `https://glosa.test/${family}-400.woff2`,
  bold: `https://glosa.test/${family}-700.woff2`,
  italic: `https://glosa.test/${family}-400i.woff2`,
})
const fonts: FontSources = {
  serif: face("Glosa Serif"),
  sans: face("Glosa Sans"),
  dyslexic: face("Glosa Dyslexic"),
}

describe("parseReaderSettings", () => {
  it("fills in defaults for an empty or missing value", () => {
    expect(parseReaderSettings({})).toEqual(DEFAULT_READER_SETTINGS)
    expect(parseReaderSettings(null)).toEqual(DEFAULT_READER_SETTINGS)
    expect(parseReaderSettings("dark")).toEqual(DEFAULT_READER_SETTINGS)
  })

  it("keeps every valid field and replaces the invalid ones", () => {
    expect(
      parseReaderSettings({
        theme: "dark",
        fontSize: 140,
        font: "comic",
        lineHeight: 9,
      })
    ).toEqual({ ...DEFAULT_READER_SETTINGS, theme: "dark", fontSize: 140 })
  })
})

describe("steppers", () => {
  it("moves the font size by 10 within 80–200", () => {
    expect(stepFontSize(100, 1)).toBe(110)
    expect(stepFontSize(200, 1)).toBe(200)
    expect(stepFontSize(80, -1)).toBe(80)
  })

  it("moves the line height by 0.1 within 1.2–2.0, without float noise", () => {
    expect(stepLineHeight(1.5, 1)).toBe(1.6)
    expect(stepLineHeight(2, 1)).toBe(2)
    expect(stepLineHeight(1.2, -1)).toBe(1.2)
    expect(stepLineHeight(1.3, -1)).toBe(1.2)
  })
})

describe("readerCss", () => {
  it("loads the chosen font and applies size, spacing and theme", () => {
    const css = readerCss(
      {
        ...DEFAULT_READER_SETTINGS,
        font: "dyslexic",
        fontSize: 130,
        lineHeight: 1.8,
        theme: "dark",
      },
      fonts
    )
    expect(css).toContain('font-family: "Glosa Dyslexic"')
    expect(css).toContain('url("https://glosa.test/Glosa Dyslexic-400.woff2")')
    expect(css).toContain("font-size: 130% !important")
    expect(css).toContain("line-height: 1.8 !important")
    expect(css).toContain("color-scheme: dark")
    expect(css).toContain("background: #0b1518 !important")
  })

  it("uses a light colour scheme for the sepia theme", () => {
    const css = readerCss(DEFAULT_READER_SETTINGS, fonts)
    expect(css).toContain("color-scheme: light")
    expect(css).toContain("background: #f6eedb !important")
    expect(css).toContain('font-family: "Glosa Serif"')
  })
})
