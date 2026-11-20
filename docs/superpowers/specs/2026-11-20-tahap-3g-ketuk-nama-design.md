# Tahap 3G: ketuk dulu, baru nama — desain

Tanggal: 2026-11-20 · Cabang: `tahap-3g-ketuk-nama` (dari `main` 12a73a2)
Spec induk: [`2026-11-07-tahap-3f-ruang-baca-pribadi-design.md`](2026-11-07-tahap-3f-ruang-baca-pribadi-design.md) (ruang baca, R3 kegiatan Anda §4A.1)

## 1. Tujuan

Setelah 3F tampil di HP (2026-11-20), ruang baca terlihat berantakan. Ada 18 tempat yang semuanya diberi label pil, lingkaran tanda untuk label yang tidak muat, dan tanda di tepi layar untuk tempat di luar layar. Akibatnya banyak lingkaran yang tidak jelas maksudnya. Selain itu, di HP tegak ruangan tampil kecil di tengah dengan banyak ruang hitam, dan sapaan menutupi tombol "Pusatkan".

3G mengganti cara ruangan memberi tahu nama tempat. **Tidak ada label tetap.** Tiap tempat diberi cincin cahaya tipis di lantai di depan bendanya. Ketuk pertama menampilkan nama dan keadaannya, dan ketuk kedua membuka tempat itu.

Keputusan ini **menggantikan** aturan 2026-11-14 "label tidak pernah disembunyikan; label yang tidak muat menjadi tanda yang bisa diketuk" (R3 Task 4X).

Di luar cakupan: data, alamat, tabel, alur kegiatan Anda R3 (jalan → kegiatan → halaman), dan perbaikan cache gambar lobi (dikerjakan terpisah di cabang `fix-aset-lobi-cache`).

## 2. Keputusan pemilik (2026-11-20)

| # | Keputusan |
|---|---|
| 1 | Nama tempat: **ketuk dulu, baru nama**. Tidak ada label tetap di ruangan. |
| 2 | Ketuk pertama di HP: cincin tempat itu terang dan **kartu nama** muncul (nama, satu baris keadaan, tombol **Buka**). Anda belum bergerak. Ketuk benda yang sama lagi atau Buka: alur R3. |
| 3 | Petunjuk: **cincin cahaya tipis yang diam di lantai** di depan setiap benda yang bisa dipakai (rak: satu di depan tiap bagian genre; benda dinding seperti papan gabus, pintu dan perapian: di lantai di depannya, tempat Anda berdiri). Tempat yang dipilih atau di bawah kursor: cincinnya lebih terang. Ditambah satu kalimat "Ketuk benda untuk melihat namanya" yang hanya muncul sekali di tiap perangkat. *(Diganti 2026-11-20, lihat di bawah; semula garis tepi pada benda.)* |
| 4 | **Tidak ada angka di ruangan.** Angka hanya muncul di kartu. Keadaan sudah terlihat dari bendanya (api, lampu meja, tutup kotak paket, isi rak; spec 3F §3.6). |
| 5 | Desktop: **kursor di atas benda = sorotan + nama kecil di dekat kursor; klik = buka langsung** (alur R3), tanpa kartu. |
| 6 | Kamera HP tegak: **ruangan lebih besar dan bisa digeser.** Ruangan mengisi area antara atas layar dan kartu "Lanjutkan membaca", sisi kiri/kanan boleh terpotong. |
| 7 | Pendekatan **A**: area ketuk adalah kotak tak terlihat di adegan 3D, dan petunjuk serta sorotan digambar di 3D (cincin di lantai). Tombol HTML tak terlihat tetap ada untuk keyboard dan pembaca layar. |

**2026-11-20 (cincin lantai):** pemilik memutuskan petunjuk bukan tepi kotak ketuk, melainkan cincin cahaya tipis, diam dan lembut di lantai di depan tiap tempat; cincin tempat yang dipilih/disorot lebih terang (sorotan kuat). Tanpa animasi. Render sesuai kebutuhan (R1) tetap: diam = 0 frame, ganti sorotan = satu frame. Murah di HP: satu geometri cincin bersama, satu `InstancedMesh` untuk semua cincin redup dan satu `Mesh` untuk cincin terang, tanpa pass pascapemrosesan. Di mode gambar diam, titik tetap. Sepuluh keputusan lain di rencana (penyimpangan dari spec ini) disetujui pemilik pada hari yang sama dan dilipat ke bagian 3 dan 4.

## 3. Perilaku

### 3.1 HP (layar sentuh)

- **Ketuk benda** → `selected = id`: cincin tempat itu menjadi terang dan kartu nama muncul (§3.5).
- **Ketuk benda yang sama lagi** atau **tekan Buka** → alur R3 `activate(id)`: Anda berjalan, berkegiatan, lalu halaman terbuka. Aturan R3 tetap berlaku: ketuk saat Anda masih berjalan atau berkegiatan berarti lewati, dan ketukan terakhir yang menentukan halaman.
- **Ketuk benda lain** → sorotan dan kartu pindah ke benda itu.
- **Ketuk ruang kosong** atau **mulai menggeser/zoom kamera** → kartu tertutup, `selected = null`.
- **Ketuk vs geser:** untuk sentuh dan pena, dianggap ketuk bila jari bergerak kurang dari 10 px dan dilepas sebelum 300 ms; selain itu dianggap geser kamera. Untuk mouse hanya aturan jarak (10 px) yang berlaku, tanpa batas 300 ms, sehingga klik lambat di desktop tetap membuka.

### 3.2 Desktop (mouse)

- **Kursor di atas benda** → sorotan kuat + nama kecil di dekat kursor (`HoverName`). Kursor menjadi `pointer`.
- **Kursor keluar** → sorotan kuat dan nama hilang.
- **Klik benda** → `activate(id)`. Tidak ada kartu.
- **Desktop** berarti perangkat dengan `(hover: hover) and (pointer: fine)`. Perangkat lain memakai perilaku HP.

### 3.3 Keyboard dan pembaca layar

- Setiap tempat tetap berupa `<button>` dengan nama aksesibel, dalam urutan Tab yang sekarang (spec 1D §6). Tombol tidak terlihat, kecuali cincin fokus pada posisi benda, yaitu pusat kotak ketuk terbesar tempat itu (bukan lagi posisi label lama). **Nama aksesibel hanya nama tempat** ("Fiksi & Sastra", tanpa "· 0 buku"); angka dan keadaan dibacakan lewat kartu.
- **Fokus** → cincin tempat itu terang dan kartu muncul (juga di desktop, karena keyboard tidak punya kursor). Kartu memakai satu keadaan terpilih (`chosen`) bersama ketukan di HP; mouse di desktop tidak membuat kartu. Fokus yang bukan hasil tekanan pointer (keyboard, skrip, pembaca layar) juga menggeser kamera bila tempatnya di luar layar. Ini pengganti `:focus-visible`, yang tidak menyala untuk fokus lewat skrip atau pembaca layar.
- **Enter/Spasi** → halaman langsung terbuka dengan Anda dalam pose kegiatan, tanpa jalan (spec 3F §4A.1, keputusan 2026-11-20, commit 12a73a2).
- Isi kartu dibacakan lewat `aria-describedby` tombol yang sedang fokus.

### 3.4 Petunjuk

- **Cincin cahaya redup** di lantai di depan setiap tempat yang bisa dipakai: tipis, lembut di kedua tepinya, berwarna aksen, **tidak beranimasi**, dan selalu ada saat adegan 3D tampil. Di mode gambar diam tidak ada cincin (lihat §3.8).
- **Titik cincin** adalah titik berdiri Anda untuk tempat itu (`stand`, sudah terbukti lantai kosong dan memang tujuan jalan): rak di depan tiap bagian genre, papan gabus, pintu dan perapian di lantai di depannya. Pengecualian: tiga tempat di sudut meja tulis (Kosakata, Meja tulis, Sorotan) yang titik berdirinya bertumpuk dengan bagian rak pertama diberi titik sendiri di lantai di depan meja. Setiap tempat punya tepat satu titik, di lantai yang bisa dilalui dan tidak di dalam perabot atau kotak tempat lain, dan titik-titik saling berjarak cukup sehingga cincin tidak saling menimpa.
- **Sorotan kuat** (tempat terpilih atau di bawah kursor): cincinnya lebih terang dan sedikit lebih lebar. Hanya satu tempat dalam satu waktu.
- **Kalimat petunjuk** "Ketuk benda untuk melihat namanya" (di desktop: "Arahkan kursor ke benda untuk melihat namanya") muncul sekali saat ruangan pertama kali tampil di perangkat itu. Petunjuk hilang saat ada ketukan/arahan pertama atau setelah 6 detik. Tandanya disimpan di `localStorage` (`glosa:place-hint-seen`, dibungkus try/catch). Bila penyimpanan gagal, petunjuk boleh muncul lagi.

### 3.5 Kartu nama (`PlaceCard`)

Kartu muncul di atas kartu "Lanjutkan membaca" (atau di dasar area adegan bila kartu itu tidak ada) dan tidak menutupi benda yang disorot. Isinya:
- **Nama tempat**, sama dengan nama yang sekarang di `lobby-data.ts`.
- **Satu baris keadaan.** Teksnya dari `place-status.ts` dan memakai data yang sudah dimuat lobi, tanpa permintaan baru. Bila datanya belum ada, dipakai keterangan pendek.

| Tempat (id) | Nama | Baris keadaan | Bila data belum ada / kosong |
|---|---|---|---|
| `meja-baca` | Kursi baca | `<judul buku terakhir> · <n>%` | "Belum ada buku yang dibaca" |
| 8 genre | nama genre | "`<n>` buku" | "Belum ada buku" |
| `troli` | Kotak buku baru | "`<n>` buku belum diberi genre" | "Tidak ada buku baru" |
| `lemari` | Sudah dibaca | "`<n>` buku selesai" | "Belum ada buku yang selesai" |
| `meja-admin` | Meja tulis | "Tambahkan buku ke rak" | (sama) |
| `katalog` | Kosakata | "`<n>` kata tersimpan" (jumlah kata di cache kosakata) | "Kata yang kamu simpan dari bacaan" |
| `tanaman` | Kebiasaan baca | "`<n>` hari baca minggu ini": hari yang targetnya terpenuhi sejak Senin, dihitung dari data kebiasaan yang sudah dimuat lobi (3B). Selama data kebiasaan belum termuat atau gagal, atau hitungannya 0, dipakai keterangan di kolom kanan. | "Target dan kebiasaan membacamu" |
| `toko` | Toko dekorasi | "`<n>` koin" | "Hias ruang bacamu" |
| `perapian` | Kilas balik | "`<n>` dari 7 hari terakhir kamu membaca" (hari bertarget terpenuhi, sama dengan sinyal api 3F §3.6) | "Rangkuman bacaanmu" (juga selama data kebiasaan belum termuat atau hitungannya 0) |
| `papan` | Sorotan | "`<n>` sorotan". Lobi hanya memuat 20 sorotan terbaru, jadi bila tepat 20: "20+ sorotan". | Belum termuat, offline atau gagal: "Sorotan dan catatanmu" (bukan "Belum ada sorotan", yang akan keliru). "Belum ada sorotan" hanya untuk hasil kosong yang sudah dimuat. |
| `pintu` | Pengaturan | "Akun, tampilan, dan keluar" | (sama) |

Plan harus memeriksa sumber data tiap baris. Baris yang datanya tidak tersedia di lobi memakai keterangan pendek pada kolom terakhir.

- **Tombol Buka** → `activate(id)`. Kartu tertutup saat alur dimulai.
- Kata-kata di kartu ikut diperiksa oleh pemindai kata (`src/lib/wording.test.ts`).

### 3.6 Yang dihapus

- Label pil, lingkaran tanda (termasuk yang di tepi layar), histeresis label, dan pengukuran pil: `label-layout.ts` beserta CSS-nya.
- Angka dan gaya "kosong" (garis putus) pada label genre.
- Gelembung bicara tetap ada (petunjuk membaca, Kilas balik R3) dan ditambatkan ke benda tanpa label.

### 3.7 Kamera HP tegak

- **Pandangan awal:** ruangan mengisi tinggi area adegan (antara atas layar dan kartu "Lanjutkan membaca"), berpusat pada Anda dan kursi baca. Supaya area itu benar-benar yang dihitung kamera, adegan di HP menyusut di atas kartu "Lanjutkan membaca": tinggi kartu diukur dan dipublikasikan sebagai variabel CSS `--lobby-sheet-h` (adegan paling banyak 9rem lebih rendah).
- **Batas zoom-out:** lebar ruangan di layar tidak pernah lebih kecil dari lebar layar.
- **Geser:** sisi ruangan yang terpotong bisa dicapai. Batas geser yang ada (`clampView`) tetap berlaku.
- **"Pusatkan"** hanya muncul setelah kamera digeser atau di-zoom dari pandangan awal, dan tidak pernah tertutup sapaan. Penyembunyian ini hanya di HP tegak (tinggi lebih besar dari lebar); desktop dan HP mendatar tetap menampilkannya seperti sekarang.
- **Sapaan** ("Selamat datang kembali, …") tidak menutupi tombol mana pun dan menghilang sendiri setelah beberapa detik.
- **Desktop dan HP mendatar:** pandangan sekarang tidak berubah.

### 3.8 Mode gambar diam

Bila tidak ada WebGL atau adegan 3D gagal, gambar diam tampil:
- Cincin di lantai tidak bisa digambar, jadi tiap tempat diberi **titik kecil tanpa tulisan** pada proyeksi pusat kotak ketuknya ke gambar (`STILL_VIEW`).
- Ketuk titik atau area kotaknya → kartu yang sama (§3.5). Buka → halaman.
- Bila WebGL gagal di tengah jalan, `selected` dilepas lalu pindah ke mode ini.

Kualitas "diam" dengan WebGL (reduced motion, FPS rendah) **bukan** mode gambar diam. Adegan tetap 3D tanpa animasi, sehingga cincin cahaya dan sorotannya tetap ada.

## 4. Arsitektur

| Unit | Jenis | Tugas |
|---|---|---|
| `scene/pick-volumes.ts` | baru, murni | Satu kotak (AABB) per tempat, dari `layout.ts`. Rak: satu kotak per bagian genre (`WALL_SECTIONS`). |
| `scene/picker.ts` | baru, murni | `pickAt(point, camera, volumes) → HotspotId \| null`. Raycast ke kotak, yang terdekat ke kamera menang. |
| `scene/ring-spots.ts` | baru, murni | Satu titik cincin per tempat di lantai (`stand`, kecuali tiga tempat di meja tulis) dan ukuran cincin. |
| `scene/highlight.ts` | baru | Cincin cahaya di lantai: satu `InstancedMesh` untuk cincin redup semua tempat, satu `Mesh` untuk cincin terang tempat terpilih, satu geometri bersama dengan alfa lembut per titik sudut. Tanpa pass pascapemrosesan dan tanpa animasi. |
| `stage.ts` | diubah | `pick(x, y)` dan `setHighlight(id \| null)`. Ganti sorotan = satu `requestRender()`. Ruangan diam tetap 0 frame (render sesuai kebutuhan, R1). |
| `place-status.ts` | baru, murni | Teks baris keadaan per tempat dari data lobi (§3.5). |
| `PlaceCard.tsx` | baru | Kartu nama + Buka (§3.5). |
| `HoverName.tsx` | baru | Nama di dekat kursor, khusus desktop (§3.2). Dirender oleh `LobbyScene`, bukan `LobbyStage`, supaya posisi kursor yang berubah terus tidak merender ulang `LobbyStage`; `LobbyStage` hanya diberi tahu id yang berubah. |
| `HotspotLayer.tsx` | disederhanakan | Hanya tombol tak terlihat (keyboard/AT) dan titik di mode gambar diam. |
| `label-layout.ts` | dihapus | Diganti seluruhnya. |
| `LobbyStage.tsx` | diubah | Memegang `selected` (kartu, dari ketukan di HP dan fokus), `hovered`, dan tujuan alur R3; menghubungkan ketukan, kursor, fokus, kartu dan `activate`. |
| modul kamera | diubah | Pandangan awal dan batas zoom HP tegak (§3.7). |

**Alur data**

- **HP:** `pointerup` (ketuk) → `stage.pick` → `LobbyStage.select(id)` → `stage.setHighlight(id)` (cincin terang) + `PlaceCard`. Ketuk sama/Buka → `activate(id)`.
- **Desktop:** `pointermove` (dibatasi satu kali per frame) → `stage.pick` → `setHighlight` + `HoverName`. `click` → `activate`.
- **Keyboard:** `focus` → `select(id)`. Enter → `activate(id, { keyboard: true })`.

**Kasus khusus**

- Popup atau papan gabus terbuka (`covered`) → `selected = null`, sorotan hilang, kartu tertutup.
- Alur R3 berjalan → kartu tertutup. Sorotan tetap pada tujuan sampai halaman terbuka.
- Data lobi berubah saat kartu terbuka → baris keadaan ikut diperbarui.
- Ukuran layar berubah → kartu tetap, sorotan tetap.

## 5. Pengujian

- **Unit:**
  - `picker` (benda depan menang, ruang kosong `null`, semua id bisa dipilih dari pandangan awal HP dan desktop);
  - `pick-volumes` (setiap tempat punya kotak, kotak rak mengikuti bagian genre, kotak tidak saling memuat);
  - `ring-spots` (tepat satu titik per tempat, di lantai yang bisa dilalui dengan lebar cincin terang, tidak di dalam kotak tempat lain, saling berjarak, dekat bendanya);
  - `highlight` (satu geometri bersama, dua objek di adegan, satu instance per tempat di titiknya, cincin terang di titik id terpilih, `set` melapor berubah hanya bila id berubah, dispose bersih);
  - `place-status` (setiap baris, termasuk data kosong/belum ada);
  - ketuk vs geser (10 px / 300 ms);
  - `LobbyStage` (ketuk 1 → kartu, ketuk 2/Buka → `activate`, benda lain, ruang kosong, `covered`, fokus, Enter);
  - petunjuk sekali (termasuk penyimpanan gagal);
  - kamera HP (pandangan awal mengisi tinggi, batas zoom-out).
- **E2E** (mode diam, seperti sekarang):
  - fokus tombol tempat → kartu dengan nama + keadaan;
  - Buka → halaman;
  - Enter → halaman;
  - mode gambar diam: ketuk titik → kartu.
- **E2E `lobby-3d` (WebGL):** ketuk pada proyeksi benda → kartu; ketuk ruang kosong → kartu tertutup.
- **Pemindai kata:** teks kartu dan petunjuk.
- **Cek manual pemilik di HP:**
  - cincin di lantai terlihat tapi tidak ramai, dan tiap cincin terbaca sebagai milik bendanya;
  - ketukan pada benda yang bertumpuk (meja tulis dan kursi, kotak paket dan rak);
  - kamera tegak dan geser;
  - kartu tidak menutupi benda.

## 6. Urutan kerja (satu plan, sekitar 6 task)

1. `pick-volumes` + `picker` (murni).
2. Sorotan 3D: titik dan cincin cahaya di lantai (redup + terang), `stage.pick`/`setHighlight`.
3. `place-status` + `PlaceCard` + alur ketuk di `LobbyStage`; hapus label pil/tanda (`label-layout.ts`).
4. Desktop `HoverName`, keyboard (fokus → kartu), mode gambar diam (titik).
5. Kamera HP tegak, sapaan dan "Pusatkan", petunjuk sekali.
6. E2E, pemindai kata, pembersihan CSS, verifikasi akhir.
