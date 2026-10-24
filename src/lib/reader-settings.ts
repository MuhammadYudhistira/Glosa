import { z } from "zod"
import { ACTIVE_HIGHLIGHT, SAVED_HIGHLIGHT } from "@/lib/words/saved-marks"

export const READER_FONTS = ["serif", "sans", "dyslexic"] as const
export const READER_THEMES = ["light", "sepia", "dark"] as const
export const READER_MARGINS = ["narrow", "normal", "wide"] as const
export const READER_FLOWS = ["paginated", "scrolled"] as const

export type ReaderFont = (typeof READER_FONTS)[number]
export type ReaderTheme = (typeof READER_THEMES)[number]
export type ReaderMargin = (typeof READER_MARGINS)[number]
export type ReaderFlow = (typeof READER_FLOWS)[number]

export const FONT_SIZE = { min: 80, max: 200, step: 10 } as const
export const LINE_HEIGHT = { min: 1.2, max: 2, step: 0.1 } as const

export type ReaderSettings = {
  font: ReaderFont
  /** Percent of the book's own size. */
  fontSize: number
  lineHeight: number
  margin: ReaderMargin
  theme: ReaderTheme
  flow: ReaderFlow
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  font: "serif",
  fontSize: 100,
  lineHeight: 1.5,
  margin: "normal",
  theme: "sepia",
  flow: "paginated",
}

export const ReaderSettingsSchema = z.object({
  font: z.enum(READER_FONTS),
  fontSize: z
    .number()
    .int()
    .min(FONT_SIZE.min)
    .max(FONT_SIZE.max)
    .refine((value) => value % FONT_SIZE.step === 0),
  lineHeight: z
    .number()
    .min(LINE_HEIGHT.min)
    .max(LINE_HEIGHT.max)
    .refine((value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9),
  margin: z.enum(READER_MARGINS),
  theme: z.enum(READER_THEMES),
  flow: z.enum(READER_FLOWS),
})

const SETTING_KEYS = Object.keys(DEFAULT_READER_SETTINGS) as Array<
  keyof ReaderSettings
>

/** Stored settings may be partial, outdated or `{}`: keep each valid field, default the rest. */
export function parseReaderSettings(value: unknown): ReaderSettings {
  const source =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {}
  const result: ReaderSettings = { ...DEFAULT_READER_SETTINGS }
  for (const key of SETTING_KEYS) {
    const parsed = ReaderSettingsSchema.shape[key].safeParse(source[key])
    if (parsed.success) Object.assign(result, { [key]: parsed.data })
  }
  return result
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function stepFontSize(current: number, direction: 1 | -1): number {
  return clamp(
    current + direction * FONT_SIZE.step,
    FONT_SIZE.min,
    FONT_SIZE.max
  )
}

export function stepLineHeight(current: number, direction: 1 | -1): number {
  const next = Math.round((current + direction * LINE_HEIGHT.step) * 10) / 10
  return clamp(next, LINE_HEIGHT.min, LINE_HEIGHT.max)
}

export const FONT_LABELS: Record<ReaderFont, string> = {
  serif: "Serif",
  sans: "Sans",
  dyslexic: "Ramah disleksia",
}
export const THEME_LABELS: Record<ReaderTheme, string> = {
  light: "Terang",
  sepia: "Sepia",
  dark: "Gelap",
}
export const MARGIN_LABELS: Record<ReaderMargin, string> = {
  narrow: "Sempit",
  normal: "Sedang",
  wide: "Lebar",
}
export const FLOW_LABELS: Record<ReaderFlow, string> = {
  paginated: "Halaman",
  scrolled: "Gulir",
}

/** `mark` lights the tapped word while its meaning shows (spec 2 §6.2). */
export const THEME_COLORS: Record<
  ReaderTheme,
  { background: string; text: string; link: string; mark: string }
> = {
  light: {
    background: "#ffffff",
    text: "#1c1b19",
    link: "#1d4ed8",
    mark: "#fde68a",
  },
  sepia: {
    background: "#f6eedb",
    text: "#2b2118",
    link: "#7a2e2e",
    mark: "#ecd59a",
  },
  dark: {
    background: "#0b1518",
    text: "#d8e4e1",
    link: "#2fe0b8",
    mark: "#2a5b52",
  },
}

/** foliate's paginator `gap`: the space beside the text, as a share of the page width. */
export const MARGIN_GAP: Record<ReaderMargin, string> = {
  narrow: "4%",
  normal: "7%",
  wide: "12%",
}

export type FontFace = {
  family: string
  fallback: string
  regular: string
  bold: string
  italic: string
}
export type FontSources = Record<ReaderFont, FontFace>

/**
 * The stylesheet foliate puts into every section of the book (spec §9).
 * The font sources are trusted, built in the app (`readerFonts`), and never come from settings.
 */
export function readerCss(
  settings: ReaderSettings,
  fonts: FontSources
): string {
  const colors = THEME_COLORS[settings.theme]
  const face = fonts[settings.font]
  const fontFace = (url: string, weight: number, style: string) =>
    `@font-face { font-family: "${face.family}"; src: url("${url}") format("woff2"); font-weight: ${weight}; font-style: ${style}; }`
  return [
    fontFace(face.regular, 400, "normal"),
    fontFace(face.bold, 700, "normal"),
    fontFace(face.italic, 400, "italic"),
    `html { color-scheme: ${settings.theme === "dark" ? "dark" : "light"}; background: ${colors.background} !important; color: ${colors.text} !important; font-size: ${settings.fontSize}% !important; }`,
    `body { background: transparent !important; color: inherit !important; font-family: "${face.family}", ${face.fallback} !important; }`,
    "body *:not(code, kbd, pre, samp, tt, code *, pre *) { font-family: inherit !important; }",
    "body *:not(img, svg, video, canvas) { color: inherit !important; background-color: transparent !important; }",
    `p, li, blockquote, dd, dt, td, th { line-height: ${settings.lineHeight} !important; }`,
    `a:link, a:visited { color: ${colors.link} !important; }`,
    "pre { white-space: pre-wrap !important; }",
    `::highlight(${SAVED_HIGHLIGHT}) { text-decoration: underline dotted 2px ${colors.link}; }`,
    `::highlight(${ACTIVE_HIGHLIGHT}) { background-color: ${colors.mark}; }`,
  ].join("\n")
}
