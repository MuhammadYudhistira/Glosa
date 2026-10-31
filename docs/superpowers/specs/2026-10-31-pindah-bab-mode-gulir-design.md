# Pindah bab di mode Gulir — desain

Tanggal: 2026-10-31 · Cabang: `bab-gulir`

## 1. Masalah

Di mode Gulir, foliate memuat satu bagian (file spine) EPUB saja. Di dasar bagian, gulir mentok dan tidak terjadi apa-apa. Pindah bab memang sudah bisa lewat ketuk tepi kanan/kiri, Space atau PageDown, tetapi di HP tidak ada yang tahu, dan swipe dimatikan di mode Gulir. Pengguna bingung cara ke bab berikutnya atau sebelumnya.

## 2. Keputusan pemilik

1. Pindah bab dengan **terus menggulir**, bukan swipe, dengan penanda yang memberi tahu.
2. Berlaku di **HP dan desktop**, perilakunya sama; desktop diberi pengaman gulir inersia.
3. Penanda menyebut **judul dari daftar isi**, dengan teks umum sebagai cadangan.
4. Penanda tetap ada saat bilah reader tampil, **digeser ke atas bilah bawah**.
5. Bukan gulir menyambung tanpa jeda antarbab: foliate tidak mendukungnya.

## 3. Perilaku

### 3.1 Akhir bagian

- Saat gulir sampai di dasar bagian, penanda muncul di bawah area baca: *"Akhir bab · Gulir terus ke **Bab 5: Perjalanan Pulang**"*. Penanda adalah tombol: diketuk atau diklik langsung membuka bagian berikutnya.
- Terus menarik (HP) atau menggulir (desktop) mengisi garis indikator di penanda. Penuh → bagian berikutnya terbuka dari atas. Berhenti sebelum penuh → indikator kosong lagi, tidak terjadi apa-apa.
- **Gerakan yang membawa ke dasar tidak dihitung.** Sentuhan dihitung hanya bila dimulai saat sudah di dasar. Gulir roda dihitung hanya dari rangkaian gulir baru (setelah jeda tanpa gulir) yang dimulai saat sudah di dasar. Sisa gulir inersia tidak pernah memindahkan bab.
- Ambang desktop sedikit lebih tinggi daripada HP.

### 3.2 Awal bagian

- Polanya sama ke atas: *"Tarik ke bawah ke **Bab 3: Kota Lama**"*. Bagian sebelumnya terbuka di akhirnya.
- Berbeda dengan akhir bagian, penanda atas **hanya tampil selama ada tarikan** (indikator > 0). Alasannya: setiap pindah ke bab berikutnya mendarat di atas, dan penanda yang langsung muncul di sana mengganggu.

### 3.3 Teks penanda

- Judul diambil dari daftar isi untuk bagian tujuan: ke depan entri pertama di bagian itu, ke belakang entri terakhir (pengguna mendarat di akhirnya).
- Tujuan tidak ada di daftar isi, atau judulnya sama dengan bab yang sedang dibaca (satu bab terbagi ke beberapa file) → teks umum: *"Akhir bagian · Gulir terus untuk lanjut"* dan *"Tarik ke bawah ke bagian sebelumnya"*.
- Dasar bagian terakhir: *"Akhir buku"*, tanpa tarikan dan tanpa tombol. Atas bagian pertama: tidak ada penanda.
- Bagian `linear="no"` dilewati, sama seperti foliate saat membalik.

### 3.4 Tata letak dan gangguan

- Penanda akhir di bawah tengah; saat bilah reader tampil, di atas bilah bawah. Penanda awal di atas tengah, di bawah bilah atas bila tampil. Saat tombol Kembali tampil, penanda akhir naik satu baris agar tidak menutupinya.
- Disembunyikan dan tidak menghitung tarikan saat ada popup, menu seleksi, panel, catatan, kartu kutipan, atau tawaran posisi dari perangkat lain.
- Mode Halaman tidak berubah. Ketuk tepi, Space, PageDown tetap seperti sekarang.
- `prefers-reduced-motion`: indikator tetap terisi, tanpa animasi pengosongan.
- Buku dengan tulisan vertikal tidak mendapat tarikan (gulirnya mendatar); ketuk tepi tetap bekerja.

## 4. Rancangan kode

### 4.1 `src/components/reader/chapter-edge.ts` (murni)

`createEdgePull({ threshold, gapMs })` → objek dengan:
- `wheel(delta, at: { start: boolean; end: boolean }, time)` dan `touchStart(y, at)`, `touchMove(y, at)`, `touchEnd()`;
- masing-masing mengembalikan `{ side: "start" | "end"; progress: number } | null` atau `"next" | "prev"` saat tarikan penuh;
- `reset()`.

Aturan di dalamnya: rangkaian roda baru dimulai setelah `gapMs` tanpa gulir; rangkaian/sentuhan dihitung hanya bila dimulai di tepi yang dituju; gerak menjauh mengurangi tarikan; arah berlawanan mengganti sisi; setelah pindah, sisa rangkaian diabaikan. Ambang: sentuh 96 px gerak jari, roda 320 px (baris = 16 px). Pengosongan setelah diam ditangani `ReaderView` dengan timer (roda), dan `touchEnd` (sentuh).

### 4.2 `chapterLabel` dan `adjacentSection` (murni, di modul yang sama)

- `adjacentSection(linear: ReadonlyArray<string | undefined>, index, dir)`: indeks berikutnya/sebelumnya yang bukan `linear="no"`, atau `null`.
- `chapterLabel(entries: ReadonlyArray<{ label; index }>, target, dir, current)`: judul untuk penanda, atau `null` (teks umum). `entries` adalah daftar isi yang diratakan berurutan, dengan indeks bagiannya dari `view.resolveNavigation(href)`.

### 4.3 `ReaderView.tsx`

- Callback baru `onChapterEdge(edge: ChapterEdge | null)` dengan `ChapterEdge = { side; progress; label: string | null; bookEnd: boolean }`.
- Khusus mode Gulir: `wheel` dan `touchstart/move/end` pada host dan setiap dokumen bagian diteruskan ke `createEdgePull`. Posisi tepi dibaca dari renderer: `start <= 0` dan `viewSize - end <= 2` (ukuran yang dipakai foliate sendiri).
- Penanda akhir dihitung ulang pada event `scroll` renderer (sekali per frame) dan setelah relocate.
- Tarikan penuh → `interact()` lalu `move("next" | "prev")` yang sudah ada; foliate membuka bagian berikutnya di atas dan sebelumnya di akhir, dan `isTurn` menghitungnya sebagai balik halaman.
- Diabaikan saat popup terbuka atau ada seleksi. Direset saat bagian baru dimuat atau mode berubah.
- `ReaderControls` tidak berubah: tombol penanda memakai `move` yang ada.

### 4.4 `ChapterEdge.tsx`

Penanda: teks, garis indikator (`progress`), tombol (kecuali "Akhir buku"). Dipasang di `read.$bookId.tsx`, dengan `chromeShown`, `backShown` untuk posisinya; tidak dirender saat ada popup/panel.

## 5. Pengujian

- Unit `chapter-edge`: ambang roda dan sentuh, rangkaian yang mencapai tepi tidak dihitung, jeda memulai rangkaian baru, gerak menjauh, bagian pendek (kedua tepi), sisa rangkaian setelah pindah diabaikan; `adjacentSection` dengan `linear="no"`; `chapterLabel` maju, mundur, tidak ada di daftar isi, judul sama.
- Komponen `ChapterEdge`: teks judul dan cadangan, tombol memanggil pindah, "Akhir buku" tanpa tombol, posisi atas hanya saat tarikan.
- E2E (desktop dan HP), mode Gulir di buku contoh: gulir ke dasar → penanda tampil; gulir terus (roda di desktop, sentuh di HP) → bagian berikutnya terbuka; ketuk penanda → pindah.
