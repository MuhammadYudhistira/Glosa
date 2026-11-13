# Tahap 3F: ruang baca pribadi — desain

Tanggal: 2026-11-07, diperbarui 2026-11-13 (benda bertujuan, R3) · Cabang: `tahap-3f-ruang-baca`
Spec induk: [`2026-10-15-epub-reader-tahap-1-design.md`](2026-10-15-epub-reader-tahap-1-design.md) §1 (roadmap) · Lobi 3D: [`2026-10-21-tahap-1f-lobi-sebagai-pusat-design.md`](2026-10-21-tahap-1f-lobi-sebagai-pusat-design.md) · Lemari pajang: [`2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md`](2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md) §4.5 · Tanaman: [`2026-11-06-tahap-3b-kebiasaan-baca-design.md`](2026-11-06-tahap-3b-kebiasaan-baca-design.md) · Toko: [`2026-11-06-tahap-3c-toko-lobi-design.md`](2026-11-06-tahap-3c-toko-lobi-design.md)

## 1. Tujuan

Glosa berganti tema dari **perpustakaan publik** menjadi **ruang baca pribadi**: sebuah ruang studi milik anggota, dengan benda yang lebih detail. Lobi 3D sekarang adalah aula besar yang dilihat dari jauh, dibangun dari kotak dan silinder, sehingga terkesan kurang detail. Fitur Tahap 3 (tanaman, lemari buku selesai, dekorasi yang dibeli dengan koin, kilas balik) juga lebih cocok di ruang sendiri daripada di aula umum.

Data dan alamat yang ada tidak berubah. Yang berubah adalah adegan 3D, gambar diam, thumbnail toko, dan kata-kata di UI. R3 menambah satu halaman (`/highlights`) dan satu fungsi baca, tanpa tabel baru.

Prinsip ruangan (sejak 2026-11-13): **setiap benda dan setiap animasi punya tujuan.** Benda yang terlihat bisa dipakai; animasi menjawab tindakan anggota atau memberi tahu keadaan bacaannya (§3.6).

Pekerjaan dibagi tiga rencana, dikerjakan berurutan: **R1, ruang studi 3D**, **R2, bahasa dan alur masuk**, dan **R3, ruangan yang bercerita** (§4A).

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
| 9 | (2026-11-13) **Setiap benda punya fungsi atau dibuang.** Benda tanpa fitur yang cocok dibuang; bagian kecil dari benda induk (mantel perapian, kursi meja) boleh tetap. | Ruangan jujur: yang terlihat bisa dipakai, tak ada ketukan yang kosong. Fitur yang tersembunyi mendapat tempat. |
| 10 | (2026-11-13) **Animasi hanya dua jenis:** respons atas tindakan anggota, atau sinyal keadaan bacaan. Tanpa gerak dekoratif. | Setiap gerak berarti sesuatu ("Story"). |
| 11 | (2026-11-13) **Anda melakukan kegiatannya** (duduk, menulis, menyiram, …) sebelum popup terbuka, paling lama ±1,5 detik. **Menggantikan keputusan 1D no. 5** (aksi langsung tanpa menunggu). | Ruangan bercerita; jeda pendek dan bisa dilewati dengan ketuk ulang. |
| 12 | (2026-11-13) **Pembelian di masa depan** (koin, paket Pro, barang musiman, tema) masuk lewat **katalog di meja samping**; tidak ada benda baru untuknya sebelum fiturnya dibuat. | Satu pintu masuk untuk semua yang bisa dibeli; tak ada benda kosong. |

## 3. Ruang studi (R1)

### 3.1 Ruangan

- Satu ruangan bersudut L dengan kamera isometrik (sudut pandang sama dengan lobi sekarang), putar ±15° dan perbesar seperti sekarang.
- Dinding kiri: rak setinggi dinding dengan **8 bagian genre** berlabel.
- Dinding kanan: jendela besar ke kota, perapian, dan lemari kaca.
- Lantai: kursi berlengan dengan lampu baca, meja tulis dengan lampu meja, meja samping, dan pintu dengan kotak paket di dekatnya.
- Atrium, tangga, menara genre, pustakawan, pembaca NPC, dan pejalan kaki dihapus.
- Dibuang karena tidak punya fungsi (keputusan 9): tangga rak, tanaman kecil dekat pintu, tanaman di ambang jendela, lukisan dinding, dan karpet dasar. Karpet dan hiasan dinding tetap bisa dipasang lewat slot toko `rug` dan `wall`.
- Karakter **Anda** tetap bisa berjalan, dibatasi lantai ruangan dan perabot.

### 3.2 Benda dan hotspot

ID hotspot internal yang ada tetap, label berubah (§4.2). Tiga hotspot baru (`perapian`, `papan`, `pintu`) masuk di akhir urutan tab, setelah `toko`.

| Benda | Hotspot (ID) | Isi |
|---|---|---|
| Rak dinding kiri, 8 bagian | zona genre (`fiksi_sastra` … `lainnya`) | Rak Saya per genre. Punggung buku sebanyak jumlah buku (dibatasi), warna dari `coverHue`. Bagian tanpa buku redup. |
| Kotak paket dekat pintu | `troli` | Troli Buku Baru, jumlah buku tanpa genre |
| Kursi berlengan + lampu baca | `meja-baca` | Lanjutkan buku terakhir |
| Meja tulis + buku catatan + lampu meja | `katalog` | Kosakata |
| Laptop di meja tulis | `meja-admin` | Hanya admin |
| Tanaman di dekat jendela | `tanaman` | Kebiasaan baca, tahap tumbuh 3B |
| Lemari kaca | `lemari` | 12 sampul terakhir (3A §4.5), punggung berwarna sebagai cadangan |
| Katalog di meja samping | `toko` | Toko dekorasi, dengan pratinjau kamera 3C. Tahap 5: koin, paket Pro, dan barang baru (keputusan 12). |
| Perapian | `perapian` | **Kilas balik**: `RecapPanel` yang sudah ada sebagai popup |
| Papan gabus di dinding | `papan` | **Sorotan & catatan**: 3 sorotan terbaru tertempel sebagai kertas. Ketuk → popup berisi sorotan itu dengan "Buka di buku"; mulai R3 juga "Lihat semua" ke `/highlights`. Tahap 4 berbagi papan dengan feed. |
| Pintu | `pintu` | Popup kecil: **Pengaturan** dan **Keluar**. Tombol di bilah atas tetap ada. |
| Jendela ke kota | — | Tanpa hotspot. Fungsinya penunjuk waktu (suasana §3.4); Tahap 4 memakai lampu kota untuk pembaca online. |

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
| Malam | 19.00–04.59 | Lampu baca, lampu kota; ruangan bergantung pada lampu dan api |

Saat batas jam terlewati ketika halaman terbuka, suasana berganti halus dalam beberapa detik.

Api perapian dan lampu meja adalah sinyal (§3.6): keduanya mengikuti keadaan bacaan di semua suasana, juga di siang hari. Tabel di atas berlaku untuk lampu baca, lampu kota, dan cahaya umum.

### 3.5 Kualitas dan gambar diam

- Tingkat kualitas tetap: **tinggi**, **rendah** (tanpa bayangan, cahaya sederhana), **diam**; penurunan otomatis menurut FPS tetap.
- Mode diam memakai **gambar ruang studi versi malam** (avif/webp, 1280 dan ukuran besar) dengan hotspot di atasnya.
- Selama model dimuat, gambar diam tampil dengan hotspot yang sudah bisa diketuk, lalu adegan 3D memudar masuk.
- Bila model tidak bisa dimuat, ruangan tetap di mode diam tanpa pesan error.
- Gambar diam dan thumbnail barang toko dibuat ulang dari adegan baru lewat harness yang ada.
- Gambar diam memakai sinyal netral (api kecil, lampu meja padam, tutup kotak paket tertutup) dan memuat ketiga hotspot baru.

### 3.6 Benda bertujuan dan sinyal (R1)

Setiap benda di ruangan termasuk salah satu: punya hotspot, bagian dari benda yang punya hotspot, slot dekorasi, atau jendela (penunjuk waktu). Tes unit memeriksa aturan ini untuk daftar perabot dasar.

Animasi yang diizinkan:
- **Respons:** Anda berjalan ke hotspot (dan di R3 melakukan kegiatannya), pratinjau toko, peralihan popup.
- **Sinyal:** lihat tabel. Peralihan suasana dan lampu kota menandai waktu; rak dan lemari bertambah isi saat buku bertambah.
- Tanpa gerak dekoratif: tidak ada awan atau burung yang bergerak, tidak ada benda bergoyang. **Cincin di bawah Anda diam** (tidak berdenyut).

| Sinyal | Keadaan | Sumber data |
|---|---|---|
| Api perapian | **bara** bila tidak ada hari baca dalam 7 hari terakhir; **kecil** untuk 1–2 hari; **besar** untuk ≥ 3 hari | Hari baca dari kebiasaan baca 3B |
| Lampu meja | **menyala** bila jumlah pertemuan kata sekarang lebih besar dari jumlah saat Kosakata terakhir dibuka (ada kata tersimpan yang bertemu lagi sejak itu); selain itu padam | Jumlah `count` di `word_meetings` milik anggota (3D; tabel itu tak punya kolom waktu). Jumlah saat Kosakata dibuka disimpan di perangkat; belum ada catatan → disimpan sekarang dan lampu padam |
| Tutup kotak paket | **terbuka** bila ada buku tanpa genre | Jumlah troli yang sudah ada |

Di R1 sinyal hanya ditampilkan sesuai keadaannya saat lobi dimuat. Momen perubahan (peralihan beranimasi) ada di R3.

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

## 4A. Ruangan yang bercerita (R3)

Dikerjakan setelah R2.

### 4A.1 Kegiatan Anda

Setelah hotspot diketuk: Anda berjalan, melakukan kegiatannya, lalu popup atau halaman terbuka.

| Hotspot | Kegiatan |
|---|---|
| `meja-baca` | Duduk di kursi berlengan, membuka buku |
| genre (8) | Menjangkau rak, menarik satu buku |
| `troli` | Membungkuk ke kotak paket |
| `katalog` | Duduk di meja, menulis di buku catatan |
| `meja-admin` | Duduk di meja, mengetik di laptop |
| `lemari` | Membuka pintu kaca |
| `tanaman` | Menyiram dengan kaleng siram |
| `toko` | Mengambil katalog, membalik halaman |
| `perapian` | Berjongkok menghangatkan tangan |
| `papan` | Menatap papan, menyentuh kertas |
| `pintu` | Memegang gagang pintu |

- Waktu: berjalan paling lama ±0,9 detik (kecepatan menyesuaikan jarak jalur), kegiatan ±0,6 detik; total paling lama ±1,5 detik.
- Ketuk lagi selama berjalan atau berkegiatan langsung membuka popup.
- Langsung tanpa animasi, dengan Anda langsung dalam pose kegiatan: `prefers-reduced-motion`, mode diam, kualitas "diam", dan aktivasi lewat keyboard.
- Pose dibangun lewat kode pada figur Anda (sendi diputar). Benda bantu kecil (kaleng siram, buku di tangan) dibuat lewat kode dan hanya tampil selama kegiatan.

### 4A.2 Momen perubahan

Keadaan sinyal (§3.6) dan isi ruangan yang terakhir terlihat disimpan di perangkat. Saat lobi dibuka dan keadaannya berbeda, perubahannya dimainkan sekali (±1 detik):
- api membesar atau mengecil ke keadaan baru;
- tutup kotak paket terbuka saat ada buku baru tanpa genre;
- lampu meja menyala;
- daun baru tumbuh saat tanaman naik tahap;
- sampul masuk ke lemari saat buku selesai.

Kunjungan pertama di perangkat, reduced-motion, mode diam, dan kualitas "diam" langsung menampilkan keadaan akhir.

### 4A.3 Halaman Sorotan & catatan

- Alamat `/highlights`, dibuka dari papan gabus ("Lihat semua") dan dari popup papan.
- Isi: semua sorotan (`kind = 'highlight'`, belum dihapus) milik anggota di semua buku, terbaru dulu. Tiap baris: kutipan, catatan bila ada, judul buku, dan warna. Penanda halaman tidak ikut.
- Saringan per buku dan per warna.
- Aksi per sorotan: **Buka di buku** (pembaca dibuka di `cfi` itu) dan **Buat kartu kutipan** (ShareDialog kartu kutipan yang sudah ada).
- Data: satu fungsi server baca `annotations` milik anggota (RLS yang ada); tanpa tabel atau kolom baru. Saat offline tampil pesan seperti halaman lain yang butuh jaringan.

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
- `LobbyCanvas`, `HotspotLayer`, dan panel yang ada tidak berubah selain label (R2). Yang bertambah: popup untuk `perapian` (memakai `RecapPanel`), `papan`, dan `pintu` di `LobbyStage`/`LobbyPopup`, data sinyal (§3.6) yang diteruskan ke adegan, dan di R3 route `/highlights`.
- "Buka di buku" memakai parameter `?cfi=` pembaca yang sudah ada.

## 6. Urutan kerja dan titik cek

1. Audit aset dan pipeline model.
2. Kerangka ruangan, perabot dasar, dan cahaya tiga suasana.
3. **Titik cek pemilik:** tangkapan layar tiga suasana di desktop dan HP. Arah visual dikunci di sini sebelum lanjut. (2026-11-13: arah disetujui dengan benda tanpa fungsi dibuang, §3.1.)
4. Rak genre dan hotspot (termasuk `perapian`, `papan`, `pintu`), sinyal §3.6, lemari kaca, tanaman, slot dekorasi dan 18 barang, karakter Anda.
5. Gambar diam, thumbnail toko, pemuatan dan mode diam.
6. E2E dan verifikasi akhir R1.
7. R2: bahasa dan alur masuk.
8. R3: kegiatan Anda, momen perubahan, halaman Sorotan & catatan.

## 7. Pengujian

- **Unit:**
  - setiap hotspot di dalam ruangan dan terproyeksi di dalam layar pada rasio HP dan desktop;
  - `daylight` pada batas 04.59/05.00, 15.59/16.00, 18.59/19.00;
  - setiap model di daftar punya berkas di `public/lobby/models/`;
  - slot dekorasi di dalam ruangan dan tidak bertabrakan dengan perabot dasar;
  - Anda tidak bisa berjalan menembus perabot;
  - setiap perabot dasar punya hotspot atau tercatat sebagai bagian dari benda yang punya hotspot (§3.6);
  - sinyal api, lampu meja, dan kotak paket dari datanya, termasuk batas 0/1/2/3 hari baca;
  - R3: urutan dan waktu kegiatan, lompatan saat ketuk ulang, reduced-motion, keyboard, dan deteksi momen perubahan.
- **Harness tangkapan layar:** tiga suasana, desktop dan HP, gambar diam, thumbnail 18 barang.
- **E2E:** lobi 3D, toko (pratinjau dan pasang), lemari, dan tanaman disesuaikan; alur masuk dengan teks baru; perapian membuka Kilas balik, papan membuka sorotan, pintu membuka Pengaturan dan Keluar; R3: `/highlights` membuka buku di sorotan dan membuat kartu kutipan.
- **Pemindaian teks akhir R2:** tidak ada teks UI yang memuat "perpustakaan", "lobi", "anggota", atau "buku tamu", kecuali yang disengaja dan dicatat.
- **Manual setelah deploy:** kesan detail di HP, kinerja di HP lama, perubahan suasana saat jam berganti, offline setelah kunjungan pertama.

## 8. Di luar 3F

- Lampu kota sebagai pembaca online dan papan buletin sebagai feed (Tahap 4).
- Suasana yang bisa dikunci di Pengaturan, cuaca, musim.
- Barang toko baru di luar 18 yang ada.
- Mengganti URL atau nama tabel.
