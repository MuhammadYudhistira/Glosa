import { createFileRoute } from "@tanstack/react-router"
import { LegalPage } from "@/components/legal/LegalPage"
import { LEGAL_CONTACT_EMAIL } from "@/lib/site"

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Syarat Layanan — Glosa" }] }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <LegalPage
      title="Syarat Layanan (Tata Tertib Perpustakaan)"
      updated="15 Oktober 2026"
    >
      <p>
        Dengan menjadi anggota Glosa, kamu setuju dengan tata tertib berikut.
      </p>
      <h2>1. Buku yang kamu bawa</h2>
      <ul>
        <li>
          Unggah hanya file EPUB yang kamu miliki secara sah atau yang
          berlisensi bebas.
        </li>
        <li>
          Buku yang kamu unggah hanya bisa dibaca olehmu. Glosa bukan tempat
          berbagi file.
        </li>
        <li>Kami dapat menghapus file yang dilaporkan melanggar hak cipta.</li>
      </ul>
      <h2>2. Ulasan dan perilaku</h2>
      <ul>
        <li>
          Bagikan ulasan, bukan file. Jangan mengunggah konten yang melanggar
          hukum.
        </li>
        <li>Hormati anggota lain. Ujaran kebencian dan spam akan dihapus.</li>
      </ul>
      <h2>3. Akun</h2>
      <ul>
        <li>
          Jaga kerahasiaan kata sandimu. Kamu bertanggung jawab atas aktivitas
          di akunmu.
        </li>
        <li>Kamu boleh menghapus akunmu kapan saja dari halaman Pengaturan.</li>
      </ul>
      <h2>4. Paket dan penyimpanan</h2>
      <p>
        Paket Gratis mendapat 100 MB penyimpanan. Ketentuan paket berbayar akan
        diumumkan sebelum tersedia.
      </p>
      <h2>5. Perubahan layanan</h2>
      <p>
        Kami dapat mengubah tata tertib ini. Perubahan penting akan
        diberitahukan lewat aplikasi atau email.
      </p>
      <h2>Kontak</h2>
      <p>
        Pertanyaan atau laporan pelanggaran:{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
