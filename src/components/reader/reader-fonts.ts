import atkinsonBold from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2?url"
import atkinsonItalic from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-italic.woff2?url"
import atkinsonRegular from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2?url"
import caslonBold from "@fontsource/libre-caslon-text/files/libre-caslon-text-latin-700-normal.woff2?url"
import caslonItalic from "@fontsource/libre-caslon-text/files/libre-caslon-text-latin-400-italic.woff2?url"
import caslonRegular from "@fontsource/libre-caslon-text/files/libre-caslon-text-latin-400-normal.woff2?url"
import dyslexicBold from "@fontsource/opendyslexic/files/opendyslexic-latin-700-normal.woff2?url"
import dyslexicItalic from "@fontsource/opendyslexic/files/opendyslexic-latin-400-italic.woff2?url"
import dyslexicRegular from "@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff2?url"
import type { FontSources } from "@/lib/reader-settings"

const absolute = (url: string) => new URL(url, window.location.href).href

/**
 * Font files for the book's iframe. Its documents are blob: URLs, which cannot
 * resolve relative paths, so every URL is made absolute (plan 1C, decision 11).
 */
export function readerFonts(): FontSources {
  return {
    serif: {
      family: "Glosa Serif",
      fallback: "Georgia, serif",
      regular: absolute(caslonRegular),
      bold: absolute(caslonBold),
      italic: absolute(caslonItalic),
    },
    sans: {
      family: "Glosa Sans",
      fallback: "system-ui, sans-serif",
      regular: absolute(atkinsonRegular),
      bold: absolute(atkinsonBold),
      italic: absolute(atkinsonItalic),
    },
    dyslexic: {
      family: "Glosa Dyslexic",
      fallback: "sans-serif",
      regular: absolute(dyslexicRegular),
      bold: absolute(dyslexicBold),
      italic: absolute(dyslexicItalic),
    },
  }
}
