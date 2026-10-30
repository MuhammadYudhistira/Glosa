import { describe, expect, it } from "vitest"
import { FOOTNOTE_MAX_LENGTH, footnoteText, isFootnoteLink } from "./footnotes"

/** A section as EPUB has it: XHTML, with the epub: namespace. */
const xhtml = (body: string) =>
  new DOMParser().parseFromString(
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body>${body}</body></html>`,
    "application/xhtml+xml"
  )

const element = (doc: Document, id: string) => {
  const found = doc.getElementById(id)
  if (!found) throw new Error(`no #${id}`)
  return found
}

describe("isFootnoteLink", () => {
  it("knows links marked as notes", () => {
    const doc = xhtml(
      '<p><a id="type" epub:type="noteref" href="#n1">1</a><a id="role" role="doc-noteref" href="#n2">2</a><a id="gloss" epub:type="glossref" href="#g">g</a></p>'
    )
    expect(isFootnoteLink(element(doc, "type"))).toBe(true)
    expect(isFootnoteLink(element(doc, "role"))).toBe(true)
    expect(isFootnoteLink(element(doc, "gloss"))).toBe(true)
  })

  it("knows unmarked notes by their raised number", () => {
    const doc = xhtml(
      '<p><sup><a id="inside" href="#n1">1</a></sup><a id="around" href="#n2"><sup>2</sup></a></p>'
    )
    expect(isFootnoteLink(element(doc, "inside"))).toBe(true)
    expect(isFootnoteLink(element(doc, "around"))).toBe(true)
  })

  it("leaves other links and links back to the text alone", () => {
    const doc = xhtml(
      '<p><a id="plain" href="bab2.xhtml">Bab 2</a><sup><a id="back" epub:type="backlink" href="#r1">↩</a></sup></p>'
    )
    expect(isFootnoteLink(element(doc, "plain"))).toBe(false)
    expect(isFootnoteLink(element(doc, "back"))).toBe(false)
  })
})

describe("footnoteText", () => {
  it("reads a note's paragraphs without its link back", () => {
    const doc = xhtml(
      '<aside epub:type="footnote" id="n1"><p>Satu <em>dua</em>.</p><p>Tiga <a epub:type="backlink" href="#r1">↩</a></p></aside>'
    )
    expect(footnoteText(element(doc, "n1"))).toEqual(["Satu dua.", "Tiga"])
  })

  it("takes the block around a target inside it", () => {
    const doc = xhtml('<p><a id="n2"/>2. Isi   catatan\n kedua.</p>')
    expect(footnoteText(element(doc, "n2"))).toEqual(["2. Isi catatan kedua."])
  })

  it("takes the next block when the target stands alone", () => {
    const doc = xhtml('<a id="n3"/><p>Catatan tiga.</p>')
    expect(footnoteText(element(doc, "n3"))).toEqual(["Catatan tiga."])
  })

  it("also drops an unmarked link back to the clicked reference", () => {
    const doc = xhtml(
      '<div id="n6"><p>Nota satu. <a href="#FNanchor_1">[1]</a> <a href="ch1.xhtml#FNanchor_1">[1]</a> <a href="#lain">dua</a></p></div>'
    )
    expect(footnoteText(element(doc, "n6"), "FNanchor_1")).toEqual([
      "Nota satu. dua",
    ])
    // Without the reference's id the link is kept: it may be part of the text.
    expect(footnoteText(element(doc, "n6"))).toEqual(["Nota satu. [1] [1] dua"])
  })

  it("keeps a word break where a note has a line break", () => {
    const doc = xhtml('<p id="n7">Baris satu<br/>baris dua<br />tiga</p>')
    expect(footnoteText(element(doc, "n7"))).toEqual([
      "Baris satu baris dua tiga",
    ])
  })

  it("has nothing for a note without text", () => {
    const doc = xhtml('<p id="n4">   </p>')
    expect(footnoteText(element(doc, "n4"))).toBeNull()
  })

  it("stops a long note", () => {
    const doc = xhtml(`<p id="n5">${"x".repeat(FOOTNOTE_MAX_LENGTH + 500)}</p>`)
    const [text] = footnoteText(element(doc, "n5")) ?? []
    expect(text).toHaveLength(FOOTNOTE_MAX_LENGTH + 1)
    expect(text.endsWith("…")).toBe(true)
  })
})
