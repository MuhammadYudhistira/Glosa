import atkinsonBold from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2?url"
import atkinsonItalic from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-italic.woff2?url"
import atkinsonRegular from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2?url"
import caslonBold from "@fontsource/libre-caslon-text/files/libre-caslon-text-latin-700-normal.woff2?url"
import caslonItalic from "@fontsource/libre-caslon-text/files/libre-caslon-text-latin-400-italic.woff2?url"
import caslonRegular from "@fontsource/libre-caslon-text/files/libre-caslon-text-latin-400-normal.woff2?url"
import dyslexicBold from "@fontsource/opendyslexic/files/opendyslexic-latin-700-normal.woff2?url"
import dyslexicItalic from "@fontsource/opendyslexic/files/opendyslexic-latin-400-italic.woff2?url"
import dyslexicRegular from "@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff2?url"
import { type FontSources, READER_FONTS } from "@/lib/reader-settings"

const FONT_FILES: FontSources = {
  serif: {
    family: "Glosa Serif",
    fallback: "Georgia, serif",
    regular: caslonRegular,
    bold: caslonBold,
    italic: caslonItalic,
  },
  sans: {
    family: "Glosa Sans",
    fallback: "system-ui, sans-serif",
    regular: atkinsonRegular,
    bold: atkinsonBold,
    italic: atkinsonItalic,
  },
  dyslexic: {
    family: "Glosa Dyslexic",
    fallback: "sans-serif",
    regular: dyslexicRegular,
    bold: dyslexicBold,
    italic: dyslexicItalic,
  },
}

type FontUrl = { url: string; fetched: boolean }

/**
 * One font file for the book's iframe. The page fetches it, so offline it comes
 * from the service worker's precache: the book's documents are blob: URLs,
 * which the service worker does not serve (spec 1D §8). A file that cannot be
 * fetched keeps an absolute URL (plan 1C, decision 11).
 */
async function fontUrl(url: string): Promise<FontUrl> {
  try {
    const response = await fetch(url)
    if (response.ok) {
      return { url: URL.createObjectURL(await response.blob()), fetched: true }
    }
  } catch {
    // Offline and not cached yet: the absolute URL below may still work later.
  }
  return { url: new URL(url, window.location.href).href, fetched: false }
}

let loaded: FontSources | null = null

/** Font files for the book's iframe, fetched once per session when all of them arrive. */
export async function loadReaderFonts(): Promise<FontSources> {
  if (loaded) return loaded
  const faces = await Promise.all(
    READER_FONTS.map(async (font) => {
      const face = FONT_FILES[font]
      const [regular, bold, italic] = await Promise.all(
        [face.regular, face.bold, face.italic].map(fontUrl)
      )
      return {
        font,
        face: {
          ...face,
          regular: regular.url,
          bold: bold.url,
          italic: italic.url,
        },
        fetched: regular.fetched && bold.fetched && italic.fetched,
      }
    })
  )
  const fonts = Object.fromEntries(
    faces.map(({ font, face }) => [font, face])
  ) as FontSources
  if (faces.every(({ fetched }) => fetched)) loaded = fonts
  return fonts
}
