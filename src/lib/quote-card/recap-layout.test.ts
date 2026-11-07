import { describe, expect, it } from "vitest"
import { fakeMeasure } from "@/test/canvas"
import { CARD_DIMENSIONS } from "./layout"
import { type RecapCardInput, layoutRecapCard } from "./recap-layout"

const base: RecapCardInput = {
  size: "story",
  title: "Oktober 2026 di Glosa",
  ongoing: false,
  books: 8,
  coverCount: 6,
  readTime: "12 jam 5 menit",
  days: 19,
  streak: 7,
  saved: 31,
  topWord: { headword: "ominous", meetings: 5 },
  host: "glos-a.tech",
}
const texts = (layout: ReturnType<typeof layoutRecapCard>) =>
  layout.items.flatMap((item) => (item.kind === "text" ? [item] : []))

describe("layoutRecapCard", () => {
  it("fits in both sizes with its numbers", () => {
    for (const size of ["story", "square"] as const) {
      const layout = layoutRecapCard({ ...base, size }, fakeMeasure)
      expect(layout).toMatchObject(CARD_DIMENSIONS[size])
      expect(layout.fits).toBe(true)
      const written = texts(layout).map((item) => item.text)
      expect(written).toContain("Oktober 2026 di Glosa")
      expect(written).toContain("8 buku selesai")
      expect(written).toContain("12 jam 5 menit")
      expect(written).toContain("19 hari")
      expect(written).toContain("7 hari")
      expect(written).toContain("31 kata")
      expect(written.some((text) => text.includes("ominous"))).toBe(true)
    }
  })

  it("puts one cover item per slot, at most six", () => {
    const covers = layoutRecapCard(base, fakeMeasure).items.filter(
      (item) => item.kind === "cover"
    )
    expect(
      covers.map((item) => (item.kind === "cover" ? item.slot : -1))
    ).toEqual([0, 1, 2, 3, 4, 5])
    const three = layoutRecapCard(
      { ...base, coverCount: 3 },
      fakeMeasure
    ).items.filter((item) => item.kind === "cover")
    expect(three).toHaveLength(3)
    expect(
      layoutRecapCard({ ...base, coverCount: 9 }, fakeMeasure).items.filter(
        (item) => item.kind === "cover"
      )
    ).toHaveLength(6)
  })

  it("says sejauh ini for a period that is not over, and skips the top word without one", () => {
    const written = texts(
      layoutRecapCard({ ...base, ongoing: true, topWord: null }, fakeMeasure)
    ).map((item) => item.text)
    expect(written).toContain("sejauh ini")
    expect(written.some((text) => text.includes("Paling sering bertemu"))).toBe(
      false
    )
    expect(
      texts(layoutRecapCard(base, fakeMeasure)).map((item) => item.text)
    ).not.toContain("sejauh ini")
  })

  it("does not carry the looked-up words", () => {
    const written = texts(layoutRecapCard(base, fakeMeasure))
      .map((item) => item.text)
      .join(" ")
    expect(written).not.toMatch(/dicari/i)
  })

  it("keeps long text inside the card", () => {
    const layout = layoutRecapCard(
      {
        ...base,
        title: "Oktober 2026 di Glosa ".repeat(6),
        topWord: { headword: "x".repeat(60), meetings: 12 },
      },
      fakeMeasure
    )
    for (const item of texts(layout)) {
      expect(item.x + fakeMeasure(item.text, item.font)).toBeLessThanOrEqual(
        layout.width
      )
    }
  })
})
