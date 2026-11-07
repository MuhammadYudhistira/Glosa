# Glosa Tahap 3F-R2 — Bahasa ruang baca dan alur masuk: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Semua teks UI berganti dari tema perpustakaan publik ke tema ruang baca pribadi (spec 3F §4), tanpa mengubah URL, tabel, fungsi, atau ID hotspot, dan sebuah tes pemindai menjaga agar kata lama tidak kembali.

**Architecture:** Hanya perubahan teks dan nama komponen internal. Tokoh petugas dihapus (`LibrarianBubble` menjadi `NoteBubble` tanpa judul tokoh). `MembershipCard` menjadi kartu pembaca (satu baris ringkasan buku bila datanya ada). Tes pemindai `src/lib/wording.test.ts` membaca `src/**` dan `supabase/templates/*.html` dan gagal bila kata terlarang muncul di luar daftar pengecualian yang tercatat.

**Tech Stack:** TanStack Start + Router, React 19, TypeScript, Tailwind CSS 4, Vitest + Testing Library, Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-07-tahap-3f-ruang-baca-pribadi-design.md`](../specs/2026-11-07-tahap-3f-ruang-baca-pribadi-design.md) §4, §7 (pemindaian teks). Dikerjakan **setelah R1** ([`2026-11-07-tahap-3f-r1-ruang-studi.md`](2026-11-07-tahap-3f-r1-ruang-studi.md)).

## Global Constraints

- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris. Array ditulis `Array<T>`. Tidak ada kata "gagal" di teks UI baru.
- **Dependensi:** tidak ada dependensi baru.
- **Teks dari spec, persis:** "Masuk ke ruang bacamu" (judul `/login`), "Masuk ke ruang bacamu →" (tombol `/welcome`), "…ruang baca pribadimu…" (halaman depan), "Buat ruang baca" (judul dan tombol `/register`), "Kartu pembaca", "Ruang bacamu sudah siap", "Syarat Layanan", "Ruang baca" (menggantikan Lobi), "Denah ruangan", "Toko dekorasi", "Kursi baca", "Lihat di ruang baca".
- **Tidak berubah (spec §4.3):** URL (`/lobby`, `/login`, `/register`, `/welcome`, `/shop`, dan lainnya), nama tabel dan fungsi, ID hotspot (`meja-baca`, `toko`, dan lainnya), nama route file dan ID route (`_member/_lobi`, `getRouteApi("/_member/_lobi")`), isi hukum Syarat Layanan dan Kebijakan Privasi, aturan isinya (tiga aturan buku/kata sandi tetap).
- **Pemindaian akhir (spec §7):** tidak ada teks UI yang memuat "perpustakaan", "lobi", "anggota", atau "buku tamu" (dan "petugas"), kecuali kasus sengaja yang dicatat di daftar pengecualian tes pemindai.
- **Line ending dan encoding:** LF, UTF-8. Jangan menulis file lewat PowerShell `Set-Content` atau Python tanpa `encoding='utf-8', newline=''`. Pergantian massal lewat `sed -i` (Git Bash) atau edit per berkas; periksa `git diff --stat` setelahnya.
- **Route tree:** jangan pakai `npm run generate-routes`. R2 tidak menambah route dan tidak mengubah `src/routeTree.gen.ts`.
- **CI** menjalankan `npm run check` (prettier): setiap task menjalankan `npx prettier --write` pada file yang disentuh sebelum commit.
- **Tes unit:** `npx vitest run --maxWorkers=2` (`--maxWorkers=1` bila worker timeout). **E2E:** `--workers=2`; cek port 3000 dulu (`curl -sL localhost:3000/login | grep -o "<title>[^<]*"`), bila dipegang aplikasi lain pakai config sementara di port 3100 lalu hapus; satu kegagalan dijalankan ulang sendirian dulu.
- **Tidak ada push ke GitHub** (pemilik yang memutuskan). Commit lokal saja. Pesan commit diakhiri `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Keputusan dan penyimpangan dari spec

1. **Tabel teks lengkap ada di Task 1 dan 2.** Spec hanya menyebut teks kunci; sisanya mengikuti nada "tema rumah, sederhana" (keputusan pemilik 7): tanpa tokoh dan tanpa permainan kata.
2. **"Masuk ke ruang bacamu →" ada di `/welcome`**, bukan di halaman depan: halaman depan sekarang tidak punya tombol itu (hanya "Masuk" dan "Daftar jadi anggota"). Halaman depan mendapat "Masuk" (tetap) dan "Buat ruang baca" (menggantikan "Daftar jadi anggota"); kalimat "…ruang baca pribadimu…" ada di deskripsi dan sub-judul.
3. **Tokoh petugas dihapus dengan mengganti nama:** `LibrarianBubble` → `NoteBubble` (tanpa judul "Petugas perpustakaan"), kelas CSS `.librarian-bubble` → `.note-bubble`, `LibrarianWelcome` → `ShelfWelcome`. Bentuk gelembung tetap. `AdminDesk`, `GuestBook`, `GuestBookRules` (tata letak halaman masuk, bukan teks) dan `Stamp` tidak diganti nama; teks di dalamnya diganti. Daftar nama internal yang sengaja tetap ada di tes pemindai.
4. **Stempel `/welcome`** "DITERIMA" → "SIAP". Judul tersembunyi untuk pembaca layar: "Ruang bacamu sudah siap".
5. **"Meja Admin" (hotspot `meja-admin`, `AdminDeskCard`) tidak diganti:** kata itu tidak ada di daftar terlarang, benda di ruang studi adalah laptop di meja tulis, dan hanya admin yang melihatnya. Pesan galat auth yang memakai "meja admin" sebagai kiasan petugas diganti netral ("Glosa …").
6. **"Pengunjung hari ini" → "Pembaca hari ini"** di sisi halaman masuk (angka tanpa nama, fungsi `visitors_today` tidak berubah); Kebijakan Privasi mengikuti. Tanggal "diperbarui" di `/terms` dan `/privacy` tidak diubah (isi hukum sama).
7. **Kartu pembaca:** spec menyebut "ringkasan buku dan streak". Streak sudah ada; ringkasan buku ditambahkan sebagai prop opsional `shelf?: { total: number; finished: number }` dan satu baris "N buku · M selesai". Pengaturan mengisinya dari loader `_lobi` (pola `habits.tsx`); `/welcome` tidak mengisinya (anggota baru belum punya buku).
8. **Template email:** `supabase/templates/confirmation.html` diubah; `recovery.html` tidak memuat kata terlarang. Subjek email "Konfirmasi keanggotaan Glosa" ada di dashboard Supabase (bukan repo), jadi `docs/ops/deploy.md` §8.1 diperbarui menjadi **"Buka ruang baca Glosa"** dan pemilik harus menempel subjek dan isi baru di dashboard Supabase dev (dan prod nanti). Ini langkah manual; dicatat di laporan akhir.
9. **Label tombol masuk:** "Tanda tangan & masuk" → "Masuk". Karena "Masuk dengan Google" ikut cocok pada pencarian nama sebagian, tes E2E memakai `exact: true`.
10. **Tes pemindai** (Task 3) menggantikan pemindaian `grep` manual; pengecualian ditulis di dalam tes dengan alasan, sehingga "kecuali yang disengaja dan dicatat" (spec §7) terpenuhi oleh kode.

## Struktur file

| File | Tanggung jawab |
|---|---|
| `src/components/auth/NoteBubble.tsx` (+ `.test.tsx`), `src/styles.css` | Gelembung tanpa tokoh (Task 1) |
| `src/components/auth/GuestBookRules.tsx`, `LinkFailed.tsx` (+ tes), `useUsernameCheck.ts`, `src/lib/auth-messages.ts` | Teks masuk dan galat (Task 1) |
| `src/routes/index.tsx`, `login.tsx`, `register.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `terms.tsx`, `privacy.tsx`, `_member/welcome.tsx` | Alur masuk (Task 1) |
| `src/components/member/MembershipCard.tsx` (+ tes), `src/routes/_member/_lobi/settings.tsx` | Kartu pembaca (Task 1) |
| `supabase/templates/confirmation.html`, `docs/ops/deploy.md` | Email (Task 1) |
| `src/components/member/MemberShell.tsx`, `src/components/lobby/{LobbyScene,LobbyStage,LibraryMap,ShopPanel,lobby-data,LobbyBubbles}.tsx`, `src/components/shelf/EmptyShelf.tsx`, `src/components/RouteError.tsx`, `src/routes/__root.tsx`, `src/routes/_member/_lobi/{lobby,shop}.tsx` (+ tes) | Di dalam aplikasi (Task 2) |
| `e2e/*.spec.ts`, `e2e/helpers/members.ts` | Teks baru di E2E (Task 1 dan 2) |
| `src/lib/wording.test.ts` | Pemindai teks akhir (Task 3) |

---

### Task 1: Alur masuk — halaman depan, masuk, daftar, selamat datang, kartu pembaca, email

**Files:**
- Rename: `src/components/auth/LibrarianBubble.tsx` → `NoteBubble.tsx`, `LibrarianBubble.test.tsx` → `NoteBubble.test.tsx` (`git mv`)
- Modify: `src/styles.css` (`.librarian-bubble` → `.note-bubble`, baris ±225 dan ±235), pemakai `LibrarianBubble`: `src/components/lobby/LobbyBubbles.tsx`, `src/components/shelf/EmptyShelf.tsx`, `src/routes/{forgot-password,login,register,reset-password}.tsx`, `src/routes/_member/welcome.tsx`
- Modify: `src/components/auth/GuestBookRules.tsx`, `LinkFailed.tsx`, `LinkFailed.test.tsx`, `useUsernameCheck.ts`, `src/lib/auth-messages.ts` (+ `auth-messages.test.ts` bila menyebut teks yang berubah)
- Modify: `src/routes/{index,login,register,forgot-password,terms,privacy}.tsx`, `src/routes/_member/welcome.tsx`
- Modify: `src/components/member/MembershipCard.tsx`, `MembershipCard.test.tsx`, `src/routes/_member/_lobi/settings.tsx`
- Modify: `supabase/templates/confirmation.html`, `docs/ops/deploy.md`
- Modify: `e2e/auth.spec.ts`, `e2e/helpers/members.ts`, `e2e/scene.spec.ts` bila perlu

**Interfaces:**
- Produces: `NoteBubble({ children, tone?: "info" | "error" })` (tanda tangan sama seperti `LibrarianBubble`, sekarang tanpa judul tokoh); `MembershipCard` prop opsional baru `shelf?: { total: number; finished: number } | null`; `ShelfWelcome` (nama baru `LibrarianWelcome` di `LobbyBubbles.tsx`).
- Consumes: tidak ada dari R1 selain label E2E.

Teks baru (persis; "—" berarti tidak berubah):

| Tempat | Sekarang | Menjadi |
|---|---|---|
| `NoteBubble` judul | `<b>Petugas perpustakaan</b>` | dihapus (hanya isi) |
| `index.tsx` deskripsi `head` | "Glosa adalah perpustakaan pribadimu untuk belajar…" | "Glosa adalah ruang baca pribadimu untuk belajar bahasa Inggris lewat buku: unggah EPUB, baca dengan nyaman, dan pahami setiap kata." |
| `index.tsx` sub-judul | "Perpustakaan pribadimu untuk belajar bahasa Inggris lewat buku." | "Ruang baca pribadimu untuk belajar bahasa Inggris lewat buku." |
| `index.tsx` tombol kedua | "Daftar jadi anggota" | "Buat ruang baca" |
| `login.tsx` `head` judul | "Buku Tamu — Glosa" | "Masuk — Glosa" |
| `login.tsx` `h1` (mobile) dan `GuestBookRules` `h1` | "Buku Tamu" | "Masuk ke ruang bacamu" |
| `login.tsx` sapaan | "Selamat datang! Silakan isi buku tamu, ya." | "Selamat datang kembali!" |
| `login.tsx` tombol | "Tanda tangan & masuk" / "Menandatangani…" | "Masuk" / "Membuka ruang baca…" |
| `login.tsx` tautan | "Belum jadi anggota? Daftar" | "Belum punya ruang baca? Buat ruang baca" |
| `GuestBookRules` | "Tata tertib perpustakaan"; "Jaga kata sandimu; petugas tidak akan pernah memintanya."; "Pengunjung hari ini:" | "Aturan ruang baca"; "Jaga kata sandimu; Glosa tidak akan pernah memintanya."; "Pembaca hari ini:" (dua aturan lain tetap) |
| `LinkFailed` | "Ke buku tamu" | "Ke halaman masuk" |
| `forgot-password.tsx` | "Kembali ke buku tamu" | "Kembali ke halaman masuk" |
| `register.tsx` `head` judul | "Formulir Anggota — Glosa" | "Buat ruang baca — Glosa" |
| `register.tsx` `h1` | "FORMULIR PENDAFTARAN ANGGOTA" | "BUAT RUANG BACA" |
| `register.tsx` sapaan | "Anggota baru? Isi satu formulir ini, kartumu langsung jadi." | "Baru di sini? Isi satu formulir ini, ruang bacamu langsung siap." |
| `register.tsx` setelah kirim (gelembung) | "…Buka tautannya untuk menerima kartu anggotamu." | "…Buka tautannya untuk membuka ruang bacamu." |
| `register.tsx` setelah kirim (kertas) | "…Sampai jumpa di meja admin!" | "…Sampai jumpa di ruang bacamu!" |
| `register.tsx` tombol | "Ajukan keanggotaan" | "Buat ruang baca" |
| `register.tsx` kotak centang | "Saya setuju dengan tata tertib (Syarat Layanan & Kebijakan Privasi)" | "Saya setuju dengan Syarat Layanan & Kebijakan Privasi" (tautan tetap pada dua frasa itu) |
| `register.tsx` petunjuk Google | "Centang persetujuan tata tertib dulu." | "Centang persetujuan syarat layanan dulu." |
| `register.tsx` tautan | "Sudah jadi anggota? Isi buku tamu" | "Sudah punya ruang baca? Masuk" |
| `auth-messages.ts` | `username_taken`: "…sudah dipakai anggota lain."; `terms_required`: "Sebelum jadi anggota, setujui tata tertib perpustakaan dulu, ya." / field "Centang persetujuan tata tertib."; `not_authenticated`: "Sesimu sudah berakhir. Silakan isi buku tamu lagi."; "Meja admin belum bisa mengirim surat…"; "Meja admin sedang ramai. Tunggu sebentar, ya."; FALLBACK "Maaf, ada gangguan di meja admin. Coba lagi sebentar lagi." | "…sudah dipakai pengguna lain."; "Sebelum membuat ruang baca, setujui Syarat Layanan dulu, ya." / "Centang persetujuan syarat layanan."; "Sesimu sudah berakhir. Silakan masuk lagi."; "Glosa belum bisa mengirim surat ke alamat itu. Coba alamat lain, ya."; "Glosa sedang ramai. Tunggu sebentar, ya."; "Maaf, ada gangguan. Coba lagi sebentar lagi." |
| `useUsernameCheck.ts` | "Sudah dipakai anggota lain." | "Sudah dipakai pengguna lain." |
| `terms.tsx` judul | "Syarat Layanan (Tata Tertib Perpustakaan)" | "Syarat Layanan" |
| `terms.tsx` isi | "Dengan menjadi anggota Glosa, kamu setuju dengan tata tertib berikut."; "Hormati anggota lain."; "Kami dapat mengubah tata tertib ini." | "Dengan memakai Glosa, kamu setuju dengan syarat berikut."; "Hormati pengguna lain."; "Kami dapat mengubah syarat ini." (periksa sisa berkas dengan grep dan ganti "tata tertib"/"anggota" serupa; isi hukum tidak berubah) |
| `privacy.tsx` | "Toko lobi: barang lobi yang kamu beli dan pasang, serta koin…"; "Menyediakan perpustakaan pribadimu…"; "Jumlah "pengunjung hari ini" di buku tamu…" | "Toko dekorasi: barang dekorasi yang kamu beli dan pasang di ruang bacamu, serta koin…"; "Menyediakan ruang baca pribadimu…"; "Jumlah "pembaca hari ini" di halaman masuk…" |
| `welcome.tsx` `head` judul | "Kartu Anggota — Glosa" | "Kartu Pembaca — Glosa" |
| `welcome.tsx` stempel | "DITERIMA" | "SIAP" |
| `welcome.tsx` `h1` (sr-only) | "Kartu anggotamu sudah jadi" | "Ruang bacamu sudah siap" |
| `welcome.tsx` tombol | "Masuk ke perpustakaan →" | "Masuk ke ruang bacamu →" (pending "Membuka pintu…" tetap) |
| `MembershipCard` | `aria-label` "Kartu anggota Glosa"; "KARTU ANGGOTA PERPUSTAKAAN"; "No. anggota"; "Anggota sejak" | "Kartu pembaca Glosa"; "KARTU PEMBACA"; "No. pembaca"; "Bergabung sejak" |
| `LobbyBubbles` | `LibrarianWelcome` | `ShelfWelcome` (teks "Rakmu masih kosong. Bawa buku pertamamu ke sini!" tetap) |
| `confirmation.html` | "Terima kasih sudah mengisi formulir anggota. Satu langkah lagi untuk menerima kartu anggotamu:" / tautan "Konfirmasi keanggotaan" | "Terima kasih sudah membuat ruang bacamu di Glosa. Satu langkah lagi untuk membukanya:" / "Konfirmasi dan buka ruang baca" |
| `deploy.md` §8.1 | subjek **Konfirmasi keanggotaan Glosa** | **Buka ruang baca Glosa** |

- [ ] **Step 1: Ubah tes dulu (gagal)**

Perbarui tes yang mengunci teks lama ke teks baru: `NoteBubble.test.tsx` (gelembung status tidak lagi memuat "Petugas perpustakaan": `expect(screen.getByRole("status")).not.toHaveTextContent("Petugas")` dan teks anak tampil), `LinkFailed.test.tsx` ("Ke halaman masuk"), `MembershipCard.test.tsx` (nama figure "Kartu pembaca Glosa"; tambahkan dua tes:
```tsx
it("shows the shelf summary when it is given", () => {
  render(<MembershipCard member={member} shelf={{ total: 12, finished: 5 }} />)
  expect(screen.getByText("12 buku · 5 selesai")).toBeInTheDocument()
})

it("leaves the summary out when there is none", () => {
  render(<MembershipCard member={member} />)
  expect(screen.queryByText(/buku ·/)).toBeNull()
})
```
dengan `member` fixture yang sudah ada di berkas itu), `auth-messages.test.ts` bila ada kecocokan teks lama. E2E: `e2e/auth.spec.ts` ("Silakan isi buku tamu" → "Selamat datang kembali"; link "Daftar jadi anggota" → "Buat ruang baca"; `getByRole("figure", { name: "Kartu pembaca Glosa" })`; `getByText("SIAP")`; tombol `/Masuk ke ruang bacamu/`; `{ name: "Buat ruang baca", exact: true }` untuk tombol kirim di formulir; `getByLabel("Saya setuju dengan Syarat Layanan")`; `{ name: "Masuk", exact: true }` untuk tombol masuk) dan `e2e/helpers/members.ts` (`{ name: "Masuk", exact: true }` baris ±97, `/Masuk ke ruang bacamu/` baris ±117). Pastikan `e2e/scene.spec.ts` (`link "Masuk"` di halaman depan) masih benar. Run `npx vitest run src/components/auth src/components/member src/lib/auth-messages.test.ts` → FAIL.

- [ ] **Step 2: Hapus tokoh petugas**

```bash
git mv src/components/auth/LibrarianBubble.tsx src/components/auth/NoteBubble.tsx
git mv src/components/auth/LibrarianBubble.test.tsx src/components/auth/NoteBubble.test.tsx
```
Di `NoteBubble.tsx`: nama `NoteBubble`, kelas `note-bubble`, buang `<b …>Petugas perpustakaan</b>` (`content` = `children` saja). Ganti semua `LibrarianBubble` → `NoteBubble` dan impor `@/components/auth/LibrarianBubble` → `@/components/auth/NoteBubble` di pemakai yang tercantum di Files (`grep -rl LibrarianBubble src`), `LibrarianWelcome` → `ShelfWelcome` (definisi dan pemakai di `LobbyStage.tsx`/tes: `grep -rn LibrarianWelcome src`), dan `.librarian-bubble` → `.note-bubble` di `styles.css` (`grep -rn librarian src`).

- [ ] **Step 3: Terapkan tabel teks**

Edit tiap berkas sesuai tabel di atas. Catatan khusus:
- `login.tsx`: `<h1>` mobile dan judul sisi (`GuestBookRules`) memakai "Masuk ke ruang bacamu"; tanggal panjang di `GuestBookRules` dan struktur selebihnya tetap.
- `register.tsx`: kotak centang tetap `name="acceptedTerms"`; tautan `/terms` dan `/privacy` tetap `target="_blank"`.
- `MembershipCard`: tambah prop `shelf?: { total: number; finished: number } | null`; bila ada, render sebelum baris streak `<p className="text-[10px] font-bold tracking-wide text-mint">{shelf.total} buku · {shelf.finished} selesai</p>` (tanpa baris saat `null`/tidak ada). `settings.tsx`: baca buku dari loader `_lobi` seperti `habits.tsx` (`const lobi = getRouteApi("/_member/_lobi")`; `const { books } = lobi.useLoaderData()`) dan kirim `shelf={{ total: books.length, finished: books.filter((book) => book.finishedAt !== null).length }}` (gunakan nama bidang selesai yang dipakai `summarizeLobby` di `lobby-data.ts`, bukan tebakan). `welcome.tsx` tidak memberi `shelf`.
- Template dan `deploy.md`: ubah sesuai tabel.

- [ ] **Step 4: Verifikasi**

`npx vitest run src/components src/lib src/routes --maxWorkers=2` hijau. E2E auth: `npx playwright test e2e/auth.spec.ts e2e/scene.spec.ts --workers=2` hijau (lihat Global Constraints soal port). `grep -rniE "perpustakaan|buku tamu|petugas|anggota" src/routes/index.tsx src/routes/login.tsx src/routes/register.tsx src/routes/terms.tsx src/routes/privacy.tsx src/routes/forgot-password.tsx src/routes/_member/welcome.tsx src/components/auth src/components/member src/lib/auth-messages.ts supabase/templates` kosong (di luar tes).

- [ ] **Step 5: Format dan commit**

```bash
npx prettier --write <semua berkas yang disentuh>
git add -A src e2e supabase docs/ops/deploy.md
git commit -m "feat(3f): reading-room wording for the sign-in flow and the reader card" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Di dalam aplikasi — navigasi, ruang baca, denah, toko dekorasi, galat

**Files:**
- Modify: `src/components/member/MemberShell.tsx`, `MemberShell.test.tsx`
- Modify: `src/components/lobby/{LobbyScene,LobbyStage,LibraryMap,ShopPanel,lobby-data}.tsx|ts` dan tes: `HotspotLayer.test.tsx`, `LibraryMap.test.tsx`, `lobby-data.test.ts`, `LobbyScene.test.tsx`, `LobbyStage.test.tsx`, `ShopPanel.test.tsx`
- Modify: `src/routes/_member/_lobi/{lobby,shop}.tsx`, `src/components/RouteError.tsx`, `src/routes/__root.tsx`
- Modify: `e2e/*.spec.ts` yang menyebut teks lama (daftar di Step 1)

**Interfaces:** tidak ada tanda tangan berubah. ID hotspot dan route tetap.

Teks baru:

| Tempat | Sekarang | Menjadi |
|---|---|---|
| `MemberShell` tautan `/lobby` | label "Lobi", short "Lobi" | label "Ruang baca", short "Ruang" |
| `MemberShell` `aria-label` (dua `nav`) | "Navigasi anggota" | "Navigasi utama" |
| `LobbyScene` `aria-label` | "Adegan lobi" | "Adegan ruang baca" |
| `LobbyStage` `h1` sr-only; `aside` | "Lobi"; "Panel lobi" | "Ruang baca"; "Panel ruang baca" |
| `LibraryMap` `h2` | "Peta Perpustakaan" | "Denah ruangan" |
| `LibraryMap` legenda dan tombol peta | "Meja Baca" (`… di peta`), "Toko lobi" | "Kursi baca", "Toko dekorasi" (sisanya tetap: "Rak buku", "Meja Admin", "Troli Buku Baru", "Kosakata", "Sudah dibaca", "Kebiasaan baca", "Posisi Anda") |
| `lobby-data.ts` label hotspot | `meja-baca` "Meja Baca"; `toko` "Toko lobi" | "Kursi baca"; "Toko dekorasi" |
| `ShopPanel` | "Toko lobi" (dua `h1`), "Toko lobi belum bisa dimuat.", "Lihat di lobi" | "Toko dekorasi", "Toko dekorasi belum bisa dimuat.", "Lihat di ruang baca" |
| `shop.tsx` | judul "Toko lobi — Glosa", `LobbyPopup label="Toko lobi"` | "Toko dekorasi — Glosa", `label="Toko dekorasi"` |
| `lobby.tsx` judul | "Lobi — Glosa" | "Ruang baca — Glosa" |
| `RouteError` | "Petugas sedang membereskannya. Coba muat ulang halaman ini." | "Kami sedang membereskannya. Coba muat ulang halaman ini." |
| `__root.tsx` 404 | "…tidak ada di perpustakaan ini." | "…tidak ada di ruang baca ini." |

- [ ] **Step 1: Ubah tes dulu (gagal)**

Ganti string lama di tes unit sesuai tabel (daftar pasti dari `grep -rnE "Meja Baca|Toko lobi|Peta Perpustakaan|Adegan lobi|Lihat di lobi|Navigasi anggota|\"Lobi\"|Lobi 3D" src --include=*.test.ts --include=*.test.tsx`): `HotspotLayer.test.tsx` (nama tombol pertama "Kursi baca", terakhir "Toko dekorasi"), `LibraryMap.test.tsx` (nama "Kursi baca di peta", "Toko dekorasi di peta", dan teks urutan legenda "Rak bukuKursi bacaMeja AdminTroli Buku BaruKosakataSudah dibacaKebiasaan bacaToko dekorasiPosisi Anda"), `lobby-data.test.ts`, `LobbyScene.test.tsx`, `LobbyStage.test.tsx` (heading "Ruang baca", "Denah ruangan"), `ShopPanel.test.tsx`, `MemberShell.test.tsx` (tautan "Ruang baca", nav "Navigasi utama"; teks palsu "Lobi 3D" di rute tiruan boleh diganti "Ruang 3D" supaya lolos pemindai). E2E: ganti pada `e2e/lobby.spec.ts`, `lobby-3d.spec.ts`, `lobby-popup.spec.ts`, `collections.spec.ts`, `habit.spec.ts`, `offline.spec.ts`, `shop.spec.ts`, `vocabulary.spec.ts`: `name: "Adegan lobi"` → `"Adegan ruang baca"`, `"Navigasi anggota"` → `"Navigasi utama"`, `"Toko lobi"` → `"Toko dekorasi"`, tombol hotspot `Meja Baca`/"Meja Baca" → `Kursi baca` (cari `grep -rn "Meja Baca" e2e`). Penanda `data-e2e-mark = "lobi"` di `lobby-popup.spec.ts` hanya nilai internal; ganti ke `"ruang"` agar bersih. Run `npx vitest run src/components --maxWorkers=2` → FAIL.

- [ ] **Step 2: Terapkan tabel teks**

Edit tiap berkas. Komentar kode yang menyebut "lobby/lobi" boleh tetap (bukan teks UI), kecuali komentar yang menyalin teks UI. `LobbyScene` di `Pusatkan`, `LobbyBubbles` ("Belum ada buku yang dibaca. Rak Saya") tidak berubah. Cek juga `LobbyTopBar.tsx`/`AdminDeskCard.tsx`/`TrolleyPanel.tsx`/`RecapPanel.tsx`/`HabitPanel.tsx` dengan `grep -rniE "lobi\b|perpustakaan|anggota|petugas" src/components` dan ganti bila ada teks UI.

- [ ] **Step 3: Verifikasi**

`npx vitest run --maxWorkers=2` hijau. E2E: `npx playwright test e2e --workers=2` (seluruh rangkaian; lambat; satu kegagalan dijalankan ulang sendirian dulu) hijau.

- [ ] **Step 4: Format dan commit**

```bash
npx prettier --write <semua berkas yang disentuh>
git add -A src e2e
git commit -m "feat(3f): reading-room wording inside the app" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Pemindai teks akhir dan verifikasi

**Files:**
- Create: `src/lib/wording.test.ts`

**Interfaces:** tes saja.

- [ ] **Step 1: Tulis tes pemindai (gagal bila ada sisa)**

```ts
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

// The reading room's wording (spec 3F §4, §7): no library vocabulary in UI text.
const BANNED = /perpustakaan|(?<![\w$/])lobi(?![\w$])|anggota|buku tamu|petugas/i

/** Lines that may keep a banned word, each with the reason. */
const ALLOWED: Array<{ file: RegExp; line: RegExp; reason: string }> = [
  {
    file: /src\/routes\/(_member\/(_lobi\.tsx|read\.\$bookId\.tsx|_lobi\/.*)|routeTree\.gen\.ts)$/,
    line: /_lobi|\blobi\.use|getRouteApi|LobiLayout|const lobi\b/,
    reason: "route ids and variable names; the URL and route files do not change (spec 3F §4.3)",
  },
]

const ROOT = join(__dirname, "../..")
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|\.output)(\/|$)/
const SKIP_FILE = /\.test\.(ts|tsx)$|routeTree\.gen\.ts$|database\.types\.ts$/

function files(dir: string): Array<string> {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (SKIP_DIR.test(relative(ROOT, path))) return []
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)

describe("reading-room wording", () => {
  it("keeps library vocabulary out of UI text", () => {
    const targets = [
      ...files(join(ROOT, "src")).filter(
        (path) => /\.(ts|tsx)$/.test(path) && !SKIP_FILE.test(path)
      ),
      ...files(join(ROOT, "supabase/templates")).filter((path) => path.endsWith(".html")),
    ]
    const found: Array<string> = []
    for (const path of targets) {
      const name = relative(ROOT, path).split("\\").join("/")
      readFileSync(path, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (isComment(line) || !BANNED.test(line)) return
          const allowed = ALLOWED.some((rule) => rule.file.test(name) && rule.line.test(line))
          if (!allowed) found.push(`${name}:${index + 1}: ${line.trim()}`)
        })
    }
    expect(found).toEqual([])
  })
})
```
Run `npx vitest run src/lib/wording.test.ts`. Untuk tiap temuan: teks UI → ganti (ikuti tabel Task 1–2 dan nada keputusan 1); nama identifier/variabel/ID route yang tak bisa berubah → tambahkan aturan `ALLOWED` yang menamai berkas, pola baris, dan alasan (jangan melonggarkan `BANNED`). Komentar kode berbahasa Inggris yang memuat kata Indonesia tidak diperiksa (`isComment`).

- [ ] **Step 2: Sapuan akhir manual**

```bash
grep -rniE "perpustakaan|\blobi\b|anggota|buku tamu|petugas" src supabase/templates docs/ops/deploy.md public --include=*.ts --include=*.tsx --include=*.html --include=*.json --include=*.md | grep -v "\.test\.\|routeTree.gen"
```
Sisa hanya yang ada di `ALLOWED`, komentar, atau (di `deploy.md`) catatan sejarah yang bukan teks UI. Periksa mata: halaman `/`, `/login`, `/register`, `/welcome`, `/terms`, `/privacy`, `/forgot-password`, `/lobby`, `/shop`, `/settings` pada 1440 × 900 dan 390 × 844 lewat server dev (`npm run dev`), memastikan tak ada kalimat yang terpotong atau terbaca aneh.

- [ ] **Step 3: Verifikasi akhir**

```bash
npx tsc --noEmit
npx vitest run --maxWorkers=2
npm run check
npx playwright test e2e --workers=2
```
Semua hijau (cek port 3000 dulu). Laporkan ke pengendali: ringkasan hasil, daftar `ALLOWED`, dan **langkah manual pemilik**: tempel subjek **Buka ruang baca Glosa** dan isi `supabase/templates/confirmation.html` baru ke dashboard Supabase dev (Authentication → Emails → Confirm signup), dan lakukan hal sama di prod nanti.

- [ ] **Step 4: Commit**

```bash
npx prettier --write src/lib/wording.test.ts
git add src/lib/wording.test.ts
git commit -m "test(3f): scan UI text for library wording" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review (dijalankan penulis rencana)

**Cakupan spec §4.** Alur masuk (halaman depan, `/login`, `/register`, `/welcome`, form daftar dan `/terms`) → Task 1; dalam aplikasi (Lobi, Peta, Toko lobi, Meja Baca, petugas, kartu anggota) → Task 1–2; teks pembaca layar (`aria-label`) → Task 2; privasi dan syarat → Task 1; template email → Task 1 (+ langkah manual dashboard); §4.3 tidak berubah → Global Constraints; §7 pemindaian teks → Task 3.

**Placeholder.** Tabel teks memberi string persis; hal yang bergantung isi berkas (sisa "tata tertib" di `terms.tsx`, bidang selesai di `lobby-data.ts`) diarahkan ke grep/berkas dengan aturan penggantian yang jelas.

**Konsistensi.** `NoteBubble`/`ShelfWelcome`/`shelf` prop dipakai konsisten; label E2E baru ("Adegan ruang baca", "Navigasi utama", "Toko dekorasi", "Kursi baca") sama di tabel Task 2 dan langkah E2E. R2 bergantung pada R1 hanya lewat urutan (label E2E R1 masih lama sampai Task 2 R2).
