import { afterEach, describe, expect, it, vi } from "vitest"
import { markKeptLayout } from "./keep-layout"

/** The page's own document stands for a section: it has a window to compute in. */
function section(css: string, body: string): Document {
  document.head.innerHTML = `<style>${css}</style>`
  document.body.innerHTML = body
  return document
}

afterEach(() => {
  document.head.innerHTML = ""
  document.body.innerHTML = ""
})

describe("markKeptLayout", () => {
  it("marks a paragraph whose container the book centres or aligns right", () => {
    const doc = section(
      "footer { text-align: right } section { text-align: center }",
      '<footer><p id="a">x</p></footer><section><p id="b">y</p></section><div><p id="c">z</p></div>'
    )
    markKeptLayout(doc)
    expect(doc.getElementById("a")?.hasAttribute("data-glosa-keep-align")).toBe(
      true
    )
    expect(doc.getElementById("b")?.hasAttribute("data-glosa-keep-align")).toBe(
      true
    )
    expect(doc.getElementById("c")?.hasAttribute("data-glosa-keep-align")).toBe(
      false
    )
  })

  it("marks a paragraph whose container the book does not hyphenate", () => {
    const doc = section(
      "header { hyphens: none } aside { hyphens: auto }",
      '<header><p id="a">x</p></header><aside><blockquote id="b">y</blockquote></aside><div><li id="c">z</li></div>'
    )
    markKeptLayout(doc)
    expect(
      doc.getElementById("a")?.hasAttribute("data-glosa-keep-hyphens")
    ).toBe(true)
    expect(
      doc.getElementById("b")?.hasAttribute("data-glosa-keep-hyphens")
    ).toBe(false)
    expect(
      doc.getElementById("c")?.hasAttribute("data-glosa-keep-hyphens")
    ).toBe(false)
  })

  it("measures each parent once, however many blocks it holds", () => {
    const doc = section(
      "footer { text-align: right }",
      "<footer><p>a</p><p>b</p><p>c</p></footer><div><p>d</p><p>e</p></div>"
    )
    const spy = vi.spyOn(window, "getComputedStyle")
    markKeptLayout(doc)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(doc.querySelectorAll("[data-glosa-keep-align]")).toHaveLength(3)
    spy.mockRestore()
  })

  it("leaves a document without a window alone", () => {
    const doc = new DOMParser().parseFromString(
      "<html><body><p>x</p></body></html>",
      "text/html"
    )
    expect(() => markKeptLayout(doc)).not.toThrow()
    expect(doc.querySelector("[data-glosa-keep-align]")).toBeNull()
  })
})
