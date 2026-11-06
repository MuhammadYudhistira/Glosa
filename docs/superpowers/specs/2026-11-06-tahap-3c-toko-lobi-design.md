# Tahap 3C: toko lobi — desain

Tanggal: 2026-11-06 · Cabang: `tahap-3c-toko`
Spec induk: [`2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md`](2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md) §1–§2 · Data waktu baca: [`2026-11-06-tahap-3b-kebiasaan-baca-design.md`](2026-11-06-tahap-3b-kebiasaan-baca-design.md) §3.1, §5

## 1. Tujuan

Membaca menghasilkan koin, dan koin membeli dekorasi untuk lobi 3D. Lobi pelan-pelan menjadi milik anggota, dan setiap barang di dalamnya datang dari halaman yang dibaca. Ide ini berasal dari `inspiration.md` ("make the homepage more gamify, like buy part").

Prinsip Tahap 3 tetap berlaku: hadiah datang dari membaca. Tidak ada XP, papan peringkat, hadiah harian untuk sekadar membuka aplikasi, atau barang yang hilang bila anggota berhenti membaca.

## 2. Keputusan pemilik

| # | Keputusan | Alasan |
|---|---|---|
| 1 | Koin dari **menit baca** (1 koin per menit) dan **bonus buku selesai** (+50). Nanti koin juga bisa **dibeli** (Tahap 5). | Mendorong membaca rutin dan menuntaskan buku. Sumber "dibeli" disiapkan sekarang (§5.1 `coin_grants`). |
| 2 | Target harian tercapai **tidak** memberi koin. | Target sudah dihargai lewat streak dan tanaman (3B). |
| 3 | Bonus buku selesai hanya bila buku itu sudah dibaca **minimal 60 menit**. | Mengunggah lalu langsung menandai selesai tidak menghasilkan koin. |
| 4 | Batas per halaman tetap **10 menit** (plafon jam baca 3B), dan koin memakai data yang sama dengan streak. | Halaman padat tetap terhitung wajar; satu sumber angka. |
| 5 | Waktu baca **sebelum toko ada** ikut dihitung. | Tidak ada pembaca yang merasa rugi; datanya baru sejak 3B, jadi jumlahnya kecil. |
| 6 | Isi toko: **dekorasi di slot tetap**, 6 slot × 3 barang. | Lobi tetap tertata; tidak perlu editor tata ruang bebas. |
| 7 | Harga **sedang**: 60–600 koin. | Barang pertama dalam beberapa hari; koleksi lengkap butuh berbulan-bulan. |
| 8 | **Panel toko + pratinjau di lobi**: memilih barang memasangnya sementara dan menggeser kamera ke slotnya. | Anggota melihat hasilnya sebelum membayar. |
| 9 | Saldo **dihitung dari data** (menit baca + bonus + koin tambahan − belanja), bukan disimpan sebagai angka (§5). | Koin lama otomatis terhitung, saldo tidak bisa menyimpang dari datanya, dan klien tidak bisa mengubah saldo atau harga. Waktu baca sendiri masih dilaporkan klien (3B), jadi koin bisa dipalsukan oleh skrip; aman selama barang hanya kosmetik dan pribadi (lihat §8). |

## 3. Perilaku

### 3.1 Koin didapat

- **Menit baca:** per tanggal, `least(floor(total detik hari itu / 60), 240)` koin. Total detik sama dengan 3B §3.2 (semua buku dan perangkat). Batas **240 koin per hari** menahan tab yang dibiarkan terbuka seharian.
- **Buku selesai:** +50 koin, **sekali per buku**, bila buku itu ditandai selesai (`books.finished_at` terisi) dan jumlah `reading_time.seconds` untuk buku itu (semua hari dan perangkat) ≥ 3600.
- Bonus yang sudah diberikan **tetap** walau tanda selesai dibatalkan atau buku dihapus (§5.1 `coin_awards`).
- Bonus diperiksa setiap kali saldo dibaca atau barang dibeli (§5.2). Urutan tidak menjadi masalah: buku yang ditandai selesai sebelum menit terakhirnya terkirim tetap mendapat bonus begitu menit itu sampai, selama tanda selesai masih ada.
- Buku yang selesai sebelum 3B tidak punya data waktu baca, jadi tidak mendapat bonus. Buku yang sangat pendek (di bawah 60 menit) juga tidak; menit bacanya tetap menjadi koin.
- **Koin tambahan** (`coin_grants`): koin dari luar bacaan, misalnya pembelian di Tahap 5. Di 3C tabelnya kosong dan tidak ada jalan untuk mengisinya dari aplikasi.

### 3.2 Saldo

Saldo = koin menit baca + bonus buku + koin tambahan − total harga barang yang dibeli. Saldo tidak pernah negatif: pembelian ditolak bila saldo kurang (§5.2), dan koin yang sudah didapat tidak berkurang, karena `reading_time` tidak terhapus saat buku dihapus (3B §5.1) dan bonus ditulis sekali.

Menit yang masih di antrean perangkat belum masuk saldo. Sebelum saldo dibaca, antrean waktu baca dikirim dulu (§6.3).

### 3.3 Barang

- Sekali beli, milik selamanya. Tidak ada jual kembali atau pengembalian koin.
- Satu slot berisi paling banyak satu barang. Barang milik bisa dipasang dan dilepas kapan saja, tanpa biaya.
- Membeli barang langsung memasangnya di slotnya, menggantikan barang yang terpasang sebelumnya di slot itu.
- Harga yang dibayar disimpan bersama pembelian, sehingga perubahan harga di katalog nanti tidak mengubah riwayat.

## 4. Katalog

Enam slot, masing-masing tiga barang. Posisi persis tiap slot ditentukan di plan lewat screenshot harness, seperti lemari pajang (3A) dan tanaman (3B): setiap slot harus utuh terlihat di pandangan awal atau mudah dicapai dengan menggeser kamera, dan tidak menghalangi hotspot, orang yang berjalan, atau menara genre.

| Slot (`slot`) | Letak | Barang (`id`: nama, harga) |
|---|---|---|
| `rug` Karpet baca | lantai depan meja baca | `rug_woven` Karpet anyaman 60 · `rug_round` Karpet bundar 120 · `rug_pattern` Karpet motif 300 |
| `lamp` Lampu | samping meja baca | `lamp_floor` Lampu lantai 80 · `lamp_arc` Lampu tiang lengkung 150 · `lamp_lantern` Lentera gantung 250 |
| `seat` Kursi santai | dekat dinding kaca | `seat_beanbag` Bean bag 100 · `seat_armchair` Kursi berlengan 200 · `seat_sofa` Sofa jendela 400 |
| `wall` Dinding | dinding rak kiri (X = 0) | `wall_map` Peta dunia 120 · `wall_painting` Lukisan 200 · `wall_clock` Jam dinding besar 300 |
| `pet` Teman | lantai terbuka | `pet_cat` Kucing tidur 250 · `pet_bird` Sangkar burung 300 · `pet_aquarium` Akuarium 400 |
| `ceiling` Gantungan | plafon atrium | `ceiling_lights` Untaian lampu 150 · `ceiling_books` Buku terbang 350 · `ceiling_globe` Bola dunia antik 600 |

Satu barang termurah di tiap slot berjumlah 760 koin; semua 18 barang 4.330 koin. Dengan ±15 menit baca per hari: barang pertama ±4 hari, tiap slot terisi ±7 minggu, semua barang ±8–9 bulan (lebih cepat dengan bonus buku).

Barang dibangun dari bentuk sederhana lewat `kit` lobi, seperti perabot yang ada; tidak ada file model. Barang di slot `pet` dan `ceiling` boleh bergerak pelan (ekor kucing, ikan, buku yang melayang); geraknya mati bila `prefers-reduced-motion` aktif, sama seperti orang yang berjalan.

## 5. Data

### 5.1 Tabel

Semua tabel memakai RLS: anggota hanya membaca barisnya sendiri, tidak ada hak tulis langsung, dan semua baris ikut terhapus saat akun dihapus (`on delete cascade` ke `profiles`).

- **`lobby_items`** `(id text primary key, slot text not null, price integer not null check (price > 0))`: katalog server, diisi oleh migrasi. Bisa dibaca semua anggota. Server memakai harga dari sini, tidak pernah dari klien.
- **`coin_awards`** `(user_id, book_id uuid, coins integer, awarded_at timestamptz, primary key (user_id, book_id))`: bonus buku selesai. `book_id` tanpa foreign key, seperti `reading_time`, supaya bonus tetap setelah buku dihapus.
- **`coin_grants`** `(id uuid primary key, user_id, coins integer check (coins > 0), reason text, created_at)`: koin tambahan (Tahap 5). Kosong di 3C.
- **`lobby_purchases`** `(user_id, item_id references lobby_items, price integer, bought_at timestamptz, primary key (user_id, item_id))`.
- **`lobby_placements`** `(user_id, slot text, item_id references lobby_items, primary key (user_id, slot))`. Fungsi DB menjaga agar `item_id` dimiliki anggota dan slotnya cocok dengan `lobby_items.slot`.

### 5.2 Fungsi

Semua `security definer`, `set search_path = ''`, dan hanya bisa dijalankan oleh `authenticated`. Jawaban memakai kode teks seperti fungsi 3A; hanya sesi yang hilang menjadi exception.

- **`award_book_coins()`** (internal, tidak diberikan ke klien): menyisipkan `coin_awards` untuk setiap buku anggota dengan `finished_at` terisi, total detik ≥ 3600, dan belum ada bonusnya (`on conflict do nothing`).
- **`coin_balance()`** → `(earned integer, spent integer, balance integer)`: menjalankan `award_book_coins()`, lalu menghitung `earned` = menit baca (§3.1) + `coin_awards` + `coin_grants`, `spent` = jumlah `lobby_purchases.price`.
- **`lobby_state()`** → saldo (seperti `coin_balance`), daftar `item_id` yang dimiliki, dan pasangan `slot → item_id` yang terpasang, dalam satu panggilan untuk panel dan lobi.
- **`buy_lobby_item(p_item text)`** → `ok` | `not_found` | `owned` | `not_enough`: mengunci baris `profiles` anggota (`for update`) supaya dua pembelian bersamaan tidak membayar dari saldo yang sama, menjalankan `award_book_coins()`, memeriksa saldo terhadap `lobby_items.price`, lalu menyisipkan pembelian dan memasang barang di slotnya.
- **`place_lobby_item(p_slot text, p_item text)`** → `ok` | `not_found` | `not_owned`: `p_item` kosong melepas barang dari slot; selain itu barang harus dimiliki dan slotnya harus cocok.

### 5.3 Di perangkat (Dexie)

Barang yang terpasang disimpan di Dexie per anggota, supaya lobi langsung menampilkannya saat dibuka, juga offline. Cache dihapus saat keluar akun atau berganti anggota, lewat pola `onMemberDataWiped` dari 3B. Saldo dan daftar milik tidak dipakai offline untuk membeli.

## 6. Kode

### 6.1 Katalog

`src/lib/shop/catalog.ts`: slot (id, nama, urutan) dan barang (id, slot, nama, harga). Pembuat 3D tiap barang ada di `src/components/lobby/scene/decor.ts`, dikunci dengan id yang sama. Tes DB memastikan isi `lobby_items` sama dengan katalog kode (id, slot, harga).

### 6.2 Panel "Toko lobi"

- Rute popup **`/shop`**, ditambahkan ke `POPUP_PATHS`, dengan pola yang sama seperti `/habits`.
- Hotspot baru di lobi: **kios kecil** yang membuka panel. Masuk ke urutan tab hotspot; posisinya ditentukan di plan bersama slot-slot.
- Bagian atas: saldo koin dan keterangan "1 koin per menit baca, +50 per buku selesai (dibaca minimal 1 jam)".
- Enam kelompok slot. Tiap barang: gambar kecil, nama, harga, dan satu tombol menurut keadaannya:
  - **Beli**: dinonaktifkan dengan keterangan "Kurang N koin" bila saldo tidak cukup.
  - **Pasang**: barang milik yang tidak terpasang.
  - **Terpasang**, dengan tombol **Lepas**.
- Beli meminta konfirmasi: dialog "Beli Kucing tidur seharga 250 koin?", karena koin tidak bisa dikembalikan.
- Gambar kecil dirender sekali oleh skrip harness ke `public/lobby/shop/<id>.webp`, seperti gambar diam lobi.

### 6.3 Pratinjau dan lobi 3D

- `stage` mendapat `setDecor(placements)` untuk barang terpasang dan `preview(item | null)` untuk pratinjau.
- **Desktop:** memilih barang di panel memasangnya sementara di slotnya dan menggeser kamera supaya slot terlihat di samping panel. Menutup panel tanpa membeli mengembalikan lobi seperti semula.
- **HP:** panel adalah halaman biasa dan lobi tidak terlihat; pratinjaunya gambar barang yang lebih besar.
- Gambar diam lobi (tanpa WebGL atau kualitas rendah) tetap versi bawaan tanpa dekorasi. Toko tetap bisa dipakai.
- `src/server/shop.ts` berisi server function untuk `lobby_state`, `buy_lobby_item`, dan `place_lobby_item`. `src/lib/shop/shop-client.ts` mengirim antrean waktu baca (sinkronisasi 3B) sebelum membaca `lobby_state`, menyimpan barang terpasang ke Dexie, dan menyegarkan status setelah beli atau pasang.

### 6.4 Keadaan kosong, offline, dan error

- Saldo 0: panel tetap tampil, dengan ajakan "Baca untuk mendapat koin".
- Offline: panel menampilkan barang terpasang dari cache; tombol Beli, Pasang, dan Lepas dinonaktifkan dengan keterangan "Perlu koneksi internet".
- Jawaban `not_enough` (saldo berubah di perangkat lain): pesan "Koinmu belum cukup" dan status disegarkan. `owned`: status disegarkan tanpa pesan error. Error lain: pesan umum, status tidak berubah.

### 6.5 Privasi

Halaman privasi menyebut data baru: barang lobi yang dibeli dan dipasang, serta catatan koin. Semua dihapus bersama akun.

## 7. Pengujian

- **DB:**
  - menit baca: pembulatan ke bawah per hari, batas 240 per hari, semua perangkat dan buku dijumlah;
  - bonus buku: hanya bila selesai dan ≥ 3600 detik, sekali per buku, tetap setelah tanda selesai dibatalkan dan setelah buku dihapus, muncul setelah menit terakhir tiba;
  - `buy_lobby_item`: `ok` (memasang dan menggantikan barang di slot), `not_found`, `owned`, `not_enough`; dua pembelian bersamaan tidak membuat saldo negatif;
  - `place_lobby_item`: pasang, lepas, `not_owned`, slot tidak cocok;
  - tulis langsung ke tabel baru ditolak; anggota lain tidak melihat baris anggota;
  - `lobby_items` sama dengan katalog kode.
- **Unit:** katalog, cache klien dan penghapusannya, status panel (beli, kurang koin, pasang, lepas, offline, saldo 0), dialog konfirmasi, pembuat dekorasi (`set` dan `dispose`), pratinjau yang dikembalikan saat panel ditutup.
- **E2E desktop dan HP:** waktu baca diisi lewat helper, saldo tampil, beli, barang terpasang di lobi, lepas; tombol Beli nonaktif bila koin kurang.
- **Harness:** screenshot posisi tiap slot dan kios, serta gambar kecil tiap barang.

## 8. Di luar 3C

Membeli koin dengan uang (Tahap 5, mengisi `coin_grants`), jual kembali barang, barang musiman atau terbatas, tema lobi utuh, varian benda yang sudah ada (warna rak, model meja), tata ruang bebas, dan memamerkan lobi ke anggota lain (Tahap 4).

**Catatan untuk Tahap 5 (review akhir 3C):** `record_reading_time` mempercayai klien (hingga 86.400 detik per hari, perangkat, dan buku; tanggal dalam jendela 30 hari). Sebelum koin dijual lewat `coin_grants`, server perlu memeriksa kewajaran waktu baca, supaya koin palsu tidak bersaing dengan koin yang dibayar.
