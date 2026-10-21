# Glosa Tahap 1F — Lobi sebagai Pusat: Desain

Tanggal: 2026-10-21
Spec induk: [`2026-10-17-tahap-1d-lobi-3d-design.md`](2026-10-17-tahap-1d-lobi-3d-design.md) §5 (interaksi)
Asal: masukan pemilik proyek setelah mencoba situs dev (cek Android dan 1D lolos pada 2026-10-21)

## 1. Ringkasan

Di desktop, Rak Saya (`/shelf`) dan Pengaturan (`/settings`) sekarang halaman sendiri. Halaman itu terlihat terlalu kosong, dan lobi 3D terasa tidak berguna karena setiap navigasi meninggalkannya.

Di 1F, lobi menjadi pusat di desktop. Rak Saya dan Pengaturan terbuka sebagai panel besar di atas lobi, sedangkan adegan 3D tetap terpasang di belakangnya. Di HP tidak ada yang berubah: keduanya tetap halaman sendiri.

1F juga memperbaiki satu bug: dropdown menu akun di top bar lobi tertutup oleh peta.

## 2. Keputusan

| # | Keputusan | Alasan |
|---|---|---|
| 1 | Popup hanya di desktop (≥ 1024px). Di HP, `/shelf` dan `/settings` tetap halaman dengan tab bar bawah. | Di layar sempit popup layar penuh sama saja dengan halaman. Lobi 3D di HP juga lebih berat dan tidak perlu terus berjalan di belakang. |
| 2 | Alamat tetap berganti ke `/shelf` dan `/settings`. | Back browser menutup popup, refresh tetap membuka popup di atas lobi, dan link `/shelf?genre=…` tetap bisa dibagikan. |
| 3 | Popup berupa panel kaca besar di tengah (lebar ± 1000px). Top bar dan menu kiri tetap terlihat. | Grid buku butuh ruang lebar. Lobi tetap terlihat redup di tepinya. |
| 4 | Saat popup terbuka, adegan 3D dibekukan, lalu diredupkan dan diblur ringan. | Hemat CPU dan baterai, dan scroll grid tetap mulus. Animasi lanjut dari posisi yang sama saat popup ditutup. |
| 5 | `/lobby`, `/shelf`, dan `/settings` menjadi anak dari satu layout lobi. | Hanya cara ini yang memenuhi keputusan 1–4 tanpa memuat ulang WebGL. Alternatif yang ditolak ada di §8. |
| 6 | Desktop atau HP ditentukan oleh CSS. JavaScript (`matchMedia`) hanya memutuskan apakah WebGL boleh menyala. | Tampilan dari server sudah benar untuk kedua ukuran, jadi tidak ada kedipan setelah hidrasi. |
| 7 | Karakter "Anda" yang bisa digerakkan bebas **tidak** masuk 1F. | Masalahnya berbeda (tabrakan, kamera, kontrol HP, aksesibilitas) dan akan dibahas di spec terpisah. Usulan awalnya: klik atau ketuk lantai untuk berjalan, plus tombol panah di desktop. |

## 3. Struktur rute

Alamat tidak berubah, tapi file rutenya pindah:

```
src/routes/_member/_lobi.tsx           layout baru: LobbyStage + <Outlet/>
src/routes/_member/_lobi/lobby.tsx     tanpa isi sendiri; lobi digambar layout
src/routes/_member/_lobi/shelf.tsx     isi Rak Saya
src/routes/_member/_lobi/settings.tsx  isi Pengaturan
```

`src/routes/_member/lobby.tsx`, `shelf.tsx`, dan `settings.tsx` yang lama dihapus. `read.$bookId.tsx` dan `welcome.tsx` tetap di luar layout.

### Layout `_lobi`

- **Loader.** Memegang `loadShelf(context.user.id)` dengan `staleTime: 60_000` dan `errorComponent: ShelfLoadError`, dipindah dari lobi dan Rak. Rute anak memakai data itu lewat `getRouteApi("/_member/_lobi")`. Pengaturan ikut memuatnya, tapi data rak sudah di-cache dan tersedia offline.
- **`validateSearch`.** Rak tetap memegang `parseShelfSearch` (genre, q, urutan). Lobi tetap memegang `kembali`.
- **Render.** Layout menggambar `LobbyStage`. Kalau rute anak adalah `/shelf` atau `/settings`, layout juga membungkus `<Outlet/>` dengan `LobbyPopup`. Di `/lobby`, anak tidak menggambar apa pun selain `<h1 class="sr-only">Lobi</h1>`.
- **`useShelfSnapshot`.** Dipanggil sekali di layout, tidak lagi di setiap halaman.

### `LobbyStage`

Isi `LobbyPage` sekarang dipindah ke `src/components/lobby/LobbyStage.tsx`:
- `LobbyScene`, `LobbyTopBar`, dan notifikasi lobi;
- `aside.lobby-side`: peta, detail buku, buku terakhir, dan Meja Admin;
- `ContinueSheet`, tombol "Bawa buku", `UploadPanel`, dan `TrolleyPanel`;
- state lobi: buku terpilih, posisi Anda, upload, troli, dan petunjuk baca.

Prop baru:
- `popup: boolean`. Kalau `true`, adegan dibekukan (§4.5) dan disembunyikan dari keyboard, panel lobi tidak digambar (§4.4), dan di HP seluruh stage disembunyikan (§5).

### `MemberShell`

- Menu kiri melayang (`data-floating`) untuk `/lobby`, `/shelf`, dan `/settings`. Di desktop, ketiganya selalu punya lobi di belakang.
- Tab bar HP tetap seperti sekarang.

## 4. Popup di desktop (≥ 1024px)

### 4.1 Tampilan

- **`LobbyPopup`.** Komponen baru di `src/components/lobby/LobbyPopup.tsx`, berupa `<main>` dengan tombol ✕. Judulnya tetap `h1` yang sudah ada di isi halaman ("Rak Saya" di `ShelfHeader`, "Pengaturan" di halaman Pengaturan). `LobbyPopup` tidak membuat `h1` sendiri; `aria-labelledby` menunjuk ke `h1` itu.
- **Ukuran dan letak.** Lebar maksimal ± 1000px dan tinggi maksimal sebatas layar dikurangi top bar dan jarak tepi. Letaknya di tengah area di kanan menu kiri.
- **Gaya.** Kaca seperti `Panel` lobi yang sudah ada.
- **Scroll.** Isi menggulir di dalam panel, sedangkan halaman tidak menggulir.
- **Isi Rak dan Pengaturan.** Tetap sama, hanya dilepas dari `<main className="mx-auto … min-h-dvh">` miliknya. Pembungkus halaman sekarang tugas `LobbyPopup`.

### 4.2 Membuka

Semua jalan yang sudah ada tetap berlaku karena semuanya link ke alamat:
- menu kiri "Rak Saya" dan "Pengaturan";
- hotspot rak genre di adegan, yaitu `navigate({ to: "/shelf", search: { genre } })`;
- menu akun → Pengaturan.

### 4.3 Menutup

- **Cara menutup.** Tombol ✕, tombol Esc (selama tidak ada dialog lain yang terbuka di atasnya), atau klik area lobi yang redup. Ketiganya menjalankan `navigate({ to: "/lobby" })`.
- **Back browser.** Kembali ke alamat sebelumnya. Kalau alamat itu `/lobby`, popup tertutup.
- **Fokus setelah menutup.** Kembali ke elemen yang membuka popup, kalau elemen itu masih ada. Kalau tidak, fokus pindah ke kolom pencarian di top bar.

### 4.4 Fokus dan aksesibilitas

- **Saat popup terbuka.** Fokus pindah ke `h1` pertama di dalam popup, yang diberi `tabIndex={-1}`.
- **Lobi di belakang.** `LobbyScene` (termasuk `HotspotLayer` di dalamnya) dibungkus elemen ber-`inert` dan `aria-hidden`, jadi tidak bisa di-Tab atau diklik dan tidak terbaca pembaca layar. Panel lobi (`aside.lobby-side`, notifikasi, gelembung, `ContinueSheet`, tombol "Bawa buku") tidak digambar sama sekali: isinya mengulang teks dan tombol Rak, misalnya judul buku dan pemberitahuan offline. State-nya ada di `LobbyStage`, jadi tidak hilang.
- **Yang tetap aktif.** Top bar dan menu kiri tetap bisa dipakai, jadi pengguna bisa pindah langsung dari Rak ke Pengaturan.
- **Pencarian top bar.** Kalau hasil pencarian dipilih saat popup terbuka, popup ditutup (`/lobby`) dan detail buku dibuka di lobi seperti biasa.
- **Dialog lain.** Dialog yang sudah ada (detail buku di Rak, `UploadPanel`, konfirmasi hapus akun) tetap memakai portal Base UI, jadi muncul di atas popup.

### 4.5 Adegan dibekukan

- **Prop `paused`.** `LobbyScene` mendapat prop `paused`, yang diteruskan ke stage di `scene/stage.ts` lewat method `setPaused(paused)`.
- **Saat dijeda.** Loop render berhenti dengan jalur yang sama seperti `visibilitychange`. Frame terakhir dibiarkan tampil.
- **Saat dilanjutkan.** Animasi berjalan lagi dari waktu yang sama, tanpa lompatan.
- **Tampilan beku.** Lapisan redup dan blur ringan (`backdrop-filter`) di atas canvas. Kalau WebGL tidak tersedia, lapisan yang sama dipasang di atas gambar diam (`LobbyStill`).

## 5. HP (< 1024px)

- **Tampilan.** `/lobby`, `/shelf`, dan `/settings` terlihat dan bekerja persis seperti sekarang.
- **Stage disembunyikan.** Di `/shelf` dan `/settings`, `LobbyStage` disembunyikan dengan CSS (`display: none`), sedangkan `LobbyPopup` tampil sebagai halaman biasa tanpa tombol ✕.
- **WebGL.** `LobbyScene` hanya menyalakan WebGL kalau rutenya `/lobby` atau lebar layar ≥ 1024px (`matchMedia("(min-width: 1024px)")`, didengarkan perubahannya). Gambar diam di stage yang tersembunyi tidak boleh ikut diunduh.
- **Melewati 1024px.** Kalau layar diputar atau jendela diubah ukurannya, CSS langsung berganti, dan WebGL menyala saat lebar mencapai 1024px.
- **Esc.** Tidak ditangkap di HP. Tidak ada popup untuk ditutup.

## 6. Dropdown akun

- **Bug.** `.lobby-topbar` dan `.lobby-side` sama-sama `position: absolute; z-index: 10`. `.lobby-side` muncul belakangan di DOM, jadi digambar di atas top bar beserta dropdown-nya. `z-index: 20` milik `.lobby-account-menu` hanya berlaku di dalam top bar.
- **Perbaikan.** `.lobby-topbar` diberi `z-index` di atas `.lobby-side` dan `LobbyPopup`, tapi tetap di bawah menu kiri (`z-index: 30`) dan dialog.
- **Akibat layout baru.** Karena lobi tidak lagi dilepas saat pindah ke `/settings`, `<details>` menu akun bisa tetap terbuka di atas popup. Menu harus tertutup saat:
  - sebuah item dipilih;
  - pengguna mengklik di luar menu;
  - pengguna menekan Esc. Fokus kemudian kembali ke tombol akun.

## 7. Offline dan error

- **Offline.** `loadShelf` sudah membaca salinan offline. Membuka `/shelf` saat offline di desktop menampilkan popup di atas lobi. Notifikasi offline tampil di dalam popup; notifikasi lobi baru muncul lagi setelah popup ditutup.
- **Error.** Kalau `loadShelf` gagal, `ShelfLoadError` menggantikan seluruh layout, sama seperti perilaku halaman lobi dan Rak sekarang.

## 8. Alternatif yang ditolak

- **Adegan dipindah ke `MemberShell`.** State lobi (buku terpilih, upload, posisi Anda) jadi bercampur dengan navigasi.
- **"Modal route" dengan background location.** Kalau `/shelf` di-refresh, lobi di belakang hilang. Ini bertentangan dengan keputusan 2.
- **Alamat tetap `/lobby`, popup hanya state.** Back browser meninggalkan lobi, refresh menutup popup, dan link rak per genre tidak bisa dibagikan.

## 9. Pengujian

### Unit (Vitest)

- **`LobbyPopup`.** Tombol ✕, Esc, dan klik area redup memanggil navigasi ke `/lobby`. Fokus pindah ke `h1` di dalamnya saat popup dipasang. Esc diabaikan kalau ada dialog lain yang terbuka.
- **`LobbyTopBar`.** Menu akun tertutup saat item dipilih, saat klik di luar, dan saat Esc ditekan.
- **`MemberShell`.** `data-floating` aktif untuk `/lobby`, `/shelf`, dan `/settings`, dan tidak aktif untuk rute lain.
- **Jeda.** `paused` diteruskan dari `LobbyScene` ke `LobbyCanvas` ke `stage.setPaused` (stage di-mock, karena jsdom tidak punya WebGL).

### E2E desktop (1280 × 720)

- **Canvas tidak dipasang ulang.** Buka Rak dari menu kiri, lalu pastikan elemen canvas lobi tetap sama (tandai elemen dengan atribut sebelum navigasi, lalu cek atribut itu masih ada).
- **Menutup.** Esc menutup popup ke `/lobby`, dan Back browser juga menutup popup.
- **Refresh.** Refresh di `/shelf` menampilkan popup di atas lobi.
- **Hotspot genre.** Membuka Rak yang sudah terfilter, lewat jalur hotspot yang dipakai tes lobi sekarang.
- **Dropdown akun.** Setelah dibuka, `document.elementFromPoint` di tengah link "Pengaturan" mengembalikan link itu sendiri, bukan peta.

### E2E HP (390 × 844)

- `/shelf` dan `/settings` tampil tanpa canvas lobi, dan navigasi lewat tab bar tetap jalan.

### Tes yang sudah ada

- `shelf.spec.ts`, `auth.spec.ts` (Pengaturan), `offline.spec.ts`, dan `reader.spec.ts` berjalan di viewport desktop. Selektornya disesuaikan kalau ada yang bergantung pada `<main>` halaman lama.
- Job `e2e-3d` di CI tetap menjaga adegan. Test baru di sana memastikan canvas WebGL yang sama masih ada setelah Rak dibuka lalu ditutup.
