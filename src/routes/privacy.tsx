import { createFileRoute } from "@tanstack/react-router"
import { LegalPage } from "@/components/legal/LegalPage"
import { LEGAL_CONTACT_EMAIL } from "@/lib/site"

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Kebijakan Privasi — Glosa" }] }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <LegalPage title="Kebijakan Privasi" updated="24 Oktober 2026">
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
          Data membaca: posisi baca, pengaturan tampilan, dan aktivitas belajar,
          termasuk kata yang kamu simpan di Kosakata beserta artinya, kalimat
          asalnya, dan judul bukunya.
        </li>
        <li>
          Data teknis: waktu masuk terakhir dan laporan error untuk memperbaiki
          aplikasi. Laporan error hanya memuat ID akunmu, tanpa email atau nama.
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
      <h2>Kamus</h2>
      <p>
        Kata yang kamu ketuk saat membaca dikirim ke server kami untuk dicari
        artinya, dan tidak dibagikan ke pihak lain. Arti kata berasal dari{" "}
        <a href="https://en.wiktionary.org/">English Wiktionary</a> lewat
        ekstrak <a href="https://kaikki.org/">kaikki.org</a>, dengan lisensi{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">
          CC BY-SA 4.0
        </a>
        .
      </p>

      <h2>Tempat penyimpanan</h2>
      <p>
        Akun, data membaca, dan file bukumu disimpan di Supabase, di pusat data
        Singapura. Aplikasi berjalan di server sewaan (VPS) kami. Email akun
        dikirim lewat Resend, dan laporan error disimpan di Sentry. Penyedia
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
