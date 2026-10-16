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
  offline: "Butuh internet.",
}

const FALLBACK = "Ada yang tidak beres. Coba lagi sebentar lagi."

export function bookMessage(code: string | null | undefined): string {
  return (code && Object.hasOwn(MESSAGES, code) && MESSAGES[code]) || FALLBACK
}
