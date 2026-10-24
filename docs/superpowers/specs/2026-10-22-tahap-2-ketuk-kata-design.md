# Glosa Tahap 2 — Ketuk Kata, Anotasi, dan Kenyamanan Baca: Desain

Tanggal: 2026-10-22
Spec induk: [`2026-10-15-epub-reader-tahap-1-design.md`](2026-10-15-epub-reader-tahap-1-design.md) §1 (roadmap)
Dikerjakan dalam tiga plan berurutan: **2A** Ketuk Kata & Kosakata → **2B** Anotasi → **2C** Kenyamanan Baca. Tiap plan selesai dengan fitur yang bisa dipakai dan di-deploy ke dev.

## 1. Ringkasan

Tahap 2 mengubah reader Glosa dari pembaca EPUB biasa menjadi alat belajar. User mengetuk kata yang sulit dan langsung melihat artinya dalam bahasa Indonesia, lalu menyimpan kata itu bersama kalimat asalnya. Kata yang tersimpan terkumpul di halaman Kosakata.

Pemilik proyek juga memasukkan dua kelompok fitur reader yang sebelumnya belum punya tahap:

- **Anotasi:** highlight, catatan, dan bookmark.
- **Kenyamanan baca:** catatan kaki di popup, tombol Kembali, sisa waktu, perataan teks, dua halaman, dan layar tetap menyala.

Cari teks di dalam buku dicatat di roadmap sebagai tahap tersendiri (2D).

## 2. Keputusan

| # | Keputusan | Alasan |
|---|---|---|
| 1 | Popup arti berisi bentuk dasar, padanan Indonesia per kelas kata, dan saran phrasal verb. Tanpa definisi Inggris dan pelafalan. | Ringkas, cocok dengan data kamus bebas yang tersedia, dan cukup untuk pembaca tingkat menengah. |
| 2 | Kamus berasal dari English Wiktionary lewat ekstrak kaikki/wiktextract (CC BY-SA). | Satu sumber untuk arti, bentuk kata (lematisasi), dan phrasal verb. WordNet Bahasa ditolak (§11). |
| 3 | Ketukan di atas kata **selalu** membuka arti, di mana pun posisinya. Ketukan di ruang kosong tetap memakai zona lama. | Ketuk kata adalah inti produk. Balik halaman tetap bisa lewat swipe, tombol, roda mouse, dan ketukan di margin. |
| 4 | Arti dicari online dan di-cache di perangkat. Kata baru saat offline menampilkan "Arti butuh koneksi". | Mengunduh kamus penuh di HP terlalu berat untuk tahap ini. Kata yang pernah dicari tetap muncul offline. |
| 5 | Selain kata tunggal, phrasal verb dengan 1–2 partikel sesudahnya juga dikenali. Phrasal verb yang terpisah objek (*gave it up*) dan pilih frasa bebas tidak termasuk. | Phrasal verb sangat umum di novel dan sering menyesatkan bila diartikan per kata. |
| 6 | Kata tersimpan terkumpul di halaman **Kosakata**, dengan pintu masuk hotspot baru *lemari katalog kartu* di lobi. | Cocok dengan tema perpustakaan. Tahap 3 nanti menambahkan flashcard di halaman yang sama. |
| 7 | Arti **disalin** ke baris kata tersimpan. | Kosakata bisa dibuka offline, kata tanpa arti tetap bisa disimpan, dan pembaruan kamus tidak mengubah kata yang sudah dipelajari. |
| 8 | Hapus buku: kata tersimpan tetap ada (judul disalin), anotasi buku itu ikut terhapus. | Kosakata milik user, bukan milik buku. Anotasi tidak berarti tanpa bukunya. |
| 9 | Anotasi disinkronkan dengan aturan "yang terbaru menang" dan tombstone untuk hapus. | Polanya sama dengan `save_progress`, dan penghapusan tetap sampai ke perangkat yang sedang offline. |
| 10 | Highlight menang atas kata. Arti kata di dalam highlight dibuka lewat tombol di popup anotasi. | Satu ketukan hanya punya satu arti, jadi tidak ada popup yang saling tumpuk. |
| 11 | Overlay anotasi, perkiraan waktu, dan catatan kaki memakai fitur bawaan foliate-js (`overlayer.js`, `progress.js`, `footnotes.js`). | Sudah teruji dan bekerja dengan CFI. |
| 12 | Batas 20 ketukan/hari, AI konteks, dan batas 100 kata Gratis **tidak** termasuk Tahap 2. | Semuanya bagian dari monetisasi di Tahap 5. Di Tahap 2 penguji memakai tanpa batas, dengan pengaman 5.000 kata dan 10.000 anotasi. |

## 3. Cakupan

### 2A — Ketuk Kata & Kosakata
1. Impor kamus Wiktionary (§4.1).
2. Ketuk kata di reader (§6.2).
3. Popup arti (§6.3).
4. Simpan kata (§4.2).
5. Halaman Kosakata (§6.4).
6. Garis bawah kata tersimpan di semua buku (§6.5).
7. Offline: cache arti, antrean simpan/hapus, dan daftar Kosakata tersimpan (§7).

### 2B — Anotasi
1. Seleksi teks dengan menu *Highlight · Catatan · Salin*.
2. Highlight 4 warna; ketuk highlight untuk mengganti warna, menambah catatan, atau menghapus.
3. Catatan pada highlight, ditandai ikon kecil di pinggir teks.
4. Bookmark lewat tombol di toolbar, dengan pita di pojok halaman yang di-bookmark.
5. Panel anotasi sebagai tab di samping Daftar isi.
6. Sinkron antar perangkat dan antrean offline.

### 2C — Kenyamanan Baca
1. Catatan kaki di popup.
2. Tombol Kembali setelah lompatan.
3. Sisa waktu bab dan buku.
4. Setelan perataan teks dan pemenggalan kata.
5. Dua halaman berdampingan di layar lebar.
6. Layar tetap menyala saat membaca (Wake Lock).

### Tidak termasuk
Cari teks di buku (Tahap 2D), batas harian, AI konteks, terjemahan kalimat, flashcard, definisi Inggris, pelafalan, pilih frasa bebas untuk arti, phrasal verb terpisah objek, kamus offline penuh, ekspor anotasi, dan arah ID→EN.

Sesuai spec induk §2, tidak ada tombol mati atau label "segera hadir" untuk fitur di luar cakupan.

## 4. Data dan server

Pola yang dipakai sama dengan Tahap 1. Tabel memakai RLS "baca milik sendiri", penulisan lewat fungsi `security definer` yang punya pengaman dan `set search_path = ''`, dan batch dari antrean perangkat dikirim lewat server function seperti `saveProgressFn`.

### 4.1 Kamus (2A)

| Tabel | Isi |
|---|---|
| `dict_entries` | `headword` (huruf kecil; boleh berspasi untuk phrasal verb, mis. `give up`), `pos` (`noun`, `verb`, `adj`, `adv`, `pron`, `prep`, `conj`, `interj`, `phrase`), `meanings text[]` (padanan ID sesuai urutan Wiktionary, 1–8 item). Unik per (`headword`, `pos`). |
| `dict_forms` | `form`, `headword`, `pos`. Kunci utama (`form`, `headword`, `pos`). Bentuk dasar juga dicatat sebagai bentuknya sendiri (`run → run`), supaya pencarian selalu cukup satu query. |
| `dict_meta` | Satu baris: versi ekstrak, tanggal dump Wiktionary, jumlah entri dan bentuk, dan waktu impor. |

Akses: `authenticated` hanya boleh `select`, dan hanya `service_role` yang boleh menulis. `anon` tidak punya akses.

**`lookup_word(p_word text, p_next text[])`** (SQL `stable`, `security invoker`):
1. Mencari semua (`headword`, `pos`) untuk `p_word` lewat `dict_forms`.
2. Menyusun kandidat phrasal verb dari tiap bentuk dasar ditambah 1 dan 2 kata pertama `p_next`, misalnya *gave* + `["up", "on"]` → `give up` dan `give up on`.
3. Mengembalikan `jsonb`: `{ word, entries: [{ headword, pos, meanings }], phrases: [{ headword, meanings }] }`. Phrasal verb yang lebih panjang diurutkan lebih dulu, dan `entries` diurutkan menurut kelas kata yang paling umum (verb, noun, adj, adv, lainnya).
4. `p_word` maksimal 64 karakter dan `p_next` maksimal 2 item. Selain itu, fungsi mengembalikan hasil kosong.

Browser memanggil fungsi ini lewat server function `lookupWordFn`, seperti panggilan lain (tidak ada klien Supabase di browser). Di Tahap 5, kuota harian dihitung di server function yang sama.

**Impor:** perintah `node scripts/import-dictionary.ts <file.jsonl[.gz]> --env dev|prod [--dump-date YYYY-MM-DD] [--force]` memakai `SUPABASE_URL` dan `SUPABASE_SECRET_KEY` dari `.env.local` (dev) atau `.env.prod` (prod). Kamus baru ditukar lewat fungsi `dict_swap`.
- Ambil entri dengan `lang_code = "en"`. Per kelas kata, kumpulkan terjemahan dengan `code = "id"`, buang yang kembar, dan ambil paling banyak 8.
- Bentuk kata diambil dari `forms` di entri bentuk dasar dan dari `senses[].form_of` di entri bentuk turunan. Bentuk hanya disimpan bila headword-nya punya arti.
- Semua kata melewati `normalizeWord` (§5), yang juga dipakai reader.
- Data dimuat ke tabel staging, lalu dalam satu transaksi tabel lama dikosongkan dan diisi dari staging, kemudian `dict_meta` diperbarui. Pencarian tidak pernah melihat kamus setengah jadi.
- Skrip mencetak ringkasan (jumlah entri, bentuk, dan phrasal verb) dan menolak menukar tabel bila jumlah entri turun lebih dari 20% dari impor sebelumnya, kecuali ada `--force`.
- Skrip dijalankan manual, tidak lewat CI. Panduannya ditambahkan ke [`docs/ops/deploy.md`](../../ops/deploy.md).

### 4.2 Kata tersimpan (2A)

`saved_words`:

| Kolom | Isi |
|---|---|
| `id` | `uuid`, default `gen_random_uuid()` |
| `user_id` | → `profiles(id)` `on delete cascade` |
| `headword` | 1–64 karakter, sudah dinormalisasi |
| `pos` | Kelas kata yang ditampilkan saat disimpan, boleh `null` |
| `meanings` | `text[]`, salinan arti, 0–8 item |
| `book_id` | → `books(id)` `on delete set null` |
| `book_title` | Salinan judul, maksimal 300 karakter |
| `sentence` | Kalimat asal, maksimal 500 karakter |
| `cfi` | Posisi kata, maksimal 2.000 karakter, boleh `null` |
| `created_at` | `timestamptz` |

Unik per (`user_id`, `headword`). Member hanya bisa `select` baris miliknya.

Fungsi:
- **`save_word(p_headword, p_pos, p_meanings, p_book_id, p_sentence, p_cfi)`** menyimpan kata bila belum ada. Kalau kata sudah ada, konteks pertama yang dipertahankan dan fungsi tetap mengembalikan sukses. Batas 5.000 kata dicek dengan mengunci baris profil, seperti `reserve_book_upload`. `book_id` harus buku milik user dan `book_title` diambil dari baris buku itu, bukan dari client.
- **`delete_word(p_headword)`** menghapus kata bila ada.
- **`saved_word_forms()`** mengembalikan satu objek `jsonb` `{ headword: [bentuk…] }` dari kata tersimpan user, untuk garis bawah (§6.5).
- **Buku pada `save_word`:** buku yang sudah tidak ada membuat kata disimpan tanpa buku. Buku milik user lain ditolak.

Server function **`syncSavedWordsFn`** menerima batch dari antrean (maksimal 50 operasi), lalu menjalankan `save_word` atau `delete_word` berurutan. Tiap operasi idempoten. Hasilnya per operasi: `ok`, `limit_reached`, atau `invalid`.

### 4.3 Anotasi (2B)

`annotations`:

| Kolom | Isi |
|---|---|
| `id` | `uuid` yang dibuat di perangkat |
| `user_id` | → `profiles(id)` `on delete cascade` |
| `book_id` | → `books(id)` `on delete cascade` |
| `kind` | `highlight` atau `bookmark` |
| `cfi` | Rentang (highlight) atau titik (bookmark), maksimal 2.000 karakter |
| `color` | `yellow`, `green`, `blue`, `pink` untuk highlight; `null` untuk bookmark |
| `note` | Maksimal 2.000 karakter, hanya untuk highlight |
| `excerpt` | Kutipan teks untuk panel, maksimal 1.000 karakter |
| `created_at`, `updated_at` | `timestamptz` |
| `deleted_at` | `timestamptz`, tombstone |

Indeks (`user_id`, `book_id`). Member hanya bisa `select` baris miliknya.

**`save_annotations(p_entries jsonb)`** menerima batch, maksimal 50 entri:
- Tiap entri disimpan hanya bila `updated_at`-nya lebih baru dari yang tersimpan. Stempel waktu dari masa depan dipangkas ke `now()`, persis seperti `save_progress`.
- Hapus dikirim sebagai entri dengan `deleted_at` terisi.
- `book_id` harus buku `ready` milik user. `id` yang sudah dipakai user lain ditolak.
- Batas 10.000 anotasi aktif per user.

Server function **`syncAnnotationsFn`** membungkus fungsi ini. Reader membaca semua anotasi buku, termasuk tombstone, saat buku dibuka.

Sweep per jam yang sudah ada (`src/server/sweep`) menghapus tombstone yang berumur lebih dari 30 hari.

### 4.4 Kenyamanan baca (2C)

Tidak ada tabel baru. `ReaderSettingsSchema` diperluas dengan:

| Setelan | Nilai | Default |
|---|---|---|
| `align` | `start`, `justify` | `start` |
| `hyphenate` | `boolean` | `true` |
| `spread` | `auto`, `single` | `auto` |

Nilai baru disimpan di `profiles.reader_settings` yang sudah ada. Setelan lama tetap valid karena `parseReaderSettings` mengisi default untuk kolom yang tidak ada.

Kecepatan baca hanya disimpan di perangkat (Dexie), tanpa dikirim ke server.

### 4.5 Hapus akun dan privasi

Semua tabel baru memakai `on delete cascade` dari `profiles`, jadi hapus akun membersihkan semuanya. Kebijakan Privasi ditambah keterangan kosakata, kalimat asal, dan anotasi. Atribusi CC BY-SA untuk Wiktionary dicantumkan di Kebijakan Privasi, dan juga sebagai tautan kecil di popup arti.

## 5. Modul client

| Modul | Tugas |
|---|---|
| `src/lib/words/normalize.ts` | `normalizeWord`: huruf kecil, `’` menjadi `'`, buang akhiran *'s*, buang tanda baca di ujung kata. Dipakai juga oleh skrip impor. |
| `src/lib/words/word-at.ts` | `wordAt(doc, x, y)`: mengambil kata di titik ketuk lewat `caretPositionFromPoint` atau `caretRangeFromPoint`, lalu **memastikan titik itu ada di dalam kotak kata**. Mengembalikan `{ word, range, sentence, next }`, atau `null` bila ketukan jatuh di spasi atau margin. |
| `src/lib/words/lookup.ts` | Mencari di cache Dexie dulu, lalu RPC `lookup_word`. Hasil kosong juga di-cache. |
| `src/lib/words/saved-marks.ts` | Garis bawah kata tersimpan memakai CSS Custom Highlight API (§6.5). |
| `src/lib/reading-speed.ts` | Menghitung dan menyimpan kecepatan baca per perangkat (§6.7). |
| `src/lib/local/lookups.ts` | Cache arti di Dexie, maksimal 2.000 kata; yang paling lama tidak dipakai dibuang. |
| `src/lib/local/saved-words.ts` | Salinan Kosakata dan antrean simpan/hapus. |
| `src/lib/local/annotations.ts` | Anotasi per buku dan antreannya. |

Antrean mengikuti pola `src/lib/local/positions.ts` dan `progress-sync-client.ts`.

## 6. Reader dan antarmuka

### 6.1 Urutan penanganan klik

Klik di dokumen section ([`ReaderView.tsx`](../../../src/components/reader/ReaderView.tsx), handler `click` di `onSectionLoad`) diperiksa berurutan, dan langkah pertama yang cocok menang:

1. **Tautan.** foliate yang menangani, seperti sekarang (`defaultPrevented`). Catatan kaki dibuka di popup (§6.7).
2. **Highlight** (2B). Klik dibaca dari `show-annotation` dan membuka popup anotasi.
3. **Ada seleksi teks** (2B). Muncul menu seleksi.
4. **Kata** (2A). `wordAt` mengembalikan kata, lalu popup arti terbuka.
5. **Ruang kosong.** `tapAt` seperti sekarang: pinggir membalik halaman, tengah membuka menu.

Swipe, tombol, roda mouse, dan tepi klik di margin tidak berubah.

### 6.2 Ketuk kata

- Kata yang diketuk disorot (Custom Highlight `glosa-active`) selama popup terbuka.
- Kalimat asal dibatasi oleh tanda `.`, `!`, `?`, atau batas paragraf, lalu dipotong menjadi 500 karakter di sekitar kata.
- `next` berisi 2 kata sesudahnya dalam paragraf yang sama.
- Kata yang bukan huruf Latin, angka murni, atau lebih dari 64 karakter tidak membuka popup. Ketukan seperti itu jatuh ke langkah 5.

### 6.3 Popup arti (`WordPopup`)

- **Desktop (≥ 1024px):** popover Base UI yang ditempatkan di posisi kata. Rect dari iframe dipindah ke koordinat jendela, seperti `inWindow`.
- **HP:** bottom sheet.
- **Isi, dari atas ke bawah:**
  - kata yang diketuk, dan bentuk dasarnya bila berbeda (*running → run*);
  - saran phrasal verb bila ada, ditandai "frasa";
  - arti per kelas kata, dengan label Indonesia (*kata benda*, *kata kerja*, *kata sifat*, …);
  - tombol **Simpan** / **Tersimpan** (ketuk lagi untuk menghapus);
  - tautan kecil "Wiktionary · CC BY-SA".
- **Kata yang disimpan:** headword dari pilihan paling atas yang tampil, yaitu frasa bila ada, lalu bentuk dasar, lalu kata seperti yang diketuk bila tidak ada di kamus.
- **Keadaan:**
  - *memuat*: skeleton muncul bila lebih dari 150 ms;
  - *hasil*;
  - *belum ada arti*: "Belum ada arti untuk kata ini", Simpan tetap bisa;
  - *offline tanpa cache*: "Arti butuh koneksi";
  - *gagal*: "Arti tidak bisa dimuat" dan tombol Coba lagi. Error dicatat ke Sentry.
- **Fokus:** masuk ke popup saat terbuka. Escape atau ketukan di luar menutup popup, lalu fokus kembali ke buku. Membalik halaman juga menutup popup; `relocate` di tempat yang sama (misalnya snap foliate setelah sentuhan) tidak menutupnya. Ketukan di ruang kosong saat popup terbuka hanya menutup popup.
- **Offline:** hanya koneksi yang hilang (`TypeError` dari fetch, pesan yang sama dengan yang diabaikan Sentry) yang dianggap offline. Error lain menampilkan "Arti tidak bisa dimuat" dan dicatat ke Sentry.

### 6.4 Halaman Kosakata

- Route `src/routes/_member/_lobi/vocabulary.tsx`, alamat `/vocabulary`, dibungkus `LobbyPopup` seperti Rak Saya dan Pengaturan (spec 1F §3–§5). Di HP tampil sebagai halaman penuh dengan tab baru **Kosakata** di tab bar bawah.
- Hotspot baru `katalog` di `src/components/lobby/scene/layout.ts`, berupa model low-poly lemari katalog kartu dengan label "Kosakata", di dinding kiri di atas Meja Admin.
- **Isi:**
  - daftar kata, terbaru di atas;
  - pencarian di sisi client (cukup untuk 5.000 kata);
  - filter per buku;
  - tiap kartu memuat kata, kelas kata, 2–3 arti pertama, kalimat asal dengan kata yang ditebalkan, dan judul buku;
  - tombol hapus dengan toast *Urungkan*;
  - **Buka di buku**, yang membuka `/read/$bookId?cfi=…`. Tombol ini disembunyikan bila buku sudah dihapus atau CFI kosong.
- **Keadaan kosong:** "Ketuk kata yang sulit saat membaca, lalu simpan. Kata itu akan muncul di sini."
- Reader menerima parameter `cfi` dan membuka posisi itu, alih-alih posisi baca terakhir. Posisi baca baru tersimpan setelah user membalik halaman, mengikuti aturan "yang terbaru menang" yang sudah ada. Parameter ini juga dipakai panel anotasi (§6.6). `?cfi` yang section-nya ada tetapi jalurnya tidak menuju apa pun juga jatuh ke posisi terakhir dengan catatan yang sama (§8).

### 6.5 Garis bawah kata tersimpan

- `saved_word_forms()` di-cache di Dexie dan diperbarui saat Kosakata berubah.
- Saat section dimuat, text node di dokumen section dipindai. Kata yang cocok dengan salah satu bentuk ditandai lewat `CSS.highlights` (`glosa-saved`), dengan garis bawah titik-titik tipis yang warnanya mengikuti tema.
- DOM buku tidak diubah, jadi CFI dan anotasi tetap aman.
- Di browser tanpa Custom Highlight API, garis bawah tidak muncul dan tidak ada error.
- Pemindaian berjalan di `requestIdleCallback` (dengan cadangan `setTimeout`), supaya membalik halaman tidak tersendat.

### 6.6 Anotasi (2B)

- **Seleksi:** seret di desktop, tekan lama lalu seret di HP. Setelah seleksi selesai (`pointerup` atau `touchend`, dengan seleksi tidak kosong), muncul menu *Highlight · Catatan · Salin* di dekat seleksi. Seleksi di luar satu section tidak didukung.
- **Highlight** digambar lewat `view.addAnnotation` dan event `draw-annotation` dengan `Overlayer.highlight`, sesuai warnanya. Highlight yang punya catatan diberi ikon kecil di pinggir teks.
- **Popup anotasi** (dari `show-annotation`) berisi 4 warna, *Catatan*, *Hapus*, dan *Arti "kata"* bila highlight hanya satu kata, atau *Arti* untuk kata yang diketuk di dalam highlight.
- **Catatan** diedit di textarea, dalam dialog di desktop dan sheet di HP. Catatan tersimpan saat ditutup. Catatan kosong menghapus catatan, bukan highlightnya.
- **Bookmark:** tombol di `ReaderToolbar` menandai awal halaman yang sedang dibaca. Bila halaman ini berisi bookmark, tombolnya aktif dan pita kecil muncul di pojok kanan atas halaman. Ketuk tombol aktif untuk menghapus bookmark.
- **Panel:** `TocPanel` mendapat tab **Daftar isi · Anotasi**. Tab Anotasi menampilkan bookmark dan highlight menurut urutan dalam buku, dengan kutipan, warna, catatan, dan nama bab. Ketuk salah satunya untuk melompat ke posisinya.

### 6.7 Kenyamanan baca (2C)

- **Catatan kaki:** `footnotes.js` foliate mendeteksi tautan catatan kaki (`epub:type="noteref"` dan pola umum lainnya). Isinya ditampilkan di popup yang gayanya sama dengan popup arti, alih-alih melompat ke akhir bab. Tautan biasa tetap melompat.
- **Tombol Kembali:** muncul di kiri bawah setelah lompatan lewat daftar isi, tautan, anotasi, atau slider posisi. Tombol ini membawa user kembali ke posisi sebelum lompatan, dan hilang setelah dipakai atau setelah 5 kali balik halaman.
- **Sisa waktu:** footer menampilkan "±8 mnt lagi di bab ini".
  - Angkanya `time.section` dari `relocate` foliate, dikalikan rasio kecepatan user terhadap kecepatan default foliate.
  - Kecepatan diukur dari halaman yang dibaca 5 detik sampai 10 menit, sebagai rata-rata bergerak dari 50 halaman terakhir.
  - Sebelum ada 10 halaman terukur, kecepatan default foliate yang dipakai.
  - Di mode scroll, sisa waktu dihitung dengan cara yang sama dari `relocate`.
- **Setelan baru** di `ReaderSettingsPanel`:
  - perataan (*Rata kiri* / *Rata kiri-kanan*);
  - pemenggalan kata, lewat `hyphens: auto` dan atribut `lang` buku;
  - dua halaman (*Otomatis* / *Satu halaman*). Pilihan ini hanya tampil di layar ≥ 1024px dan mode halaman. *Otomatis* membiarkan foliate menampilkan dua kolom bila layar cukup lebar.
- **Layar tetap menyala:** Wake Lock diminta saat reader terbuka dan tab terlihat, dilepas saat tab disembunyikan, dan diminta lagi saat tab terlihat kembali. Bila browser tidak mendukung atau menolak, tidak ada pesan apa pun.

## 7. Offline dan sinkron

- **Arti:** kata yang pernah dicari muncul dari cache Dexie tanpa jaringan.
- **Simpan/hapus kata dan perubahan anotasi:** ditampilkan seketika di perangkat, lalu masuk antrean Dexie. Antrean dikirim saat online kembali, saat buku dibuka, dan 2 detik setelah perubahan terakhir.
- **Penolakan server:** misalnya `limit_reached`. Perubahan di perangkat dibatalkan dan pesan ditampilkan, misalnya "Kosakata sudah penuh (5.000 kata). Hapus beberapa kata untuk menyimpan yang baru." Pesan ditambahkan ke modul pesan yang sudah ada.
- **Kosakata:** daftar disimpan di tabel Dexie `words`, seperti salinan rak.
- **Anotasi:** anotasi buku yang sudah diunduh ikut tersedia offline.

## 8. Error dan batas

| Kasus | Perilaku |
|---|---|
| RPC `lookup_word` gagal | Keadaan *gagal* di popup, dicatat ke Sentry |
| Kosakata penuh | `limit_reached`, pesan seperti §7 |
| Anotasi penuh (10.000) | Pesan serupa, highlight tidak dibuat |
| CFI di Kosakata atau anotasi tidak bisa dibuka (buku diganti versi lain) | Reader membuka posisi baca terakhir dan menampilkan "Posisi itu tidak ditemukan di buku ini" |
| Kamus belum diimpor (dev baru) | Semua kata tampil sebagai *belum ada arti* |

## 9. Roadmap

Tabel roadmap di spec induk diperbarui:

| Tahap | Isi |
|---|---|
| 2 | Ketuk kata, Kosakata, anotasi, dan kenyamanan baca (dokumen ini; plan 2A, 2B, 2C) |
| 2D | Cari teks di dalam buku (`search.js` foliate), dengan spec terpisah |

Bagian "Tidak termasuk" spec induk §2 diperbarui: highlight/catatan kini ada di Tahap 2, dan pencarian teks di Tahap 2D.

## 10. Pengujian

### Unit (Vitest)
- `normalizeWord`: apostrof melengkung, *'s*, tanda baca, huruf besar.
- `wordAt`: ketukan di tengah kata, di spasi, di margin, di kata bertanda hubung, dan di batas kalimat.
- Penyusunan kandidat phrasal verb.
- Cache arti: batas 2.000 kata dan urutan pembuangan.
- Antrean kata dan anotasi: urutan, penggabungan, dan pembatalan saat ditolak.
- Kecepatan baca: halaman di luar 5 detik–10 menit diabaikan, dan rata-rata bergerak.
- `parseReaderSettings` dengan setelan baru dan setelan lama.

### SQL dan RLS
- Member tidak bisa membaca `saved_words` atau `annotations` milik user lain.
- `dict_*` hanya bisa dibaca, dan `anon` tidak punya akses.
- `lookup_word`: bentuk turunan, phrasal verb, dan input yang terlalu panjang.
- `save_word`: idempoten, konteks pertama dipertahankan, batas 5.000, buku milik user lain ditolak.
- `save_annotations`: "yang terbaru menang", pemangkasan stempel waktu dari masa depan, tombstone, batas 10.000, dan `id` milik user lain ditolak.
- Hapus buku: kata tersimpan tetap ada dengan `book_id` `null`, anotasi ikut terhapus.
- Hapus akun: semuanya terhapus.

Database test diisi kamus kecil (fixture beberapa puluh kata, termasuk bentuk turunan dan phrasal verb), jadi test tidak bergantung pada impor penuh.

### E2E (Playwright, port 3100)
- **2A:** ketuk kata → popup arti → Simpan → buka Kosakata dari lobi (desktop) dan tab bar (HP) → *Buka di buku* kembali ke posisi itu → kata bergaris bawah.
- **2A:** ketukan di margin masih membalik halaman.
- **2B:** seleksi → highlight → catatan → muat ulang → highlight dan catatan masih ada → hapus dari panel anotasi.
- **2B:** bookmark dari toolbar muncul di panel.
- **2C:** catatan kaki terbuka di popup, dan tombol Kembali setelah lompat dari daftar isi.

## 11. Alternatif yang ditolak

- **WordNet Bahasa + Princeton WordNet sebagai kamus.** Lisensinya lebih longgar, tetapi pembuatnya sendiri memperkirakan 5–10% entri salah, data Melayu dan Indonesia bercampur, dan arti tidak diurutkan dari yang paling umum. Bisa ditambahkan nanti sebagai cadangan tanpa mengubah skema.
- **Tekan lama untuk arti** (gaya Kindle). Tidak bentrok dengan balik halaman, tetapi fitur inti jadi tersembunyi.
- **Saklar "mode belajar".** Menambah satu keadaan yang harus diingat user.
- **Kamus penuh offline.** Unduhan besar di HP dan perlu sistem versi kamus. Bisa dipertimbangkan setelah Tahap 5.
- **Merujuk arti ke kamus alih-alih menyalin.** Kosakata tidak bisa dibuka offline, dan arti yang sudah dipelajari bisa berubah setelah impor ulang.
- **Lematisasi di browser dengan library NLP.** Menambah ukuran bundle. Tabel bentuk kata di Postgres cukup dan konsisten dengan kamus.
