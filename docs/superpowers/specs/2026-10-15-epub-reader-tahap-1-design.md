# Velora — Desain Tahap 1: Fondasi Reader

- **Tanggal:** 2026-10-15
- **Status:** Draf, menunggu review
- **Nama aplikasi:** "Velora" (nama sementara)
- **Mockup:** [mockups/lobi.html](mockups/lobi.html) · [mockups/alur-login.html](mockups/alur-login.html)

---

## 1. Ringkasan produk

Velora adalah **EPUB reader berbasis web (PWA) untuk orang Indonesia yang belajar bahasa Inggris lewat buku**. User meng-upload EPUB miliknya sendiri, membacanya dalam suasana "perpustakaan", mengetuk kata yang sulit untuk melihat artinya, lalu melatih kosakata itu lewat flashcard.

**Positioning:** "Duolingo untuk membaca buku". Fitur bahasa adalah alasan orang **membayar**, sedangkan gamifikasi adalah alasan orang **kembali setiap hari**.

### Model bisnis (freemium)

| | Gratis | Pro |
|---|---|---|
| Storage | 100 MB | 5 GB |
| Ketuk kata (kamus) | Terbatas, mis. 20/hari | Tanpa batas |
| Terjemahan kalimat & penjelasan AI sesuai konteks | — | ✓ |
| Flashcard | Maks. 100 kata | Tanpa batas + spaced repetition |
| Statistik | Dasar (streak, waktu baca) | Lengkap (kosakata, % pemahaman) |
| Kartu anggota | Standar | Kartu Emas |

Pembayaran lewat Midtrans/Xendit (QRIS, e-wallet, VA), **bukan** in-app billing Play Store/App Store. Harga final ditentukan di tahap 5.

### Roadmap

Rilis publik dilakukan **setelah semua tahap selesai**. Selama pengembangan, 3–5 penguji tertutup diajak mencoba.

| Tahap | Isi | Spec |
|---|---|---|
| **1** | **Fondasi reader:** auth, upload, kuota, lobi perpustakaan, reader, sinkronisasi, offline | **Dokumen ini** |
| 2 | Ketuk kata: lematisasi, kamus EN–ID di Postgres, popup arti, simpan kata | Terpisah |
| 3 | Flashcard (FSRS) + gamifikasi: streak, level, statistik kosakata, % pemahaman | Terpisah |
| 4 | Sosial: katalog `works` (ISBN / Open Library), review + level kesulitan, feed global, suka, moderasi, pembaca online | Terpisah |
| 5 | Monetisasi: paket Free/Pro, Midtrans/Xendit, batas harian, AI konteks (LLM) | Terpisah |

Keputusan yang sudah diambil untuk tahap selanjutnya (dicatat supaya desain tahap 1 tidak menutup jalannya):

- **Fitur kamus (tahap 2/5):** pendekatan hybrid. Tabel kamus EN–ID di Postgres dipakai untuk semua user (biaya ~0), sedangkan LLM untuk "jelaskan dalam konteks" dan terjemahan kalimat khusus Pro. Hasil LLM di-cache.
- **Sosial (tahap 4):** review sederhana (rating, level mudah/sedang/sulit, teks, kata yang dipelajari), feed global Terbaru/Populer, dan tombol suka. **Tanpa follow dan tanpa komentar.** User hanya bisa me-review buku yang ada di perpustakaannya sendiri.

---

## 2. Cakupan tahap 1

### Termasuk

1. Auth: email + kata sandi, login Google, konfirmasi email, lupa kata sandi, hapus akun.
2. Alur "datang ke perpustakaan": halaman sambutan → buku tamu (masuk) / formulir anggota (daftar) → kartu anggota.
3. Lobi perpustakaan isometrik dengan hotspot dan panel kaca (desktop), versi HP dengan bottom sheet.
4. Rak Saya: daftar buku, pencarian, urutan, upload banyak file, kuota 100 MB.
5. Reader: foliate-js, mode halaman/scroll, font, ukuran, spasi, margin, tema terang/sepia/gelap, daftar isi.
6. Sinkronisasi posisi baca antar perangkat.
7. Offline: app shell, daftar buku, dan buku yang sudah diunduh.
8. Halaman Pengaturan, Kebijakan Privasi, dan Syarat Layanan.
9. Testing (unit, RLS, E2E) dan deploy ke VPS.

### Tidak termasuk (masuk tahap lain)

Ketuk kata, kosakata, flashcard, streak/level, review, feed, pembaca online, pengelompokan rak per genre, highlight/catatan, pencarian teks di dalam buku, pembayaran, dan AI.

Elemen UI untuk fitur-fitur ini **tidak ditampilkan** di tahap 1. Item menu "Kosakata" dan "Papan Ulasan" baru muncul di tahapnya masing-masing. Tidak ada tombol mati atau label "segera hadir".

---

## 3. Arsitektur

```
┌─────────────────────── Browser (PWA) ───────────────────────┐
│  TanStack Start (React + TypeScript)                        │
│   ├─ TanStack Router  → routing type-safe, beforeLoad auth  │
│   ├─ TanStack Query   → cache data Supabase (dipersist ke   │
│   │                     IndexedDB untuk offline)            │
│   ├─ foliate-js       → render EPUB (halaman/scroll, CFI)   │
│   ├─ Dexie (IndexedDB)→ file EPUB, posisi baca, antrean     │
│   └─ Service worker   → app shell & cover offline           │
└──────────────┬──────────────────────────────┬───────────────┘
               │ server functions             │ langsung (RLS)
               ▼                              ▼
┌──────────────────────────── Supabase Cloud ─────────────────┐
│  Auth      → email+password, Google OAuth, konfirmasi email │
│  Postgres  → profiles, books, reading_progress              │
│  Storage   → bucket privat "books"                          │
└─────────────────────────────────────────────────────────────┘

Hosting aplikasi: VPS (KVM 2) → Docker + Caddy (HTTPS otomatis)
```

### Keputusan teknis

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Framework | TanStack Start | Aplikasi bersifat client-heavy. Kelebihan RSC/ISR di Next.js tidak terpakai karena perpustakaan bersifat privat. |
| Render EPUB | foliate-js | Aktif dikembangkan, dipakai Foliate dan Readest, mendukung CFI dan mode halaman/scroll. |
| Backend | Supabase Cloud | Backup dan keamanan dikelola Supabase. Bisa pindah ke self-host nanti (`pg_dump` + migrasi file). |
| Penyimpanan file | Supabase Storage | Paling sederhana karena RLS terintegrasi. Akses dibungkus satu modul supaya bisa pindah ke Cloudflare R2 jika egress mahal. |
| UI kit | Tailwind CSS + shadcn/ui (dikustomisasi) | Komponen aksesibel yang dibungkus tema perpustakaan. |
| Font | Atkinson Hyperlegible (UI), Libre Caslon Text (judul), Caveat (tulisan tangan dekoratif), Courier Prime (mesin tik) | Mudah dibaca dan berkarakter perpustakaan. |
| Bahasa | UI berbahasa Indonesia, path URL berbahasa Inggris | |

**Prinsip pemisahan:** operasi baca/tulis biasa langsung ke Supabase dari browser dan dilindungi RLS. **Server functions** hanya untuk hal yang tidak boleh dipercayakan ke client: mengeluarkan signed upload URL setelah cek kuota, konfirmasi upload, dan hapus akun.

---

## 4. Model data

Semua tabel memakai RLS. Migrasi disimpan di `supabase/migrations/`.

```
profiles                          1 baris per user, dibuat trigger saat auth.users insert
  id                  uuid PK = auth.users.id
  member_no           bigint unik, dari sequence (nomor kartu anggota, publik)
  username            text unik (3–20 karakter: huruf kecil, angka, _)
  display_name        text
  avatar_url          text null
  plan                text 'free' | 'pro'          default 'free'   (hanya server)
  storage_limit_bytes bigint                       default 104857600 (hanya server)
  reader_settings     jsonb                        default {}
  onboarded_at        timestamptz null             (null = belum melihat kartu anggota)
  created_at          timestamptz

books
  id                  uuid PK
  user_id             uuid FK → profiles, on delete cascade
  title, author       text
  description         text null        (dari metadata EPUB, HTML dibersihkan, maks. 2000 karakter)
  language            text null        (dari metadata EPUB)
  file_path           text             '{user_id}/{book_id}.epub'
  cover_path          text null        '{user_id}/{book_id}-cover.webp'
  size_bytes          bigint           (epub + cover)
  sha256              text
  status              text 'pending' | 'ready'
  work_id             uuid null        (disiapkan untuk tahap 4, belum dipakai)
  created_at, last_opened_at
  unique (user_id, sha256)

reading_progress
  user_id, book_id    PK gabungan, FK on delete cascade
  cfi                 text
  percentage          numeric(5,2)
  updated_at          timestamptz      (waktu dari client, dipakai untuk "terbaru menang")
```

### RLS

- `profiles`: user hanya bisa membaca miliknya sendiri. User bisa mengubah `display_name`, `username`, `avatar_url`, `reader_settings`, dan `onboarded_at` miliknya (dibatasi dengan column privileges). Kolom `plan`, `storage_limit_bytes`, dan `member_no` hanya bisa diubah server.
- `books`: select/update/delete hanya milik sendiri. **Tidak ada policy insert untuk client.** Insert hanya lewat server function.
- `reading_progress`: semua operasi hanya untuk baris milik sendiri. Penulisan lewat fungsi `save_progress(book_id, cfi, percentage, updated_at)` yang **hanya menimpa jika `updated_at` lebih baru**.
- Storage bucket `books` (privat): user hanya bisa membaca objek dengan prefix `{auth.uid()}/`. Tidak ada policy insert, karena upload hanya lewat signed upload URL.

### Kuota

Pemakaian storage **dihitung, tidak disimpan**: `SUM(size_bytes)` dari `books` milik user dengan status `pending` atau `ready`. Dengan begitu tidak ada counter yang bisa meleset.

---

## 5. Upload dan kuota

1. **Browser:** foliate-js mem-parsing file. Jika gagal, file ditolak dengan pesan "File EPUB rusak atau tidak didukung". Browser lalu mengambil judul, penulis, bahasa, dan cover, mengecilkan cover menjadi WebP (lebar 400px), serta menghitung SHA-256 lewat Web Crypto.
2. **Server function `requestUpload({ sha256, sizes, metadata })`:**
   - Wajib login.
   - Ukuran EPUB maks. **50 MB per file**.
   - Duplikat (`user_id` + `sha256` sudah ada) ditolak dengan pesan "Buku ini sudah ada di rakmu".
   - Kuota diperiksa dalam transaksi dengan `SELECT … FOR UPDATE` pada baris `profiles`, dengan syarat `terpakai + ukuran_baru ≤ storage_limit_bytes`.
   - Jika lolos, server meng-insert `books` (`pending`) dan mengembalikan signed upload URL untuk EPUB dan cover.
3. **Browser** upload langsung ke Supabase Storage dengan progres per file. Bandwidth VPS tidak terpakai.
4. **Server function `confirmUpload(bookId)`:** membaca metadata objek di Storage. Jika ukuran cocok, status menjadi `ready`. Jika tidak cocok, objek dan baris dihapus lalu error dikembalikan.
5. **pg_cron** menghapus baris `pending` yang berumur lebih dari 1 jam beserta objeknya.

**Hapus buku:** objek di Storage dan baris di database ikut terhapus, dan kuota langsung kembali. Salinan lokal di IndexedDB juga dihapus.

Akses Storage dibungkus satu modul `bookStorage` (`createUploadUrls`, `getReadUrl`, `remove`, `statObject`) supaya penyedia penyimpanan bisa diganti.

---

## 6. Auth: "datang ke perpustakaan"

Rujukan visual: [mockups/alur-login.html](mockups/alur-login.html).

| Langkah | Route | Isi |
|---|---|---|
| 1. Tiba | `/` | Adegan lobi diredupkan, tanpa panel. Kartu sambutan berisi tombol **Masuk** dan **Daftar jadi anggota**. Meja Admin berdenyut. Di-render di server (SSR) untuk SEO. |
| 2. Buku tamu | `/login` | Kamera zoom ke Meja Admin (±0,8 detik), petugas menyapa lewat balon kata. Buku tamu terbuka: **kiri** tata tertib dan jumlah pengunjung hari ini (angka saja), **kanan** form email + kata sandi, "Tanda tangan & masuk", "Masuk dengan Google", tautan Daftar dan Lupa kata sandi. |
| 3. Formulir anggota | `/register` | Nama lengkap, nama pengguna, email, kata sandi, centang persetujuan tata tertib (tertaut ke `/terms` dan `/privacy`), tombol "Ajukan keanggotaan" atau "Daftar dengan Google". Setelah dikirim, petugas berkata "Kami kirim surat konfirmasi ke emailmu". |
| 4. Kartu anggota | `/welcome` | Muncul jika `profiles.onboarded_at` masih null. Cap "DITERIMA" dihentakkan, lalu kartu tampil (nama, No. anggota, anggota sejak, paket, storage). Untuk user Google, username yang dibuat otomatis bisa diubah di sini. Tombol "Masuk ke perpustakaan" mengisi `onboarded_at` lalu menuju `/lobby`. |

**Route pendukung:** `/auth/callback` (tukar kode PKCE untuk OAuth, konfirmasi email, dan reset kata sandi), `/forgot-password`, `/reset-password`.

**Aturan:**

- User yang sudah login dan membuka `/`, `/login`, atau `/register` langsung diarahkan ke `/lobby`, dengan toast "Selamat datang kembali, {nama}".
- Route terlindungi mengecek sesi di `beforeLoad` dan mengarahkan ke `/login?next=…` jika belum login.
- Satu email berarti satu akun. Supabase menautkan identitas Google ke akun email yang sama.
- Username dari formulir dikirim lewat `signUp({ options: { data } })` lalu disimpan oleh trigger pembuat `profiles`. Ketersediaannya dicek saat mengetik lewat RPC `username_available(text)`. Jika tetap bentrok, trigger menambahkan angka.
- Username otomatis untuk user Google: bagian depan email dirapikan, ditambah angka jika sudah dipakai.
- Semua isian adalah `<input>` biasa (`autocomplete` benar), sehingga password manager tetap berfungsi. Font tulisan tangan hanya untuk tampilan nilai isian.
- Error login ditampilkan dua kali: lewat balon kata petugas ("Hmm, kata sandinya belum cocok…") dan pesan error standar di bawah isian (`aria-live`).
- Animasi bisa dilewati (klik di mana saja) dan dimatikan saat `prefers-reduced-motion`.
- **SMTP kustom** (mis. Resend) wajib untuk produksi, karena SMTP bawaan Supabase sangat terbatas.
- Hapus akun (di `/settings`): konfirmasi dengan mengetik username, lalu server function menghapus semua objek Storage dan user (data lain ikut terhapus lewat cascade).

---

## 7. Lobi perpustakaan

Rujukan visual: [mockups/lobi.html](mockups/lobi.html).

### Adegan

- Satu **ilustrasi isometrik landscape** berkualitas tinggi (AVIF + WebP, target ≤ 400 KB). Selama ilustrasi final belum ada, dipakai **adegan vektor SVG dari mockup** sebagai placeholder.
- **Hotspot** didefinisikan di satu file konfigurasi (`lobbyHotspots.ts`: id, label, posisi dalam % terhadap ilustrasi, tujuan). Mengganti ilustrasi cukup dengan memperbarui koordinat.
- Hotspot tahap 1:
  - **Meja Baca** → buka buku terakhir.
  - **Meja Admin** → panel upload.
  - **Rak (semua zona)** → `/shelf`.
- Label zona genre (Sains & Teknologi, Fantasi & Petualangan, dll.) di tahap 1 hanya dekorasi yang mengarah ke Rak Saya. Pengelompokan per genre menunggu katalog di tahap 4.
- Hotspot dirender sebagai `<button>` HTML di atas gambar, sehingga bisa diakses keyboard dan dibaca screen reader. Gambarnya sendiri dekoratif.
- Animasi ringan opsional (kilau globe, cahaya lampu) memakai CSS dan dimatikan saat `prefers-reduced-motion`.

### Panel (desktop, ≥ 1024px)

| Panel | Isi di tahap 1 |
|---|---|
| Top bar | Logo, jumlah "Buku saya", pencarian (judul/penulis di rak sendiri), avatar + menu |
| Sidebar | Lobi, Rak Saya, Pengaturan |
| Peta Perpustakaan | Denah mini dengan penanda Rak, Meja Baca, Meja Admin, dan posisi Anda. Bisa diketuk untuk berpindah. |
| Detail Buku | Muncul saat buku dipilih: cover, judul, penulis, deskripsi (dari metadata), progres + bab, Lanjutkan Membaca, Simpan offline / Hapus dari perangkat, Hapus buku |
| Baru Dibuka | 5 buku terakhir (`last_opened_at`) dengan bar progres |
| Upload EPUB | Drag & drop / pilih file, bar storage "34 / 100 MB" |

### HP (< 1024px)

- Adegan bisa digeser (pan) dengan posisi awal terfokus ke Meja Baca.
- Ada **bottom sheet** "Lanjutkan membaca". Detail buku tampil sebagai bottom sheet yang diperluas.
- Tombol **"+"** untuk upload. Peta disembunyikan karena adegannya sendiri sudah berfungsi sebagai peta.
- Tab bar: Lobi, Rak, Pengaturan (sama dengan item sidebar desktop).

### Empty state

Untuk user baru tanpa buku, petugas di Meja Admin menyapa: "Rakmu masih kosong. Bawa buku pertamamu ke sini!" Disertai tautan ke **Standard Ebooks** dan **Project Gutenberg** (EPUB legal dan gratis).

---

## 8. Rak Saya (`/shelf`)

- Grid cover di atas papan rak kayu, dengan bar progres tipis per buku dan penanda "Tersedia offline".
- Pencarian judul/penulis. Urutan: terakhir dibuka (default), judul, atau tanggal ditambahkan.
- Upload banyak file sekaligus, dengan progres dan pesan per file: duplikat, kuota penuh, terlalu besar, atau file rusak.
- Bar storage dan nama paket ditampilkan di header.

---

## 9. Reader (`/read/$bookId`)

- Route **client-only** (`ssr: false`).
- **Memuat buku:** cek IndexedDB terlebih dulu. Jika belum ada, minta signed URL (1 jam), download, simpan ke IndexedDB, lalu render. Setelah itu `last_opened_at` diperbarui.
- **Pengaturan** (disimpan di `profiles.reader_settings` dan di-cache lokal):
  - font: serif / sans / ramah disleksia
  - ukuran, spasi baris, margin
  - tema terang / sepia / gelap
  - mode halaman / scroll
- **Navigasi:** ketuk kiri/kanan untuk pindah halaman, ketuk tengah untuk toolbar, swipe, tombol panah dan PageUp/PageDown, panel daftar isi, slider progres + persentase.
- **Tampilan reader tetap bersih.** Nuansa perpustakaan hanya ada di bingkai (toolbar dan panel), tidak di halaman teks.

---

## 10. Sinkronisasi posisi baca

1. Event `relocate` dari foliate-js memberikan CFI dan persentase.
2. Posisi langsung ditulis ke IndexedDB. Pengiriman ke Supabase memakai debounce 5 detik, dan langsung dikirim saat `visibilitychange: hidden` atau `pagehide`.
3. Saat offline, data masuk antrean IndexedDB dan dikirim ulang ketika event `online` terjadi atau saat aplikasi dibuka.
4. Server: `save_progress` hanya menimpa jika `updated_at` dari client lebih baru.
5. **Saat buku dibuka:** posisi lokal langsung dirender, lalu posisi server diambil. Jika posisi server lebih baru dan berbeda lebih dari 1%, muncul toast *"Lanjutkan dari 45% (dibaca di perangkat lain)? [Lompat]"*. Aplikasi tidak melompat otomatis.

---

## 11. Offline (PWA)

- Service worker (Workbox) mem-precache app shell, font, dan ilustrasi lobi. Cover di-cache dengan strategi cache-first.
- Cache TanStack Query dipersist ke IndexedDB, sehingga rak tetap tampil saat offline.
- Setiap buku punya aksi "Simpan offline" dan "Hapus dari perangkat" (hanya salinan lokal).
- Aplikasi memanggil `navigator.storage.persist()` saat user pertama kali menyimpan buku offline.
- Upload dan perubahan profil membutuhkan koneksi. Tombolnya dinonaktifkan dengan keterangan "Butuh internet".
- Manifest PWA dengan ikon dan `display: standalone`, sehingga aplikasi bisa di-install ke layar utama.

---

## 12. Penanganan error

| Situasi | Penanganan |
|---|---|
| EPUB rusak atau tidak didukung | Ditolak di browser sebelum upload, dengan pesan per file |
| Kuota penuh / file > 50 MB / duplikat | Ditolak oleh `requestUpload` dengan pesan spesifik, lalu ditawarkan hapus buku lain |
| Upload terputus | Baris `pending` dibersihkan pg_cron. User bisa mencoba lagi. |
| Ukuran di Storage tidak cocok | `confirmUpload` menghapus objek dan baris, lalu menampilkan error |
| Signed URL kedaluwarsa | Otomatis minta URL baru satu kali |
| Penyimpanan perangkat penuh | Salinan lokal yang paling lama tidak dibuka dihapus (bukan file di server), lalu dicoba lagi |
| Sesi habis saat offline | Buku lokal tetap bisa dibaca. Sinkronisasi menunggu login ulang. |
| Gagal sinkron berulang kali | Data tetap di antrean. Ada indikator kecil "Belum tersinkron" di toolbar reader. |
| Error tak terduga | Error boundary per route dengan pesan ramah, dan dilaporkan ke Sentry |

---

## 13. Testing

| Jenis | Alat | Cakupan wajib |
|---|---|---|
| Unit | Vitest | Validasi upload, logika kuota, "terbaru menang" pada progres, wrapper metadata EPUB, pembuatan username otomatis |
| Database | Supabase CLI (lokal) + pgTAP | **RLS:** user A tidak bisa membaca/mengubah buku, progres, atau objek Storage milik user B. User tidak bisa mengubah `plan` atau `storage_limit_bytes`. Insert `books` dari client ditolak. `save_progress` menolak data yang lebih lama. Kuota menolak upload yang melebihi batas, termasuk dua permintaan bersamaan. |
| E2E | Playwright | Daftar → konfirmasi email (inbox lokal Supabase) → kartu anggota → lobi. Upload EPUB contoh (Standard Ebooks) → baca → pindah halaman → buka di browser context kedua → muncul tawaran "Lanjutkan". Mode offline: buku tersimpan tetap terbuka. Hapus buku → kuota kembali. |

CI (GitHub Actions) menjalankan lint, typecheck, unit, pgTAP, dan E2E pada setiap push.

---

## 14. Deploy

```
GitHub push ke main
  └─▶ GitHub Actions: lint + test → build Docker image → push ke GHCR
        └─▶ SSH ke VPS: docker compose pull && docker compose up -d

VPS KVM 2
  ├─ Caddy  → HTTPS otomatis (Let's Encrypt), reverse proxy
  └─ app    → TanStack Start (Node), port internal 3000
```

- Dua proyek Supabase: **dev** dan **prod**. Migrasi dijalankan lewat Supabase CLI di pipeline.
- Env: `SUPABASE_URL` dan publishable key boleh dipakai di browser. **Secret key hanya ada di server.** Dicek di CI dengan memastikan secret tidak muncul di bundle client.
- Monitoring: Sentry (browser + server) dan Uptime Kuma di VPS.
- Halaman `/privacy` dan `/terms` wajib ada sebelum Google OAuth produksi diaktifkan.

---

## 15. Pertanyaan terbuka

1. **Nama aplikasi dan domain.** "Velora" masih nama sementara.
2. **Sumber ilustrasi final:** AI image generator atau ilustrator. Lisensinya harus mengizinkan pemakaian komersial.
3. **Penyedia SMTP** untuk email konfirmasi dan reset kata sandi (kandidat: Resend).
