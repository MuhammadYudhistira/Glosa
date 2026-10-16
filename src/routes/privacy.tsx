import { createFileRoute } from "@tanstack/react-router"
import { LegalPage } from "@/components/legal/LegalPage"
import { LEGAL_CONTACT_EMAIL } from "@/lib/site"

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Kebijakan Privasi — Glosa" }] }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <LegalPage title="Kebijakan Privasi" updated="15 Oktober 2026">
      <p>
        Glosa menghormati privasimu. Halaman ini menjelaskan data apa yang kami
        kumpulkan, untuk apa, dan apa hakmu sesuai Undang-Undang Pelindungan
        Data Pribadi (UU PDP).
      </p>
      <h2>Data yang kami kumpulkan</h2>
      <ul>
        <li>
          Data akun: email, nama, nama pengguna, dan foto profil (jika masuk
          dengan Google).
        </li>
        <li>
          File EPUB yang kamu unggah beserta judul, penulis, dan sampul buku.
        </li>
        <li>
          Data membaca: posisi baca, pengaturan tampilan, dan aktivitas belajar.
        </li>
        <li>
          Data teknis: waktu masuk terakhir dan laporan error untuk memperbaiki
          aplikasi.
        </li>
      </ul>
      <h2>Untuk apa data dipakai</h2>
      <ul>
        <li>
          Menyediakan perpustakaan pribadimu dan menyinkronkannya antar
          perangkat.
        </li>
        <li>
          Mengirim email yang diperlukan, seperti konfirmasi akun dan atur ulang
          kata sandi.
        </li>
        <li>Menjaga keamanan layanan dan memperbaiki masalah.</li>
      </ul>
      <p>Kami tidak menjual data pribadimu dan tidak memakainya untuk iklan.</p>
      <h2>Siapa yang bisa melihat bukumu</h2>
      <p>
        File EPUB yang kamu unggah bersifat pribadi dan hanya bisa dibaca
        olehmu. Jumlah "pengunjung hari ini" di buku tamu hanya berupa angka
        tanpa nama.
      </p>
      <h2>Tempat penyimpanan</h2>
      <p>
        Data disimpan di layanan Supabase dan server aplikasi kami. Penyedia
        layanan tersebut hanya memproses data atas instruksi kami.
      </p>
      <h2>Hakmu</h2>
      <ul>
        <li>Melihat dan memperbarui data profilmu di halaman Pengaturan.</li>
        <li>
          Menghapus akun beserta seluruh datamu kapan saja dari halaman
          Pengaturan.
        </li>
        <li>
          Meminta salinan data atau mengajukan pertanyaan lewat email di bawah.
        </li>
      </ul>
      <h2>Kontak</h2>
      <p>
        Hubungi kami di{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
