import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The module keeps fetched fonts for the session; each test gets a fresh copy.
async function freshLoader() {
  vi.resetModules()
  return (await import("./reader-fonts")).loadReaderFonts
}

describe("loadReaderFonts", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:font")
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("hands every font file to the book as a blob: URL fetched by the page", async () => {
    const fetchMock = vi.fn(
      async () => new Response(new Blob(["font"]), { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)
    const loadReaderFonts = await freshLoader()

    const fonts = await loadReaderFonts()
    for (const face of Object.values(fonts)) {
      expect([face.regular, face.bold, face.italic]).toEqual([
        "blob:font",
        "blob:font",
        "blob:font",
      ])
    }
    expect(fetchMock).toHaveBeenCalledTimes(9)

    await loadReaderFonts()
    expect(fetchMock).toHaveBeenCalledTimes(9)
  })

  it("falls back to absolute URLs, and tries again next time", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    vi.stubGlobal("fetch", fetchMock)
    const loadReaderFonts = await freshLoader()

    const fonts = await loadReaderFonts()
    expect(fonts.serif.regular).toMatch(
      /^http:\/\/localhost(:\d+)?\/.+\.woff2$/
    )
    await loadReaderFonts()
    expect(fetchMock).toHaveBeenCalledTimes(18)
  })
})
