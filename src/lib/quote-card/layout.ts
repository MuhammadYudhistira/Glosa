import { SITE_NAME, SITE_TAGLINE } from "@/lib/site"
import { HAND, SANS, SERIF, font } from "./fonts"
import type { QuoteToken } from "./quote-text"

/** The two layouts (spec kartu kutipan §3.2). */
export const CARD_LAYOUTS = ["kutipan", "glosa"] as const
export type CardLayoutKind = (typeof CARD_LAYOUTS)[number]
/** Story 9:16 and Persegi 1:1 (spec kartu kutipan, decision 5). */
export const CARD_SIZES = ["story", "square"] as const
export type CardSize = (typeof CARD_SIZES)[number]
export const CARD_DIMENSIONS: Record<
  CardSize,
  { width: number; height: number }
> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
}

/** A text's width in a canvas font; the dialog passes the canvas's own. */
export type Measure = (text: string, font: string) => number
/** A theme colour: themes.ts says which. */
export type CardColor = "text" | "soft" | "accent"
/** A turn of `angle` radians around (x, y). */
export type CardTurn = { angle: number; x: number; y: number }
/** Something to draw, in the card's own pixels; y of a text is its baseline. */
export type CardItem =
  | {
      kind: "text"
      text: string
      x: number
      y: number
      font: string
      color: CardColor
      turn?: CardTurn
    }
  | {
      kind: "mark"
      x: number
      y: number
      width: number
      height: number
      turn: CardTurn
    }
  | { kind: "rule"; x: number; y: number; width: number; height: number }
  | { kind: "cover"; x: number; y: number; width: number; height: number }
/** Where a quote token is, for a tap on the preview. */
export type CardHit = {
  token: number
  x: number
  y: number
  width: number
  height: number
}
/** The highlighted word as the card writes it. */
export type CardWord = { label: string; pos: string; meanings: string }
export type CardInput = {
  layout: CardLayoutKind
  size: CardSize
  tokens: ReadonlyArray<QuoteToken>
  /** The highlighted token; ignored without a word. */
  highlight: number | null
  word: CardWord | null
  title: string
  author: string
  hasCover: boolean
  /** The site's address, e.g. glos-a.tech. */
  host: string
}
export type CardLayout = {
  width: number
  height: number
  /** The quote's font size. */
  fontSize: number
  /** False when even the smallest size overflows the room for the quote. */
  fits: boolean
  /** In drawing order. */
  items: Array<CardItem>
  hits: Array<CardHit>
}

const PAD = 96
const TOP = 110
const BOTTOM = 90
const COVER_WIDTH = 64
const COVER_HEIGHT = 94
const COVER_GAP = 28
const QUOTE_SIZES: Record<
  CardLayoutKind,
  Record<CardSize, { max: number; min: number }>
> = {
  kutipan: { story: { max: 76, min: 40 }, square: { max: 60, min: 32 } },
  glosa: { story: { max: 68, min: 36 }, square: { max: 54, min: 30 } },
}
const SIZE_STEP = 2
/** Room between the header and the quote, and between the quote and the footer. */
const GAPS: Record<CardSize, { head: number; foot: number }> = {
  story: { head: 110, foot: 80 },
  square: { head: 64, foot: 48 },
}
const RULE_GAP = 56
const RULE_WIDTH = 84
const RULE_HEIGHT = 6
const LABEL_SIZE = 54
const POS_SIZE = 30
const MEANING_SIZES = [56, 44] as const
const GLOSS_TURN = -0.05
const MARK_TURN = -0.02

type Piece = {
  token: number
  text: string
  font: string
  width: number
  color: CardColor
}
type Metrics = { lineHeight: number; first: number; tail: number }
type SetQuote = {
  size: number
  pieces: Array<Piece>
  lines: Array<Array<number>>
  space: number
  metrics: Metrics
  height: number
}

/** The text cut to fit `maxWidth`, with an ellipsis when cut. */
function fitText(
  text: string,
  fontName: string,
  maxWidth: number,
  measure: Measure
): string {
  if (measure(text, fontName) <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && measure(`${cut}…`, fontName) > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut.trimEnd()}…`
}

/**
 * Line breaks that keep lines about as long as each other, like CSS
 * `text-wrap: balance`: the least sum of squared slack. A piece wider than
 * the line sits alone. Each line lists its piece indexes.
 */
export function breakLines(
  widths: ReadonlyArray<number>,
  space: number,
  maxWidth: number
): Array<Array<number>> {
  const count = widths.length
  const cost = Array<number>(count + 1).fill(Number.POSITIVE_INFINITY)
  const from = Array<number>(count + 1).fill(0)
  cost[0] = 0
  for (let end = 1; end <= count; end++) {
    let width = -space
    for (let start = end - 1; start >= 0; start--) {
      width += widths[start] + space
      if (width > maxWidth && start < end - 1) break
      const slack = maxWidth - width
      const total = cost[start] + slack * slack
      if (total < cost[end]) {
        cost[end] = total
        from[end] = start
      }
    }
  }
  const lines: Array<Array<number>> = []
  for (let end = count; end > 0; end = from[end]) {
    lines.unshift(
      Array.from({ length: end - from[end] }, (_, i) => from[end] + i)
    )
  }
  return lines
}

function litToken(input: CardInput): number | null {
  return input.word && input.highlight !== null ? input.highlight : null
}

function quotePieces(
  input: CardInput,
  size: number,
  maxWidth: number,
  measure: Measure
): Array<Piece> {
  const last = input.tokens.length - 1
  const lit = input.layout === "kutipan" ? litToken(input) : null
  return input.tokens.map((token, i) => {
    const text = `${i === 0 ? "“" : ""}${token.text}${i === last ? "”" : ""}`
    const bold = i === lit
    let pieceFont = font(size, SERIF, { bold })
    let width = measure(text, pieceFont)
    // A word wider than the line is made smaller, never cut (spec §3.3).
    if (width > maxWidth) {
      pieceFont = font((size * maxWidth) / width, SERIF, { bold })
      width = measure(text, pieceFont)
    }
    return {
      token: i,
      text,
      font: pieceFont,
      width,
      color: bold ? "accent" : "text",
    }
  })
}

/** Glosa with a word leaves room above each line for the handwriting. */
function metricsOf(
  layout: CardLayoutKind,
  size: number,
  gloss: boolean
): Metrics {
  if (gloss)
    return { lineHeight: size * 2.1, first: size * 1.75, tail: size * 0.35 }
  const lineHeight = size * (layout === "glosa" ? 1.3 : 1.25)
  return { lineHeight, first: size * 0.95, tail: size * 0.3 }
}

function setQuote(
  input: CardInput,
  size: number,
  maxWidth: number,
  gloss: boolean,
  measure: Measure
): SetQuote {
  const pieces = quotePieces(input, size, maxWidth, measure)
  const space = measure(" ", font(size, SERIF))
  const lines = breakLines(
    pieces.map((piece) => piece.width),
    space,
    maxWidth
  )
  const metrics = metricsOf(input.layout, size, gloss)
  const height =
    lines.length === 0
      ? 0
      : metrics.first + (lines.length - 1) * metrics.lineHeight + metrics.tail
  return { size, pieces, lines, space, metrics, height }
}

/** The largest size whose quote, and word below it, fit the room (spec §3.3). */
function fitQuote(
  input: CardInput,
  maxWidth: number,
  room: number,
  below: number,
  gloss: boolean,
  measure: Measure
): SetQuote {
  const { max, min } = QUOTE_SIZES[input.layout][input.size]
  for (let size = max; ; size -= SIZE_STEP) {
    const quote = setQuote(input, size, maxWidth, gloss, measure)
    if (quote.height + below <= room || size - SIZE_STEP < min) return quote
  }
}

function meaningLines(
  meanings: string,
  size: number,
  maxWidth: number,
  measure: Measure
): Array<string> {
  const words = meanings.split(" ")
  const handFont = font(size, HAND)
  return breakLines(
    words.map((word) => measure(word, handFont)),
    measure(" ", handFont),
    maxWidth
  ).map((line) => line.map((i) => words[i]).join(" "))
}

/** Kutipan's word under the quote: a rule, the word and its part of speech, the meanings. */
function wordBlock(
  word: CardWord,
  maxWidth: number,
  measure: Measure
): { height: number; items: (top: number) => Array<CardItem> } {
  const labelFont = font(LABEL_SIZE, SERIF, { bold: true })
  const label = fitText(word.label, labelFont, maxWidth * 0.6, measure)
  const labelWidth = measure(label, labelFont)
  const posFont = font(POS_SIZE, SANS, { italic: true })
  const pos = fitText(word.pos, posFont, maxWidth - labelWidth - 18, measure)
  let size: number = MEANING_SIZES[0]
  let lines = meaningLines(word.meanings, size, maxWidth, measure)
  if (lines.length > 2) {
    size = MEANING_SIZES[1]
    lines = meaningLines(word.meanings, size, maxWidth, measure)
  }
  if (lines.length > 2) {
    lines = [
      lines[0],
      fitText(lines.slice(1).join(" "), font(size, HAND), maxWidth, measure),
    ]
  }
  const labelBase = RULE_GAP + RULE_HEIGHT + 64
  const bases = lines.map((_, i) => labelBase + 16 + size + i * size * 1.1)
  const height = (bases.at(-1) ?? labelBase) + size * 0.3
  return {
    height,
    items: (top) => [
      {
        kind: "rule",
        x: PAD,
        y: top + RULE_GAP,
        width: RULE_WIDTH,
        height: RULE_HEIGHT,
      },
      {
        kind: "text",
        text: label,
        x: PAD,
        y: top + labelBase,
        font: labelFont,
        color: "text",
      },
      {
        kind: "text",
        text: pos,
        x: PAD + labelWidth + 18,
        y: top + labelBase,
        font: posFont,
        color: "soft",
      },
      ...lines.map((line, i): CardItem => ({
        kind: "text",
        text: line,
        x: PAD,
        y: top + bases[i],
        font: font(size, HAND),
        color: "accent",
      })),
    ],
  }
}

/** Glosa's handwriting above the word, moved in from the card's edges. */
function glossItems(
  word: CardWord,
  x: number,
  baseline: number,
  size: number,
  width: number,
  measure: Measure
): Array<CardItem> {
  const room = width - 2 * PAD
  const gap = size * 0.15
  const posText = `(${word.pos})`
  let scale = 1
  const widths = () => {
    const meaningFont = font(size * 0.62 * scale, HAND)
    const posFont = font(size * 0.44 * scale, HAND)
    const meaningWidth = measure(word.meanings, meaningFont)
    const total = meaningWidth + gap * scale + measure(posText, posFont)
    return { meaningFont, posFont, meaningWidth, total }
  }
  let sized = widths()
  if (sized.total > room) {
    scale = room / sized.total
    sized = widths()
  }
  const left = Math.max(
    PAD,
    Math.min(x - size * 0.1, width - PAD - sized.total)
  )
  const y = baseline - size * 1.05
  const turn = { angle: GLOSS_TURN, x: left, y }
  return [
    {
      kind: "text",
      text: word.meanings,
      x: left,
      y,
      font: sized.meaningFont,
      color: "accent",
      turn,
    },
    {
      kind: "text",
      text: posText,
      x: left + sized.meaningWidth + gap * scale,
      y,
      font: sized.posFont,
      color: "accent",
      turn,
    },
  ]
}

/** Cover, title and author; returns the header's bottom. */
function header(
  input: CardInput,
  width: number,
  measure: Measure,
  items: Array<CardItem>
): number {
  let textX = PAD
  if (input.hasCover) {
    items.push({
      kind: "cover",
      x: PAD,
      y: TOP,
      width: COVER_WIDTH,
      height: COVER_HEIGHT,
    })
    textX = PAD + COVER_WIDTH + COVER_GAP
  }
  const room = width - PAD - textX
  const titleFont = font(36, SANS, { bold: true })
  items.push({
    kind: "text",
    text: fitText(input.title, titleFont, room, measure),
    x: textX,
    y: TOP + 40,
    font: titleFont,
    color: "text",
  })
  if (input.author) {
    const authorFont = font(30, SANS)
    items.push({
      kind: "text",
      text: fitText(input.author, authorFont, room, measure),
      x: textX,
      y: TOP + 84,
      font: authorFont,
      color: "soft",
    })
  }
  return TOP + COVER_HEIGHT
}

/** Glosa, the site and (Kutipan story only) the tagline; returns the footer's top. */
function footer(
  input: CardInput,
  width: number,
  height: number,
  measure: Measure,
  items: Array<CardItem>
): number {
  const base = height - BOTTOM
  const logoFont = font(52, SERIF, { bold: true })
  items.push({
    kind: "text",
    text: SITE_NAME,
    x: PAD,
    y: base,
    font: logoFont,
    color: "text",
  })
  const hostFont = font(30, SANS)
  const host = fitText(
    input.host,
    hostFont,
    width - 2 * PAD - measure(SITE_NAME, logoFont) - 32,
    measure
  )
  items.push({
    kind: "text",
    text: host,
    x: width - PAD - measure(host, hostFont),
    y: base,
    font: hostFont,
    color: "soft",
  })
  let top = base - 52
  if (input.layout === "kutipan" && input.size === "story") {
    const taglineFont = font(28, SANS)
    items.push({
      kind: "text",
      text: SITE_TAGLINE,
      x: width - PAD - measure(SITE_TAGLINE, taglineFont),
      y: base - 46,
      font: taglineFont,
      color: "soft",
    })
    top -= 46
  }
  return top
}

/** Where everything on a card goes (spec kartu kutipan §3). */
export function layoutCard(input: CardInput, measure: Measure): CardLayout {
  const { width, height } = CARD_DIMENSIONS[input.size]
  const maxWidth = width - 2 * PAD
  const frame: Array<CardItem> = []
  const gaps = GAPS[input.size]
  const top = header(input, width, measure, frame) + gaps.head
  const room = footer(input, width, height, measure, frame) - gaps.foot - top

  const lit = litToken(input)
  const word = lit === null ? null : input.word
  const gloss = input.layout === "glosa" && word !== null
  const block =
    input.layout === "kutipan" && word
      ? wordBlock(word, maxWidth, measure)
      : null
  const quote = fitQuote(
    input,
    maxWidth,
    room,
    block?.height ?? 0,
    gloss,
    measure
  )
  const total = quote.height + (block?.height ?? 0)
  const blockTop = top + Math.max(0, (room - total) / 2)

  const marks: Array<CardItem> = []
  const texts: Array<CardItem> = []
  const glosses: Array<CardItem> = []
  const hits: Array<CardHit> = []
  quote.lines.forEach((line, row) => {
    const baseline =
      blockTop + quote.metrics.first + row * quote.metrics.lineHeight
    let x = PAD
    for (const index of line) {
      const piece = quote.pieces[index]
      texts.push({
        kind: "text",
        text: piece.text,
        x,
        y: baseline,
        font: piece.font,
        color: piece.color,
      })
      hits.push({
        token: piece.token,
        x,
        y: baseline - quote.size,
        width: piece.width,
        height: quote.metrics.lineHeight,
      })
      if (gloss && piece.token === lit) {
        const markY = baseline - quote.size * 0.45
        const markHeight = quote.size * 0.5
        marks.push({
          kind: "mark",
          x: x - quote.size * 0.08,
          y: markY,
          width: piece.width + quote.size * 0.16,
          height: markHeight,
          turn: {
            angle: MARK_TURN,
            x: x + piece.width / 2,
            y: markY + markHeight / 2,
          },
        })
        glosses.push(
          ...glossItems(word, x, baseline, quote.size, width, measure)
        )
      }
      x += piece.width + quote.space
    }
  })

  return {
    width,
    height,
    fontSize: quote.size,
    fits: total <= room,
    items: [
      ...frame,
      ...marks,
      ...texts,
      ...glosses,
      ...(block ? block.items(blockTop + quote.height) : []),
    ],
    hits,
  }
}
