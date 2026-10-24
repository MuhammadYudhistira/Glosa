import { describe, expect, it } from "vitest"
import { endRect, rectAt, selectedRange } from "./selection"

function docWith(html: string) {
  document.body.innerHTML = html
  return document
}

function select(node: Node, start: number, end: number) {
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)
  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

describe("selectedRange", () => {
  it("gives the selected text", () => {
    const doc = docWith("<p>To Sherlock Holmes she is always the woman.</p>")
    const text = doc.querySelector("p")?.firstChild as Text
    select(text, 3, 11)
    expect(selectedRange(doc)?.text).toBe("Sherlock")
  })

  it("is null with nothing selected or only spaces", () => {
    const doc = docWith("<p>To  Sherlock</p>")
    const text = doc.querySelector("p")?.firstChild as Text
    document.getSelection()?.removeAllRanges()
    expect(selectedRange(doc)).toBeNull()
    select(text, 2, 4)
    expect(selectedRange(doc)).toBeNull()
  })
})

/** A box as layout would give it (jsdom has no layout). */
const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
  }) as DOMRect

/** A range with the boxes layout would give it. */
function rangeWith(rects: Array<DOMRect>) {
  return {
    getClientRects: () => rects,
    getBoundingClientRect: () => rect(0, 0, 500, 500),
  } as unknown as Range
}

describe("endRect and rectAt", () => {
  const lines = [rect(10, 20, 200, 18), rect(10, 40, 80, 18)]

  it("finds where a selection ends", () => {
    expect(endRect(rangeWith(lines))).toBe(lines[1])
    expect(endRect(rangeWith([])).width).toBe(500)
  })

  it("finds the line under a tap", () => {
    expect(rectAt(rangeWith(lines), 50, 45)).toBe(lines[1])
    expect(rectAt(rangeWith(lines), 50, 25)).toBe(lines[0])
    expect(rectAt(rangeWith(lines), 400, 400).width).toBe(500)
  })
})
