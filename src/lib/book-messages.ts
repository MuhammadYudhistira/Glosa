const MESSAGES: Record<string, string> = {
  not_epub: "Hanya file .epub yang bisa dibawa masuk.",
  epub_invalid: "File EPUB rusak atau tidak didukung.",
  too_large: "Ukurannya lebih dari 50 MB.",
  duplicate: "Buku ini sudah ada di rakmu.",
  quota_exceeded: "Rakmu penuh. Hapus buku lain dulu untuk memberi tempat.",
  too_many_pending:
    "Terlalu banyak unggahan yang belum selesai. Tunggu sebentar, lalu coba lagi.",
  upload_interrupted: "Unggahan terputus. Coba lagi.",
  size_mismatch: "File tidak terunggah utuh. Coba lagi.",
  not_found: "Buku ini tidak ada di rakmu.",
  not_authenticated: "Sesi masukmu sudah habis. Masuk lagi, ya.",
  offline_not_saved:
    "Buku ini belum tersimpan di perangkat ini. Sambungkan internet untuk membukanya.",
  offline_no_shelf:
    "Rakmu belum tersimpan di perangkat ini. Sambungkan internet untuk membukanya.",
  download_failed: "Buku gagal diunduh. Coba lagi.",
  device_full:
    "Penyimpanan perangkat penuh. Buku ini tetap bisa dibaca, tapi tidak tersimpan untuk offline.",
  device_full_offline:
    "Penyimpanan perangkat penuh. Buku ini tidak bisa disimpan untuk offline.",
  offline: "Butuh internet.",
  words_full:
    "Kosakata sudah penuh (5.000 kata). Hapus beberapa kata untuk menyimpan yang baru.",
  word_invalid: "Kata ini tidak bisa disimpan.",
  position_missing: "Posisi itu tidak ditemukan di buku ini",
}

const FALLBACK = "Ada yang tidak beres. Coba lagi sebentar lagi."

export function bookMessage(code: string | null | undefined): string {
  return (code && Object.hasOwn(MESSAGES, code) && MESSAGES[code]) || FALLBACK
}
