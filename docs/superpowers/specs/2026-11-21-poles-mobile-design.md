# Poles Mobile: Rak Saya, Dock Mengambang, Transisi Halaman, Pengaturan — Desain

Tanggal: 2026-11-21. Status: disetujui pemilik (brainstorm dengan visual companion, mockup di `.superpowers/brainstorm/1640-1795251890/content/`).

## 1. Latar

Setelah 3G, pemilik mengecek di HP dan menemukan:
- pindah halaman terasa kaku (tanpa animasi);
- Rak Saya terlalu padat: layar pertama habis untuk judul, penyimpanan, tombol, tab koleksi, kolom cari, dan dua dropdown sebelum buku terlihat. Kartu buku kecil dengan judul terpotong, tidak terasa seperti rak, buku yang sedang dibaca tidak menonjol, dan jaraknya terlalu rapat;
- tombol Keluar di Pengaturan berdiri sendiri di panel besar yang kosong.

Pemilik juga meminta tab bar bawah dibuat mengambang supaya lebih modern.

## 2. Keputusan

| # | Keputusan | Alasan |
|---|-----------|--------|
| 1 | Rak Saya memakai **arah B: grid besar 2 kolom** di HP. | Paling mudah dibaca: sampul besar, judul dan penulis utuh. |
| 2 | Kontrol Rak diringkas: **Cari**, **Saring**, dan **+ (Bawa buku)** menjadi tombol ikon di samping judul. | Buku terlihat di layar pertama. |
| 3 | Kartu **"Sedang dibaca"** di atas grid. | Buku yang sedang dibaca tampil di depan. |
| 4 | Tab bar HP diganti **dock mengambang gaya 2**: pil kaca, hanya tab aktif yang berlabel (pil hijau berisi ikon + nama). | Pilihan pemilik, lebih modern dan tetap memberi tahu posisi. |
| 5 | Animasi pindah halaman **gaya C: kartu di atas ruang**, memakai View Transitions API lewat router. | Halaman terasa berada di depan ruang baca. Ruang 3D memang tetap hidup di balik halaman (perbaikan 6d254a0). |
| 6 | Pengaturan **gaya 1**: daftar **"Akun"** di bawah berisi Keluar dan Hapus akun. Hapus akun membuka dialog konfirmasi. | Pola pengaturan HP yang lazim; formulir hapus akun tidak lagi terbuka di halaman. |
| 7 | Landing page **di luar** desain ini. | Spec sendiri setelah ini, sebelum produksi. |

## 3. Rak Saya (arah B)

### 3.1 Bagian atas
- Judul "Rak Saya" dengan tiga tombol ikon di kanan (masing-masing punya nama untuk pembaca layar):
  - **Cari**: membuka kolom cari tepat di bawah judul, langsung fokus. Kata kunci tetap disimpan di URL (`q`) seperti sekarang. Bila `q` sudah terisi saat halaman dibuka, kolomnya langsung terbuka.
  - **Saring**: membuka lembar dari bawah (dialog di desktop) berisi *Tampilkan genre* (`GenreSelect`), *Urutkan*, dan **meter penyimpanan** (`StorageMeter`). Meter tidak lagi tampil di halaman utama; panel Bawa buku tetap menampilkannya.
  - **+** (nama: "Bawa buku"): membuka panel unggah seperti sekarang.
- Pesan offline dan pesan hasil (`notice`) tetap ada, di bawah judul.

### 3.2 Kartu "Sedang dibaca"
- Buku yang **terakhir dibuka dan belum selesai** (`lastOpenedAt` terbaru, `finishedAt` kosong). Ini berbeda dari "Lanjutkan membaca" di Ruang yang juga memakai buku yang sudah selesai; di Rak, buku selesai sudah punya tempatnya sendiri.
- Isi: sampul, judul, penulis, bilah progres, tombol **Lanjutkan · N%** yang membuka pembaca. Ketuk bagian lain kartu membuka detail buku.
- Tampil hanya pada tampilan *Semua* tanpa pencarian aktif. Tidak tampil bila tidak ada buku yang memenuhi syarat.
- Buku itu tetap juga ada di grid.

### 3.3 Tab saring
- Satu baris yang bisa digeser ke samping: *Semua · Sedang dibaca · Sudah dibaca*, lalu koleksi milik anggota, lalu **+ Koleksi**. Ini `CollectionBar` yang sekarang, diberi gaya baru; perilaku (buat, ubah, hapus koleksi) tidak berubah.

### 3.4 Grid buku
- **2 kolom** di HP, 3 kolom mulai 640 px, 4–5 kolom di popup desktop.
- Kartu:
  - sampul 2:3 lebar penuh kolom;
  - judul maksimal 2 baris, penulis 1 baris;
  - bilah progres tipis bila 0 < progres < 100;
  - lencana **Selesai** di pojok sampul untuk buku selesai;
  - lencana "Tersedia offline" tetap ada.
- Pemilih genre untuk buku di "Kotak buku baru" (`TrolleyGenrePicker`) tetap ada di bawah kartu.
- Ketuk buku membuka `BookDetail` seperti sekarang, hanya jaraknya diperbarui.

### 3.5 Jarak
- Tepi halaman 16 px, antarbaris buku 18 px, antarbagian 20–24 px.

### 3.6 Desktop
- Struktur yang sama di dalam popup yang ada, dengan kolom lebih banyak.

## 4. Dock mengambang (gaya 2)

### 4.1 Tempat
- **Hanya HP** (lebar < 1024 px), menggantikan `.member-tabbar`. Sidebar dan menu mengambang desktop tidak berubah.
- Tetap disembunyikan di pembaca dan `/welcome` (`hasShell`).

### 4.2 Rupa
- Pil melayang: 16 px dari kiri-kanan (lebar maksimal 360 px), di tengah, di atas area gestur HP (`env(safe-area-inset-bottom)` + jarak).
- Kaca buram agak tembus (`backdrop-filter`), garis tipis, bayangan lembut.
- Empat tab hanya ikon, **kecuali tab aktif**: pil hijau berisi ikon + nama.

### 4.3 Gerak
- Saat pindah tab, pil hijau **bergeser** dari tab lama ke tab baru (±250 ms), bersamaan dengan transisi halaman.
- Hanya memakai `transform` dan `opacity`; tidak menganimasikan `width`, `padding`, atau `max-width`.
- Dengan "kurangi gerakan": langsung berpindah tanpa animasi.

### 4.4 Aksesibilitas
- Setiap tab punya `aria-label` berisi namanya, dan tab aktif punya `aria-current="page"`, meski labelnya tidak tampil.

### 4.5 Dampak ke elemen lain
- Ganti `--tabbar-h` dengan ruang dock (tinggi dock + jarak + safe area). Halaman mendapat padding bawah sebesar itu supaya tidak ada yang tertutup.
- Yang sekarang menempel di atas tab bar ikut naik ke atas dock:
  - lembar "Lanjutkan membaca" di Ruang (`use-sheet-height`);
  - kartu nama tempat;
  - pemberitahuan "Versi baru siap" (`.update-notice`).
- **Saat mengetik** (kolom teks fokus di HP), dock **disembunyikan** supaya tidak ikut naik bersama keyboard dan menutupi kolom.

## 5. Transisi halaman (gaya C)

### 5.1 Mekanisme
- Router diberi `defaultViewTransition` dengan fungsi `types` yang memilih jenis dari `fromLocation` → `toLocation`:
  - **`ke-halaman`** (Ruang `/lobby` → halaman lain di dalam shell): halaman baru naik dari bawah seperti kartu, sudut atasnya membulat selama bergerak. Ruang di belakangnya mengecil ke 94% dan meredup.
  - **`ke-ruang`** (halaman → Ruang): kartu turun, ruang membesar dan menerang kembali.
  - **`antar-halaman`** (antarhalaman selain Ruang, mis. Rak ↔ Kosakata ↔ Pengaturan): yang lama memudar, yang baru muncul sambil naik 12 px.
- Tidak ada transisi bila hanya query/hash yang berubah (mis. saring Rak), untuk pembaca (`/read/…`), dan untuk halaman tanpa shell. Untuk kasus ini fungsi `types` mengembalikan `false`.
- Durasi ±260 ms, easing keluar yang lembut. Animasi ditulis di CSS (`::view-transition-old/new` per jenis).

### 5.2 Yang tidak ikut bergerak
- Dock punya `view-transition-name` sendiri sehingga tidak ikut tergeser bersama halaman; hanya pil hijaunya yang bergeser (§4.3).

### 5.3 Berlaku di mana
- **Hanya HP** (< 1024 px). Di desktop fungsi `types` mengembalikan `false` (lewat `matchMedia`), supaya browser tidak menjalankan pudar bawaannya. Popup desktop tetap dengan animasinya sendiri.
- Gestur dan tombol kembali memakai aturan yang sama (kembali ke Ruang = kartu turun).

### 5.4 Bila tidak bisa
- Browser tanpa View Transitions (Firefox Android lama, iOS < 18): pindah langsung seperti sekarang.
- "Kurangi gerakan": fungsi `types` mengembalikan `false`, jadi tanpa animasi sama sekali.

### 5.5 Kinerja
- Ruang 3D tetap terpasang dalam keadaan dijeda (6d254a0), jadi ruangnya benar-benar ada di balik kartu. Selama animasi browser hanya menggerakkan gambar tangkapan, sehingga adegan 3D tidak menggambar frame.

## 6. Pengaturan (gaya 1)

- Urutan: judul → kartu pembaca → panel **Profil** (tidak berubah) → bagian **"Akun"** di bawah.
- "Akun" berupa daftar baris dengan ikon:
  - **Keluar**: ke `/logout` seperti sekarang.
  - **Hapus akun** (merah): membuka **dialog konfirmasi** (lembar dari bawah di HP) berisi formulir yang ada sekarang: ketik nama pengguna, lalu "Hapus akun saya permanen". Logika penghapusan dan pesan galatnya tidak berubah.
- Popup desktop memakai susunan yang sama.

## 7. Unit kerja

| Unit | Jenis | Isi |
|------|-------|-----|
| `lib/shelf.ts` → `currentRead(books)` | murni | Buku "Sedang dibaca" (§3.2). |
| `shelf/CurrentReadCard.tsx` | baru | Kartu "Sedang dibaca". |
| `shelf/ShelfFilterSheet.tsx` | baru | Lembar Saring: genre, urutan, penyimpanan. |
| `shelf/ShelfHeader.tsx`, `ShelfToolbar.tsx` | diubah | Judul + tombol ikon; kolom cari yang bisa dibuka. |
| `shelf/BookGrid.tsx`, `CollectionBar.tsx` | diubah | Kartu besar, lencana Selesai, jarak baru. |
| `member/MemberShell.tsx` → dock | diubah | Dock mengambang, pil aktif, sembunyi saat mengetik. |
| `lib/page-transition.ts` → `transitionTypes(from, to)` | murni | Jenis transisi (§5.1). |
| `router.tsx` | diubah | `defaultViewTransition` memakai `transitionTypes`. |
| `settings/DeleteAccountDialog.tsx` | baru | Dialog hapus akun. |
| `routes/_member/_lobi/settings.tsx` | diubah | Daftar "Akun". |
| `styles.css` | diubah | Dock, ruang dock, view transitions, Rak, Pengaturan. |

## 8. Pengujian

- **Unit**:
  - `currentRead` (terakhir dibuka, abaikan yang selesai, tidak ada → null);
  - kartu buku (progres, lencana Selesai, pemilih genre kotak);
  - lembar Saring (genre, urutan, penyimpanan);
  - Cari (terbuka bila `q` ada);
  - dock (`aria-current`, `aria-label`, sembunyi saat fokus di kolom teks);
  - `transitionTypes` (ketiga jenis; `false` untuk query saja, pembaca, tanpa shell, desktop, dan "kurangi gerakan");
  - daftar "Akun" dan dialog hapus akun.
- **E2E**:
  - tes Rak dan Pengaturan diperbarui ke letak baru (cari di balik tombol, genre di lembar Saring, Hapus akun di dialog);
  - navigasi lewat dock di project `mobile`;
  - Keluar dari Pengaturan.
- **Cek HP pemilik**: rasa animasi dan dock, ruang 3D terlihat di balik kartu, dock tidak menutupi apa pun, dan dock tersembunyi saat mengetik.

## 9. Di luar cakupan

- Landing page (spec sendiri, sebelum produksi).
- Sidebar dan menu mengambang desktop, pembaca, halaman Kosakata.
