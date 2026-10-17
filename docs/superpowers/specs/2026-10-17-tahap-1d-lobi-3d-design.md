# Glosa Tahap 1D — Lobi Perpustakaan 3D: Desain

Tanggal: 2026-10-17
Spec induk: [`2026-10-15-epub-reader-tahap-1-design.md`](2026-10-15-epub-reader-tahap-1-design.md) §7 (lobi)
Rujukan visual: [`mockups/lobi-starfield.html`](mockups/lobi-starfield.html), prototipe yang disetujui pemilik proyek

## 1. Ringkasan

Lobi `/lobby` menjadi atrium perpustakaan 3D bertema **Starfield Library**:
- dinding rak raksasa setinggi beberapa lantai dengan kotak rak yang menyala hangat;
- balkon putih, kotak rak melayang, dan tangga tribun tempat pengunjung duduk;
- menara rak sebagai zona genre;
- dinding kaca dengan pemandangan gedung pencakar langit.

Adegan memenuhi layar, hidup dengan animasi ringan, dan setiap tempat penting bisa diketuk.

Rencana 1D di seri tahap 1 dipecah menjadi dua:

| Rencana | Isi |
|---|---|
| **1D** | **Lobi 3D (dokumen ini)**, kerangka navigasi anggota, dan perbaikan font reader saat offline |
| 1E | Produksi: proyek Supabase prod + SMTP, Docker + Caddy di VPS, GitHub Actions deploy, Sentry + Uptime Kuma, sapuan Storage berkala (termasuk user auth tanpa profil), header cache `sw.js` |

## 2. Keputusan

Diambil bersama pemilik proyek selama brainstorming 2026-10-17:

1. **3D sungguhan dengan Three.js**, bukan ilustrasi SVG. Pilihan ini diambil setelah membandingkan prototipe sudut perpustakaan versi SVG dan versi 3D. Ini mengganti rencana "ilustrasi raster/SVG" di spec induk §7.
2. **Tema Starfield Library.** Kayu hangat, kotak rak menyala dari belakang, lantai kayu mengilap, aksen putih.
3. **Area penuh.** Adegan memenuhi seluruh layar, dan geser kamera dibatasi supaya latar kosong tidak pernah terlihat.
4. **Pemandangan luar berupa gedung pencakar langit senja**, dengan awan, burung, dan lampu suar yang berkedip. Tidak ada mobil.
5. **Ketuk hotspot:** aksinya langsung berjalan, dan tokoh "Anda" ikut berjalan ke titik itu tanpa membuat anggota menunggu.
6. **Navigasi (sidebar/tab bar) ada di semua halaman anggota**, kecuali reader.
7. **Tidak ada tombol "matikan animasi".** `prefers-reduced-motion` dari sistem sudah cukup.
8. **Tokoh diperhalus** dari kapsul di prototipe menjadi figur yang lebih proporsional, tetap dibangun dari bentuk dasar, tanpa model eksternal.
9. **Area depan lantai diisi sudut duduk santai** (sofa, meja kecil, lampu), supaya tampilan HP tidak lapang.
10. **Perbaikan font reader offline** (sisa 1C) masuk ke 1D sebagai task terpisah.

## 3. Arsitektur

```
/lobby (route anggota)
 ├─ LobbyPage            loader: loadShelf (online atau salinan rak, 1C)
 │   ├─ LobbyStage       memilih: 3D | gambar diam
 │   │   ├─ LobbyCanvas  (client-only, chunk lazy "lobby-3d": three + adegan)
 │   │   └─ LobbyStill   (<img> lobby-still.avif — poster & cadangan)
 │   ├─ HotspotLayer     <button> HTML, posisi dari proyeksi kamera
 │   └─ panel lobi       top bar, Peta, Detail Buku, Baru Dibuka, Meja Admin / sheet HP
 └─ MemberShell (_member.tsx)  sidebar ≥ 1024 px, tab bar < 1024 px
```

### 3.1 Adegan 3D

- **Library:** Three.js `0.160.x` (versi yang dipakai prototipe), ditambah addon `RoundedBoxGeometry`, `OrbitControls`, `RoomEnvironment`, serta `EffectComposer` dengan `UnrealBloomPass`.
- **Hanya dimuat di `/lobby`**, lewat `import()` dinamis di dalam effect, sehingga halaman lain tidak membawa three.js. Chunk ini ikut di-precache service worker, jadi lobi juga tampil offline.
- **Struktur kode** di `src/components/lobby/scene/`. Setiap file punya satu tugas dan diuji terpisah bila logikanya murni:

  | File | Isi |
  |---|---|
  | `layout.ts` | Koordinat dunia: ukuran atrium, posisi zona, meja, troli, jalur pejalan kaki, titik "Anda". Data murni. |
  | `projection.ts` | Proyeksi isometrik ortografis murni (dunia → % layar) untuk hotspot dan gambar diam, tanpa three.js. |
  | `room.ts` | Lantai, dinding rak, balkon, kotak rak melayang, tangga tribun. |
  | `shelves.ts` | Kotak rak menyala; buku dan sekat sebagai `InstancedMesh`. |
  | `skyline.ts` | Dinding kaca dengan stencil, latar gedung yang dilukis, awan, burung, lampu suar. |
  | `furniture.ts` | Menara zona, Meja Baca, Meja Admin, Troli, meja pajang, lampu, tanaman, bola seni, sudut duduk. |
  | `people.ts` | Figur bersendi (pinggul, lutut, bahu, kepala) dan pose: berjalan, duduk, membaca, mengetik. |
  | `motion.ts` | Animasi per frame: pejalan kaki, halaman, pustakawan, awan, burung, lampu suar, bola seni, "Anda". |
  | `stage.ts` | Renderer, kamera, kontrol, kualitas, loop render, `dispose()`. |

- **Pemandangan luar.** Kamera isometrik selalu melihat ke bawah, sehingga lewat kaca hanya tanah yang akan terlihat. Karena itu langit dan gedung dilukis pada bidang tepat di balik kaca (cara diorama), dan hanya digambar di area kaca melalui stencil buffer.
- **Kamera.**
  - `OrthographicCamera` dengan arah isometrik (1, 1, 1).
  - Geser dengan drag atau satu jari, zoom dengan roda atau dua jari (zoom 1–2,6×), tanpa rotasi.
  - Target kamera dibatasi di atas lantai atrium.
  - Desktop membuka seluruh atrium. HP membuka di sekitar Meja Baca.
- **Kualitas, dipilih otomatis:**

  | Tingkat | Kapan | Isi |
  |---|---|---|
  | Tinggi | Default desktop | DPR ≤ 2, peta bayangan 2048, bloom |
  | Rendah | HP, `deviceMemory` ≤ 4, atau rata-rata < 40 fps pada 3 detik pertama | DPR 1, peta bayangan 1024, tanpa bloom, separuh pejalan kaki |
  | Diam | `prefers-reduced-motion`, WebGL tidak tersedia, atau rata-rata < 20 fps pada tingkat rendah | Tanpa loop animasi; render hanya saat kamera digeser |

- **Loop render.**
  - Berhenti saat tab tersembunyi dan saat route lobi tidak tampil.
  - Saat keluar dari lobi, `dispose()` melepas geometri, material, tekstur, renderer, dan listener.
- **Gambar diam** `public/lobby/lobby-still.avif` (+ `.webp`):
  - dirender dari adegan yang sama oleh `scripts/render-lobby-still.mjs` (Playwright, mode diam, ukuran tetap);
  - dipakai sebagai poster selama chunk 3D dimuat (tidak ada kedipan kosong), sebagai cadangan tingkat "diam" ketika WebGL tidak ada, dan sebagai **latar halaman sambutan dan masuk/daftar** menggantikan `scene.svg` dan `scene-labels.svg` dari 1A. Kamera CSS yang mendekat ke Meja Admin tetap dipakai. Label zona tidak dibawa ke latar ini, karena di halaman auth label tidak bisa diketuk;
  - koordinat hotspot gambar diam dihitung dengan `projection.ts`, jadi sama persis dengan versi 3D.

### 3.2 Data

Loader lobi memakai `loadShelf(userId)` dari 1C, sehingga lobi juga tampil dari salinan rak saat offline. Tidak ada tabel, server function, atau migrasi baru. Dari data rak dihitung:
- jumlah buku per zona (`countBooks`);
- isi Troli (buku tanpa genre);
- 5 buku terakhir dibuka (`last_opened_at`);
- buku terakhir untuk Meja Baca.

## 4. Isi atrium

Mengikuti prototipe `lobi-starfield.html`:

- **Dinding kiri:** rak penuh setinggi atrium, dengan dua lantai balkon.
- **Dinding kanan:** rak hingga dinding kaca. Dinding kaca setinggi atrium menampilkan kota senja.
- **Kotak rak melayang** di atas tangga tribun putih. Tiap anak tangga punya LED dan rak kecil, dan 8–12 pengunjung duduk di sana.
- **8 menara rak**, satu per zona genre: Fiksi & Sastra, Misteri & Thriller, Fantasi & Petualangan, Anak & Remaja, Sains & Teknologi, Sejarah & Budaya, Bisnis & Pengembangan Diri, Rak Lainnya.
- **Meja Baca:** meja panjang dengan lampu dan pembaca yang membalik halaman.
- **Meja Admin:** pustakawan mengetik di depan monitor.
- **Troli Buku Baru** di dekat Meja Admin.
- **Sudut duduk santai** di area depan.
- Dekorasi: meja pajang menyala, lampu bola bertiang, tanaman, dan bola seni yang tergantung.

**Animasi** (hanya di tingkat tinggi/rendah):
- pengunjung berjalan di antara menara, berhenti sejenak, lalu menoleh;
- pengunjung di tangga menggerakkan kepala;
- pembaca membalik halaman;
- pustakawan mengetik;
- bola seni berputar pelan;
- di luar kaca: awan melayang, burung mengepak, lampu suar berkedip.

## 5. Interaksi

### 5.1 Hotspot

Hotspot berupa `<button>` HTML di atas kanvas. Posisinya mengikuti proyeksi titik 3D dan diperbarui saat kamera bergeser. Nama aksesibelnya memuat jumlah buku.

| Hotspot | Label | Aksi |
|---|---|---|
| Zona genre ×8 | "Sains & Teknologi · 3". Zona tanpa buku tetap tampil, diredupkan. | `/shelf?genre=<nilai>` |
| Meja Baca | "Meja Baca" | Membuka buku terakhir di `/read/$bookId`. Kalau belum ada buku yang dibaca, muncul gelembung "Belum ada buku yang dibaca" dengan tautan ke Rak Saya. |
| Meja Admin | "Meja Admin" | Membuka `UploadPanel` (1B) |
| Troli | "Troli Buku Baru" + badge jumlah. Badge disembunyikan saat troli kosong. | Panel "Susun buku": daftar buku troli dengan `TrolleyGenrePicker` (1B) |

Setiap ketukan menjalankan aksinya langsung. Tokoh "Anda" (cincin mint di lantai) berjalan ke titik hotspot selama ±0,9 detik. Posisinya diingat selama sesi (`sessionStorage`), sehingga saat kembali ke lobi ia berada di tempat terakhir.

### 5.2 Panel

**Desktop (≥ 1024 px):**
- **Top bar:** logo, jumlah buku, pencarian di rak sendiri (hasilnya membuka Detail Buku), dan avatar dengan menu (Pengaturan, Keluar).
- **Peta Perpustakaan:** denah mini dengan zona, Meja Baca, Meja Admin, Troli, dan posisi "Anda". Mengetuk titik di peta menggeser kamera ke area itu.
- **Detail Buku:** isinya dipakai bersama dengan dialog di Rak Saya (`BookDetail`, `ReadLink`, `BookActions`).
- **Baru Dibuka:** 5 buku dengan bar progres.
- **Kartu Meja Admin:** upload dan bar penyimpanan.

**HP (< 1024 px):**
- Adegan bisa digeser dan di-zoom.
- Bottom sheet "Lanjutkan membaca" berisi buku terakhir; Detail Buku tampil sebagai sheet yang diperluas.
- Tombol "+" untuk upload. Peta tidak ditampilkan.
- Tab bar: Lobi, Rak, Pengaturan.

**Empty state:** untuk anggota tanpa buku, `LibrarianBubble` di Meja Admin menyapa "Rakmu masih kosong. Bawa buku pertamamu ke sini!", dengan tautan ke Standard Ebooks dan Project Gutenberg.

### 5.3 Kerangka navigasi anggota

`_member.tsx` mendapat `MemberShell`: sidebar di desktop dan tab bar di HP, berisi Lobi, Rak Saya, dan Pengaturan. Tautan "← Lobi" di Rak Saya dan Pengaturan dihapus. Reader (`/read/$bookId`) tetap layar penuh tanpa kerangka.

### 5.4 Tidak ditampilkan

Kosakata, Papan Ulasan, jumlah pembaca online, level/streak, dan "Lihat versi HP" adalah fitur tahap lain. Tidak ada tombol mati.

## 6. Aksesibilitas

- Kanvas diberi `aria-hidden`. Semua aksi bisa dicapai lewat tombol hotspot, panel, dan navigasi.
- Kanvas dan hotspot berada di dalam wilayah adegan (`<section aria-label="Adegan lobi">`) yang bisa difokus.
- Urutan Tab mengikuti urutan logis: Meja Baca, zona, Troli, lalu Meja Admin. Hotspot yang mendapat fokus akan menggeser kamera supaya terlihat.
- Saat wilayah adegan difokus, kamera bisa digeser dengan tombol panah. Tombol "Pusatkan" mengembalikannya ke posisi awal.
- Label memenuhi kontras AA di atas adegan.
- `prefers-reduced-motion` membuat adegan diam. Perpindahan "Anda" menjadi instan, dan panel tidak beranimasi.

## 7. Offline dan error

- **Offline:** lobi tampil dari salinan rak (pesan offline yang sama dengan Rak Saya). Upload dan Troli dinonaktifkan dengan "Butuh internet." Meja Baca membuka buku terakhir; kalau buku itu belum tersimpan di perangkat, reader menampilkan `offline_not_saved` (1C).
- **Error data:** komponen error yang sama dengan Rak Saya, termasuk `offline_no_shelf`.
- **Error 3D:** kalau WebGL gagal dibuat atau konteksnya hilang, lobi beralih ke gambar diam tanpa pesan error. Hotspot dan panel tetap berfungsi.

## 8. Font reader offline (sisa 1C)

Masalah: buku dirender di iframe `blob:` yang tidak dikendalikan service worker, sehingga `@font-face` dengan URL `/assets/*.woff2` gagal saat offline.

Perbaikan:
1. Halaman utama, yang dikendalikan service worker, mengambil file font dengan `fetch`, sehingga font datang dari precache saat offline.
2. Font itu diubah menjadi `blob:` URL, lalu disuntikkan ke `readerCss`.
3. Kalau pengambilan gagal, URL absolut seperti sekarang dipakai sebagai cadangan.

Test E2E offline (1C) ditambah satu pemeriksaan: `document.fonts` di iframe buku memuat huruf reader dalam keadaan offline.

## 9. Pengujian

| Jenis | Cakupan |
|---|---|
| Unit | `projection.ts` (titik dunia → %, termasuk zoom dan geser); `layout.ts` (setiap genre punya zona, id unik, jalur pejalan kaki di dalam lantai dan tidak menembus menara); pemilihan tingkat kualitas; pemilihan buku terakhir; ringkasan data lobi (jumlah per zona, troli, 5 terakhir) |
| Komponen | `data-quality` pada wilayah adegan mengikuti tingkat kualitas; hotspot (nama aksesibel, redup, badge troli); gelembung Meja Baca; empty state; `MemberShell` (sidebar/tab bar, tautan aktif); fallback gambar diam saat WebGL tidak tersedia |
| E2E (desktop + HP) | Jumlah di zona benar, dan klik zona membuka Rak Saya terfilter; Meja Baca membuka buku terakhir; Troli dapat "susun buku"; Meja Admin membuka upload; empty state; di HP tab bar dan "Lanjutkan membaca" berfungsi; dengan emulasi reduced-motion, wilayah adegan ber-`data-quality="diam"`; test auth (kartu anggota → lobi) disesuaikan |
| Offline (proyek `offline`) | Lobi tampil dari salinan rak; font reader termuat offline |
| Manual | Profil performa Chrome dengan CPU 4× lebih lambat: tingkat rendah ≥ 40 fps. Tangkapan layar desktop dan 390 px. Satu HP Android sungguhan setelah deploy HTTPS di 1E. |

E2E berinteraksi lewat tombol HTML, jadi tidak bergantung pada piksel kanvas. WebGL di Chromium headless berjalan dengan SwiftShader.

## 10. Anggaran

- Chunk `lobby-3d` (three + adegan): ≤ 250 kB gzip. Total precache tetap < 4 MB.
- Gambar diam: ≤ 250 kB (AVIF) per ukuran.
- Adegan: ≤ 12.000 instans buku, satu lampu berbayangan, tanpa `PointLight` berbayangan.
- Animasi tidak menyebabkan long task > 50 ms.
