# Tahap 3: koleksi dan kebiasaan membaca — desain

Tanggal: 2026-10-31 · Cabang: `tahap-3a-koleksi`
Spec induk: [`2026-10-15-epub-reader-tahap-1-design.md`](2026-10-15-epub-reader-tahap-1-design.md) §1 (roadmap)

## 1. Arah Tahap 3

Roadmap lama menulis Tahap 3 sebagai "flashcard (FSRS) + gamifikasi: streak, level, statistik kosakata, % pemahaman". Pemilik mengubahnya: Glosa tidak boleh menjadi aplikasi latihan ala Duolingo, karena latihan terpisah akan menggeser reader sebagai fitur utama.

**Prinsip:** gamifikasi mendorong orang membaca, bukan menggantikan membaca. Semua hadiah datang dari halaman yang dibaca.

**Tidak termasuk:** flashcard, XP dan level, papan peringkat, "nyawa", notifikasi yang mendesak.

## 2. Susunan

| Bagian | Isi | Spec |
|---|---|---|
| **3A** | Koleksi buatan pengguna, koleksi otomatis Sedang dibaca dan Sudah dibaca, penanda buku selesai, lemari pajang di lobi 3D | **Dokumen ini (§3–§8)** |
| 3B | Kebiasaan membaca: streak hari membaca (nada lembut, tanpa hukuman), target pribadi (menit per hari, buku per tahun), pencatatan waktu baca | Terpisah |
| 3C | Kosakata yang tumbuh dari bacaan: % pemahaman per buku, kata yang ditemukan di tiap buku, kata tersimpan yang "bertemu lagi" di bacaan | Terpisah |
| 3D | Kartu buku selesai, ulasan pribadi (rating 1–5, tingkat kesulitan mudah/sedang/sulit, catatan, kata yang dipelajari otomatis dari 3C), kilas balik bulanan/tahunan yang bisa dibagikan | Terpisah |

Urutan: 3A → 3B → 3C → 3D. 3A memberi "buku selesai" dan rak yang dipakai bagian lain; 3D merangkum semuanya.

**Ulasan** pribadi di 3D. Datanya disiapkan supaya Tahap 4 (sosial) bisa mempublikasikannya nanti; ulasan publik butuh katalog `works`, feed, dan moderasi, yang tetap di Tahap 4.

**Paket Free/Pro** (spec induk §1) baru di Tahap 5. Tahap 3 dibangun tanpa batas paket, dengan desain yang tidak menghalangi batas dipasang nanti.

## 3. Keputusan pemilik untuk 3A

| # | Keputusan | Alasan |
|---|---|---|
| 1 | Genre tetap menjadi "lokasi" buku (menara di lobi 3D, ditebak otomatis); kategori pengguna menjadi **koleksi**, dan satu buku boleh masuk beberapa koleksi. | Perpustakaan pengguna baru langsung tersusun; koleksi lebih luwes daripada satu rak per buku; lobi 3D tidak perlu dibongkar. |
| 2 | Koleksi otomatis **Sedang dibaca** dan **Sudah dibaca**. | "Koleksi buku yang selesai" yang diminta pemilik, tanpa kerja tangan. |
| 3 | Buku selesai: **ditanya** saat sampai di akhir, plus tombol manual. | Otomatis tanpa bertanya salah untuk buku berlampiran panjang dan untuk lompatan ke akhir; hanya manual membuat koleksi tidak lengkap. |
| 4 | **Lemari pajang** di lobi 3D yang memajang sampul buku selesai. | Wujud "perpustakaan yang tumbuh"; tanpa tata letak 3D dinamis. |

## 4. Perilaku

### 4.1 Koleksi buatan pengguna

- Dibuat dari Rak Saya lewat **+ Koleksi baru**. Nama 1–40 karakter setelah dipangkas, tidak boleh kembar (huruf besar/kecil dianggap sama). Maksimal **50** koleksi per pengguna.
- Bisa diganti nama dan dihapus. Menghapus koleksi tidak menghapus bukunya; ada konfirmasi.
- Buku masuk atau keluar koleksi dari detail buku, bagian **Koleksi**: daftar centang semua koleksi pengguna. Menyimpan daftar itu mengganti seluruh keanggotaan buku sekaligus.
- Mengubah koleksi hanya bisa saat online, sama seperti mengubah genre. Saat offline koleksi tetap terlihat (snapshot rak), tombol ubah nonaktif dengan keterangan.

### 4.2 Koleksi otomatis

Tidak bisa diganti nama, dihapus, atau diisi lewat daftar centang.

- **Sedang dibaca:** `progress > 0` dan belum selesai. Urutan bawaan: terakhir dibuka.
- **Sudah dibaca:** `finishedAt` terisi. Urutan bawaan: terakhir selesai. Membaca ulang tidak mengeluarkan buku dari sini.

### 4.3 Rak Saya

- Baris utama berisi chip koleksi: *Semua · Sedang dibaca · Sudah dibaca · koleksi pengguna (urut dibuat) · + Koleksi baru*. Setiap chip menampilkan jumlah buku. Koleksi pengguna yang aktif punya menu Ganti nama / Hapus.
- Genre pindah dari baris chip ke pilihan **Genre: Semua ▾** di samping pencarian dan urutan. Pilihan Troli Buku Baru tetap ada di sana.
- Koleksi dan genre digabung (AND). Alamat: `/shelf?koleksi=<sedang|selesai|id>&genre=…&q=…&sort=…`. Nilai `koleksi` yang tidak dikenal (koleksi sudah dihapus) jatuh ke Semua.
- Pilihan urutan pengguna (`sort`) menimpa urutan bawaan koleksi.
- Hotspot genre di lobi tetap membuka `/shelf?genre=…`.

### 4.4 Buku selesai

- Di reader, **ajakan** muncul sekali saat pengguna berada di akhir bagian linear terakhir **atau** posisinya ≥ 95%, dan buku belum selesai serta belum pernah dijawab "Belum":
  > Sudah selesai membaca buku ini? **[Ya, selesai] [Belum]**
- **Ya** → `finishedAt` diisi, muncul pemberitahuan singkat *"Masuk ke koleksi Sudah dibaca"*. (Di 3D ini diganti kartu ringkasan dan ulasan.)
- **Belum** → `finishDeclined` disimpan di server; ajakan tidak muncul lagi di perangkat mana pun untuk buku itu.
- Ajakan butuh online. Offline, ajakan tidak muncul (muncul lagi saat sampai di akhir dalam keadaan online).
- Ajakan tidak tampil bersamaan dengan popup, panel, atau kartu kutipan; ia menunggu.
- Di detail buku: **Tandai selesai** / **Tandai belum selesai**. Tandai belum selesai mengosongkan `finishedAt` (dan `finishDeclined`, supaya ajakan bisa muncul lagi).

### 4.5 Lemari pajang di lobi 3D

- Perabot baru di bagian lantai yang masih kosong, dengan hotspot berlabel **Sudah dibaca** dan jumlah bukunya. Klik/ketuk → `/shelf?koleksi=selesai`.
- Raknya memajang sampul hingga **12** buku terakhir selesai, sebagai tekstur dari signed URL sampul (Supabase Storage mengirim header CORS). Buku tanpa sampul, sampul yang gagal dimuat, dan keadaan offline → punggung buku berwarna (`coverHue` judul).
- Lemari kosong tetap ada, hotspot redup (seperti zona genre tanpa buku).
- Mode gambar diam (tanpa WebGL): hotspot dan jumlah tetap ada, tanpa sampul.
- Peta perpustakaan (HP) mendapat tujuan baru ini, urutan tab setelah katalog Kosakata.

## 5. Data

Satu migrasi baru.

```sql
collections (
  id uuid pk, user_id uuid → profiles on delete cascade,
  name text check (char_length(name) between 1 and 40),
  created_at timestamptz default now(),
  unique index on (user_id, lower(name))
)
collection_books (
  collection_id uuid → collections on delete cascade,
  book_id uuid → books on delete cascade,
  added_at timestamptz default now(),
  primary key (collection_id, book_id)
)
books + finished_at timestamptz null
      + finish_declined boolean not null default false
```

- RLS: pengguna hanya membaca baris miliknya (`collection_books` lewat koleksinya). Tidak ada grant tulis langsung.
- Fungsi `security definer`, `search_path = ''`, error `P0001` dengan kode seperti fungsi yang ada:
  - `create_collection(p_name) returns text`: id koleksi baru, atau `'limit_reached'` / `'duplicate'`. Nama dipangkas; baris profil dikunci supaya batas 50 tidak terlewati oleh dua panggilan bersamaan.
  - `rename_collection(p_id, p_name)`, `delete_collection(p_id)` — hanya koleksi milik sendiri.
  - `set_book_collections(p_book_id, p_collection_ids uuid[])` — buku dan semua koleksi harus milik pemanggil; keanggotaan diganti seluruhnya.
  - `set_book_finished(p_book_id, p_finished boolean)` — `true` mengisi `finished_at = now()` (bila belum terisi); `false` mengosongkan `finished_at` dan `finish_declined`.
  - `decline_finish(p_book_id)`.
- Kolom `finished_at` dan `finish_declined` tidak masuk grant `update` buku: hanya lewat fungsi.

## 6. Kode

- **Tipe:** `ShelfBook` + `finishedAt: string | null`, `finishDeclined: boolean`, `collectionIds: Array<string>`. `ShelfData` + `collections: Array<{ id: string; name: string; createdAt: string }>`. Snapshot offline yang ada ikut menyimpannya.
- **Server:** `src/server/collections.ts` dengan server function untuk setiap fungsi DB, pola `updateBookGenreFn` (validasi zod, `ActionResult`). Pemuat rak membaca koleksi dan keanggotaan. Setelah perubahan berhasil, data rak dimuat ulang.
- **Logika murni:**
  - `src/lib/shelf.ts`: `ShelfSearch.koleksi`, filter koleksi × genre, urutan bawaan per koleksi, jumlah per koleksi.
  - `src/lib/finish.ts`: `shouldAskFinish(book, place)` dengan `place = { fraction, atBookEnd }`.
- **Komponen:** `CollectionBar`, `CollectionDialog` (buat, ganti nama, hapus), `BookCollections` (daftar centang di detail buku), `GenreSelect` (pengganti `GenreFilter`), `FinishPrompt` (di `read.$bookId.tsx`; reader memberi tahu `atBookEnd` lewat `ReaderLocation`).
- **Lobi:** hotspot `lemari` di `scene/layout.ts`; perabot dan tekstur sampul di `scene/furniture.ts` (tekstur dibuang saat adegan ditutup); `summarizeLobby` + `finished: Array<ShelfBook>` (12 terakhir); `LibraryMap` dan `HotspotLayer` mengenal tujuan baru.

## 7. Pengujian

- **DB:** batas 50 (termasuk dua panggilan bersamaan), nama kembar beda huruf, RLS dan fungsi menolak koleksi/buku orang lain, cascade saat buku atau koleksi dihapus, `set_book_finished` dan `decline_finish`.
- **Unit:** filter dan urutan koleksi, parse `koleksi`, `shouldAskFinish`, `summarizeLobby`, tata letak hotspot baru.
- **Komponen:** chip dan jumlah, dialog (validasi nama, konfirmasi hapus), daftar centang, ajakan selesai, offline menonaktifkan ubah.
- **E2E (desktop dan HP):** buat koleksi → centang buku → filter koleksi; sampai di akhir buku → Ya → buku di Sudah dibaca; Belum → ajakan tidak muncul lagi setelah muat ulang; hotspot lemari membuka Sudah dibaca.

## 8. Di luar 3A

Streak dan target (3B), % pemahaman (3C), kartu buku selesai, ulasan, dan kilas balik (3D), urutan koleksi yang bisa diatur tangan, ikon/warna koleksi, koleksi bersama antarpengguna.

## 9. Penyimpangan saat implementasi

1. Fungsi DB menjawab dengan kode teks (`ok`, `not_found`, `invalid`, `duplicate`, `limit_reached`; `create_collection` menjawab id baru); hanya sesi yang hilang menjadi exception, seperti `save_word`.
2. Kode pesan baru untuk `bookMessage`: `collections_full`, `collection_duplicate`, `collection_invalid`, diterjemahkan server function dari jawaban DB.
3. Daftar centang koleksi menyimpan setiap kali dicentang (tanpa tombol Simpan); bila gagal, centang kembali seperti semula dan pesan error tampil.
4. "Sedang dibaca" memakai `progress` dari server (`> 0`), bukan persentase lokal perangkat, supaya isi koleksi sama di semua perangkat.
5. Urutan `finished` ("Terakhir selesai") menjadi pilihan urutan untuk semua koleksi; bawaannya `finished` di Sudah dibaca dan `opened` di tempat lain, dan `?sort=` hanya masuk URL bila berbeda dari bawaan.
6. Label pilihan genre di rak adalah "Tampilkan genre", bukan "Genre", karena label "Genre" sudah dipakai di detail buku.
7. Letak akhir lemari pajang: berdiri bebas di `[30, 14]` menghadap +X, utuh di pandangan awal (titik awal `[0.9, 28.5]` dan `[0.9, 26]` jatuh di luar bingkai); hotspot terakhir dalam urutan tab.
8. Tekstur sampul dimuat ulang hanya bila daftar buku berubah (urutan id), bukan saat signed URL diperbarui.
9. Ajakan selesai dan penanda bab (mode Gulir) tidak tampil bersamaan: penanda disembunyikan selama ajakan tampil.
10. Ajakan selesai punya jawaban ketiga, "Nanti": ajakan disembunyikan hanya selama kunjungan baca itu dan tidak ada yang disimpan; membuka bukunya lagi menanyakan lagi (keputusan pemilik A).
