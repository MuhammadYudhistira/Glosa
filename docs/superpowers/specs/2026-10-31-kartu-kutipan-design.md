# Glosa: Kartu Kutipan: Desain

Tanggal: 2026-10-31
Spec induk: [`2026-10-22-tahap-2-ketuk-kata-design.md`](2026-10-22-tahap-2-ketuk-kata-design.md) §6.3 (popup arti), §6.6 (menu seleksi dan anotasi)
Ide awal: `inspiration.md` (kartu seperti lirik Apple Music, untuk iklan gratis di media sosial)

## 1. Ringkasan

Pembaca bisa mengubah kutipan dari buku menjadi gambar kartu yang siap dibagikan ke Instagram Story, WhatsApp, X, dan Threads. Kartu tidak hanya memuat kutipan. Satu kata di dalamnya disorot beserta artinya dari kamus Glosa, jadi orang yang melihatnya langsung paham fungsi Glosa: membaca buku Inggris aslinya sambil memahami setiap katanya.

Gambar dibuat sepenuhnya di perangkat pembaca dengan Canvas 2D. Teks kutipan tidak dikirim ke server mana pun, sehingga server, database, dan Kebijakan Privasi tidak berubah.

Fitur ini dibangun dan dideploy ke dev sekarang. Pengumuman ke publik menunggu prod di `glos-a.tech`. Kartu menulis alamat situs yang sedang dibuka, jadi alamat di kartu otomatis benar di dev maupun di prod.

## 2. Keputusan

| # | Keputusan | Alasan |
|---|---|---|
| 1 | **Isi kartu: kutipan + satu kata sorotan beserta artinya.** Kata boleh dikosongkan, dan kartu menjadi kutipan saja. | Pembeda dari kartu kutipan biasa (Kindle, Apple Music), dan langsung memperlihatkan guna Glosa. |
| 2 | **Kata sorotan dipilih dengan mengetuk kata di pratinjau.** Kata default diambil dari kata di kutipan yang sudah ada di Kosakata pengguna, kalau ada. | Orang biasanya membagikan kalimat karena kata yang baru mereka pelajari. Mengetuk langsung di kartu paling mudah dipahami. |
| 3 | **Arti dipilih dari kamus, 1 sampai 3 arti, dikelompokkan per kelas kata.** Arti pertama dari kelas kata pertama terpilih sebagai default. Arti tidak bisa ditulis sendiri. | Urutan kamus tidak selalu cocok dengan kalimat (*a capital mistake* bukan "ibu kota"). Arti yang dibagikan atas nama Glosa harus berasal dari kamus. |
| 4 | **2 layout × 3 tema.** Layout: **Glosa** dan **Kutipan**. Tema: **Sampul**, **Kertas**, **Malam**. Layout dan tema saling bebas. | Pilihan membuat orang lebih suka berbagi. Memisahkan layout dari tema membuat tema baru cukup berupa satu set token. |
| 5 | **2 ukuran: Story 9:16 (1080×1920) dan Persegi 1:1 (1080×1080).** Default Story. | Story untuk Instagram dan WhatsApp, Persegi untuk feed Instagram, X, dan Threads. 4:5 ditolak karena bedanya tipis dengan 1:1, sementara kombinasinya bertambah. |
| 6 | **Tiga pintu:** menu seleksi, popup highlight, dan daftar highlight di panel Anotasi. | Bisa langsung berbagi saat membaca, dan highlight lama juga bisa dibagikan. |
| 7 | **Berbagi dari seleksi tidak membuat highlight.** | Berbagi dan menyimpan adalah dua niat yang berbeda. |
| 8 | **Gambar dibuat dengan Canvas 2D di klien, lewat modul layout murni.** | Hasil sama di semua perangkat (termasuk Safari iOS), tanpa library, berjalan offline, privasi tetap, dan layout bisa dites. Alternatif yang ditolak ada di §10. |
| 9 | **Berbagi lewat jendela berbagi sistem** (`navigator.share` dengan file), ditambah **Simpan gambar** dan **Salin gambar**. Tidak ada tombol langsung per aplikasi. | Dari web, Instagram Story tidak bisa dibuka langsung (butuh SDK native). Tautan langsung X dan Threads hanya membawa teks, tidak membawa gambar. |
| 10 | **Alamat situs tertulis di kartu, dan link ikut dikirim bersama gambar.** Sebelum jendela berbagi terbuka, link juga disalin ke clipboard untuk stiker Link Instagram. Tidak ada QR code. | Gambar tidak bisa diklik, dan "Glosa" sulit dicari di Google (kata umum dalam bahasa Spanyol dan Portugis). QR code membuat kartu terasa seperti iklan. |
| 11 | **Kutipan paling panjang 300 karakter.** Kalau lebih panjang, kutipan dipotong di batas kata dan diakhiri "…". Judul dan pengarang selalu tercantum. | Kutipan pendek dengan sumber yang jelas wajar untuk buku yang masih dilindungi hak cipta (UU Hak Cipta pasal 44), dan tetap terbaca di kartu. |
| 12 | **Pilihan terakhir (layout, tema, ukuran) diingat per perangkat** di `localStorage`, tanpa sinkronisasi. | Kartu berikutnya langsung memakai gaya favorit. Ini hanya kenyamanan, jadi tidak perlu disimpan di server. |

## 3. Kartu

### 3.1 Bagian kartu

Dari atas ke bawah:

1. **Buku:** sampul kecil (kalau ada), judul tebal, dan pengarang.
2. **Isi**, menurut layout (§3.2).
3. **Kaki:** logo **Glosa** di kiri dan alamat situs di kanan (`location.host`, misalnya `glos-a.tech`). Di layout Kutipan ukuran Story, tagline *"Baca buku aslinya, pahami setiap katanya."* ditulis di atas alamat situs, kalau muat. Di layout Glosa dan di ukuran Persegi hanya alamat situs yang ditulis.

### 3.2 Layout

**Kutipan:**

- Kutipan ditulis besar dalam Libre Caslon, dengan baris yang diseimbangkan. Kata sorotan tebal dan berwarna aksen tema.
- Di bawahnya ada garis aksen pendek, lalu kata sorotan dalam bentuk kamusnya (Libre Caslon tebal; *hundred* untuk *hundreds*, seperti popup arti), kelas katanya dengan label yang sama seperti popup dan Kosakata (*kata sifat*, *kata benda*, …, Atkinson miring), dan arti yang dipilih (Caveat, warna aksen).
- Tanpa kata sorotan: hanya kutipan.

**Glosa:**

- Kutipan ditulis dalam Libre Caslon dengan jarak antarbaris yang lebar.
- Kata sorotan diberi stabilo, yaitu persegi panjang sedikit miring di belakang kata, dengan warna aksen agak transparan.
- Arti yang dipilih ditulis dengan Caveat di atas kata itu, sedikit miring, diikuti kelas katanya dalam kurung dengan huruf lebih kecil, misalnya *(kata sifat)*. Kalau tulisan tangan itu akan melewati tepi kartu, posisinya digeser masuk.
- Tanpa kata sorotan: kutipan saja dengan jarak antarbaris biasa.

Pada kedua layout, kutipan diberi tanda kutip pembuka dan penutup.

### 3.3 Ukuran huruf

Ukuran huruf kutipan dimulai dari nilai terbesar layout dan ukuran kartu, lalu diturunkan bertahap sampai kutipan muat di ruangnya. Ada batas bawah. Kutipan 300 karakter harus muat di batas bawah itu pada keenam kombinasi dan kedua ukuran, dan unit test memastikannya (§9). Layout Glosa butuh ruang di atas setiap baris untuk tulisan tangan, jadi ukurannya turun lebih cepat.

Kata yang lebih lebar dari baris (jarang terjadi) diperkecil sendiri, tidak dipotong.

### 3.4 Tema

Setiap tema berisi: latar, warna teks, warna aksen, warna teks redup, dan tekstur.

| Tema | Latar | Teks | Aksen |
|---|---|---|---|
| **Sampul** | Gradasi diagonal dari 2–3 warna sampul buku. Tanpa sampul: gradasi teal Glosa. | Putih | Kuning hangat |
| **Kertas** | Krem dengan butiran halus | Coklat tinta | Oranye bata |
| **Malam** | Biru malam dengan bintang (seperti lobi Starfield) | Putih kebiruan | Biru lembut |

Warna Sampul diambil oleh `coverPalette`. Kontras teks putih di atas gradasi dijaga dengan menggelapkan warna yang terlalu terang. Bintang di tema Malam ditempatkan dengan pola tetap (seed dari id buku), jadi kartu yang sama selalu tampil sama.

Contoh visual yang disetujui: `.superpowers/brainstorm/262-1793412250/content/tipografi-kutipan-v2.html` (layout Glosa, bagian pembanding) dan `tipografi-kutipan-v3.html` (layout Kutipan). File ini hanya ada di laptop pemilik.

## 4. Layar "Bagikan kutipan"

- **HP:** layar penuh, memakai pola sheet `ReaderPopup`.
- **Desktop:** dialog dua kolom, dengan pratinjau di kiri dan kontrol di kanan.

Isi layar:

1. **Pratinjau**, berupa canvas kartu yang sebenarnya, digambar sesuai kerapatan piksel layar. Mengetuk sebuah kata menjadikannya kata sorotan. Di bawahnya ada petunjuk *"Ketuk kata di kutipan untuk menyorotnya"*.
2. **Layout:** Glosa | Kutipan.
3. **Ukuran:** Story | Persegi.
4. **Tema:** tiga bulatan warna.
5. **Kata:** *Kata: **capital*** dan tombol *Tanpa kata*. Di bawahnya **Arti di kartu (pilih 1–3)**, berupa chip yang dikelompokkan per kelas kata. Selama arti dimuat, chip diganti tanda muat.
6. **Tombol:**
   - **Bagikan** sebagai tombol utama. Hanya muncul kalau `navigator.canShare({ files })` bernilai benar.
   - **Simpan gambar**.
   - **Salin gambar**, hanya kalau `ClipboardItem` dan `navigator.clipboard.write` tersedia.

Kalau kutipan dipotong (§2 keputusan 11), muncul pesan kecil *"Kutipan dipendekkan menjadi 300 karakter."*

## 5. Pintu masuk

| Pintu | Perubahan |
|---|---|
| Menu seleksi | *Highlight · Catatan · Salin · **Bagikan*** |
| Popup highlight | Tombol **Bagikan** di samping aksi yang sudah ada |
| Panel Anotasi | Tombol **Bagikan** di setiap highlight. Bookmark tidak punya tombol ini karena tidak punya teks. |

Seleksi yang hanya berisi spasi atau tanda baca tidak menampilkan *Bagikan*.

## 6. Arsitektur

Semua bagian berjalan di klien. Tidak ada perubahan server, database, migrasi, atau Kebijakan Privasi.

### 6.1 Modul murni (`src/lib/quote-card/`)

| Modul | Tanggung jawab |
|---|---|
| `quote-text.ts` | `prepareQuote(text)`: merapikan spasi, membuang tanda kutip di kedua ujung, memotong ke 300 karakter di batas kata dengan "…", dan menandai apakah teksnya dipotong. `quoteWords(quote)`: token-token kutipan beserta posisinya dan bentuk carinya (`normalizeWord`). Hanya token yang lolos `isLookupWord` yang bisa disorot. `defaultWord(words, savedForms)`: kata pertama yang ada di Kosakata (memakai pencocokan bentuk dari `saved-marks`), atau tidak ada. |
| `layout.ts` | `layoutCard(input, measure)` → `CardLayout`. `input` berisi kutipan, token, kata sorotan, arti terpilih dan kelas katanya, layout, ukuran, judul, pengarang, ada tidaknya sampul, dan alamat situs. `measure(text, font)` mengembalikan lebar teks, sehingga modul ini bisa dites tanpa canvas. Hasilnya berupa daftar gambar yang sudah berposisi (teks, persegi stabilo, garis aksen, kotak sampul), ditambah kotak setiap token untuk deteksi ketukan. Semua koordinat dalam piksel kartu ukuran penuh. |
| `themes.ts` | `QUOTE_THEMES` (Sampul, Kertas, Malam) sebagai token, dan `coverPalette(pixels)`, yang mengubah piksel sampul berukuran kecil menjadi 2–3 warna gradasi dengan kontras yang cukup. |
| `prefs.ts` | Membaca dan menulis pilihan terakhir di `localStorage`, dengan `try/catch` (sama seperti `reader-settings-cache`). Nilai yang tidak dikenal kembali ke default. |

### 6.2 Modul browser

| Modul | Tanggung jawab |
|---|---|
| `draw.ts` | `drawCard(ctx, layout, theme, cover)` menggambar `CardLayout` ke canvas. Isinya tipis, karena semua keputusan posisi sudah diambil `layout.ts`. |
| `share.ts` | `cardBlob(canvas)` mengubah canvas menjadi PNG. `shareCard(blob, { title, url })`: menyalin link ke clipboard (kegagalan diabaikan), lalu memanggil `navigator.share({ files, text })`. Pembatalan (`AbortError`) tidak dianggap error. `saveCard(blob, name)` mengunduh lewat `<a download>`. `copyCard(blob)` memakai `ClipboardItem`. Fungsi `canShareFiles()` dan `canCopyImage()` memberi tahu tombol mana yang ditampilkan. |
| `fonts.ts` | `cardFontsReady()` menunggu `document.fonts.load` untuk Libre Caslon (400, 400 miring, 700), Atkinson (400, 700), dan Caveat, paling lama ±3 detik. |
| (sampul) | Sampul diambil dari file EPUB yang sedang dibuka, lewat `getCover()` milik foliate, yang ditambahkan ke `ReaderControls` sebagai `cover()`. Hasilnya blob lalu `createImageBitmap`, jadi canvas tidak "tercemar" CORS dan cara ini berjalan offline. Cache sampul Rak tidak bisa dipakai karena berisi respons *opaque* dari `<img>`. Kalau gagal, hasilnya `null`. |

### 6.3 Komponen

- `src/components/reader/QuoteCardDialog.tsx`: layar §4. Komponen ini menyimpan pilihan, memuat arti dengan `lookUp` yang sudah ada (cache dan offline-nya ikut), menggambar pratinjau, dan **menyiapkan PNG ukuran penuh lebih dulu** setiap kali pilihan berubah (dengan jeda singkat). Dengan begitu, ketukan *Bagikan* langsung memanggil `navigator.share` tanpa menunggu, karena Safari iOS hanya membuka jendela berbagi dari ketukan pengguna.
- `SelectionMenu`, `AnnotationPopup`, dan `AnnotationList` mendapat callback `onShare`.
- Rute baca (`src/routes/_member/read.$bookId.tsx`) menyimpan satu state, yaitu teks kutipan yang sedang dibagikan, lalu membuka dialog dengan buku (id, judul, pengarang) dan `controls.cover`.

### 6.4 Alur data

```
seleksi / highlight
  → prepareQuote → quoteWords → defaultWord (Kosakata)
  → lookUp(kata) → chip arti
  → pilihan pengguna → layoutCard → drawCard (pratinjau)
                                  → drawCard 1080×1920 / 1080×1080 → PNG (disiapkan lebih dulu)
  → Bagikan (jendela berbagi + link di clipboard) | Simpan | Salin
```

### 6.5 Teks yang ikut dibagikan

`text` di `navigator.share`: *"Dari {judul}, dibaca di Glosa → {origin}"*. Di WhatsApp, X, dan Threads, teks ini menjadi keterangan dan link-nya bisa diklik. Instagram Story membuang teks ini, jadi link sudah disalin ke clipboard lebih dulu, dan muncul pesan *"Link Glosa sudah disalin, tempel di stiker Link Instagram."*

Nama file unduhan: `glosa-{judul-pendek}.png`.

## 7. Penanganan error

| Situasi | Perilaku |
|---|---|
| Buku tanpa sampul, atau sampul gagal dibaca | Kartu tanpa kotak sampul. Tema Sampul memakai gradasi teal Glosa. |
| Font belum siap setelah ±3 detik | Kartu tetap digambar. |
| Arti gagal dimuat (offline, server error) | Pesan *"Arti belum bisa dimuat."* Kartu menjadi kutipan saja, dan kata lain masih bisa dicoba. |
| Kata belum punya arti di kamus | Kata itu tidak bisa disorot. Ketukannya memunculkan *"Belum ada arti untuk kata ini."* |
| `navigator.canShare({ files })` tidak benar | Tombol Bagikan disembunyikan. |
| `ClipboardItem` tidak ada | Tombol Salin gambar disembunyikan. |
| Pengguna menutup jendela berbagi (`AbortError`) | Tidak ada pesan. |
| Berbagi gagal karena alasan lain | *"Gagal membagikan. Coba Simpan gambar."* |
| Menyalin link gagal | Diabaikan, berbagi tetap berjalan. |
| Salin gambar gagal | *"Gagal menyalin gambar. Coba Simpan gambar."* |
| `localStorage` tidak tersedia | Pilihan memakai default dan tidak diingat. |
| PNG belum siap saat tombol diketuk | Tombol dinonaktifkan dengan tanda muat sampai PNG siap. |

## 8. Aksesibilitas

- Canvas pratinjau punya label yang dibaca pembaca layar: kutipan, kata sorotan, dan artinya.
- Selain diketuk di canvas, kata sorotan juga bisa dipilih dari daftar tombol kata (satu tombol per kata yang bisa disorot) yang bisa dijangkau dengan keyboard. Daftar ini ditampilkan untuk pembaca layar dan saat fokus keyboard masuk ke pratinjau.
- Tombol tema punya nama (*Tema Sampul*, …) dan status terpilih.

## 9. Pengujian

**Unit (Vitest):**

- `quote-text`:
  - potongan 300 karakter jatuh di batas kata, dengan "…";
  - tanda kutip di ujung dibuang;
  - token dan bentuk carinya benar;
  - kata default diambil dari Kosakata, termasuk bentuk berubah (*hundreds* → *hundred*);
  - tanpa kata Kosakata, hasilnya tidak ada kata default.
- `layout`, dengan `measure` palsu yang lebarnya sebanding jumlah huruf:
  - kutipan pendek memakai ukuran terbesar;
  - kutipan 300 karakter muat pada 2 layout × 2 ukuran;
  - baris seimbang;
  - stabilo menutupi kata sorotan;
  - tulisan tangan Glosa tidak keluar tepi saat kata ada di ujung baris;
  - kotak ketukan cocok dengan token;
  - kartu tanpa kata dan tanpa sampul;
  - Persegi tanpa tagline.
- `themes`:
  - `coverPalette` mengembalikan 2–3 warna;
  - sampul putih polos tetap menghasilkan kontras yang cukup untuk teks putih;
  - tanpa piksel, hasilnya gradasi bawaan.
- `share`, dengan `navigator` tiruan:
  - `canShareFiles` dan `canCopyImage` sesuai dukungan browser;
  - `AbortError` diam;
  - link disalin sebelum `share`;
  - kegagalan menyalin link tidak menghentikan `share`.
- `prefs`: nilai rusak atau tidak dikenal kembali ke default, dan `localStorage` yang melempar error tidak menggagalkan apa pun.

**Komponen (Testing Library):**

- `QuoteCardDialog`:
  - kata default terpilih;
  - mengetuk tombol kata mengganti sorotan;
  - chip arti dibatasi 3;
  - *Tanpa kata* bekerja;
  - tombol Bagikan dan Salin mengikuti dukungan browser;
  - pesan kutipan dipotong;
  - pesan arti gagal dimuat.
- `SelectionMenu`, `AnnotationPopup`, `AnnotationList`: tombol Bagikan memanggil `onShare`, dan tidak ada tombol untuk bookmark.

**E2E (Playwright, port 3100, `--workers=2`):**

- Buka buku, pilih teks, ketuk **Bagikan**, ketuk satu kata, pilih arti, lalu **Simpan gambar**. Cek bahwa PNG terunduh dan berukuran 1080×1920.
- Setelah ganti ke Persegi, PNG berukuran 1080×1080.
- Dari panel Anotasi, highlight yang ada bisa dibagikan.

**Cek manual pemilik di dev (setelah push):**

- iPhone Safari: Bagikan → Instagram Story; tempel link di stiker Link.
- Android Chrome: Bagikan → WhatsApp (keterangan berisi link) dan Instagram Story.
- Desktop: Salin gambar lalu tempel di X atau Threads web; Simpan gambar.
- Keenam kombinasi layout dan tema, di Story dan Persegi, masing-masing dengan kutipan pendek, kutipan 300 karakter, dan tanpa kata.
- Tema Sampul dengan beberapa buku, termasuk sampul yang sangat terang dan buku tanpa sampul.

## 10. Alternatif yang ditolak

- **Komponen HTML/CSS yang dijadikan gambar** (`html-to-image` dan sejenisnya). Safari iOS sering kehilangan font atau menghasilkan render pertama yang kosong. Padahal iPhone adalah jalur utama ke Instagram Story.
- **Gambar dibuat di server** (Satori, `@vercel/og`). Teks kutipan harus dikirim ke server (Kebijakan Privasi berubah), tidak bisa offline, dan menambah beban VPS.
- **Tombol langsung ke X dan Threads.** Tautan intent hanya membawa teks dan link, tidak membawa gambar.
- **Terjemahan seluruh kalimat.** Butuh AI atau penerjemah berbayar, sementara kamus Glosa hanya punya arti per kata.
- **Arti ditulis sendiri oleh pengguna.** Arti yang keliru atau iseng bisa tersebar dengan merek Glosa.
- **QR code di kartu.** Kartu terasa seperti iklan, dan orang jarang memindai QR dari story di HP yang sama.

## 11. Tidak termasuk

- Tema tambahan (kandidat: *Kartu katalog* dengan Courier Prime, *Tulisan tangan* dengan Caveat). Strukturnya sudah siap untuk menampung tema baru.
- Ukuran 4:5.
- Kartu dari Kosakata (kata tanpa kutipan).
- Pengukuran berapa kartu yang dibagikan, atau berapa pengunjung yang datang dari kartu.
- Domain prod `glos-a.tech` dan pengalihan dari `glosa.tech`. Keduanya diurus saat prod disiapkan.
