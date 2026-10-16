import { describe, expect, it } from "vitest"
import { bookMessage } from "./book-messages"

describe("bookMessage", () => {
  it("explains each upload problem", () => {
    expect(bookMessage("not_epub")).toBe(
      "Hanya file .epub yang bisa dibawa masuk."
    )
    expect(bookMessage("epub_invalid")).toBe(
      "File EPUB rusak atau tidak didukung."
    )
    expect(bookMessage("too_large")).toBe("Ukurannya lebih dari 50 MB.")
    expect(bookMessage("duplicate")).toBe("Buku ini sudah ada di rakmu.")
    expect(bookMessage("quota_exceeded")).toBe(
      "Rakmu penuh. Hapus buku lain dulu untuk memberi tempat."
    )
    expect(bookMessage("too_many_pending")).toBe(
      "Terlalu banyak unggahan yang belum selesai. Tunggu sebentar, lalu coba lagi."
    )
    expect(bookMessage("upload_interrupted")).toBe(
      "Unggahan terputus. Coba lagi."
    )
    expect(bookMessage("size_mismatch")).toBe(
      "File tidak terunggah utuh. Coba lagi."
    )
  })

  it("falls back for unknown codes, including prototype keys", () => {
    const fallback = "Ada yang tidak beres. Coba lagi sebentar lagi."
    expect(bookMessage("unknown")).toBe(fallback)
    expect(bookMessage("constructor")).toBe(fallback)
    expect(bookMessage(null)).toBe(fallback)
  })
})
