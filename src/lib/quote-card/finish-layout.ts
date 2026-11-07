import { SANS, SERIF, font } from "./fonts"
import {
  CARD_DIMENSIONS,
  type CardItem,
  type CardLayout,
  type CardSize,
  type Measure,
  PAD,
  TOP,
  fitText,
  footer,
} from "./layout"
import { wrapText } from "./wrap"

export type FinishCardInput = {
  size: CardSize
  title: string
  author: string
  hasCover: boolean
  /** e.g. "6 jam 20 menit". */
  readTime: string
  /** 1-5, or null while the book has no review. */
  rating: number | null
  host: string
}

const COVER: Record<CardSize, { width: number; height: number }> = {
  story: { width: 400, height: 600 },
  square: { width: 200, height: 300 },
}
const TITLE_SIZE: Record<CardSize, number> = { story: 66, square: 50 }
const TITLE_LINES: Record<CardSize, number> = { story: 3, square: 2 }
const GAP: Record<CardSize, number> = { story: 56, square: 32 }

/**
 * The card of a finished book (spec 3E section 3.3): cover, "Selesai dibaca",
 * title, author, reading time and stars, centred, with the Glosa footer.
 * Nothing about the member's notes, difficulty, words or comprehension.
 */
export function layoutFinishCard(
  input: FinishCardInput,
  measure: Measure
): CardLayout {
  const { width, height } = CARD_DIMENSIONS[input.size]
  const gap = GAP[input.size]
  const middle = (text: string, fontName: string) =>
    (width - measure(text, fontName)) / 2
  const frame: Array<CardItem> = []
  const footerTop = footer(
    { layout: "glosa", size: input.size, host: input.host },
    width,
    height,
    measure,
    frame
  )
  const room = footerTop - gap - TOP

  const build = (y0: number) => {
    const items: Array<CardItem> = []
    let y = y0
    const text = (
      value: string,
      fontName: string,
      color: "text" | "soft" | "accent",
      baseline: number,
      x = middle(value, fontName)
    ) =>
      items.push({
        kind: "text",
        text: value,
        x,
        y: baseline,
        font: fontName,
        color,
      })

    if (input.hasCover) {
      const cover = COVER[input.size]
      items.push({
        kind: "cover",
        x: (width - cover.width) / 2,
        y,
        width: cover.width,
        height: cover.height,
        slot: 0,
      })
      y += cover.height + gap
    }
    const label = font(36, SANS, { bold: true })
    y += 36
    text("Selesai dibaca", label, "accent", y)
    y += gap * 0.9

    const titleSize = TITLE_SIZE[input.size]
    const titleFont = font(titleSize, SERIF, { bold: true })
    const lines = wrapText(
      input.title,
      titleFont,
      width - 2 * PAD,
      measure,
      TITLE_LINES[input.size]
    )
    lines.forEach((line, i) => {
      y += titleSize * (i === 0 ? 0.9 : 1.2)
      text(line, titleFont, "text", y)
    })
    if (input.author) {
      const authorFont = font(34, SANS)
      y += 56
      text(
        fitText(input.author, authorFont, width - 2 * PAD, measure),
        authorFont,
        "soft",
        y
      )
    }
    y += gap
    const caption = font(30, SANS)
    y += 30
    text("Waktu baca", caption, "soft", y)
    const timeFont = font(58, SERIF, { bold: true })
    y += 74
    text(
      fitText(input.readTime, timeFont, width - 2 * PAD, measure),
      timeFont,
      "text",
      y
    )
    if (input.rating !== null) {
      const starFont = font(64, SANS)
      const all = "★★★★★"
      const start = middle(all, starFont)
      const filled = "★".repeat(input.rating)
      y += 96
      text(filled, starFont, "accent", y, start)
      if (input.rating < 5) {
        text(
          "★".repeat(5 - input.rating),
          starFont,
          "soft",
          y,
          start + measure(filled, starFont)
        )
      }
    }
    return { items, bottom: y }
  }

  const measured = build(0)
  const used = measured.bottom
  const top = TOP + Math.max(0, (room - used) / 2)
  const placed = build(top)
  return {
    width,
    height,
    fontSize: TITLE_SIZE[input.size],
    fits: used <= room,
    items: [...frame, ...placed.items],
    hits: [],
  }
}
