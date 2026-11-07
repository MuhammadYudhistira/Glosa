import { describe, expect, it } from "vitest"
import { fakeMeasure } from "@/test/canvas"
import { wrapText } from "./wrap"

const FONT = "10px sans" // the fake measures 5 px a character

describe("wrapText", () => {
  it("breaks at spaces within the width", () => {
    expect(wrapText("aaa bbb ccc ddd", FONT, 40, fakeMeasure, 5)).toEqual([
      "aaa bbb",
      "ccc ddd",
    ])
  })

  it("ends the last line with an ellipsis when there are too many lines", () => {
    const lines = wrapText("aaa bbb ccc ddd eee fff", FONT, 40, fakeMeasure, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith("…")).toBe(true)
    for (const line of lines)
      expect(fakeMeasure(line, FONT)).toBeLessThanOrEqual(40)
  })

  it("cuts a word longer than the line", () => {
    const [line] = wrapText("supercalifragilistic", FONT, 40, fakeMeasure, 2)
    expect(line.endsWith("…")).toBe(true)
    expect(fakeMeasure(line, FONT)).toBeLessThanOrEqual(40)
  })

  it("gives no lines for blank text", () => {
    expect(wrapText("   ", FONT, 40, fakeMeasure, 2)).toEqual([])
  })
})
