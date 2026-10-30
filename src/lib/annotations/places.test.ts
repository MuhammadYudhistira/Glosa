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

  it("keeps a bookmark on a section's first page as its end settles", () => {
    // Logged in Chromium: the first page of a section, before and after the
    // fonts load. The start stays; only the end moves.
    const first =
      "epubcfi(/6/6!/4/2[a-scandal-in-bohemia],/2,/4[a-scandal-in-bohemia-1]/8/3:90)"
    const settled =
      "epubcfi(/6/6!/4/2[a-scandal-in-bohemia],/2,/4[a-scandal-in-bohemia-1]/6/1:1300)"
    const bookmark = pageStart(first)
    expect(bookmark).toBe("epubcfi(/6/6!/4/2[a-scandal-in-bohemia]/2)")
    expect(onPage(bookmark, first)).toBe(true)
    expect(onPage(bookmark, settled)).toBe(true)
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
