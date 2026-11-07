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

export type RecapCardInput = {
  size: CardSize
  /** "Oktober 2026 di Glosa". */
  title: string
  /** The period is not over: "sejauh ini". */
  ongoing: boolean
  books: number
  /** Covers to draw, slots 0..coverCount-1; at most 6. */
  coverCount: number
  readTime: string
  days: number
  streak: number
  saved: number
  topWord: { headword: string; meetings: number } | null
  host: string
}

export const MAX_RECAP_COVERS = 6
const TITLE_SIZE: Record<CardSize, number> = { story: 84, square: 64 }
const COVER: Record<
  CardSize,
  { width: number; height: number; perRow: number; gap: number }
> = {
  story: { width: 260, height: 390, perRow: 3, gap: 54 },
  square: { width: 130, height: 195, perRow: 6, gap: 21.6 },
}
const ROW: Record<CardSize, number> = { story: 78, square: 60 }
const SECTION: Record<CardSize, number> = { story: 64, square: 36 }

/**
 * The recap card (spec 3E section 5.3): the period, the finished books with up
 * to six covers, then reading time, reading days, longest streak, saved words
 * and the word met most. Looked-up words are not on it.
 */
export function layoutRecapCard(
  input: RecapCardInput,
  measure: Measure
): CardLayout {
  const { width, height } = CARD_DIMENSIONS[input.size]
  const inner = width - 2 * PAD
  const frame: Array<CardItem> = []
  const footerTop = footer(
    { layout: "glosa", size: input.size, host: input.host },
    width,
    height,
    measure,
    frame
  )
  const items: Array<CardItem> = []
  let y = TOP

  const titleSize = TITLE_SIZE[input.size]
  const titleFont = font(titleSize, SERIF, { bold: true })
  const lines = wrapText(input.title, titleFont, inner, measure, 2)
  lines.forEach((line, i) => {
    y += titleSize * (i === 0 ? 0.9 : 1.2)
    items.push({
      kind: "text",
      text: line,
      x: PAD,
      y,
      font: titleFont,
      color: "text",
    })
  })
  if (input.ongoing) {
    const soft = font(36, SANS)
    y += 56
    items.push({
      kind: "text",
      text: "sejauh ini",
      x: PAD,
      y,
      font: soft,
      color: "soft",
    })
  }
  y += SECTION[input.size]
  const booksFont = font(46, SANS, { bold: true })
  y += 46
  items.push({
    kind: "text",
    text: fitText(`${input.books} buku selesai`, booksFont, inner, measure),
    x: PAD,
    y,
    font: booksFont,
    color: "accent",
  })

  const covers = Math.min(MAX_RECAP_COVERS, Math.max(0, input.coverCount))
  if (covers > 0) {
    const cover = COVER[input.size]
    y += 28
    for (let slot = 0; slot < covers; slot += 1) {
      const row = Math.floor(slot / cover.perRow)
      const column = slot % cover.perRow
      items.push({
        kind: "cover",
        x: PAD + column * (cover.width + cover.gap),
        y: y + row * (cover.height + 28),
        width: cover.width,
        height: cover.height,
        slot,
      })
    }
    y += Math.ceil(covers / cover.perRow) * (cover.height + 28) - 28
  }
  y += SECTION[input.size]

  const labelFont = font(34, SANS)
  const valueFont = font(40, SANS, { bold: true })
  const row = (label: string, value: string) => {
    y += ROW[input.size]
    items.push({
      kind: "text",
      text: label,
      x: PAD,
      y,
      font: labelFont,
      color: "soft",
    })
    const room = inner - measure(label, labelFont) - 32
    const shown = fitText(value, valueFont, room, measure)
    items.push({
      kind: "text",
      text: shown,
      x: width - PAD - measure(shown, valueFont),
      y,
      font: valueFont,
      color: "text",
    })
  }
  row("Waktu baca", input.readTime)
  row("Hari membaca", `${input.days} hari`)
  row("Streak terpanjang", `${input.streak} hari`)
  row("Kata disimpan", `${input.saved} kata`)
  if (input.topWord) {
    row(
      "Paling sering bertemu",
      `${input.topWord.headword} · ${input.topWord.meetings}×`
    )
  }

  return {
    width,
    height,
    fontSize: titleSize,
    fits: y <= footerTop - 24,
    items: [...frame, ...items],
    hits: [],
  }
}
