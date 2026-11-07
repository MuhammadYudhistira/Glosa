# Tahap 3F: ruang baca pribadi — desain

Tanggal: 2026-11-07 · Cabang: `tahap-3f-ruang-baca`
Spec induk: [`2026-10-15-epub-reader-tahap-1-design.md`](2026-10-15-epub-reader-tahap-1-design.md) §1 (roadmap) · Lobi 3D: [`2026-10-21-tahap-1f-lobi-sebagai-pusat-design.md`](2026-10-21-tahap-1f-lobi-sebagai-pusat-design.md) · Lemari pajang: [`2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md`](2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md) §4.5 · Tanaman: [`2026-11-06-tahap-3b-kebiasaan-baca-design.md`](2026-11-06-tahap-3b-kebiasaan-baca-design.md) · Toko: [`2026-11-06-tahap-3c-toko-lobi-design.md`](2026-11-06-tahap-3c-toko-lobi-design.md)

## 1. Tujuan

Glosa berganti tema dari **perpustakaan publik** menjadi **ruang baca pribadi**: sebuah ruang studi milik anggota, dengan benda yang lebih detail. Lobi 3D sekarang adalah aula besar yang dilihat dari jauh, dibangun dari kotak dan silinder, sehingga terkesan kurang detail. Fitur Tahap 3 (tanaman, lemari buku selesai, dekorasi yang dibeli dengan koin, kilas balik) juga lebih cocok di ruang sendiri daripada di aula umum.

Data, fitur, dan alamat tidak berubah. Yang berubah adalah adegan 3D, gambar diam, thumbnail toko, dan kata-kata di UI.

Pekerjaan dibagi dua rencana: **R1, ruang studi 3D** dan **R2, bahasa dan alur masuk**. R1 dikerjakan lebih dulu.

## 2. Keputusan pemilik

| # | Keputusan | Alasan |
|---|---|---|
| 1 | Tema **ruang studi pribadi** (perpustakaan rumah: rak setinggi dinding, kursi berlengan, perapian, meja tulis). | Paling dekat dengan konsep sekarang, tetapi milik sendiri. |
| 2 | **3D dengan model siap pakai** (glTF, paket CC0) untuk perabot; bagian yang bergantung pada data dibuat lewat kode. | Detail terbanyak untuk usaha yang sama, tetap interaktif. |
| 3 | Gaya **stylized hangat** (bentuk membulat, warna hangat, tekstur sederhana). | Kaya tapi ringan di HP, dan mudah ditambah barang dengan gaya sama. |
| 4 | Tata letak **satu ruang bersudut L**: seluruh ruangan terlihat dalam satu layar, juga di HP. | Mudah dijelajahi tanpa menggeser kamera. |
| 5 | Hanya karakter **Anda**; pengunjung NPC dihapus. "Dunia luar" untuk Tahap 4 lewat **jendela ke kota** dan **papan buletin**. | Kamar sendiri; ruangan tidak perlu dibongkar lagi di Tahap 4. |
| 6 | **Cahaya ikut jam perangkat**: pagi/siang, senja, malam. | Ruangan terasa hidup dan cocok untuk kebiasaan harian. |
| 7 | Bahasa **tema rumah, sederhana**. | Jelas tanpa permainan kata berlebihan. |
| 8 | **Ganti di tempat** dengan antarmuka adegan yang sama ke React (pendekatan A). | Panel, data, route, dan tesnya tidak tersentuh. |

## 3. Ruang studi (R1)

### 3.1 Ruangan

- Satu ruangan bersudut L dengan kamera isometrik (sudut pandang sama dengan lobi sekarang), putar ±15° dan perbesar seperti sekarang.
- Dinding kiri: rak setinggi dinding dengan **8 bagian genre** berlabel.
- Dinding kanan: jendela besar ke kota, perapian, dan lemari kaca.
- Lantai: kursi berlengan dengan lampu baca, meja tulis, meja samping, karpet, dan pintu dengan kotak paket di dekatnya.
- Atrium, tangga, menara genre, pustakawan, pembaca NPC, dan pejalan kaki dihapus.
- Karakter **Anda** tetap bisa berjalan, dibatasi lantai ruangan dan perabot.

### 3.2 Benda dan hotspot

ID hotspot internal tetap, label berubah (§4.2).

| Benda | Hotspot (ID) | Isi |
|---|---|---|
| Rak dinding kiri, 8 bagian | zona genre (`fiksi_sastra` … `lainnya`) | Rak Saya per genre. Punggung buku sebanyak jumlah buku (dibatasi), warna dari `coverHue`. Bagian tanpa buku redup. |
| Kotak paket dekat pintu | `troli` | Troli Buku Baru, jumlah buku tanpa genre |
| Kursi berlengan + lampu baca | `meja-baca` | Lanjutkan buku terakhir |
| Meja tulis + buku catatan | `katalog` | Kosakata |
| Laptop di meja tulis | `meja-admin` | Hanya admin |
| Tanaman di dekat jendela | `tanaman` | Kebiasaan baca, tahap tumbuh 3B |
| Lemari kaca | `lemari` | 12 sampul terakhir (3A §4.5), punggung berwarna sebagai cadangan |
| Katalog di meja samping | `toko` | Toko dekorasi, dengan pratinjau kamera 3C |
| Jendela ke kota | — | Tanpa hotspot di 3F; Tahap 4 memakai lampu kota untuk pembaca online |
| Papan gabus di dinding | — | Tanpa hotspot di 3F; Tahap 4 memakai untuk feed |

### 3.3 Slot dekorasi

- Enam slot 3C (`rug`, `lamp`, `seat`, `wall`, `pet`, `ceiling`) dipindah ke tempat yang masuk akal di ruang studi.
- Ke-18 barang dibuat ulang dengan gaya baru. ID, nama, harga, dan pembelian tetap; tabel dan fungsi toko tidak berubah.
- Slot `seat` (kursi santai) berada di tempat lain dari kursi berlengan dasar (hotspot `meja-baca`). Slot `lamp` adalah lampu tambahan, terpisah dari lampu baca dasar.

### 3.4 Cahaya

`daylight(date)` menentukan suasana dari jam lokal perangkat:

| Suasana | Jam | Cahaya |
|---|---|---|
| Pagi/siang | 05.00–15.59 | Matahari masuk dari jendela; lampu mati |
| Senja | 16.00–18.59 | Cahaya jingga rendah; lampu baca menyala |
| Malam | 19.00–04.59 | Lampu meja, perapian, lampu kota |

Saat batas jam terlewati ketika halaman terbuka, suasana berganti halus dalam beberapa detik.

### 3.5 Kualitas dan gambar diam

- Tingkat kualitas tetap: **tinggi**, **rendah** (tanpa bayangan, cahaya sederhana), **diam**; penurunan otomatis menurut FPS tetap.
- Mode diam memakai **gambar ruang studi versi malam** (avif/webp, 1280 dan ukuran besar) dengan hotspot di atasnya.
- Selama model dimuat, gambar diam tampil dengan hotspot yang sudah bisa diketuk, lalu adegan 3D memudar masuk.
- Bila model tidak bisa dimuat, ruangan tetap di mode diam tanpa pesan error.
- Gambar diam dan thumbnail barang toko dibuat ulang dari adegan baru lewat harness yang ada.

## 4. Bahasa dan alur masuk (R2)

### 4.1 Alur masuk

| Tempat | Sekarang | Menjadi |
|---|---|---|
| Halaman depan (`/`) | "…perpustakaan pribadimu…", "Masuk ke perpustakaan →" | "…ruang baca pribadimu…", "Masuk ke ruang bacamu →" |
| `/login` | Buku Tamu, sapaan petugas perpustakaan | **Masuk**, judul "Masuk ke ruang bacamu", sapaan singkat tanpa tokoh |
| `/register` | Formulir Anggota, "Ajukan keanggotaan" | **Buat ruang baca**, tombol "Buat ruang baca" |
| `/welcome` | Kartu Anggota, stempel "DITERIMA" | **Kartu pembaca** (nama, tanggal bergabung, ringkasan buku dan streak), "Ruang bacamu sudah siap", "Masuk ke ruang bacamu →" |
| Form daftar dan `/terms` | Tata tertib perpustakaan | **Syarat Layanan**, isi aturan tetap |

### 4.2 Di dalam aplikasi

| Sekarang | Menjadi |
|---|---|
| Lobi (navigasi, judul, "Lihat di lobi", label adegan) | **Ruang baca** |
| Peta Perpustakaan | **Denah ruangan** |
| Toko lobi | **Toko dekorasi** |
| Meja Baca | **Kursi baca** |
| Petugas perpustakaan | dihapus |
| Kartu anggota (menu, profil) | **Kartu pembaca** |

Teks untuk pembaca layar mengikuti nama baru. Halaman privasi dan syarat mengganti kata "perpustakaan" seperlunya tanpa mengubah isi hukumnya.

### 4.3 Tidak berubah

- URL (`/lobby`, `/login`, `/register`, `/welcome`, `/shop`, dan lainnya), supaya tautan, PWA, dan email konfirmasi tetap jalan.
- Nama tabel, fungsi, dan ID hotspot.
- Template email Supabase dicek; kata "perpustakaan" di sana ikut diganti.

## 5. Aset dan teknis

### 5.1 Aset

- Perabot dasar dari **KayKit Furniture Bits** (CC0, glTF). Paket CC0 lain bergaya cocok (misalnya dari Poly Pizza) hanya untuk benda yang tidak ada.
- Tugas pertama R1 adalah **audit aset**: mencocokkan daftar benda (§3.2, §3.3) dengan isi paket, dan memutuskan per benda: model paket, paket lain, atau dibuat lewat kode.
- Karakter Anda memakai karakter KayKit CC0 bila gayanya cocok; bila tidak, karakter sekarang diberi gaya baru. Keputusan ada di audit.
- Model yang dipakai saja disalin ke `public/lobby/models/` sebagai `.glb`, dengan `LICENSE.md` (CC0 dan asal tiap model).
- Tanpa Draco. Total unduhan model ≤ **3 MB**.

### 5.2 Dibuat lewat kode

Buku di rak dan sampul di lemari (dari data rak), tahap tanaman, kota di luar jendela (`skyline` dipakai ulang), dan susunan cahaya, dengan palet dan bentuk membulat yang sama dengan model.

### 5.3 Memuat dan kinerja

- `GLTFLoader` dari `three/addons`; tidak ada dependensi npm baru.
- Model di-cache service worker PWA (kunjungan berikutnya dan offline langsung tampil).
- Mesh statis digabung; buku di rak memakai instancing; bayangan hanya di kualitas tinggi.

### 5.4 Kode

- Modul di `src/components/lobby/scene/` diganti: `room`, `furniture`, `shelves`, `showcase`, `plant`, `decor`, `skyline`; `people` tinggal Anda.
- Modul baru: `models.ts` (daftar model dan pemuat) dan `daylight.ts` (suasana dari jam, fungsi murni).
- Ekspor yang dipakai React tetap bernama sama: `HOTSPOT_SPOTS`, `DECOR_SLOTS`, `SHOWCASE_SLOTS`, `PLANT_SHAPES`, `PREVIEW_SHIFT`, tipe `HotspotId`.
- `LobbyCanvas`, `LobbyStage`, `HotspotLayer`, dan semua panel tidak berubah selain label (R2).

## 6. Urutan kerja dan titik cek

1. Audit aset dan pipeline model.
2. Kerangka ruangan, perabot dasar, dan cahaya tiga suasana.
3. **Titik cek pemilik:** tangkapan layar tiga suasana di desktop dan HP. Arah visual dikunci di sini sebelum lanjut.
4. Rak genre dan hotspot, lemari kaca, tanaman, slot dekorasi dan 18 barang, karakter Anda.
5. Gambar diam, thumbnail toko, pemuatan dan mode diam.
6. R2: bahasa dan alur masuk.
7. E2E dan verifikasi akhir.

## 7. Pengujian

- **Unit:**
  - setiap hotspot di dalam ruangan dan terproyeksi di dalam layar pada rasio HP dan desktop;
  - `daylight` pada batas 04.59/05.00, 15.59/16.00, 18.59/19.00;
  - setiap model di daftar punya berkas di `public/lobby/models/`;
  - slot dekorasi di dalam ruangan dan tidak bertabrakan dengan perabot dasar;
  - Anda tidak bisa berjalan menembus perabot.
- **Harness tangkapan layar:** tiga suasana, desktop dan HP, gambar diam, thumbnail 18 barang.
- **E2E:** lobi 3D, toko (pratinjau dan pasang), lemari, dan tanaman disesuaikan; alur masuk dengan teks baru.
- **Pemindaian teks akhir R2:** tidak ada teks UI yang memuat "perpustakaan", "lobi", "anggota", atau "buku tamu", kecuali yang disengaja dan dicatat.
- **Manual setelah deploy:** kesan detail di HP, kinerja di HP lama, perubahan suasana saat jam berganti, offline setelah kunjungan pertama.

## 8. Di luar 3F

- Lampu kota sebagai pembaca online dan papan buletin sebagai feed (Tahap 4).
- Suasana yang bisa dikunci di Pengaturan, cuaca, musim.
- Barang toko baru di luar 18 yang ada.
- Mengganti URL atau nama tabel.
