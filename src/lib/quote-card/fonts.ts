/** The app's own fonts (fontsource, loaded by styles.css), as canvas families. */
export const SERIF = '"Libre Caslon Text", Georgia, serif'
export const SANS = '"Atkinson Hyperlegible", system-ui, sans-serif'
export const HAND = '"Caveat Variable", cursive'
/** How long a card waits for its fonts before it is drawn anyway (spec kartu kutipan §7). */
export const FONT_WAIT_MS = 3000

/** A canvas font string, the size rounded to a tenth of a pixel. */
export function font(
  size: number,
  family: string,
  style: { bold?: boolean; italic?: boolean } = {}
): string {
  const px = Math.round(size * 10) / 10
  return `${style.italic ? "italic " : ""}${style.bold ? 700 : 400} ${px}px ${family}`
}

const CARD_FONTS = [
  font(40, SERIF),
  font(40, SERIF, { bold: true }),
  font(40, SANS),
  font(40, SANS, { bold: true }),
  font(40, SANS, { italic: true }),
  font(40, HAND),
]

/**
 * Resolves once the card's fonts are loaded, or after `waitMs`, so a canvas
 * never draws with a stand-in font it could have avoided. Never rejects.
 */
export async function cardFontsReady(waitMs = FONT_WAIT_MS): Promise<void> {
  const fonts = (document as Partial<Pick<Document, "fonts">>).fonts
  if (!fonts) return
  const loaded = Promise.all(
    CARD_FONTS.map((name) => fonts.load(name).catch(() => []))
  ).then(() => undefined)
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, waitMs)
  })
  await Promise.race([loaded, late])
  clearTimeout(timer)
}
