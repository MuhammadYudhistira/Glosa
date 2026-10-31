import { describe, expect, it } from "vitest"
import { fakeContext, fakeMeasure } from "@/test/canvas"
import { drawCard } from "./draw"
import { layoutCard } from "./layout"
import { quoteTokens } from "./quote-text"

const layout = layoutCard(
  {
    layout: "glosa",
    size: "story",
    tokens: quoteTokens("It is a capital mistake."),
    highlight: 3,
    word: { label: "capital", pos: "kata sifat", meanings: "utama" },
    title: "A Scandal in Bohemia",
    author: "Arthur Conan Doyle",
    hasCover: true,
    host: "glos-a.tech",
  },
  fakeMeasure
)

describe("drawCard", () => {
  it("draws every text of the layout", () => {
    const fake = fakeContext()
    drawCard(fake.context, layout, "kertas", {
      cover: null,
      palette: null,
      seed: "a",
    })
    expect(fake.texts()).toEqual(
      layout.items.flatMap((item) => (item.kind === "text" ? [item.text] : []))
    )
  })

  it("draws the cover only when there is one", () => {
    const without = fakeContext()
    drawCard(without.context, layout, "kertas", {
      cover: null,
      palette: null,
      seed: "a",
    })
    expect(without.calls.some((call) => call.name === "drawImage")).toBe(false)

    const cover = {} as CanvasImageSource
    const withCover = fakeContext()
    drawCard(withCover.context, layout, "kertas", {
      cover,
      palette: null,
      seed: "a",
    })
    const drawn = withCover.calls.filter((call) => call.name === "drawImage")
    expect(drawn).toHaveLength(1)
    expect(drawn[0].args.slice(1)).toEqual([96, 110, 64, 94])
  })

  it("paints Sampul as a gradient and Malam with stars", () => {
    const sampul = fakeContext()
    drawCard(sampul.context, layout, "sampul", {
      cover: null,
      palette: ["#102030", "#203040"],
      seed: "a",
    })
    expect(
      sampul.calls.some((call) => call.name === "createLinearGradient")
    ).toBe(true)

    const malam = fakeContext()
    drawCard(malam.context, layout, "malam", {
      cover: null,
      palette: null,
      seed: "a",
    })
    expect(
      malam.calls.some((call) => call.name === "createRadialGradient")
    ).toBe(true)
    expect(
      malam.calls.filter((call) => call.name === "arc").length
    ).toBeGreaterThan(50)
  })
})
