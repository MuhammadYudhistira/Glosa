import { describe, expect, it } from "vitest"
import { SITE_TAGLINE } from "@/lib/site"
import { fakeMeasure } from "@/test/canvas"
import { HAND } from "./fonts"
import {
  CARD_LAYOUTS,
  CARD_SIZES,
  type CardInput,
  type CardItem,
  breakLines,
  layoutCard,
} from "./layout"
import { prepareQuote, quoteTokens } from "./quote-text"

const SHORT = "It is a capital mistake to theorize before one has data."
const LONG = prepareQuote(
  "You see, but you do not observe. The distinction is clear. ".repeat(6)
).text
const CAPITAL = {
  label: "capital",
  pos: "kata sifat",
  meanings: "utama, besar",
}

function input(overrides: Partial<CardInput> = {}): CardInput {
  return {
    layout: "kutipan",
    size: "story",
    tokens: quoteTokens(SHORT),
    highlight: 3,
    word: CAPITAL,
    title: "A Scandal in Bohemia",
    author: "Arthur Conan Doyle",
    hasCover: true,
    host: "glos-a.tech",
    ...overrides,
  }
}

type TextItem = Extract<CardItem, { kind: "text" }>
const textsOf = (items: Array<CardItem>) =>
  items.filter((item): item is TextItem => item.kind === "text")
const textOf = (items: Array<CardItem>, text: string) =>
  textsOf(items).find((item) => item.text === text)

describe("breakLines", () => {
  it("balances the lines", () => {
    const lines = breakLines(Array(10).fill(152), 38, 888)
    expect(lines).toHaveLength(3)
    expect(lines.map((line) => line.length).sort()).toEqual([3, 3, 4])
    expect(lines.flat()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it("puts a piece wider than the line on its own", () => {
    expect(breakLines([100, 2000, 100], 10, 888)).toEqual([[0], [1], [2]])
  })

  it("has no lines for no pieces", () => {
    expect(breakLines([], 10, 888)).toEqual([])
  })
})

describe("layoutCard", () => {
  it("draws a short quote at the largest size", () => {
    const card = layoutCard(input(), fakeMeasure)
    expect(card).toMatchObject({
      width: 1080,
      height: 1920,
      fontSize: 76,
      fits: true,
    })
    expect(textOf(card.items, "“It")).toBeDefined()
    expect(textOf(card.items, "data.”")).toBeDefined()
  })

  it.each(
    CARD_LAYOUTS.flatMap((layout) =>
      CARD_SIZES.map((size) => [layout, size] as const)
    )
  )("fits a 300-character quote in %s, %s", (layout, size) => {
    const card = layoutCard(
      input({ layout, size, tokens: quoteTokens(LONG), highlight: 2 }),
      fakeMeasure
    )
    expect(card.fits).toBe(true)
  })

  it("Kutipan: the word stands out in the quote, and its meaning sits below", () => {
    const card = layoutCard(input(), fakeMeasure)
    const inQuote = textsOf(card.items).filter(
      (item) => item.text === "capital"
    )
    expect(inQuote).toHaveLength(2)
    expect(inQuote[0]).toMatchObject({ color: "accent" })
    expect(inQuote[0].font.startsWith("700 ")).toBe(true)
    expect(textOf(card.items, "kata sifat")).toMatchObject({ color: "soft" })
    const meaning = textOf(card.items, "utama, besar")
    expect(meaning).toMatchObject({ color: "accent" })
    expect(meaning?.font.endsWith(HAND)).toBe(true)
    expect(card.items.some((item) => item.kind === "rule")).toBe(true)
    expect(meaning && meaning.y > inQuote[0].y).toBe(true)
  })

  it("Glosa: a highlighter behind the word, the meaning written above it", () => {
    const card = layoutCard(input({ layout: "glosa" }), fakeMeasure)
    const mark = card.items.find((item) => item.kind === "mark")
    const hit = card.hits.find((candidate) => candidate.token === 3)
    if (mark?.kind !== "mark" || !hit) throw new Error("no mark or hit")
    expect(mark.x).toBeLessThanOrEqual(hit.x)
    expect(mark.x + mark.width).toBeGreaterThanOrEqual(hit.x + hit.width)
    const word = textOf(card.items, "capital")
    const gloss = textOf(card.items, "utama, besar")
    expect(textOf(card.items, "(kata sifat)")).toBeDefined()
    expect(gloss && word && gloss.y < word.y).toBe(true)
    expect(card.items.some((item) => item.kind === "rule")).toBe(false)
    expect(card.items.indexOf(mark)).toBeLessThan(
      card.items.indexOf(word as CardItem)
    )
  })

  it("Glosa: the handwriting stays inside the card at the end of a line", () => {
    const word = { ...CAPITAL, meanings: "sangat penting sekali, utama, besar" }
    const tokens = quoteTokens(SHORT)
    const card = layoutCard(
      input({ layout: "glosa", word, highlight: tokens.length - 1 }),
      fakeMeasure
    )
    const hand = textsOf(card.items).filter((item) => item.font.endsWith(HAND))
    expect(hand).toHaveLength(2)
    for (const item of hand) {
      expect(item.x).toBeGreaterThanOrEqual(96)
      expect(item.x + fakeMeasure(item.text, item.font)).toBeLessThanOrEqual(
        1080 - 96 + 0.5
      )
    }
  })

  it("knows where each word is, for a tap", () => {
    const card = layoutCard(input(), fakeMeasure)
    expect(card.hits.map((hit) => hit.token)).toEqual(
      quoteTokens(SHORT).map((_, i) => i)
    )
    for (const hit of card.hits) expect(hit.width).toBeGreaterThan(0)
  })

  it("without a word: no highlighter, no rule, no meaning", () => {
    for (const layout of CARD_LAYOUTS) {
      const card = layoutCard(input({ layout, highlight: null }), fakeMeasure)
      expect(
        card.items.some((item) => item.kind === "mark" || item.kind === "rule")
      ).toBe(false)
      expect(textOf(card.items, "utama, besar")).toBeUndefined()
    }
  })

  it("puts the title beside the cover, or at the edge without one", () => {
    const withCover = layoutCard(input(), fakeMeasure)
    expect(withCover.items.find((item) => item.kind === "cover")).toMatchObject(
      {
        x: 96,
        width: 64,
      }
    )
    expect(textOf(withCover.items, "A Scandal in Bohemia")?.x).toBe(
      96 + 64 + 28
    )
    const without = layoutCard(input({ hasCover: false }), fakeMeasure)
    expect(without.items.some((item) => item.kind === "cover")).toBe(false)
    expect(textOf(without.items, "A Scandal in Bohemia")?.x).toBe(96)
  })

  it("shortens a long title with an ellipsis", () => {
    const card = layoutCard(
      input({ title: "Supercalifragilistic ".repeat(10) }),
      fakeMeasure
    )
    const title = textsOf(card.items)[0]
    expect(title.text.endsWith("…")).toBe(true)
    expect(title.x + fakeMeasure(title.text, title.font)).toBeLessThanOrEqual(
      1080 - 96
    )
  })

  it("signs with Glosa and the site, the tagline only on a Kutipan story", () => {
    const story = layoutCard(input(), fakeMeasure)
    expect(textOf(story.items, "Glosa")).toMatchObject({ x: 96, y: 1920 - 90 })
    const host = textOf(story.items, "glos-a.tech")
    expect(host && host.x + fakeMeasure(host.text, host.font)).toBeCloseTo(
      1080 - 96
    )
    expect(textOf(story.items, SITE_TAGLINE)).toBeDefined()
    expect(
      textOf(
        layoutCard(input({ size: "square" }), fakeMeasure).items,
        SITE_TAGLINE
      )
    ).toBeUndefined()
    expect(
      textOf(
        layoutCard(input({ layout: "glosa" }), fakeMeasure).items,
        SITE_TAGLINE
      )
    ).toBeUndefined()
  })
})
