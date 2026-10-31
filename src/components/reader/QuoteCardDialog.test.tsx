import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QUOTE_CARD_KEY } from "@/lib/local/keys"
import { layoutCard } from "@/lib/quote-card/layout"
import { quoteTokens } from "@/lib/quote-card/quote-text"
import type { LookupOutcome } from "@/lib/words/lookup"
import { savedFormsOf } from "@/lib/words/saved-marks"
import { type FakeCanvas, fakeMeasure, stubCanvas } from "@/test/canvas"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { QuoteCardDialog } from "./QuoteCardDialog"

const QUOTE = "It is a capital mistake to theorize before one has data."
const book = {
  id: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  title: "A Scandal in Bohemia",
  author: "Arthur Conan Doyle",
  finished: false,
  finishDeclined: false,
}
const CAPITAL: LookupOutcome = {
  kind: "result",
  result: {
    word: "capital",
    version: null,
    phrases: [],
    entries: [
      { headword: "capital", pos: "noun", meanings: ["ibu kota", "modal"] },
      {
        headword: "capital",
        pos: "adj",
        meanings: ["utama", "besar", "sangat penting", "pokok"],
      },
    ],
  },
}
const EMPTY = (word: string): LookupOutcome => ({
  kind: "result",
  result: { word, version: null, phrases: [], entries: [] },
})
const SAVED_CAPITAL = savedFormsOf({ capital: ["capital"] })
const MEANINGS = "Arti di kartu (pilih 1–3)"

function show(extra: Partial<Parameters<typeof QuoteCardDialog>[0]> = {}) {
  const props = {
    quote: QUOTE,
    book,
    savedForms: savedFormsOf({}),
    loadCover: () => Promise.resolve(null),
    lookup: vi.fn(async (word: string) =>
      word === "capital" ? CAPITAL : EMPTY(word)
    ),
    onClose: vi.fn(),
    finalFocus: () => null,
    ...extra,
  }
  render(<QuoteCardDialog {...props} />)
  return props
}

/** Navigator features jsdom lacks, put back after the test. */
function stubNavigator(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(navigator, key, { configurable: true, value })
  }
  return () => {
    for (const key of Object.keys(values))
      Reflect.deleteProperty(navigator, key)
  }
}

let canvas: FakeCanvas
beforeEach(() => {
  stubWideScreen(true)
  canvas = stubCanvas()
  localStorage.clear()
})
afterEach(() => {
  // Unmount before the stubs go, or a late render meets jsdom's real canvas.
  cleanup()
  unstubWideScreen()
  vi.restoreAllMocks()
})

describe("QuoteCardDialog", () => {
  it("draws the quote and offers Simpan gambar once the image is ready", async () => {
    show()
    const dialog = await screen.findByRole("dialog", {
      name: "Bagikan kutipan",
    })
    expect(
      within(dialog).getByRole("img", {
        name: /^Kartu kutipan: “It is a capital mistake/,
      })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Simpan gambar" })
      ).toBeEnabled()
    )
    expect(canvas.texts()).toContain("“It")
    expect(within(dialog).queryByRole("button", { name: "Bagikan" })).toBeNull()
    expect(
      within(dialog).queryByRole("button", { name: "Salin gambar" })
    ).toBeNull()
  })

  it("starts with a word from Kosakata and its first meaning", async () => {
    const props = show({ savedForms: SAVED_CAPITAL })
    const meanings = await screen.findByRole("group", { name: MEANINGS })
    expect(props.lookup).toHaveBeenCalledWith("capital")
    expect(
      within(meanings).getByRole("button", { name: "ibu kota" })
    ).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "capital" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("takes up to three meanings of one part of speech", async () => {
    show({ savedForms: SAVED_CAPITAL })
    const meanings = await screen.findByRole("group", { name: MEANINGS })
    const chip = (name: string) =>
      within(meanings).getByRole("button", { name })
    fireEvent.click(chip("utama"))
    expect(chip("ibu kota")).toHaveAttribute("aria-pressed", "false")
    expect(chip("utama")).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(chip("besar"))
    fireEvent.click(chip("sangat penting"))
    expect(chip("pokok")).toBeDisabled()
    fireEvent.click(chip("besar"))
    expect(chip("pokok")).toBeEnabled()
    await waitFor(() =>
      expect(canvas.texts()).toContain("utama, sangat penting")
    )
  })

  it("says when a word has no meaning, and picks another", async () => {
    show()
    fireEvent.click(await screen.findByRole("button", { name: "data" }))
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Belum ada arti untuk kata ini."
      )
    )
    expect(screen.getByRole("button", { name: "data" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    fireEvent.click(screen.getByRole("button", { name: "capital" }))
    expect(
      await screen.findByRole("group", { name: MEANINGS })
    ).toBeInTheDocument()
  })

  it("says when meanings cannot load", async () => {
    show({
      lookup: vi.fn(async (): Promise<LookupOutcome> => ({ kind: "offline" })),
    })
    fireEvent.click(await screen.findByRole("button", { name: "capital" }))
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Arti belum bisa dimuat."
      )
    )
  })

  it("says so when the image cannot be made", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback: BlobCallback) => callback(null)
    )
    show()
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Gambar belum bisa dibuat. Coba lagi."
      )
    )
    expect(screen.getByRole("button", { name: "Simpan gambar" })).toBeDisabled()
  })

  it("Tanpa kata takes the word off the card", async () => {
    show({ savedForms: SAVED_CAPITAL })
    await screen.findByRole("group", { name: MEANINGS })
    fireEvent.click(screen.getByRole("button", { name: "Tanpa kata" }))
    expect(screen.queryByRole("group", { name: MEANINGS })).toBeNull()
  })

  it("a tap on the preview picks the word under it", async () => {
    show()
    const preview = await screen.findByRole("img", { name: /^Kartu kutipan/ })
    await waitFor(() => expect(preview).toHaveAttribute("height", "1920"))
    // Drawn at 1080×1920, shown at half that.
    vi.spyOn(preview, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 540,
      bottom: 960,
      width: 540,
      height: 960,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const layout = layoutCard(
      {
        layout: "kutipan",
        size: "story",
        tokens: quoteTokens(QUOTE),
        highlight: null,
        word: null,
        title: book.title,
        author: book.author,
        hasCover: false,
        host: location.host,
      },
      fakeMeasure
    )
    const hit = layout.hits.find((candidate) => candidate.token === 3)
    if (!hit) throw new Error("capital is not on the card")
    fireEvent.click(preview, {
      clientX: (hit.x + hit.width / 2) / 2,
      clientY: (hit.y + hit.height / 2) / 2,
    })
    expect(
      await screen.findByRole("group", { name: MEANINGS })
    ).toBeInTheDocument()
  })

  it("shares through the share sheet and copies the link first", async () => {
    const share = vi.fn(async (_data: ShareData) => undefined)
    const writeText = vi.fn(async () => undefined)
    const restore = stubNavigator({
      canShare: () => true,
      share,
      clipboard: { writeText },
    })
    try {
      show()
      const button = await screen.findByRole("button", { name: "Bagikan" })
      await waitFor(() => expect(button).toBeEnabled())
      fireEvent.click(button)
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
      const data = share.mock.calls[0][0]
      expect(data.files?.[0].name).toBe("glosa-a-scandal-in-bohemia.png")
      expect(data.text).toBe(
        `Dari A Scandal in Bohemia, dibaca di Glosa → ${location.origin}`
      )
      expect(writeText).toHaveBeenCalledWith(location.origin)
      expect(screen.getByRole("status")).toHaveTextContent(
        "Link Glosa sudah disalin, tempel di stiker Link Instagram."
      )
    } finally {
      restore()
    }
  })

  it("says when the quote was shortened", async () => {
    show({ quote: "word ".repeat(100) })
    expect(
      await screen.findByText("Kutipan dipendekkan menjadi 300 karakter.")
    ).toBeInTheDocument()
  })

  it("remembers the layout chosen", async () => {
    show()
    const layout = await screen.findByRole("group", { name: "Layout" })
    fireEvent.click(within(layout).getByRole("button", { name: "Glosa" }))
    expect(
      within(layout).getByRole("button", { name: "Glosa" })
    ).toHaveAttribute("aria-pressed", "true")
    expect(
      JSON.parse(localStorage.getItem(QUOTE_CARD_KEY) ?? "{}")
    ).toMatchObject({
      layout: "glosa",
    })
  })

  it("closes", async () => {
    const props = show()
    fireEvent.click(await screen.findByRole("button", { name: "Tutup" }))
    expect(props.onClose).toHaveBeenCalled()
  })

  it("keeps the word it had when the next one has no meaning", async () => {
    const props = show({ savedForms: SAVED_CAPITAL })
    await screen.findByRole("group", { name: MEANINGS })
    fireEvent.click(screen.getByRole("button", { name: "utama" }))
    fireEvent.click(screen.getByRole("button", { name: "data" }))
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Belum ada arti untuk kata ini."
      )
    )
    expect(screen.getByRole("button", { name: "capital" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "utama" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(props.lookup).toHaveBeenCalledTimes(2)
  })

  it("keeps the word it had when a lookup fails", async () => {
    const lookup = vi.fn(async (word: string): Promise<LookupOutcome> =>
      word === "capital" ? CAPITAL : { kind: "offline" }
    )
    show({ savedForms: SAVED_CAPITAL, lookup })
    await screen.findByRole("group", { name: MEANINGS })
    fireEvent.click(screen.getByRole("button", { name: "data" }))
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Arti belum bisa dimuat."
      )
    )
    expect(screen.getByRole("group", { name: MEANINGS })).toBeInTheDocument()
  })

  it("does nothing when the word already shown is tapped again", async () => {
    const props = show({ savedForms: SAVED_CAPITAL })
    await screen.findByRole("group", { name: MEANINGS })
    fireEvent.click(screen.getByRole("button", { name: "utama" }))
    fireEvent.click(screen.getByRole("button", { name: "capital" }))
    expect(screen.getByRole("group", { name: MEANINGS })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "utama" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(props.lookup).toHaveBeenCalledTimes(1)
  })

  it("announces the loading of meanings to a screen reader", async () => {
    let finish: (outcome: LookupOutcome) => void = () => undefined
    show({
      savedForms: SAVED_CAPITAL,
      lookup: () => new Promise((resolve) => (finish = resolve)),
    })
    expect(await screen.findByText("Memuat arti…")).toBeInTheDocument()
    finish(CAPITAL)
    await screen.findByRole("group", { name: MEANINGS })
    expect(screen.queryByText("Memuat arti…")).toBeNull()
  })

  it("drops the image error once an image is made", async () => {
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementationOnce((callback: BlobCallback) => callback(null))
    show()
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Gambar belum bisa dibuat. Coba lagi."
      )
    )
    toBlob.mockImplementation((callback: BlobCallback) =>
      callback(new Blob(["png"], { type: "image/png" }))
    )
    fireEvent.click(screen.getByRole("button", { name: "Persegi" }))
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Simpan gambar" })
      ).toBeEnabled()
    )
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("keeps another notice when an image is made", async () => {
    show({ lookup: vi.fn(async (word: string) => EMPTY(word)) })
    fireEvent.click(await screen.findByRole("button", { name: "capital" }))
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Belum ada arti untuk kata ini."
      )
    )
    fireEvent.click(screen.getByRole("button", { name: "Persegi" }))
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Simpan gambar" })
      ).toBeEnabled()
    )
    expect(screen.getByRole("status")).toHaveTextContent(
      "Belum ada arti untuk kata ini."
    )
  })

  it("shrinks the cover once and closes the full-size bitmap", async () => {
    const close = vi.fn()
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 2000, height: 3000, close }))
    )
    try {
      show({ loadCover: () => Promise.resolve(new Blob(["cover"])) })
      await waitFor(() => expect(close).toHaveBeenCalledTimes(1))
      expect(
        canvas.calls.some(
          (call) =>
            call.name === "drawImage" &&
            call.args[3] === 200 &&
            call.args[4] === 300
        )
      ).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("opens the share sheet once when Bagikan is tapped twice", async () => {
    let finishShare: () => void = () => undefined
    const share = vi.fn(
      () => new Promise<void>((resolve) => (finishShare = resolve))
    )
    const restore = stubNavigator({
      canShare: () => true,
      share,
      clipboard: { writeText: async () => undefined },
    })
    try {
      show()
      const button = await screen.findByRole("button", { name: "Bagikan" })
      await waitFor(() => expect(button).toBeEnabled())
      fireEvent.click(button)
      expect(button).toBeDisabled()
      fireEvent.click(button)
      expect(share).toHaveBeenCalledTimes(1)
      finishShare()
      await waitFor(() => expect(button).toBeEnabled())
    } finally {
      restore()
    }
  })

  it("only says the link was copied once it was", async () => {
    let copied: () => void = () => undefined
    const restore = stubNavigator({
      canShare: () => true,
      share: async () => undefined,
      clipboard: {
        writeText: () => new Promise<void>((resolve) => (copied = resolve)),
      },
    })
    try {
      show()
      const button = await screen.findByRole("button", { name: "Bagikan" })
      await waitFor(() => expect(button).toBeEnabled())
      fireEvent.click(button)
      await waitFor(() => expect(button).toBeEnabled())
      expect(screen.getByRole("status")).toBeEmptyDOMElement()
      copied()
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Link Glosa sudah disalin, tempel di stiker Link Instagram."
        )
      )
    } finally {
      restore()
    }
  })
})
