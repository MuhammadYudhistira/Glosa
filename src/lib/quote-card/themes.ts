/** The three themes (spec kartu kutipan §3.4): colours only, so any fits either layout. */
export const CARD_THEMES = ["sampul", "kertas", "malam"] as const
export type CardThemeId = (typeof CARD_THEMES)[number]
export type CardTheme = {
  label: string
  text: string
  soft: string
  accent: string
}

export const THEMES: Record<CardThemeId, CardTheme> = {
  sampul: {
    label: "Sampul",
    text: "#ffffff",
    soft: "rgba(255, 255, 255, 0.72)",
    accent: "#ffd666",
  },
  kertas: {
    label: "Kertas",
    text: "#2b2118",
    soft: "#7a6650",
    accent: "#b4532a",
  },
  malam: {
    label: "Malam",
    text: "#e8ecff",
    soft: "rgba(220, 226, 255, 0.7)",
    accent: "#9fb0ff",
  },
}
/** Sampul without a cover: Glosa's teal, dark enough for white text. */
export const DEFAULT_COVER_COLORS: ReadonlyArray<string> = [
  "#0b1f24",
  "#12423f",
  "#17675a",
]
export const PAPER = { background: "#f3ead6", grain: "rgba(120, 90, 50, 0.06)" }
export const NIGHT = { background: "#0a0f24", glow: "#26306a" }
/** The highlighter's ink: the accent, this opaque. */
export const MARK_ALPHA = 0.45

/** White text has a contrast of at least 4.5:1 on a colour this dark or darker. */
const MAX_LUMINANCE = 0.18
const DARKEN = 0.85
const BANDS = 3

const channel = (value: number) => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance of an sRGB colour. */
export function luminance([r, g, b]: readonly [
  number,
  number,
  number,
]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

const hex = (rgb: readonly [number, number, number]) =>
  `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`

/**
 * Sampul's gradient from a small RGBA image of the cover: the average colour
 * of its top, middle and bottom thirds, darkened until white text reads.
 */
export function coverPalette(
  pixels: ArrayLike<number>,
  width: number,
  height: number
): Array<string> | null {
  if (width < 1 || height < 1 || pixels.length < width * height * 4) return null
  const colors: Array<string> = []
  for (let band = 0; band < BANDS; band++) {
    const from = Math.floor((band * height) / BANDS)
    const to = Math.min(
      height,
      Math.max(from + 1, Math.floor(((band + 1) * height) / BANDS))
    )
    let r = 0
    let g = 0
    let b = 0
    let weight = 0
    for (let y = from; y < to; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const alpha = pixels[i + 3] / 255
        r += pixels[i] * alpha
        g += pixels[i + 1] * alpha
        b += pixels[i + 2] * alpha
        weight += alpha
      }
    }
    let rgb: [number, number, number] =
      weight > 0 ? [r / weight, g / weight, b / weight] : [0, 0, 0]
    for (let step = 0; step < 40 && luminance(rgb) > MAX_LUMINANCE; step++) {
      rgb = [rgb[0] * DARKEN, rgb[1] * DARKEN, rgb[2] * DARKEN]
    }
    colors.push(hex(rgb))
  }
  return colors
}

export type Star = { x: number; y: number; radius: number; alpha: number }

/** Malam's stars, the same for the same seed (the book's id), so a card never changes. */
export function starField(
  seed: string,
  width: number,
  height: number,
  count = 90
): Array<Star> {
  // FNV-1a for the seed, then mulberry32.
  let state = 2166136261
  for (const char of seed) {
    state = Math.imul(state ^ (char.codePointAt(0) ?? 0), 16777619)
  }
  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return Array.from({ length: count }, () => ({
    x: next() * width,
    y: next() * height,
    radius: 1 + next() * 2.2,
    alpha: 0.35 + next() * 0.65,
  }))
}
