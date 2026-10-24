import { describe, expect, it } from "vitest"
import { inBookOrder, onPage, pageStart } from "./places"

const PAGE = "epubcfi(/6/4!/4,/2/1:0,/8/1:30)"

describe("pageStart", () => {
  it("is where the page begins", () => {
    expect(pageStart(PAGE)).toBe("epubcfi(/6/4!/4/2/1:0)")
  })
})

describe("onPage", () => {
  it("counts the start of the page but not its end", () => {
    expect(onPage("epubcfi(/6/4!/4/2/1:0)", PAGE)).toBe(true)
    expect(onPage("epubcfi(/6/4!/4/6/1:10)", PAGE)).toBe(true)
    expect(onPage("epubcfi(/6/4!/4/8/1:30)", PAGE)).toBe(false)
    expect(onPage("epubcfi(/6/6!/4/2/1:0)", PAGE)).toBe(false)
  })

  it("is false for a place it cannot read", () => {
    expect(onPage("nonsense", PAGE)).toBe(false)
  })
})

describe("inBookOrder", () => {
  it("sorts by place in the book", () => {
    const items = [
      { id: "c", cfi: "epubcfi(/6/6!/4/2/1:0)" },
      { id: "b", cfi: "epubcfi(/6/4!/4/10/1:0)" },
      { id: "a", cfi: "epubcfi(/6/4!/4/2,/1:0,/1:5)" },
    ]
    expect(inBookOrder(items).map((item) => item.id)).toEqual(["a", "b", "c"])
    expect(items[0].id).toBe("c")
  })
})
