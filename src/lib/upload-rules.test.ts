import { describe, expect, it } from "vitest"
import {
  MAX_EPUB_BYTES,
  checkEpubFile,
  clampText,
  cleanDescription,
} from "./upload-rules"

describe("checkEpubFile", () => {
  it("accepts EPUB files up to 50 MB", () => {
    expect(
      checkEpubFile({ name: "Buku.EPUB", size: MAX_EPUB_BYTES })
    ).toBeNull()
  })

  it("rejects other file types, empty files and files over 50 MB", () => {
    expect(checkEpubFile({ name: "buku.pdf", size: 10 })).toBe("not_epub")
    expect(checkEpubFile({ name: "buku.epub", size: 0 })).toBe("epub_invalid")
    expect(checkEpubFile({ name: "buku.epub", size: MAX_EPUB_BYTES + 1 })).toBe(
      "too_large"
    )
  })
})

describe("cleanDescription", () => {
  it("keeps plain text only", () => {
    expect(
      cleanDescription(
        "<p>Kisah <i>detektif</i> &amp; sahabatnya.</p><p>Jilid&nbsp;1</p>"
      )
    ).toBe("Kisah detektif & sahabatnya. Jilid 1")
  })

  it("decodes numeric entities", () => {
    expect(cleanDescription("Caf&#233; &#x2014; malam")).toBe("Café — malam")
  })

  it("returns null when nothing is left", () => {
    expect(cleanDescription("<p> </p>")).toBeNull()
    expect(cleanDescription(undefined)).toBeNull()
  })

  it("caps the text at 2000 characters", () => {
    const result = cleanDescription("kata ".repeat(1000))
    expect(result?.length).toBeLessThanOrEqual(2000)
    expect(result?.endsWith("…")).toBe(true)
  })
})

describe("clampText", () => {
  it("leaves short text alone and shortens long text with an ellipsis", () => {
    expect(clampText("pendek", 10)).toBe("pendek")
    expect(clampText("panjang sekali", 8)).toBe("panjang…")
  })
})

describe("cleanDescription characters", () => {
  it("drops surrogate and control character references", () => {
    expect(cleanDescription("&#xD800;a")).toBe("a")
    expect(cleanDescription("&#1;b")).toBe("b")
    expect(cleanDescription("x&#9;y")).toBe("x y")
  })
})

describe("clampText surrogates", () => {
  it("never ends on a lone high surrogate", () => {
    const result = clampText("abc😀def", 5)
    expect(result).toBe("abc…")
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(result)).toBe(false)
  })
})
