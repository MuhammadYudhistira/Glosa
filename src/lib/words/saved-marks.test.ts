import { describe, expect, it, vi } from "vitest"
import {
  ACTIVE_HIGHLIGHT,
  SAVED_HIGHLIGHT,
  findSavedSpans,
  markSavedWords,
  savedFormsOf,
  showActiveWord,
  whenIdle,
} from "./saved-marks"

const forms = savedFormsOf({
  run: ["run", "ran", "running"],
  "give up": ["give up", "gave up"],
  give: ["give"],
})
const spans = (text: string) =>
  findSavedSpans(text, forms).map(({ start, end }) => text.slice(start, end))

/** The Custom Highlight API, as far as these functions use it. */
function fakeScope() {
  const registry = new Map<string, { ranges: Array<Range> }>()
  class Highlight {
    ranges: Array<Range>
    constructor(...ranges: Array<Range>) {
      this.ranges = ranges
    }
  }
  return { registry, scope: { CSS: { highlights: registry }, Highlight } }
}

describe("findSavedSpans", () => {
  it("finds every form of a saved word, in any case and with 's", () => {
    expect(spans("He Ran, she ran; Running’s fun.")).toEqual([
      "Ran",
      "ran",
      "Running’s",
    ])
  })

  it("prefers a saved phrase over its first word, across a line break", () => {
    expect(spans("She gave\nup. Give it.")).toEqual(["gave\nup", "Give"])
  })

  it("does not join words across punctuation", () => {
    expect(spans("She gave, up")).toEqual([])
  })

  it("finds nothing without saved words", () => {
    expect(findSavedSpans("run", savedFormsOf({}))).toEqual([])
  })
})

describe("markSavedWords", () => {
  it("does nothing where the browser has no Custom Highlight API", () => {
    document.body.innerHTML = "<p>He ran.</p>"
    expect(() => markSavedWords(document, forms, null)).not.toThrow()
  })

  it("puts every saved form of the section in one highlight", () => {
    document.body.innerHTML = "<p>He ran. <i>Running</i> is fun.</p>"
    const { registry, scope } = fakeScope()
    markSavedWords(document, forms, scope)
    const ranges = registry.get(SAVED_HIGHLIGHT)?.ranges ?? []
    expect(ranges.map((range) => range.toString())).toEqual(["ran", "Running"])
  })

  it("marks a section without a body, as an SVG page", () => {
    const svg = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg"><text>He ran.</text></svg>',
      "image/svg+xml"
    )
    const { registry, scope } = fakeScope()
    markSavedWords(svg, forms, scope)
    const ranges = registry.get(SAVED_HIGHLIGHT)?.ranges ?? []
    expect(ranges.map((range) => range.toString())).toEqual(["ran"])
  })
})

describe("showActiveWord", () => {
  it("lights the tapped word and clears it", () => {
    document.body.innerHTML = "<p>He ran.</p>"
    const { registry, scope } = fakeScope()
    const range = document.createRange()
    showActiveWord(document, range, scope)
    expect(registry.get(ACTIVE_HIGHLIGHT)?.ranges).toEqual([range])
    showActiveWord(document, null, scope)
    expect(registry.has(ACTIVE_HIGHLIGHT)).toBe(false)
  })
})

describe("whenIdle", () => {
  it("falls back to a timeout, and can be cancelled", () => {
    vi.useFakeTimers()
    const task = vi.fn()
    const idleless = {
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
    } as unknown as Window
    whenIdle(idleless, task)
    const cancel = whenIdle(idleless, task)
    cancel()
    vi.runAllTimers()
    expect(task).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
