# Tahap 3D: kosakata yang tumbuh dari bacaan — desain

Tanggal: 2026-11-06 · Cabang: `tahap-3d-kosakata`
Spec induk: [`2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md`](2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md) §1–§2 · Ketuk kata dan Kosakata: [`2026-10-22-tahap-2-ketuk-kata-design.md`](2026-10-22-tahap-2-ketuk-kata-design.md) · Jam baca: [`2026-11-06-tahap-3b-kebiasaan-baca-design.md`](2026-11-06-tahap-3b-kebiasaan-baca-design.md) §3.1

## 1. Tujuan

Anggota melihat bahasa Inggrisnya tumbuh dari buku yang ia baca, tanpa kuis atau latihan. Untuk setiap buku Glosa menunjukkan seberapa banyak kata yang dipahami tanpa kamus dan kata apa saja yang dicari. Untuk setiap kata di Kosakata, Glosa menunjukkan berapa kali kata itu bertemu lagi di bacaan.

Prinsip Tahap 3 tetap berlaku: semua angka datang dari halaman yang dibaca. Tidak ada kartu hafalan, XP, atau kata "gagal".

## 2. Keputusan pemilik

| # | Keputusan | Alasan |
|---|---|---|
| 1 | **% pemahaman = kata yang tidak perlu dicari**: dari kata unik yang sudah dibaca di sebuah buku, persentase yang tidak diketuk di kamus. | Jujur dan langsung dari bacaan; Glosa tidak punya daftar frekuensi kata atau level pembaca. |
| 2 | Kata yang diketuk **dicatat di server, per buku**. | Angka sama di semua perangkat, dan 3E bisa menampilkan "kata yang dipelajari" dari data ini. |
| 3 | **"Bertemu lagi" dihitung dan ditampilkan di Kosakata**, tanpa penanda tambahan di reader. | Kata yang sering bertemu terasa dikuasai, tanpa kuis; reader tetap fokus membaca. |
| 4 | Tampil di **detail buku dan Kosakata**. Reader tidak berubah. | |
| 5 | **Server menyimpan himpunan kata yang sudah dibaca per buku** (pendekatan A). | Benar di semua perangkat, tidak butuh file EPUB di perangkat untuk menampilkan angka, dan bisa dipakai 3E. |
| 6 | Bab dianggap **sudah dibaca setelah 60 detik** waktu baca di bab itu. | Membuka bab sekilas tidak menambah kata yang dibaca. |

## 3. Perilaku

### 3.1 Bab yang sudah dibaca

- Waktu baca per bab dihitung dari jam baca 3B (§3.1 spec 3B): potongan waktu yang diserahkan jam saat bab itu tampil. "Bab" adalah satu bagian di spine (`section`).
- Waktu per (buku, bab) dijumlahkan di perangkat, juga lintas kunjungan. Saat jumlahnya mencapai **60 detik**, bab itu sudah dibaca di perangkat ini, sekali saja.
- Bab sudah dibaca memicu dua hal (§3.2 dan §3.4). Bab yang sudah tercatat di server dari perangkat lain tetap boleh dikirim lagi: server mengabaikannya.

### 3.2 Kata yang sudah dibaca

- Reader membuka dokumen bab itu, mengambil semua kata di teksnya (bukan `script`/`style`), dan menormalkannya dengan cara yang sama seperti kata yang diketuk (`normalizeWord` dan `isLookupWord`, Tahap 2). Hasilnya himpunan kata unik bab itu.
- Himpunan itu dikirim ke server dan digabung (union) ke himpunan kata buku tersebut, sekali per bab. Bab yang besar dikirim bertahap, paling banyak 5.000 kata per kiriman.
- Offline: kiriman menunggu di antrean perangkat.

### 3.3 Kata yang dicari

- Setiap ketukan yang membuka popup arti dicatat dengan buku dan kata yang diketuk (bentuk ternormalisasi, sama seperti §3.2). Ketukan berulang pada kata yang sama di buku yang sama menambah jumlah ketukan, bukan kata baru.
- Ketukan dicatat walaupun artinya tidak ditemukan, karena anggota tetap tidak memahami kata itu tanpa bantuan.
- Offline: catatan menunggu di antrean perangkat.

### 3.4 Pertemuan kata tersimpan

- Saat bab sudah dibaca (§3.1), reader menghitung kemunculan setiap kata tersimpan di bab itu dengan pencocokan sorotan yang sudah ada (`findSavedSpans`, termasuk frasa hingga 3 kata), lalu mengirim jumlah per (kata, buku, bab).
- Satu (kata, buku, bab) dihitung sekali; membaca ulang bab tidak menambah angka. Server menyimpan jumlah terbesar yang pernah dikirim (`greatest`).
- **Bab tempat kata itu disimpan tidak dihitung** (buku dan bab dari `cfi` kata tersimpan), karena di sana kata itu ditemukan, bukan bertemu lagi.
- Kata yang disimpan setelah sebuah bab dibaca tidak menghitung bab itu, kecuali bab itu dibaca lagi di perangkat yang belum mencatatnya. Hitungan terjadi saat bab dibaca, dengan kata tersimpan yang ada saat itu.
- Menghapus kata dari Kosakata menghapus pertemuannya.

### 3.5 % pemahaman

- `dibaca` = jumlah kata unik di himpunan kata buku (§3.2).
- `dicari` = jumlah kata yang dicari di buku itu (§3.3) yang juga ada di himpunan kata buku.
- **% pemahaman = 1 − dicari ÷ dibaca**, dibulatkan ke bawah ke persen bulat, sehingga tidak pernah tertulis 100% selama masih ada kata yang dicari.
- Bila `dibaca` < **200**, angka belum ditampilkan: "Baca lebih banyak untuk melihat angkanya".

## 4. Tampilan

### 4.1 Detail buku

Di panel detail buku (lobi dan Rak Saya) dan lembar lanjut baca di HP, satu baris:

- "Paham 96% kata tanpa kamus · 34 kata dicari", dengan tautan **Lihat kata** ke Kosakata yang disaring untuk buku itu (§4.2).
- Sebelum ada 200 kata terbaca: "Baca lebih banyak untuk melihat angkanya". Tanpa kata dicari (dan ≥ 200 terbaca), angkanya 100% dan bagian "· N kata dicari" tidak ditulis.
- Buku yang belum pernah dibuka tidak menampilkan baris ini.
- Offline: angka terakhir dari cache perangkat; tanpa cache, baris ini tidak tampil.

### 4.2 Kosakata

- **Saringan per buku** lewat `?buku=<id>`: judul "Kata di <judul buku>", angka % yang sama dengan §4.1, lalu daftar **Dicari di buku ini**: setiap kata dengan jumlah ketukan ("diketuk 3×"), urut dari ketukan terakhir. Kata yang sudah tersimpan diberi tanda "Tersimpan". Mengetuk baris membuka artinya (cache perangkat, lalu server) dengan tombol **Simpan** seperti popup kata. Tautan "Semua kata" menghapus saringan.
- **Pertemuan:** setiap kata tersimpan menampilkan "Bertemu lagi 7× di 3 buku" bila ada pertemuan. Kata tanpa pertemuan tidak menampilkan baris ini.
- **Urutan baru:** "Paling sering bertemu" (jumlah pertemuan, lalu waktu simpan terbaru).

### 4.3 Privasi

Halaman privasi menyebut data baru: kata yang kamu ketuk di tiap buku, kata unik dari bab yang sudah kamu baca (untuk menghitung % pemahaman), dan berapa kali kata tersimpan muncul lagi. Semua tidak dibagikan dan ikut terhapus bersama akun; data per buku ikut terhapus bersama bukunya, kecuali pertemuan kata (§5.1).

## 5. Data

### 5.1 Tabel

Semua tabel memakai RLS: anggota hanya membaca barisnya sendiri, tanpa hak tulis langsung, dan semua baris ikut terhapus saat akun dihapus (`on delete cascade` ke `profiles`).

- **`book_words_read`** `(user_id, book_id references books on delete cascade, sections integer[] not null default '{}', words text[] not null default '{}', updated_at, primary key (user_id, book_id))`.
- **`word_lookups`** `(user_id, book_id references books on delete cascade, word text, taps integer, first_at, last_at, primary key (user_id, book_id, word))`.
- **`word_meetings`** `(user_id, headword text, book_id uuid, section integer, count integer check (count > 0), primary key (user_id, headword, book_id, section))`. `book_id` tanpa foreign key, seperti `reading_time`, supaya "di N buku" tetap benar setelah buku dihapus.

### 5.2 Fungsi

Semua `security definer`, `set search_path = ''`, hanya untuk `authenticated`; jawaban kode teks seperti fungsi 3A/3B; sesi hilang menjadi exception.

- **`add_words_read(p_book_id uuid, p_section integer, p_words text[], p_last boolean)`** → `ok` | `not_found` | `invalid`: buku harus milik anggota; paling banyak 5.000 kata per panggilan; kata yang bukan bentuk ternormalisasi yang wajar (kosong, > 64 karakter) ditolak sebagai `invalid`. Kata digabung ke `words` tanpa duplikat. Bab baru masuk `sections` hanya bila `p_last` benar (kiriman terakhir bab itu); bab yang sudah ada di `sections` diabaikan seluruhnya. Dengan begitu kiriman bertahap tetap aman diulang.
- **`record_lookups(p_entries jsonb)`** → `text[]` (satu jawaban per entri, pola antrean 3B): setiap entri `{book_id, word, taps, at}`; `taps` dijumlahkan ke baris yang ada, `last_at` diperbarui. Buku orang lain: `ok` tanpa disimpan. Paling banyak 50 entri per batch.
- **`record_meetings(p_entries jsonb)`** → `text[]`: setiap entri `{headword, book_id, section, count}`; hanya untuk kata yang ada di Kosakata anggota; `count = greatest(lama, baru)`. Paling banyak 50 entri.
- **`book_vocab(p_book_id uuid)`** → `{read integer, looked_up integer, words: [{word, taps, last_at}]}` untuk §4.1 dan §4.2. `looked_up` dihitung sesuai §3.5 (kata dicari yang juga ada di himpunan).
- **`book_vocab_summaries()`** → satu baris per buku anggota `{book_id, read, looked_up}` untuk detail buku di lobi dan rak tanpa memanggil per buku.
- Menghapus kata tersimpan (fungsi Kosakata yang ada) juga menghapus `word_meetings` kata itu.
- Daftar kata tersimpan (`listSavedWordsFn`) ditambah `meetings` (jumlah) dan `meetingBooks` (jumlah buku berbeda).

### 5.3 Di perangkat

- Waktu per (buku, bab) dan tanda "sudah dibaca" disimpan di Dexie, dihapus bersama data anggota lain saat keluar akun.
- Tiga antrean dengan `createQueueSync`: kata terbaca per bab (dengan potongan ≤ 5.000), ketukan kata, dan pertemuan.
- Ringkasan `book_vocab_summaries` di-cache di perangkat untuk detail buku offline.

## 6. Kode

- **Logika murni:** `src/lib/vocab/` — kata unik dari teks bab (pakai `normalizeWord`/`isLookupWord`), potongan per 5.000, % pemahaman dan ambangnya, hitungan pertemuan dari `findSavedSpans` dengan pengecualian bab simpan, akumulasi waktu per bab dengan ambang 60 detik.
- **Reader:** jam baca 3B sudah tahu `section` lokasi saat ini; potongan waktu yang diserahkan ditambahkan ke bab itu. Saat bab mencapai 60 detik, reader membaca dokumen bab itu (`createDocument`) di waktu senggang, lalu mengisi antrean kata dan pertemuan. Ketukan kata menambah antrean ketukan dari alur popup kata yang ada.
- **Server:** `src/server/vocab.ts` (server function untuk antrean dan bacaan); `src/server/words.ts` ditambah kolom pertemuan.
- **UI:** baris di `BookDetailPanel` dan `ContinueSheet`; saringan buku, daftar "Dicari di buku ini", baris pertemuan, dan urutan baru di Kosakata (`/vocabulary`).

## 7. Pengujian

- **DB:** union tanpa duplikat, kiriman bertahap dengan `p_last`, bab yang sama diabaikan, batas 5.000 kata dan kata tidak wajar; ketukan dijumlahkan; pertemuan `greatest`, hanya untuk kata tersimpan, ikut terhapus saat kata dihapus, tetap setelah buku dihapus; `book_vocab` dan ringkasannya (termasuk kata dicari di luar himpunan tidak dihitung); RLS dan cascade akun/buku.
- **Unit:** ekstraksi kata (tanda baca, apostrof, tanda hubung, angka diabaikan), potongan, % dan ambang 200 serta pembulatan ke bawah, pertemuan termasuk frasa dan pengecualian bab simpan, ambang 60 detik lintas kunjungan, antrean, tampilan baris detail buku dan Kosakata (semua keadaan di §4).
- **E2E desktop dan HP:** buka buku, baca satu bab cukup lama, ketuk satu kata → detail buku menampilkan baris § 4.1 → "Lihat kata" membuka Kosakata yang disaring dengan kata itu; kata tersimpan yang muncul di bab lain menampilkan "Bertemu lagi".

## 8. Di luar 3D

Perkiraan % pemahaman sebelum membaca, daftar frekuensi atau level CEFR, kuis atau kartu hafalan, penanda pertemuan di reader, dan kata yang dipelajari di kartu buku selesai (3E memakai data 3D).
