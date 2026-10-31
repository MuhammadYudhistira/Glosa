import { describe, expect, it } from "vitest"
import { shouldAskFinish } from "./finish"

const open = { finished: false, finishDeclined: false }

describe("shouldAskFinish", () => {
  it("asks at the end of the book or from 95%", () => {
    expect(shouldAskFinish(open, { fraction: 0.5, atBookEnd: true })).toBe(true)
    expect(shouldAskFinish(open, { fraction: 0.95, atBookEnd: false })).toBe(
      true
    )
    expect(shouldAskFinish(open, { fraction: 0.94, atBookEnd: false })).toBe(
      false
    )
  })

  it("does not ask about a finished book, or after Belum", () => {
    const end = { fraction: 1, atBookEnd: true }
    expect(shouldAskFinish({ ...open, finished: true }, end)).toBe(false)
    expect(shouldAskFinish({ ...open, finishDeclined: true }, end)).toBe(false)
  })
})
