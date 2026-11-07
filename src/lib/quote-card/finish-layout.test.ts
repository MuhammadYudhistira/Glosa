import { describe, expect, it } from "vitest"
import { fakeMeasure } from "@/test/canvas"
import { CARD_DIMENSIONS } from "./layout"
import { type FinishCardInput, layoutFinishCard } from "./finish-layout"

const base: FinishCardInput = {
  size: "story",
  title: "A Scandal in Bohemia",
  author: "Arthur Conan Doyle",
  hasCover: true,
  readTime: "6 jam 20 menit",
  rating: 4,
  host: "glos-a.tech",
}
const textsOf = (layout: ReturnType<typeof layoutFinishCard>) =>
  layout.items.flatMap((item) => (item.kind === "text" ? [item] : []))

describe("layoutFinishCard", () => {
  it("is the size asked for, with the label, the time and the footer", () => {
    for (const size of ["story", "square"] as const) {
      const layout = layoutFinishCard({ ...base, size }, fakeMeasure)
      expect(layout).toMatchObject(CARD_DIMENSIONS[size])
      expect(layout.fits).toBe(true)
      const texts = textsOf(layout).map((item) => item.text)
      expect(texts).toContain("Selesai dibaca")
      expect(texts).toContain("6 jam 20 menit")
      expect(texts).toContain("Glosa")
      expect(texts).toContain("glos-a.tech")
    }
  })

  it("keeps every text inside the card, however long the title", () => {
    const long = "The Extraordinarily Long Title of a Book ".repeat(8)
    const layout = layoutFinishCard(
      { ...base, title: long, author: long },
      fakeMeasure
    )
    for (const item of textsOf(layout)) {
      expect(item.x).toBeGreaterThanOrEqual(0)
      expect(item.x + fakeMeasure(item.text, item.font)).toBeLessThanOrEqual(
        layout.width
      )
    }
  })

  it("has no cover item without a cover, and no stars without a rating", () => {
    const bare = layoutFinishCard(
      { ...base, hasCover: false, rating: null },
      fakeMeasure
    )
    expect(bare.items.some((item) => item.kind === "cover")).toBe(false)
    expect(textsOf(bare).some((item) => item.text.includes("★"))).toBe(false)
    const full = layoutFinishCard(base, fakeMeasure)
    expect(full.items.some((item) => item.kind === "cover")).toBe(true)
    expect(
      textsOf(full)
        .filter((item) => item.text.includes("★"))
        .map((item) => item.text)
    ).toEqual(["★★★★", "★"])
  })

  it("never writes the comprehension, a note or a word", () => {
    const text = textsOf(layoutFinishCard(base, fakeMeasure))
      .map((item) => item.text)
      .join(" ")
    expect(text).not.toMatch(/paham|catatan|kata/i)
  })
})
