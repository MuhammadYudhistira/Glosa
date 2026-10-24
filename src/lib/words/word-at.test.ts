import { afterEach, describe, expect, it } from "vitest"
import { nextWords, sentenceAround, wordAt, wordBounds } from "./word-at"

describe("wordBounds", () => {
  const text = "Mr. Holmes, the well-known detective."

  it("finds the word around a caret inside it or just after it", () => {
    expect(wordBounds(text, 5)).toEqual({ start: 4, end: 10 })
    expect(wordBounds(text, 10)).toEqual({ start: 4, end: 10 })
  })

  it("keeps a hyphenated word whole", () => {
    expect(wordBounds(text, 22)).toEqual({ start: 16, end: 26 })
  })

  it("finds nothing between spaces and punctuation", () => {
    expect(wordBounds("a , b", 2)).toBeNull()
  })

  it("leaves quotes at the edges out", () => {
    expect(wordBounds("'yes'", 2)).toEqual({ start: 1, end: 4 })
  })
})

describe("sentenceAround", () => {
  const around = (text: string, word: string) => {
    const start = text.indexOf(word)
    return sentenceAround(text, start, start + word.length)
  }

  it("takes the sentence between the stops", () => {
    expect(around("He sat down. Watson stood up! Then", "Watson")).toBe(
      "Watson stood up!"
    )
  })

  it("does not stop at Mr. and the like", () => {
    expect(around("Mr. Holmes sat down. Watson stood.", "Holmes")).toBe(
      "Mr. Holmes sat down."
    )
  })

  it("keeps the closing quote with its sentence", () => {
    const text = '"Come in!" said Holmes. Watson entered.'
    expect(around(text, "Come")).toBe('"Come in!"')
    expect(around(text, "said")).toBe("said Holmes.")
  })

  it("cuts a long sentence to 500 characters around the word", () => {
    const text = `${"kata ".repeat(300)}target ${"kata ".repeat(300)}`
    const sentence = around(text, "target")
    expect(sentence.length).toBeLessThanOrEqual(500)
    expect(sentence).toContain("target")
  })

  it("does not keep half of a character the cut went through", () => {
    // Cut to 8 characters, the sentence starts inside the emoji.
    const text = "x\u{1F600} word here"
    const start = text.indexOf("word")
    expect(sentenceAround(text, start, start + 4, 8)).toBe("word h")
  })

  it("drops control characters but keeps the words apart", () => {
    expect(around("He ran\u0000 away\u0007.\tThen", "ran")).toBe("He ran away.")
    expect(around("He\tran\naway.", "ran")).toBe("He ran away.")
  })
})

describe("nextWords", () => {
  const after = (text: string, word: string) =>
    nextWords(text, text.indexOf(word) + word.length)

  it("takes the next two words of the paragraph", () => {
    expect(after("He Gave Up on it.", "Gave")).toEqual(["up", "on"])
  })

  it("stops at punctuation", () => {
    expect(after("He gave it. Then", "it")).toEqual([])
    expect(after("He gave, up", "gave")).toEqual([])
  })
})

describe("wordAt", () => {
  const restore: Array<() => void> = []
  function stub(target: object, name: string, value: unknown) {
    Object.defineProperty(target, name, { configurable: true, value })
    restore.push(() => Reflect.deleteProperty(target, name))
  }
  afterEach(() => {
    for (const undo of restore.splice(0)) undo()
  })

  const box = {
    left: 0,
    top: 0,
    right: 100,
    bottom: 20,
    width: 100,
    height: 20,
  }

  /** A paragraph with a caret at `offset` of its first text node. */
  function page(html: string, offset: number) {
    document.body.innerHTML = html
    const text = document.querySelector("p")?.firstChild as Text
    stub(document, "caretPositionFromPoint", undefined)
    stub(document, "caretRangeFromPoint", () => {
      const range = document.createRange()
      range.setStart(text, offset)
      return range
    })
    stub(Range.prototype, "getClientRects", () => [box])
    return { doc: document, text }
  }

  it("takes the tapped word, its sentence and the next two words", () => {
    const { doc } = page(
      "<p>Mr. Holmes <i>smiled</i> at the well-known detective.</p>",
      5
    )
    expect(wordAt(doc, 10, 10)).toMatchObject({
      word: "holmes",
      sentence: "Mr. Holmes smiled at the well-known detective.",
      next: ["smiled", "at"],
    })
  })

  it("prefers caretPositionFromPoint where the browser has it", () => {
    const { doc, text } = page("<p>Holmes smiled.</p>", 0)
    stub(doc, "caretPositionFromPoint", () => ({ offsetNode: text, offset: 9 }))
    expect(wordAt(doc, 10, 10)?.word).toBe("smiled")
  })

  it("misses a tap outside the word's box, as in the margin", () => {
    const { doc } = page("<p>Holmes smiled.</p>", 6)
    expect(wordAt(doc, 300, 10)).toBeNull()
  })

  it("ignores numbers", () => {
    const { doc } = page("<p>In 1890 he left.</p>", 4)
    expect(wordAt(doc, 10, 10)).toBeNull()
  })

  it("takes a word in a section without a body, as an SVG page", () => {
    const svg = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg"><text>Holmes smiled.</text></svg>',
      "image/svg+xml"
    )
    const text = svg.querySelector("text")?.firstChild as Text
    stub(svg, "caretRangeFromPoint", () => {
      const range = svg.createRange()
      range.setStart(text, 0)
      return range
    })
    stub(Range.prototype, "getClientRects", () => [box])
    expect(wordAt(svg, 10, 10)).toMatchObject({
      word: "holmes",
      sentence: "Holmes smiled.",
    })
  })

  it("finds nothing without a caret", () => {
    const { doc } = page("<p>Holmes</p>", 0)
    stub(doc, "caretRangeFromPoint", () => null)
    expect(wordAt(doc, 10, 10)).toBeNull()
  })
})
