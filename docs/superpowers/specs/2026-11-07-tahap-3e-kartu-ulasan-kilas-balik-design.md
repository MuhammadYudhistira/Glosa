# Tahap 3E: kartu buku selesai, ulasan pribadi, dan kilas balik — desain

Tanggal: 2026-11-07 · Cabang: `tahap-3e-kartu-ulasan`
Spec induk: [`2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md`](2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md) §2, §4.4 · Kebiasaan: [`2026-11-06-tahap-3b-kebiasaan-baca-design.md`](2026-11-06-tahap-3b-kebiasaan-baca-design.md) · Koin: [`2026-11-06-tahap-3c-toko-lobi-design.md`](2026-11-06-tahap-3c-toko-lobi-design.md) · Kosakata: [`2026-11-06-tahap-3d-kosakata-dari-bacaan-design.md`](2026-11-06-tahap-3d-kosakata-dari-bacaan-design.md) · Kartu kutipan: [`2026-10-31-kartu-kutipan-design.md`](2026-10-31-kartu-kutipan-design.md)

## 1. Tujuan

3E merangkum Tahap 3. Saat anggota menyelesaikan sebuah buku, Glosa merayakannya dengan kartu berisi angka dari bacaannya, lalu mengajak menulis ulasan pribadi singkat. Setiap bulan dan tahun, kilas balik menunjukkan apa yang sudah dibaca. Kartu buku selesai dan kilas balik bisa dibagikan sebagai gambar.

Prinsip Tahap 3 tetap berlaku: semua angka datang dari halaman yang dibaca. Tidak ada XP, peringkat, atau kata "gagal". Ulasan tetap pribadi; ulasan publik ada di Tahap 4.

## 2. Keputusan pemilik

| # | Keputusan | Alasan |
|---|---|---|
| 1 | Setelah "Ya, selesai" muncul **kartu ringkasan dulu**, lalu tombol **Tulis ulasan** membuka formulir. Ulasan boleh dilewati dan diisi nanti dari detail buku. | Perayaan dulu, tanpa memaksa menulis. |
| 2 | **Kartu buku selesai bisa dibagikan sebagai gambar**, dengan mesin kartu kutipan. | Iklan gratis yang jujur: buku yang benar-benar selesai dibaca. |
| 3 | **% paham tidak tampil** di kartu buku selesai, di gambarnya, maupun di ulasan. | Pemilik: angka itu tetap di detail buku (3D), bukan bagian dari perayaan. |
| 4 | **Kilas balik = satu halaman + satu gambar**, per bulan atau per tahun. | Cukup untuk merangkum tanpa membangun rangkaian slide. |
| 5 | Kilas balik dibuka dari **panel kebiasaan** dan **peta perpustakaan HP**, ditambah **gelembung lobi** sekali di awal bulan. Tanpa notifikasi push. | Mudah ditemukan, tanpa desakan. |
| 6 | **Ulasan hanya untuk buku selesai**. Ulasan tampil dan diubah di detail buku. Rak mendapat urutan **Rating tertinggi**. | Ulasan merangkum bacaan yang tuntas. |
| 7 | Angka **dihitung di server saat dibuka** (pendekatan A). Ulasan disimpan di tabel baru. Angka kartu tidak dibekukan. | Sama di semua perangkat, tanpa data baru untuk disinkronkan. Membaca ulang setelah selesai jarang, dan angka yang ikut naik tetap jujur. |

## 3. Kartu buku selesai

### 3.1 Kapan muncul

- Di reader, setelah jawaban **Ya, selesai** pada ajakan 3A tersimpan, popup reader **"Selesai: ‹judul›"** muncul. Popup ini menggantikan pemberitahuan "Masuk ke koleksi Sudah dibaca".
- Dari detail buku, tombol **Lihat kartu** membuka kartu yang sama kapan saja untuk buku selesai.
- **Tandai selesai** dari detail buku (bukan dari reader) tidak membuka kartu otomatis. Kartu tetap tersedia lewat **Lihat kartu**.

### 3.2 Isi

1. Sampul kecil (kalau ada), judul, pengarang.
2. **Waktu baca**: total detik `reading_time` buku itu, ditulis dengan format durasi yang sudah ada ("6 jam 20 menit").
3. **Hari membaca**: jumlah hari berbeda yang punya waktu baca buku itu ("dalam 14 hari").
4. **Kata dicari** (jumlah kata diketuk di buku itu, 3D) dan **kata disimpan** (jumlah kata Kosakata dengan `book_id` buku itu).
5. **Koin**: "+50 koin" bila buku punya `coin_awards` (syarat 3C). Tanpa koin, baris ini tidak tampil.
6. Tombol **Tulis ulasan** (atau **Ubah ulasan** bila sudah ada), **Bagikan**, **Nanti**.

Angka yang nol tetap ditulis, kecuali koin. Kartu dimuat dari server. Selama dimuat tampil kerangka. Bila tidak bisa dimuat (offline atau error), kartu menulis "Ringkasan belum bisa dimuat" dengan judul dan sampul dari rak, dan tombol ulasan tetap ada.

### 3.3 Gambar bagikan

- Mesin, ukuran (Story 9:16, Persegi 1:1), tema (Sampul, Kertas, Malam), kaki (logo dan alamat situs), dan cara berbagi sama dengan kartu kutipan (spec kartu kutipan §2 keputusan 5, 8–10, 12).
- Isi dari atas: sampul besar, judul, pengarang, label **Selesai dibaca**, waktu baca, dan bintang bila sudah diulas.
- Tidak memuat catatan, kesulitan, kata, maupun % paham.
- Pilihan tema dan ukuran diingat bersama pilihan kartu kutipan.

## 4. Ulasan pribadi

### 4.1 Formulir

- Dibuka dari kartu atau dari detail buku, di popup yang sama.
- **Bintang 1–5**, wajib untuk menyimpan.
- **Kesulitan**: Mudah / Sedang / Sulit, opsional, bisa dikosongkan lagi.
- **Catatan**: opsional, paling panjang 2.000 karakter, dengan penghitung saat mendekati batas.
- **Kata dari buku ini**: kata Kosakata dengan `book_id` buku itu, hanya untuk dibaca. Paling banyak 12 kata (yang tersimpan paling awal), lalu **Lihat semua** ke Kosakata `?buku=`. Tanpa kata, bagian ini tidak tampil.
- Tombol **Simpan**, dan **Hapus ulasan** bila ulasan sudah ada. Simpan dan hapus butuh online; offline keduanya nonaktif dengan teks "Perlu koneksi internet".
- Setelah tersimpan, formulir kembali ke kartu (dari reader) atau ke detail buku.

### 4.2 Detail buku

Di tiga tempat detail buku yang sama dengan baris 3D (`BookDetailPanel`, `ContinueSheet`, `BookDetail`), untuk buku selesai:

- **Ulasan saya**: bintang, kesulitan, dan catatan (dipotong 3 baris, bisa dibuka), dengan tombol **Ubah**. Tanpa ulasan: tombol **Tulis ulasan**.
- Tombol **Lihat kartu**.
- Buku belum selesai: bagian ini tidak tampil.

### 4.3 Aturan

- Hanya buku selesai (`finished_at` terisi) yang bisa diulas.
- **Tandai belum selesai** menyembunyikan ulasan tanpa menghapusnya. Menandai selesai lagi memunculkannya kembali.
- Menghapus buku atau akun menghapus ulasannya.
- Ulasan terlihat offline (dibawa daftar rak), tetapi hanya bisa diubah online.

### 4.4 Rak

Urutan baru **Rating tertinggi**: buku berbintang lebih dulu, dari bintang terbanyak. Bintang yang sama diurutkan dari yang terbaru selesai. Buku tanpa bintang (termasuk yang belum selesai) di bawah, dengan urutan bawaan.

## 5. Kilas balik

### 5.1 Halaman

- Route popup lobi **`/recap`**, seperti `/habits` dan `/shop`. Alamat `?periode=2026-10` untuk bulan, `?periode=2026` untuk tahun.
- Tanpa parameter atau dengan nilai yang tidak dikenal: bulan berjalan.
- Periode yang belum selesai diberi label "sejauh ini".
- Pemilih: **Bulan | Tahun** dan daftar periode dari bulan (atau tahun) pertama yang punya waktu baca sampai sekarang. Tanpa waktu baca sama sekali, daftarnya hanya periode berjalan.

### 5.2 Isi

1. **Buku selesai** di periode itu: jumlah dan sampul, paling banyak 12, lalu "+N". Sampul membuka detail buku. Urut dari yang terbaru selesai.
2. **Waktu baca** total dan **hari membaca** (hari dengan waktu baca > 0).
3. **Streak terpanjang** di dalam periode, dengan aturan 3B (hari membaca = menit ≥ target beku hari itu; 2 hari jeda gratis per minggu Senin–Minggu). Streak dihitung hanya dari hari di dalam periode.
4. **Kata dicari**: kata yang pertama kali diketuk di periode itu, dihitung unik per kata di semua buku.
5. **Kata disimpan** di periode itu.
6. **Paling sering bertemu lagi**: kata tersimpan dengan jumlah pertemuan terbanyak yang tercatat di periode itu, beserta jumlahnya. Bila sama banyak, kata pertama menurut abjad. Tanpa pertemuan, baris ini tidak tampil.

Periode tanpa waktu baca, buku selesai, dan kata: **"Belum ada bacaan di Oktober 2026."** tanpa tombol Bagikan. Offline: "Perlu koneksi internet".

### 5.3 Gambar bagikan

- Satu kartu, mesin dan tema sama dengan §3.3.
- Judul **"Oktober 2026 di Glosa"** atau **"2026 di Glosa"**, ditambah "sejauh ini" untuk periode berjalan.
- Isi: jumlah buku selesai dengan paling banyak 6 sampul, waktu baca, hari membaca, streak terpanjang, kata disimpan, dan kata paling sering bertemu.
- Kata dicari tidak ikut.

### 5.4 Pintu masuk

- Tautan **Kilas balik** di panel kebiasaan (`/habits`).
- Tujuan baru **Kilas balik** di peta perpustakaan HP, setelah Kebiasaan.
- **Gelembung lobi**:
  - Pada tanggal 1–7 setiap bulan, bila bulan lalu punya waktu baca, lobi menampilkan sekali per perangkat **"Kilas balik Oktober sudah siap"**, yang membuka `/recap?periode=2026-10`.
  - Di bulan Januari isinya **"Kilas balik 2025 sudah siap"** dan membuka `?periode=2025`.
  - Gelembung yang sudah tampil diingat di `localStorage` per periode. Data bulan lalu dibaca dari cache kebiasaan 3B. Tanpa cache, gelembung tidak tampil.

### 5.5 Zona waktu

Hari dari `reading_time.day` sudah berupa hari lokal perangkat (3B). Waktu lain (selesai buku, ketukan pertama, simpan kata, pertemuan) dipotong per periode dengan zona waktu IANA perangkat (`Intl.DateTimeFormat().resolvedOptions().timeZone`) yang dikirim ke server.

## 6. Data

### 6.1 Migrasi `20261107000200_finish_review_recap.sql` (hanya tambahan)

- **`book_reviews`**:
  - Kolom: `book_id uuid primary key references books on delete cascade`, `user_id uuid not null references profiles on delete cascade`, `rating smallint not null check (rating between 1 and 5)`, `difficulty text check (difficulty in ('easy','medium','hard'))`, `note text check (char_length(note) <= 2000)`, `created_at`, `updated_at`.
  - RLS baca milik sendiri, `revoke all` lalu `grant select`. Penulisan hanya lewat fungsi.
  - Tidak ada kolom publik; Tahap 4 yang menambahkannya.
- **`word_meetings.met_at timestamptz not null default now()`**: waktu baris pertemuan pertama kali tercatat. Baris lama mendapat waktu migrasi. `record_meetings` tidak mengubahnya saat jumlah naik.

### 6.2 Fungsi

Semua `security definer`, `set search_path = ''`, error otentikasi `not_authenticated` (P0001), `revoke execute … from public, anon` lalu `grant` ke `authenticated`. Semua bacaan menjawab satu objek jsonb, bukan baris (batas 1.000 baris PostgREST).

| Fungsi | Jawaban |
|---|---|
| `save_review(p_book_id uuid, p_rating int, p_difficulty text, p_note text)` | `ok`, `not_found` (bukan buku anggota), `not_finished`, `invalid` (rating, kesulitan, atau catatan di luar aturan). Catatan kosong disimpan sebagai null. |
| `delete_review(p_book_id uuid)` | `ok` (juga bila tidak ada ulasan), `not_found`. |
| `book_finish_summary(p_book_id uuid)` | `{ seconds, days, looked_up, saved, words: [12 headword], coins, finished_at }`, atau null untuk buku yang bukan milik anggota. |
| `reading_recap(p_from date, p_to date, p_tz text)` | `{ days: [{ day, seconds, goal_minutes }], books: [{ id, finished_at }], looked_up, saved, top_meeting: { headword, meetings } \| null, first_day }`. Rentang `p_to − p_from` > 366 hari, `p_to < p_from`, atau zona waktu yang tidak ada di `pg_timezone_names` → exception `invalid`. |

- `days` digabung lintas perangkat dan buku per hari, dengan target beku hari itu seperti bacaan kebiasaan 3B.
- `books` hanya membawa id dan waktu selesai; judul dan sampul diambil dari rak di perangkat.
- `looked_up` menghitung kata unik dengan ketukan pertama (`word_lookups.first_at`, paling awal di semua buku) di periode itu.
- `top_meeting` menjumlahkan `word_meetings.count` dengan `met_at` di periode itu, per headword.

### 6.3 Di perangkat

- Daftar buku rak dan snapshot offline-nya mendapat `review: { rating, difficulty, note, updatedAt } | null`, dibaca dengan join ke `book_reviews`.
- Detail buku dan urutan Rating tertinggi membaca dari situ.
- Simpan dan hapus ulasan memuat ulang rak, seperti tandai selesai di 3A.
- Kartu dan kilas balik tidak disimpan di perangkat.

## 7. Kode

- **Server:** `src/server/reviews.ts` (simpan, hapus, ringkasan selesai) dan `src/server/recap.ts` (kilas balik), dengan zod di input, `safeParse` di jawaban, dan kode error tanpa kata "gagal".
- **Logika murni:**
  - `src/lib/recap/period.ts`: parsing `?periode=`, rentang tanggal, daftar periode, label bulan Indonesia;
  - `src/lib/recap/recap.ts`: streak terpanjang di dalam rentang, memakai fungsi `reading-habit.ts`;
  - `src/lib/recap/bubble.ts`: kapan gelembung tampil.
- **Gambar:** layout kartu buku selesai dan kartu kilas balik di `src/lib/quote-card/`, di samping layout kartu kutipan, berbagi token tema, font, kaki, dan `share.ts`.
- **UI:**
  - `FinishCard` (kartu dan gambar);
  - `ReviewForm`;
  - `MyReview` (detail buku);
  - halaman `/recap`;
  - tautan di `HabitPanel` dan `LibraryMap`;
  - gelembung di `LobbyBubbles`;
  - urutan rak di `src/lib/shelf.ts`.
- **Privasi:** satu butir tentang ulasan pribadi (isi, dihapus bersama buku atau akun, tidak dibagikan). Kilas balik tidak menyimpan data baru.

## 8. Pengujian

- **DB** (`tests/db/review-recap.test.ts`):
  - ulasan: simpan, ubah, hapus, `not_finished`, `not_found` untuk buku anggota lain, batas rating, kesulitan, dan catatan, catatan kosong menjadi null;
  - kaskade saat buku dan akun dihapus;
  - `book_finish_summary` dari baris `reading_time`, ketukan, kata tersimpan, dan koin yang disemai;
  - `reading_recap`: batas bulan di zona non-UTC, rentang terlalu panjang dan zona tidak dikenal, `top_meeting` per periode dan urutan seri, `met_at` tidak berubah saat jumlah naik.
- **Unit:**
  - periode (bulan, tahun, nilai salah, bulan berjalan, daftar periode) dan streak terpanjang dalam rentang;
  - gelembung (tanggal 1–7, sekali per periode, Januari menjadi tahunan, tanpa cache);
  - layout gambar (teks panjang muat, tanpa sampul, tanpa bintang);
  - kartu (memuat, tidak bisa dimuat, dengan dan tanpa koin);
  - formulir ulasan (bintang wajib, offline, hapus, kata dari buku);
  - Ulasan saya, urutan Rating tertinggi;
  - halaman kilas balik (isi, kosong, offline, sejauh ini).
- **E2E:**
  - `e2e/finish-review.spec.ts`: selesai di reader, kartu, tulis ulasan, lalu ulasan terlihat di detail buku dan urutan rak;
  - `e2e/recap.spec.ts`: kilas balik dengan data yang disemai menampilkan angka dan sampul; Bagikan menghasilkan gambar (di-stub seperti E2E kartu kutipan).
- **Manual setelah deploy:** gambar di HP (Story, Persegi, ketiga tema), gelembung di awal bulan, dan angka yang sama di HP dan laptop.

## 9. Di luar 3E

- Ulasan publik, katalog `works`, feed, dan moderasi (Tahap 4).
- Kilas balik bergaya slide, perbandingan dengan periode sebelumnya, dan koin di kilas balik.
- Rekap yang dibekukan atau dikirim lewat email.
- Penyimpanan kata per buku yang lebih hemat (catatan 3D, sebelum prod).
