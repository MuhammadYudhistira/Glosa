import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QUOTE_CARD_KEY } from "@/lib/local/keys"
import { decodeCover } from "@/lib/quote-card/cover-art"
import { layoutFinishCard } from "@/lib/quote-card/finish-layout"
import { saveCard } from "@/lib/quote-card/share"
import { stubCanvas } from "@/test/canvas"
import { ShareImage } from "./ShareImage"

vi.mock("@/lib/quote-card/fonts", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cardFontsReady: () => Promise.resolve(),
}))
vi.mock("@/lib/quote-card/cover-art", () => ({
  decodeCover: vi.fn(() => Promise.resolve(null)),
  fetchCoverBlob: vi.fn(() => Promise.resolve(null)),
}))
vi.mock("@/lib/quote-card/share", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  saveCard: vi.fn(),
}))

const input = {
  size: "story" as const,
  title: "Judul",
  author: "Penulis",
  hasCover: false,
  readTime: "2 jam",
  rating: null,
  host: "glos-a.tech",
}
const build = vi.fn(
  (
    size: "story" | "square",
    measure: (t: string, f: string) => number,
    count: number
  ) => layoutFinishCard({ ...input, size, hasCover: count > 0 }, measure)
)

function show(covers: Array<() => Promise<Blob | null>> = []) {
  return render(
    <ShareImage
      label="Kartu"
      description="Kartu buku selesai: Judul"
      fileTitle="Judul"
      seed="b"
      covers={covers}
      build={build}
    />
  )
}

beforeEach(() => {
  stubCanvas()
  localStorage.clear()
  build.mockClear()
  vi.mocked(saveCard).mockClear()
  vi.mocked(decodeCover).mockReset()
  vi.mocked(decodeCover).mockResolvedValue(null)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("ShareImage", () => {
  it("draws the built layout on a canvas named by the description", async () => {
    show()
    expect(
      await screen.findByRole("img", { name: "Kartu buku selesai: Judul" })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(build).toHaveBeenCalledWith("story", expect.any(Function), 0)
    )
  })

  it("remembers the theme and size with the quote card's choice, keeping its layout", async () => {
    localStorage.setItem(
      QUOTE_CARD_KEY,
      JSON.stringify({ layout: "kutipan", theme: "sampul", size: "story" })
    )
    show()
    const sizes = await screen.findByRole("group", { name: "Ukuran" })
    fireEvent.click(sizes.querySelectorAll("button")[1])
    fireEvent.click(screen.getByRole("button", { name: "Tema Malam" }))
    expect(JSON.parse(localStorage.getItem(QUOTE_CARD_KEY) ?? "{}")).toEqual({
      layout: "kutipan",
      theme: "malam",
      size: "square",
    })
    expect(screen.getByRole("button", { name: "Persegi" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("enables Simpan gambar once the PNG is ready, and saves it", async () => {
    show()
    const save = await screen.findByRole("button", { name: "Simpan gambar" })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)
    expect(saveCard).toHaveBeenCalledTimes(1)
    const [blob, name] = vi.mocked(saveCard).mock.calls[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(name).toMatch(/^glosa-/)
  })

  it("counts only the covers that decoded, in order", async () => {
    const image = { tag: "image" } as unknown as CanvasImageSource
    vi.mocked(decodeCover).mockImplementation((blob) =>
      Promise.resolve(blob.size > 0 ? { image, palette: null } : null)
    )
    const blob = () => Promise.resolve(new Blob(["x"]))
    show([blob, () => Promise.resolve(null), blob])
    await waitFor(() =>
      expect(build).toHaveBeenCalledWith("story", expect.any(Function), 2)
    )
  })

  it("decodes covers wide enough for the largest layout", async () => {
    show([() => Promise.resolve(new Blob(["x"]))])
    await waitFor(() =>
      expect(decodeCover).toHaveBeenCalledWith(expect.any(Blob), 600)
    )
  })
})
