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

  it("explains reading and offline problems", () => {
    expect(bookMessage("offline_not_saved")).toBe(
      "Buku ini belum tersimpan di perangkat ini. Sambungkan internet untuk membukanya."
    )
    expect(bookMessage("offline_no_shelf")).toBe(
      "Rakmu belum tersimpan di perangkat ini. Sambungkan internet untuk membukanya."
    )
    expect(bookMessage("download_failed")).toBe(
      "Buku gagal diunduh. Coba lagi."
    )
    expect(bookMessage("device_full")).toBe(
      "Penyimpanan perangkat penuh. Buku ini tetap bisa dibaca, tapi tidak tersimpan untuk offline."
    )
    expect(bookMessage("device_full_offline")).toBe(
      "Penyimpanan perangkat penuh. Buku ini tidak bisa disimpan untuk offline."
    )
    expect(bookMessage("offline")).toBe("Butuh internet.")
  })

  it("explains why a word was not kept, and a place that is gone", () => {
    expect(bookMessage("words_full")).toBe(
      "Kosakata sudah penuh (5.000 kata). Hapus beberapa kata untuk menyimpan yang baru."
    )
    expect(bookMessage("word_invalid")).toBe("Kata ini tidak bisa disimpan.")
    expect(bookMessage("position_missing")).toBe(
      "Posisi itu tidak ditemukan di buku ini"
    )
  })

  it("falls back for unknown codes, including prototype keys", () => {
    const fallback = "Ada yang tidak beres. Coba lagi sebentar lagi."
    expect(bookMessage("unknown")).toBe(fallback)
    expect(bookMessage("constructor")).toBe(fallback)
    expect(bookMessage(null)).toBe(fallback)
  })
})
