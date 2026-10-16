# Glosa Tahap 1C — Reader, Sinkronisasi Posisi Baca, dan Offline: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anggota bisa membaca buku dari raknya di `/read/$bookId`. Fitur reader:
- mode halaman atau gulir, dengan pilihan huruf, ukuran, spasi, margin, dan tema terang/sepia/gelap;
- daftar isi dan slider progres.

Posisi baca:
- tersimpan di perangkat dan tersinkron ke perangkat lain (yang terbaru menang);
- jika posisi di server lebih baru, reader menawarkan untuk melompat ke sana.

Offline:
- buku yang pernah dibuka atau disimpan offline tetap bisa dibuka tanpa internet;
- rak tampil dari salinan terakhir;
- aplikasi bisa dibuka offline sebagai PWA.

**Architecture:**
- **Reader.** Route `/read/$bookId` hanya di-render di browser (`ssr: false`).
  - Loader mengambil file EPUB dari IndexedDB (Dexie). Jika belum ada, file diunduh lewat signed URL lalu disimpan.
  - Buku dibuka dengan loader zip yang sama seperti di 1B, lalu ditampilkan oleh elemen `<foliate-view>` dari `foliate-js/view.js`.
  - Setelan baca disimpan di `profiles.reader_settings` dan di-cache di `localStorage`.
- **Posisi baca.**
  - Setiap perpindahan halaman ditulis ke IndexedDB sebagai entri "pending".
  - Mesin sinkron mengirim entri itu ke server function `saveProgressFn`: debounce 5 detik, dan langsung (fetch `keepalive`) saat halaman disembunyikan atau ditutup.
  - Fungsi Postgres `save_progress` hanya menimpa posisi yang lebih lama.
- **Offline.**
  - TanStack Start membuat shell aplikasi `/_shell.html` saat build (mode SPA).
  - Service worker buatan sendiri mem-precache shell, aset, dan font. Saat offline, navigasi dijawab dengan shell, lalu router merender halaman di browser.
  - Sesi anggota terakhir di-cache di `localStorage`. Rak dibaca dari salinan terakhir di IndexedDB.

**Tech Stack:**
- TanStack Start + Router: selective SSR, mode SPA shell, server functions dengan `fetch` kustom.
- React 19, TypeScript 6, Tailwind CSS 4, shadcn/ui (base-mira).
- Supabase Cloud (Postgres, Storage).
- foliate-js (`view.js`, `paginator.js`) pada commit yang sama dengan 1B.
- Dexie 4 (IndexedDB), `@fontsource/opendyslexic`.
- Vitest 5 + Testing Library + `fake-indexeddb`, Playwright (termasuk server `vite preview` untuk test offline).

**Seri rencana tahap 1** (spec: [`docs/superpowers/specs/2026-10-15-epub-reader-tahap-1-design.md`](../specs/2026-10-15-epub-reader-tahap-1-design.md)):

| Rencana | Isi | Status |
|---|---|---|
| 1A | Fondasi proyek, `profiles`, auth, kartu anggota, pengaturan, halaman hukum, E2E, CI | Selesai (`main`) |
| 1B | Tabel `books`, Storage, kuota, genre + Troli, Rak Saya, upload | Selesai (`main`) |
| **1C** | Reader, setelan baca, `reading_progress` + sinkronisasi, penyimpanan lokal, rak offline, PWA offline | **Dokumen ini** |
| 1D | Lobi isometrik interaktif (hotspot, panel, peta, Meja Baca, animasi), proyek Supabase prod + SMTP, deploy VPS, Sentry, sapuan Storage berkala | Ditulis setelah 1C |

## Keputusan dan penyimpangan dari spec

Semua keputusan berikut sudah disengaja. Reviewer tidak perlu menganggapnya sebagai cacat.

1. **Semua data tetap lewat server function, tanpa klien Supabase di browser** (lanjutan keputusan 1 di 1B, spec §3 "langsung (RLS)").
   - Server function memakai client berbasis cookie atas nama anggota, sehingga RLS tetap berlaku.
   - Dengan cara ini tidak ada dua pihak (server dan browser) yang sama-sama memperbarui token sesi.
   - Penulisan posisi baca memakai `saveProgressFn` dengan opsi `fetch` kustom (`keepalive: true`) saat halaman ditutup. Tidak perlu endpoint terpisah untuk `sendBeacon`.
2. **Tanpa TanStack Query** (spec §3 dan §11).
   - Rak disimpan sebagai salinan (snapshot) di IndexedDB setiap kali tampil online.
   - Loader `/shelf` memakai salinan itu saat offline.
   - Hasilnya sama dengan cache Query yang dipersist, tanpa dependensi dan refactor baru.
3. **Service worker ditulis sendiri, tanpa Workbox** (spec §11).
   - Template `pwa/sw.template.js` diisi daftar precache oleh `scripts/build-sw.mjs` setelah `vite build`.
   - Precache berisi shell, semua aset build (JS, CSS, font woff2), ikon, dan gambar lobi.
   - Navigasi selalu ke jaringan dulu, dengan shell sebagai cadangan. **HTML halaman anggota tidak pernah disimpan di Cache Storage**, sehingga tidak ada data pribadi di sana.
   - Cover memakai strategi cache-first, dengan kunci path tanpa token.
   - EPUB tidak lewat cache service worker, karena disimpan di IndexedDB.
4. **Offline memakai shell SPA TanStack Start** (`tanstackStart({ spa: { enabled: true } })` → `dist/client/_shell.html`, hanya root route).
   - Saat prerender shell, `beforeLoad` root mengembalikan `user: undefined` ("belum diketahui"), bukan `null`.
   - Di browser, guard route memanggil `resolveUser()`: bertanya ke server, atau jika offline memakai anggota terakhir yang tercatat di `localStorage`.
   - SSR biasa tidak berubah. Spike pada 2026-10-16 memastikan shell yang disajikan untuk `/shelf` ter-hidrasi dan merender rak.
   - Saat `user` belum diketahui, backdrop adegan disembunyikan, karena shell di-render untuk path `/` dan isinya akan berbeda dari halaman lain (error hidrasi React #418 dalam spike).
5. **Setiap buku yang dibuka otomatis disimpan di perangkat** (spec §9).
   - Tombol "Simpan offline" di Detail Buku mengunduh buku tanpa membukanya.
   - Penanda "Tersedia offline" berarti file EPUB ada di IndexedDB perangkat ini.
6. **Keluar dan hapus akun membersihkan perangkat.** Ini tidak ada di spec dan ditambahkan demi privasi di perangkat bersama.
   - Sebelum keluar, posisi yang masih menunggu dikirim lebih dulu (paling lama 3 detik).
   - Setelah itu buku lokal, posisi, salinan rak, cover di cache, setelan baca, dan sesi tersimpan dihapus.
   - Jika anggota lain masuk di perangkat yang sama tanpa keluar lebih dulu, data anggota sebelumnya dihapus saat layout anggota pertama kali tampil (`claimLocalData`).
7. **`last_opened_at` diperbarui oleh `markBookOpenedFn` saat buku dibuka online.** Membuka buku saat offline tidak mengubahnya.
8. **Posisi pembuka tidak disimpan.** Posisi baru disimpan setelah anggota benar-benar berinteraksi dengan reader (tombol, ketukan, roda, sentuhan, daftar isi, slider, atau "Lompat").
   - Event `relocate` saat buku dibuka atau saat tata letak berubah bukan kegiatan membaca.
   - Jika ikut disimpan, posisi lama di perangkat ini bisa menimpa posisi yang lebih baru dari perangkat lain sebelum anggota memilih "Lompat".
9. **Perangkat tanpa posisi lokal dianggap berada di 0%, dengan waktu paling awal.** Akibatnya, perangkat baru tetap mendapat tawaran "Lanjutkan dari …%" (sesuai skenario E2E di spec §13). Aplikasi tidak pernah melompat otomatis.
10. **foliate hanya dipakai untuk EPUB.** Plugin Vite `glosa:foliate-epub-only` mengganti modul PDF, MOBI, FB2, komik, TTS, serta `vendor/zip.js` dan `vendor/fflate.js` milik foliate dengan modul kosong.
    - Buku dibuka dengan loader zip milik Glosa (dari 1B), lalu objek bukunya diberikan ke `view.open(book)`.
    - Dengan begitu pdf.js (± 3 MB) tidak ikut build dan precache.
    - `foliate-js` dikeluarkan dari `optimizeDeps`, supaya plugin itu juga berlaku saat dev.
11. **Huruf reader:**
    - Serif: Libre Caslon Text.
    - Sans: Atkinson Hyperlegible.
    - Ramah disleksia: OpenDyslexic (`@fontsource/opendyslexic`).

    File woff2 diimpor dengan `?url` dan disuntikkan ke iframe buku sebagai `@font-face` dengan URL absolut. URL harus absolut karena dokumen buku adalah `blob:` URL.
12. **Penyimpanan perangkat penuh** (spec §12).
    - Saat menyimpan buku dan muncul `QuotaExceededError`, salinan lokal yang paling lama tidak dibuka dihapus satu per satu (bukan file di server), lalu penyimpanan dicoba lagi.
    - Jika tetap tidak muat, buku tetap dibaca dari memori dengan keterangan "Penyimpanan perangkat penuh…".
13. **Progres di rak memakai posisi di perangkat ini jika ada.** Jika tidak ada, rak memakai persentase dari server.
14. **Cover yang URL-nya kedaluwarsa** (sisa dari 1B, spec §12): `BookCover` menampilkan sampul polos berjudul saat gambar gagal dimuat. Cover yang pernah tampil disajikan service worker dari cache tanpa token.
15. **Tetap di 1D:**
    - lobi isometrik dengan "Meja Baca → buka buku terakhir", termasuk bab terakhir di Detail Buku versi panel lobi;
    - Sentry;
    - sapuan Storage berkala;
    - pengaturan header cache untuk `sw.js` di Caddy.

## Global Constraints

- Node.js **≥ 24**. Package manager: **npm**.
- **Supabase Cloud saja**, tanpa Supabase lokal/Docker. Semua test memakai **proyek dev**.
- Teks UI dalam **bahasa Indonesia**, path URL dalam bahasa Inggris.
- **Secret key Supabase hanya dipakai di server**, di kode test, atau di secret CI. Jangan pernah dipakai di kode client atau diberi prefix `VITE_`.
- `reading_progress`: client hanya boleh **select** baris miliknya. Tidak ada insert, update, atau delete langsung. Penulisan hanya lewat `save_progress(p_book_id, p_cfi, p_percentage, p_updated_at)`, yang:
  - memakai `auth.uid()`;
  - hanya untuk buku `ready` milik anggota;
  - hanya menimpa jika `updated_at` lebih baru;
  - memotong waktu dari masa depan menjadi `now()`.
- Posisi: `cfi` 1–**2000** karakter, `percentage` **0–100** (dua desimal), `updatedAt` ISO 8601. Satu panggilan `saveProgressFn` maksimal **50** entri.
- Debounce kirim posisi **5000 ms**. Status "Belum tersinkron" muncul jika ada posisi yang belum terkirim karena offline atau setelah **3** kali gagal berturut-turut.
- Tawaran lompat hanya muncul jika posisi server lebih baru **dan** berbeda **lebih dari 1** poin persen.
- Nilai setelan baca (`profiles.reader_settings`):
  - `font` `serif | sans | dyslexic`;
  - `fontSize` 80–200 kelipatan 10;
  - `lineHeight` 1.2–2.0 kelipatan 0.1;
  - `margin` `narrow | normal | wide`;
  - `theme` `light | sepia | dark`;
  - `flow` `paginated | scrolled`.

  Default: `serif`, 100, 1.5, `normal`, `sepia`, `paginated`. Nilai tersimpan yang tidak valid diganti default per kolom.
- Kunci penyimpanan lokal (persis): `localStorage` `glosa:user` dan `glosa:reader-settings`, cache `glosa-covers`, database IndexedDB `glosa`.
- Teks UI (persis):
  - "Mulai membaca"
  - "Lanjutkan membaca · {n}%"
  - "Simpan offline", "Hapus dari perangkat"
  - "Tersimpan untuk offline.", "Salinan di perangkat ini dihapus.", "Tersedia offline"
  - "Kamu sedang offline. Rak ditampilkan dari salinan terakhir di perangkat ini."
  - "Butuh internet."
  - "Lanjutkan dari {n}% (dibaca di perangkat lain)?", "Lompat", "Abaikan"
  - "Belum tersinkron"
  - "Daftar isi", "Tampilan", "Kembali ke rak"
  - "Menyiapkan buku…"
- Pesan error (persis, lewat `bookMessage`):
  - `offline_not_saved`: "Buku ini belum tersimpan di perangkat ini. Sambungkan internet untuk membukanya."
  - `offline_no_shelf`: "Rakmu belum tersimpan di perangkat ini. Sambungkan internet untuk membukanya."
  - `download_failed`: "Buku gagal diunduh. Coba lagi."
  - `device_full`: "Penyimpanan perangkat penuh. Buku ini tetap bisa dibaca, tapi tidak tersimpan untuk offline."
  - `device_full_offline`: "Penyimpanan perangkat penuh. Buku ini tidak bisa disimpan untuk offline."
- Tampilan reader tetap bersih. Nuansa perpustakaan hanya ada di bingkai (toolbar dan panel), tidak di halaman teks (spec §9).
- Jangan menampilkan menu, tombol, atau label untuk fitur tahap berikutnya atau rencana 1D. Tidak boleh ada tombol mati.
- Semua animasi dimatikan saat `prefers-reduced-motion: reduce`.
- Gaya kode mengikuti starter:
  - Prettier dengan kutip ganda dan tanpa titik koma.
  - ESLint `@tanstack/eslint-config`.
  - Alias `@/*` → `src/*`, dan `cn` dari `@/lib/utils`.
  - `import type` / modifier `type` (`verbatimModuleSyntax`).
- Gunakan elemen semantik, bukan atribut `role`, jika elemennya ada:
  - `<output>` untuk pesan status;
  - `<progress>` untuk bar progres baca;
  - `<input type="range">` untuk slider;
  - `<fieldset>` + `<legend>` untuk kelompok pilihan.
  - `role="alert"` tetap dipakai untuk pesan error.
- Semua server function baru memvalidasi input dengan **Zod** di `.validator(...)`.
- Semua handler aksi di UI membungkus panggilan server function dengan try/catch, sehingga error tidak pernah dibiarkan lolos tanpa ditangani.
- Kode yang menyentuh `window`, `navigator`, `localStorage`, IndexedDB, atau Cache Storage hanya dijalankan di browser: di effect, di loader route `ssr: false`, atau di belakang `import.meta.env.SSR`.
- Semua email user uji berisi `e2e-` atau dibuat dengan `run` unik di `tests/db`, berakhiran `@glosa.test`, lalu **dihapus** bersama objek Storage-nya setelah test selesai.

## Langkah manual pemilik proyek

Tidak ada. Tabel dan fungsi dibuat lewat migrasi. Test offline memakai `vite preview` lokal, jadi tidak perlu domain atau HTTPS (`localhost` dianggap aman oleh browser).

## Struktur file

```
supabase/migrations/20261017000100_reading_progress.sql   tabel reading_progress, RLS, save_progress
src/lib/reader-types.ts              Position, ProgressEntry, PositionStore, ReaderBook, ReadingState, TocItem
src/lib/reader-settings.ts           nilai/label setelan, parseReaderSettings, readerCss
src/lib/progress.ts                  toPercentage, formatPercent, jumpOffer, ProgressEntrySchema
src/lib/local/keys.ts                kunci localStorage/cache
src/lib/local/db.ts                  database Dexie "glosa"
src/lib/local/book-files.ts          file EPUB lokal + eviction
src/lib/local/positions.ts           posisi lokal + localPositionStore
src/lib/local/shelf-snapshot.ts      salinan rak per anggota
src/lib/local/device.ts              claimLocalData, clearLocalData, requestPersistence
src/lib/progress-sync.ts             mesin sinkron (murni)
src/lib/progress-sync-client.ts      singleton browser, useProgressFlush, useSyncStatus, leaveDevice
src/lib/session-cache.ts             anggota terakhir di localStorage
src/lib/current-user.ts              currentUser, browserUser, resolveUser
src/lib/book-download.ts             BookLoadError, downloadBook, saveBookOffline
src/lib/reader-settings-cache.ts     cache setelan baca + initialReaderSettings
src/lib/shelf-loader.ts              loadShelf (server atau salinan offline)
src/lib/pwa.ts                       registerServiceWorker
src/lib/epub/zip-loader.ts           openZip + EpubError (dipindah dari read-epub.ts)
src/lib/epub/open-book.ts            openBookFile untuk reader
src/server/reading.ts                readingStateFn, bookFileUrlFn, markBookOpenedFn, saveProgressFn, saveReaderSettingsFn
src/components/reader/               ReaderView, reader-input, reader-fonts, load-reader, useReaderSettings,
                                     ReaderToolbar, ReaderFooter, TocPanel, ReaderSettingsPanel, JumpOffer
src/components/shelf/useLocalShelf.ts  status lokal rak (offline + progres)
src/components/shelf/ReadLink.tsx    tombol Mulai/Lanjutkan membaca
src/routes/_member/read.$bookId.tsx  route reader (ssr: false)
pwa/sw.template.js                   service worker (template)
scripts/build-sw.mjs                 menulis dist/client/sw.js
e2e/helpers/books.ts                 seedBook, storedPercentage, readerSettingsOf
e2e/reader.spec.ts                   reader + sinkron (dev server)
e2e/offline.spec.ts                  offline (vite preview)
tests/db/progress.test.ts            RLS + save_progress
```

---
### Task 1: Tabel `reading_progress` dan fungsi `save_progress`

**Files:**
- Create: `supabase/migrations/20261017000100_reading_progress.sql`
- Modify: `src/server/database.types.ts` (dibuat ulang dengan `npm run db:types`)
- Test: `tests/db/progress.test.ts`

**Interfaces:**
- Consumes: tabel `books` dan RPC `reserve_book_upload` dari 1B (dipakai test untuk membuat buku).
- Produces:
  - tabel `public.reading_progress (user_id, book_id, cfi, percentage, updated_at)`;
  - RPC `save_progress(p_book_id uuid, p_cfi text, p_percentage numeric, p_updated_at timestamptz) returns boolean` untuk `authenticated`. Nilai kembaliannya `true` jika posisi disimpan. Error `not_found` dan `not_authenticated` memakai errcode `P0001`;
  - tipe hasil generate `Database["public"]["Functions"]["save_progress"]`.

- [ ] **Step 1: Tulis test database yang gagal**

Buat `tests/db/progress.test.ts`:

```ts
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  adminClient,
  anonClient,
  createTestMember,
  deleteTestMembers,
  signedInClient,
} from "./helpers"

const run = Date.now().toString(36)
const emails = {
  ani: `db-progress-ani-${run}@glosa.test`,
  budi: `db-progress-budi-${run}@glosa.test`,
}
const newSha = () => `${randomUUID()}${randomUUID()}`.replaceAll("-", "")
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()
type Client = Awaited<ReturnType<typeof signedInClient>>

async function newBook(userId: string, ready: boolean): Promise<string> {
  const bookId = randomUUID()
  const { error } = await adminClient()
    .rpc("reserve_book_upload", {
      p_user_id: userId,
      p_book_id: bookId,
      p_sha256: newSha(),
      p_epub_bytes: 1000,
      p_title: "Buku Uji",
      p_author: "Penulis Uji",
      p_subjects: [],
    })
    .single()
  if (error) throw error
  if (ready) {
    const { error: updateError } = await adminClient()
      .from("books")
      .update({ status: "ready" })
      .eq("id", bookId)
    if (updateError) throw updateError
  }
  return bookId
}

function save(
  client: Client,
  bookId: string,
  cfi: string,
  percentage: number,
  updatedAt: string
) {
  return client.rpc("save_progress", {
    p_book_id: bookId,
    p_cfi: cfi,
    p_percentage: percentage,
    p_updated_at: updatedAt,
  })
}

async function storedFor(bookId: string) {
  const { data, error } = await adminClient()
    .from("reading_progress")
    .select("cfi, percentage, updated_at")
    .eq("book_id", bookId)
    .maybeSingle()
  if (error) throw error
  return data
}

describe("reading progress", () => {
  const ids = { ani: "", budi: "" }
  const books = { ani: "", aniPending: "", budi: "" }
  let ani: Client
  let budi: Client

  beforeAll(async () => {
    ids.ani = (await createTestMember({ email: emails.ani })).id
    ids.budi = (await createTestMember({ email: emails.budi })).id
    books.ani = await newBook(ids.ani, true)
    books.aniPending = await newBook(ids.ani, false)
    books.budi = await newBook(ids.budi, true)
    ani = await signedInClient(emails.ani)
    budi = await signedInClient(emails.budi)
  })

  afterAll(async () => {
    await deleteTestMembers()
  })

  it("keeps the newest position", async () => {
    const first = await save(ani, books.ani, "epubcfi(/6/4!/4/2)", 12.5, at(-60_000))
    expect(first.error).toBeNull()
    expect(first.data).toBe(true)

    const older = await save(ani, books.ani, "epubcfi(/6/2!/4/2)", 3, at(-120_000))
    expect(older.error).toBeNull()
    expect(older.data).toBe(false)
    expect(await storedFor(books.ani)).toMatchObject({
      cfi: "epubcfi(/6/4!/4/2)",
      percentage: 12.5,
    })

    const newer = await save(ani, books.ani, "epubcfi(/6/8!/4/2)", 40, at(-30_000))
    expect(newer.data).toBe(true)
    expect(await storedFor(books.ani)).toMatchObject({
      cfi: "epubcfi(/6/8!/4/2)",
      percentage: 40,
    })
  })

  it("clamps a timestamp from the future to the database clock", async () => {
    const future = await save(
      ani,
      books.ani,
      "epubcfi(/6/10!/4/2)",
      50,
      "2100-01-01T00:00:00Z"
    )
    expect(future.data).toBe(true)
    const stored = await storedFor(books.ani)
    expect(new Date(stored!.updated_at).getFullYear()).toBeLessThan(2100)

    // A later save from a device with a correct clock still wins.
    const later = await save(ani, books.ani, "epubcfi(/6/12!/4/2)", 55, at(60_000))
    expect(later.data).toBe(true)
  })

  it("lets members read only their own positions", async () => {
    const { data: own, error } = await ani.from("reading_progress").select("book_id")
    expect(error).toBeNull()
    expect(own?.map((row) => row.book_id)).toEqual([books.ani])

    const { data: others } = await budi
      .from("reading_progress")
      .select("book_id")
      .eq("book_id", books.ani)
    expect(others).toEqual([])
  })

  it("refuses positions for other members' books, unready books and guests", async () => {
    const foreign = await save(budi, books.ani, "epubcfi(/6/4!/4/2)", 1, at(0))
    expect(foreign.error?.message).toBe("not_found")

    const pending = await save(ani, books.aniPending, "epubcfi(/6/4!/4/2)", 1, at(0))
    expect(pending.error?.message).toBe("not_found")

    const guest = await save(anonClient(), books.ani, "epubcfi(/6/4!/4/2)", 1, at(0))
    expect(guest.error?.code).toBe("42501")
  })

  it("rejects direct writes and invalid values", async () => {
    const insert = await budi.from("reading_progress").insert({
      user_id: ids.budi,
      book_id: books.budi,
      cfi: "epubcfi(/6/4!/4/2)",
      percentage: 1,
      updated_at: at(0),
    })
    expect(insert.error?.code).toBe("42501")

    const update = await ani
      .from("reading_progress")
      .update({ percentage: 99 })
      .eq("book_id", books.ani)
    expect(update.error?.code).toBe("42501")

    const remove = await ani
      .from("reading_progress")
      .delete()
      .eq("book_id", books.ani)
    expect(remove.error?.code).toBe("42501")

    const tooFar = await save(budi, books.budi, "epubcfi(/6/4!/4/2)", 101, at(0))
    expect(tooFar.error?.code).toBe("23514")
    const empty = await save(budi, books.budi, "", 1, at(0))
    expect(empty.error?.code).toBe("23514")
  })

  it("removes positions together with their book", async () => {
    const saved = await save(budi, books.budi, "epubcfi(/6/4!/4/2)", 5, at(0))
    expect(saved.data).toBe(true)

    const { error } = await adminClient().from("books").delete().eq("id", books.budi)
    expect(error).toBeNull()
    expect(await storedFor(books.budi)).toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run --config vitest.db.config.ts tests/db/progress.test.ts`
Expected: FAIL. Tabel `reading_progress` dan fungsi `save_progress` belum ada, sehingga muncul error PostgREST "Could not find the table" / "Could not find the function". TypeScript belum tahu nama-nama itu, tapi Vitest tetap menjalankan test-nya.

- [ ] **Step 3: Tulis migrasi**

Buat `supabase/migrations/20261017000100_reading_progress.sql`:

```sql
-- Reading positions (spec §4, §10): one row per member and book. Members read
-- their own rows; every write goes through save_progress, where the newest
-- position wins.
create table public.reading_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  cfi text not null check (char_length(cfi) between 1 and 2000),
  percentage numeric(5, 2) not null check (percentage between 0 and 100),
  updated_at timestamptz not null,
  primary key (user_id, book_id)
);

create index reading_progress_book_id_idx on public.reading_progress (book_id);

alter table public.reading_progress enable row level security;

create policy reading_progress_select_own on public.reading_progress
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.reading_progress from anon, authenticated;
grant select on table public.reading_progress to authenticated;

-- Saves the member's position in one of their ready books unless a newer one is
-- already stored ("newest wins", by the reading device's clock). A timestamp
-- from the future is clamped to now(), so a device with a fast clock cannot
-- freeze the position. Returns whether the position was stored.
create function public.save_progress(
  p_book_id uuid,
  p_cfi text,
  p_percentage numeric,
  p_updated_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated_at timestamptz := least(p_updated_at, now());
  v_rows integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from public.books
    where id = p_book_id and user_id = v_user_id and status = 'ready'
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.reading_progress as rp (user_id, book_id, cfi, percentage, updated_at)
  values (v_user_id, p_book_id, p_cfi, p_percentage, v_updated_at)
  on conflict (user_id, book_id) do update
    set cfi = excluded.cfi,
        percentage = excluded.percentage,
        updated_at = excluded.updated_at
    where rp.updated_at < excluded.updated_at;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke execute on function public.save_progress(uuid, text, numeric, timestamptz)
  from public, anon;
grant execute on function public.save_progress(uuid, text, numeric, timestamptz)
  to authenticated;
```

- [ ] **Step 4: Terapkan migrasi, buat ulang tipe, dan jalankan test**

Run: `npm run db:push && npm run db:types && npm run test:db`
Expected:
- migrasi `20261017000100_reading_progress.sql` diterapkan;
- `src/server/database.types.ts` memuat `reading_progress` dan `save_progress`;
- semua test DB lulus, yaitu 31 test: 25 lama + 6 baru.

Lalu jalankan `npm run typecheck && npm run lint && npm run check`. Expected: bersih. Jika Prettier mengeluh soal `tests/db/progress.test.ts`, jalankan `npx prettier --write tests/db/progress.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261017000100_reading_progress.sql src/server/database.types.ts tests/db/progress.test.ts
git commit -m "feat(db): add reading progress with newest-wins save_progress"
```

---
### Task 2: Logika murni — tipe reader, setelan baca, dan posisi

**Files:**
- Create: `src/lib/reader-types.ts`, `src/lib/reader-settings.ts`, `src/lib/progress.ts`
- Test: `src/lib/reader-settings.test.ts`, `src/lib/progress.test.ts`

**Interfaces:**
- Consumes: tidak ada.
- Produces (dipakai semua task berikutnya):
  - `reader-types.ts`:
    - `Position = { cfi: string; percentage: number; updatedAt: string }`
    - `ProgressEntry = Position & { bookId: string }`
    - `PositionStore = { put(entry): Promise<void>; pending(): Promise<Array<ProgressEntry>>; markSynced(entries): Promise<void> }`
    - `ReaderBook = { id: string; title: string; author: string }`
    - `ReadingState = { ok: true; book: ReaderBook; progress: Position | null; settings: ReaderSettings } | { ok: false; code: string }`
    - `BookFileTicket = { ok: true; url: string } | { ok: false; code: string }`
    - `TocItem = { label: string; href: string; subitems?: Array<TocItem> | null }`
  - `reader-settings.ts`:
    - nilai: `READER_FONTS`, `READER_THEMES`, `READER_MARGINS`, `READER_FLOWS`, `FONT_SIZE`, `LINE_HEIGHT`;
    - tipe: `ReaderSettings`, `ReaderFont`, `ReaderTheme`, `ReaderMargin`, `ReaderFlow`, `FontSources`;
    - `DEFAULT_READER_SETTINGS`, `ReaderSettingsSchema`, `parseReaderSettings(value: unknown): ReaderSettings`;
    - `stepFontSize(current, direction)`, `stepLineHeight(current, direction)`;
    - label: `FONT_LABELS`, `THEME_LABELS`, `MARGIN_LABELS`, `FLOW_LABELS`;
    - `THEME_COLORS`, `MARGIN_GAP`, `readerCss(settings, fonts): string`.
  - `progress.ts`:
    - `MAX_PROGRESS_BATCH = 50`, `MAX_CFI_LENGTH = 2000`, `JUMP_THRESHOLD = 1`, `ProgressEntrySchema`;
    - `toPercentage(fraction: number): number`, `formatPercent(percentage: number): string`;
    - `jumpOffer(local: Position | null, server: Position | null): Position | null`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/progress.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { ProgressEntrySchema, formatPercent, jumpOffer, toPercentage } from "./progress"

const position = (percentage: number, updatedAt: string) => ({
  cfi: `epubcfi(/6/${Math.round(percentage)}!/4/2)`,
  percentage,
  updatedAt,
})

describe("toPercentage", () => {
  it("turns foliate's fraction into a percentage with two decimals", () => {
    expect(toPercentage(0.4567)).toBe(45.67)
    expect(toPercentage(1 / 3)).toBe(33.33)
    expect(toPercentage(-1)).toBe(0)
    expect(toPercentage(2)).toBe(100)
    expect(toPercentage(Number.NaN)).toBe(0)
  })
})

describe("formatPercent", () => {
  it("shows whole percents, rounded down", () => {
    expect(formatPercent(45.99)).toBe("45%")
    expect(formatPercent(100)).toBe("100%")
  })
})

describe("jumpOffer", () => {
  const earlier = "2026-10-17T08:00:00.000Z"
  const later = "2026-10-17T09:00:00.000Z"

  it("offers a newer server position more than one point away", () => {
    const server = position(47, later)
    expect(jumpOffer(position(45, earlier), server)).toBe(server)
  })

  it("stays quiet when the server is not newer", () => {
    expect(jumpOffer(position(10, later), position(50, earlier))).toBeNull()
    expect(jumpOffer(position(10, later), position(50, later))).toBeNull()
  })

  it("stays quiet when the positions are within one point", () => {
    expect(jumpOffer(position(45, earlier), position(45.8, later))).toBeNull()
  })

  it("treats a device without a position as 0% from the beginning of time", () => {
    const server = position(3, earlier)
    expect(jumpOffer(null, server)).toBe(server)
    expect(jumpOffer(null, position(0.5, earlier))).toBeNull()
  })

  it("offers nothing without a server position", () => {
    expect(jumpOffer(position(10, earlier), null)).toBeNull()
  })
})

describe("ProgressEntrySchema", () => {
  const entry = {
    bookId: "0f9f5c1e-8a4b-4c2e-9d3a-1b2c3d4e5f60",
    cfi: "epubcfi(/6/4!/4/2)",
    percentage: 12.5,
    updatedAt: "2026-10-17T08:00:00.000Z",
  }

  it("accepts a valid entry", () => {
    expect(ProgressEntrySchema.safeParse(entry).success).toBe(true)
  })

  it("rejects out-of-range or malformed values", () => {
    expect(ProgressEntrySchema.safeParse({ ...entry, percentage: 101 }).success).toBe(false)
    expect(ProgressEntrySchema.safeParse({ ...entry, cfi: "" }).success).toBe(false)
    expect(ProgressEntrySchema.safeParse({ ...entry, bookId: "buku" }).success).toBe(false)
    expect(ProgressEntrySchema.safeParse({ ...entry, updatedAt: "kemarin" }).success).toBe(false)
  })
})
```

Buat `src/lib/reader-settings.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  DEFAULT_READER_SETTINGS,
  type FontSources,
  parseReaderSettings,
  readerCss,
  stepFontSize,
  stepLineHeight,
} from "./reader-settings"

const face = (family: string) => ({
  family,
  fallback: "serif",
  regular: `https://glosa.test/${family}-400.woff2`,
  bold: `https://glosa.test/${family}-700.woff2`,
  italic: `https://glosa.test/${family}-400i.woff2`,
})
const fonts: FontSources = {
  serif: face("Glosa Serif"),
  sans: face("Glosa Sans"),
  dyslexic: face("Glosa Dyslexic"),
}

describe("parseReaderSettings", () => {
  it("fills in defaults for an empty or missing value", () => {
    expect(parseReaderSettings({})).toEqual(DEFAULT_READER_SETTINGS)
    expect(parseReaderSettings(null)).toEqual(DEFAULT_READER_SETTINGS)
    expect(parseReaderSettings("dark")).toEqual(DEFAULT_READER_SETTINGS)
  })

  it("keeps every valid field and replaces the invalid ones", () => {
    expect(
      parseReaderSettings({ theme: "dark", fontSize: 140, font: "comic", lineHeight: 9 })
    ).toEqual({ ...DEFAULT_READER_SETTINGS, theme: "dark", fontSize: 140 })
  })
})

describe("steppers", () => {
  it("moves the font size by 10 within 80–200", () => {
    expect(stepFontSize(100, 1)).toBe(110)
    expect(stepFontSize(200, 1)).toBe(200)
    expect(stepFontSize(80, -1)).toBe(80)
  })

  it("moves the line height by 0.1 within 1.2–2.0, without float noise", () => {
    expect(stepLineHeight(1.5, 1)).toBe(1.6)
    expect(stepLineHeight(2, 1)).toBe(2)
    expect(stepLineHeight(1.2, -1)).toBe(1.2)
    expect(stepLineHeight(1.3, -1)).toBe(1.2)
  })
})

describe("readerCss", () => {
  it("loads the chosen font and applies size, spacing and theme", () => {
    const css = readerCss(
      { ...DEFAULT_READER_SETTINGS, font: "dyslexic", fontSize: 130, lineHeight: 1.8, theme: "dark" },
      fonts
    )
    expect(css).toContain('font-family: "Glosa Dyslexic"')
    expect(css).toContain('url("https://glosa.test/Glosa Dyslexic-400.woff2")')
    expect(css).toContain("font-size: 130% !important")
    expect(css).toContain("line-height: 1.8 !important")
    expect(css).toContain("color-scheme: dark")
    expect(css).toContain("background: #0b1518 !important")
  })

  it("uses a light colour scheme for the sepia theme", () => {
    const css = readerCss(DEFAULT_READER_SETTINGS, fonts)
    expect(css).toContain("color-scheme: light")
    expect(css).toContain("background: #f6eedb !important")
    expect(css).toContain('font-family: "Glosa Serif"')
  })
})
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/lib/progress.test.ts src/lib/reader-settings.test.ts`
Expected: FAIL. Modul `./progress` dan `./reader-settings` belum ada.

- [ ] **Step 3: Tulis implementasi**

Buat `src/lib/reader-types.ts`:

```ts
import type { ReaderSettings } from "./reader-settings"

/** A reading position. `updatedAt` comes from the reading device's clock (spec §4). */
export type Position = { cfi: string; percentage: number; updatedAt: string }

export type ProgressEntry = Position & { bookId: string }

/** Where positions wait until the server has them (IndexedDB in the browser). */
export type PositionStore = {
  /** Stores the book's latest position and marks it as waiting to be sent. */
  put: (entry: ProgressEntry) => Promise<void>
  pending: () => Promise<Array<ProgressEntry>>
  /** Clears the waiting mark, unless the book moved again in the meantime. */
  markSynced: (entries: ReadonlyArray<ProgressEntry>) => Promise<void>
}

export type ReaderBook = { id: string; title: string; author: string }

export type ReadingState =
  | {
      ok: true
      book: ReaderBook
      progress: Position | null
      settings: ReaderSettings
    }
  | { ok: false; code: string }

export type BookFileTicket =
  | { ok: true; url: string }
  | { ok: false; code: string }

/** One table-of-contents entry, as foliate-js reads it from the EPUB. */
export type TocItem = {
  label: string
  href: string
  subitems?: Array<TocItem> | null
}
```

Buat `src/lib/progress.ts`:

```ts
import { z } from "zod"
import type { Position } from "./reader-types"

export const MAX_PROGRESS_BATCH = 50
export const MAX_CFI_LENGTH = 2000
/** Positions closer than this many percentage points count as the same place (spec §10). */
export const JUMP_THRESHOLD = 1

export const ProgressEntrySchema = z.object({
  bookId: z.uuid(),
  cfi: z.string().min(1).max(MAX_CFI_LENGTH),
  percentage: z.number().min(0).max(100),
  updatedAt: z.iso.datetime({ offset: true }),
})

/** foliate's 0–1 fraction as a percentage with two decimals, within 0–100. */
export function toPercentage(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0
  return Math.round(Math.min(Math.max(fraction, 0), 1) * 10_000) / 100
}

export function formatPercent(percentage: number): string {
  return `${Math.floor(percentage)}%`
}

const time = (position: Position) => Date.parse(position.updatedAt)

/**
 * The server position worth offering when a book opens (spec §10 step 5): it
 * must be newer than this device's position and more than one percentage point
 * away. A device without a position counts as 0% from the beginning of time, so
 * a new device is offered the other device's place (plan 1C, decision 9).
 */
export function jumpOffer(
  local: Position | null,
  server: Position | null
): Position | null {
  if (!server) return null
  const localTime = local ? time(local) : Number.NEGATIVE_INFINITY
  if (!(time(server) > localTime)) return null
  const localPercentage = local?.percentage ?? 0
  return Math.abs(server.percentage - localPercentage) > JUMP_THRESHOLD
    ? server
    : null
}
```

Buat `src/lib/reader-settings.ts`:

```ts
import { z } from "zod"

export const READER_FONTS = ["serif", "sans", "dyslexic"] as const
export const READER_THEMES = ["light", "sepia", "dark"] as const
export const READER_MARGINS = ["narrow", "normal", "wide"] as const
export const READER_FLOWS = ["paginated", "scrolled"] as const

export type ReaderFont = (typeof READER_FONTS)[number]
export type ReaderTheme = (typeof READER_THEMES)[number]
export type ReaderMargin = (typeof READER_MARGINS)[number]
export type ReaderFlow = (typeof READER_FLOWS)[number]

export const FONT_SIZE = { min: 80, max: 200, step: 10 } as const
export const LINE_HEIGHT = { min: 1.2, max: 2, step: 0.1 } as const

export type ReaderSettings = {
  font: ReaderFont
  /** Percent of the book's own size. */
  fontSize: number
  lineHeight: number
  margin: ReaderMargin
  theme: ReaderTheme
  flow: ReaderFlow
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  font: "serif",
  fontSize: 100,
  lineHeight: 1.5,
  margin: "normal",
  theme: "sepia",
  flow: "paginated",
}

export const ReaderSettingsSchema = z.object({
  font: z.enum(READER_FONTS),
  fontSize: z.number().int().min(FONT_SIZE.min).max(FONT_SIZE.max),
  lineHeight: z.number().min(LINE_HEIGHT.min).max(LINE_HEIGHT.max),
  margin: z.enum(READER_MARGINS),
  theme: z.enum(READER_THEMES),
  flow: z.enum(READER_FLOWS),
})

const SETTING_KEYS = Object.keys(DEFAULT_READER_SETTINGS) as Array<
  keyof ReaderSettings
>

/** Stored settings may be partial, outdated or `{}`: keep each valid field, default the rest. */
export function parseReaderSettings(value: unknown): ReaderSettings {
  const source =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {}
  const result: ReaderSettings = { ...DEFAULT_READER_SETTINGS }
  for (const key of SETTING_KEYS) {
    const parsed = ReaderSettingsSchema.shape[key].safeParse(source[key])
    if (parsed.success) Object.assign(result, { [key]: parsed.data })
  }
  return result
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function stepFontSize(current: number, direction: 1 | -1): number {
  return clamp(
    current + direction * FONT_SIZE.step,
    FONT_SIZE.min,
    FONT_SIZE.max
  )
}

export function stepLineHeight(current: number, direction: 1 | -1): number {
  const next = Math.round((current + direction * LINE_HEIGHT.step) * 10) / 10
  return clamp(next, LINE_HEIGHT.min, LINE_HEIGHT.max)
}

export const FONT_LABELS: Record<ReaderFont, string> = {
  serif: "Serif",
  sans: "Sans",
  dyslexic: "Ramah disleksia",
}
export const THEME_LABELS: Record<ReaderTheme, string> = {
  light: "Terang",
  sepia: "Sepia",
  dark: "Gelap",
}
export const MARGIN_LABELS: Record<ReaderMargin, string> = {
  narrow: "Sempit",
  normal: "Sedang",
  wide: "Lebar",
}
export const FLOW_LABELS: Record<ReaderFlow, string> = {
  paginated: "Halaman",
  scrolled: "Gulir",
}

export const THEME_COLORS: Record<
  ReaderTheme,
  { background: string; text: string; link: string }
> = {
  light: { background: "#ffffff", text: "#1c1b19", link: "#1d4ed8" },
  sepia: { background: "#f6eedb", text: "#2b2118", link: "#7a2e2e" },
  dark: { background: "#0b1518", text: "#d8e4e1", link: "#2fe0b8" },
}

/** foliate's paginator `gap`: the space beside the text, as a share of the page width. */
export const MARGIN_GAP: Record<ReaderMargin, string> = {
  narrow: "4%",
  normal: "7%",
  wide: "12%",
}

export type FontFace = {
  family: string
  fallback: string
  regular: string
  bold: string
  italic: string
}
export type FontSources = Record<ReaderFont, FontFace>

/** The stylesheet foliate puts into every section of the book (spec §9). */
export function readerCss(
  settings: ReaderSettings,
  fonts: FontSources
): string {
  const colors = THEME_COLORS[settings.theme]
  const face = fonts[settings.font]
  const fontFace = (url: string, weight: number, style: string) =>
    `@font-face { font-family: "${face.family}"; src: url("${url}") format("woff2"); font-weight: ${weight}; font-style: ${style}; }`
  return [
    fontFace(face.regular, 400, "normal"),
    fontFace(face.bold, 700, "normal"),
    fontFace(face.italic, 400, "italic"),
    `html { color-scheme: ${settings.theme === "dark" ? "dark" : "light"}; background: ${colors.background} !important; color: ${colors.text} !important; font-size: ${settings.fontSize}% !important; }`,
    `body { background: transparent !important; color: inherit !important; font-family: "${face.family}", ${face.fallback} !important; }`,
    "body *:not(code, kbd, pre, samp, tt, code *, pre *) { font-family: inherit !important; }",
    "body *:not(img, svg, video, canvas) { color: inherit !important; background-color: transparent !important; }",
    `p, li, blockquote, dd, dt, td, th { line-height: ${settings.lineHeight} !important; }`,
    `a:link, a:visited { color: ${colors.link} !important; }`,
    "pre { white-space: pre-wrap !important; }",
  ].join("\n")
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run src/lib/progress.test.ts src/lib/reader-settings.test.ts`
Expected: PASS (semua test di dua file).

Lalu jalankan `npm run typecheck && npm run lint && npx prettier --write src/lib/progress.ts src/lib/progress.test.ts src/lib/reader-settings.ts src/lib/reader-settings.test.ts src/lib/reader-types.ts && npm run check`. Expected: bersih.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reader-types.ts src/lib/reader-settings.ts src/lib/reader-settings.test.ts src/lib/progress.ts src/lib/progress.test.ts
git commit -m "feat(reader): add reading settings and newest-position rules"
```

---
### Task 3: Penyimpanan lokal (Dexie)

**Files:**
- Modify: `package.json`, `package-lock.json`. Tambah dependensi `dexie@^4.4.6` dan devDependency `fake-indexeddb@^6.2.6`.
- Create: `src/lib/local/keys.ts`, `src/lib/local/db.ts`, `src/lib/local/book-files.ts`, `src/lib/local/positions.ts`, `src/lib/local/shelf-snapshot.ts`, `src/lib/local/device.ts`
- Test: `src/lib/local/local.test.ts`

**Interfaces:**
- Consumes: `ProgressEntry`, `Position`, `PositionStore` (Task 2), `ShelfData` (`src/lib/book-types.ts`, 1B).
- Produces:
  - `keys.ts`: `USER_KEY = "glosa:user"`, `READER_SETTINGS_KEY = "glosa:reader-settings"`, `COVER_CACHE = "glosa-covers"`.
  - `db.ts`: `localDb()`, yaitu database Dexie `glosa` dengan tabel `files`, `positions`, dan `meta`.
  - `book-files.ts`:
    - `getLocalBook(bookId, now?): Promise<Blob | null>`, yang sekaligus memperbarui `openedAt`;
    - `localBookIds(): Promise<Set<string>>`;
    - `saveLocalBook(bookId, blob, now?): Promise<boolean>`;
    - `removeLocalBook(bookId): Promise<void>`.
  - `positions.ts`: `getLocalPosition(bookId): Promise<Position | null>`, `localPercentages(): Promise<Map<string, number>>`, `removeLocalPosition(bookId)`, `localPositionStore: PositionStore`.
  - `shelf-snapshot.ts`: `saveShelfSnapshot(userId, data, now?)`, `loadShelfSnapshot(userId): Promise<ShelfData | null>`.
  - `device.ts`: `claimLocalData(userId)`, `clearLocalData()`, `requestPersistence()`.

- [ ] **Step 1: Pasang dependensi**

Run: `npm install dexie@^4.4.6 && npm install --save-dev fake-indexeddb@^6.2.6`
Expected: keduanya masuk ke `package.json` dan lockfile.

- [ ] **Step 2: Tulis test yang gagal**

Buat `src/lib/local/local.test.ts`. Test ini memakai environment `node`, karena `structuredClone` di Node bisa menyalin `Blob` ke `fake-indexeddb`, sedangkan `Blob` milik jsdom tidak bisa.

```ts
// @vitest-environment node
import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShelfData } from "@/lib/book-types"
import {
  getLocalBook,
  localBookIds,
  removeLocalBook,
  saveLocalBook,
} from "./book-files"
import { localDb } from "./db"
import { claimLocalData, clearLocalData } from "./device"
import {
  getLocalPosition,
  localPercentages,
  localPositionStore,
} from "./positions"
import { loadShelfSnapshot, saveShelfSnapshot } from "./shelf-snapshot"

const epub = (text: string) =>
  new Blob([text], { type: "application/epub+zip" })
const quotaError = () =>
  Object.assign(new Error("full"), { name: "QuotaExceededError" })
const entry = (bookId: string, updatedAt: string) => ({
  bookId,
  cfi: "epubcfi(/6/4!/4/2)",
  percentage: 12.5,
  updatedAt,
})
const shelf: ShelfData = {
  books: [],
  usage: { usedBytes: 0, limitBytes: 104857600, plan: "free" },
}

beforeEach(async () => {
  await clearLocalData()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("local books", () => {
  it("saves, reads and removes a book copy", async () => {
    expect(await saveLocalBook("a", epub("isi a"), 1)).toBe(true)
    const blob = await getLocalBook("a", 5)
    expect(await blob?.text()).toBe("isi a")
    expect((await localDb().files.get("a"))?.openedAt).toBe(5)
    expect(await localBookIds()).toEqual(new Set(["a"]))

    await removeLocalBook("a")
    expect(await getLocalBook("a")).toBeNull()
  })

  it("makes room by dropping the copy opened longest ago", async () => {
    await saveLocalBook("a", epub("a"), 1)
    await saveLocalBook("b", epub("b"), 2)
    await saveLocalBook("c", epub("c"), 3)
    await getLocalBook("a", 10)

    vi.spyOn(localDb().files, "put").mockRejectedValueOnce(quotaError())
    expect(await saveLocalBook("d", epub("d"), 11)).toBe(true)
    expect(await localBookIds()).toEqual(new Set(["a", "c", "d"]))
  })

  it("gives up when nothing else can be dropped", async () => {
    vi.spyOn(localDb().files, "put").mockRejectedValue(quotaError())
    expect(await saveLocalBook("a", epub("a"))).toBe(false)
  })

  it("rethrows other storage errors", async () => {
    vi.spyOn(localDb().files, "put").mockRejectedValueOnce(new Error("rusak"))
    await expect(saveLocalBook("a", epub("a"))).rejects.toThrow("rusak")
  })
})

describe("local positions", () => {
  it("keeps the latest position per book until it is synced", async () => {
    await localPositionStore.put(entry("a", "2026-10-17T08:00:00.000Z"))
    await localPositionStore.put(entry("a", "2026-10-17T08:05:00.000Z"))
    await localPositionStore.put(entry("b", "2026-10-17T08:01:00.000Z"))
    expect(await localPositionStore.pending()).toHaveLength(2)
    expect(await getLocalPosition("a")).toEqual({
      cfi: "epubcfi(/6/4!/4/2)",
      percentage: 12.5,
      updatedAt: "2026-10-17T08:05:00.000Z",
    })
    expect(await localPercentages()).toEqual(
      new Map([
        ["a", 12.5],
        ["b", 12.5],
      ])
    )

    await localPositionStore.markSynced([
      entry("a", "2026-10-17T08:05:00.000Z"),
      entry("b", "2026-10-17T07:00:00.000Z"),
    ])
    const pending = await localPositionStore.pending()
    expect(pending.map((row) => row.bookId)).toEqual(["b"])
  })
})

describe("shelf snapshot and device owner", () => {
  it("returns the snapshot only to the member it belongs to", async () => {
    await saveShelfSnapshot("u1", shelf)
    expect(await loadShelfSnapshot("u1")).toEqual(shelf)
    expect(await loadShelfSnapshot("u2")).toBeNull()
  })

  it("wipes another member's copies when a new member claims the device", async () => {
    await claimLocalData("u1")
    await saveLocalBook("a", epub("a"))
    await saveShelfSnapshot("u1", shelf)

    await claimLocalData("u1")
    expect(await localBookIds()).toEqual(new Set(["a"]))

    await claimLocalData("u2")
    expect(await localBookIds()).toEqual(new Set())
    expect(await loadShelfSnapshot("u1")).toBeNull()
  })
})
```

- [ ] **Step 3: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/lib/local/local.test.ts`
Expected: FAIL. Modul `./book-files` dan modul lainnya belum ada.

- [ ] **Step 4: Tulis implementasi**

Buat `src/lib/local/keys.ts`:

```ts
/**
 * Where a member's data lives on this device besides IndexedDB "glosa". The
 * cover cache name is repeated in pwa/sw.template.js.
 */
export const USER_KEY = "glosa:user"
export const READER_SETTINGS_KEY = "glosa:reader-settings"
export const COVER_CACHE = "glosa-covers"
```

Buat `src/lib/local/db.ts`:

```ts
import Dexie, { type EntityTable } from "dexie"

export type LocalFile = {
  bookId: string
  blob: Blob
  savedAt: number
  openedAt: number
}

export type LocalPosition = {
  bookId: string
  cfi: string
  percentage: number
  updatedAt: string
  /** 1 while the server does not have this position yet (booleans cannot be indexed). */
  pending: 0 | 1
}

export type LocalMeta = { key: string; value: unknown }

/** Everything Glosa keeps in IndexedDB for the member using this device (spec §3). */
class GlosaDb extends Dexie {
  files!: EntityTable<LocalFile, "bookId">
  positions!: EntityTable<LocalPosition, "bookId">
  meta!: EntityTable<LocalMeta, "key">

  constructor() {
    super("glosa")
    this.version(1).stores({
      files: "bookId, openedAt",
      positions: "bookId, pending",
      meta: "key",
    })
  }
}

let db: GlosaDb | null = null

/** Browser only: the server render never touches IndexedDB. */
export function localDb(): GlosaDb {
  db ??= new GlosaDb()
  return db
}
```

Buat `src/lib/local/book-files.ts`:

```ts
import { type LocalFile, localDb } from "./db"

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const inner = (error as { inner?: unknown }).inner
  return (
    error.name === "QuotaExceededError" ||
    (inner instanceof Error && inner.name === "QuotaExceededError")
  )
}

/** The stored EPUB, or null. Marks it as just opened, so eviction keeps it longest. */
export async function getLocalBook(
  bookId: string,
  now = Date.now()
): Promise<Blob | null> {
  const db = localDb()
  const file = await db.files.get(bookId)
  if (!file) return null
  await db.files.update(bookId, { openedAt: now })
  return file.blob
}

export async function localBookIds(): Promise<Set<string>> {
  return new Set(await localDb().files.toCollection().primaryKeys())
}

/**
 * Stores an EPUB for offline reading. When the device is full, the copies
 * opened longest ago are dropped one by one (only copies on this device, never
 * the member's files on the server) and the save is retried (spec §12).
 * Returns false when the book still does not fit.
 */
export async function saveLocalBook(
  bookId: string,
  blob: Blob,
  now = Date.now()
): Promise<boolean> {
  const db = localDb()
  const file: LocalFile = { bookId, blob, savedAt: now, openedAt: now }
  for (;;) {
    try {
      await db.files.put(file)
      return true
    } catch (error) {
      if (!isQuotaError(error)) throw error
      const oldest = await db.files
        .orderBy("openedAt")
        .filter((row) => row.bookId !== bookId)
        .first()
      if (!oldest) return false
      await db.files.delete(oldest.bookId)
    }
  }
}

export async function removeLocalBook(bookId: string): Promise<void> {
  await localDb().files.delete(bookId)
}
```

Buat `src/lib/local/positions.ts`:

```ts
import type {
  Position,
  PositionStore,
  ProgressEntry,
} from "@/lib/reader-types"
import { localDb } from "./db"

export async function getLocalPosition(
  bookId: string
): Promise<Position | null> {
  const row = await localDb().positions.get(bookId)
  return row
    ? { cfi: row.cfi, percentage: row.percentage, updatedAt: row.updatedAt }
    : null
}

/** The last percentage read on this device, per book. */
export async function localPercentages(): Promise<Map<string, number>> {
  const rows = await localDb().positions.toArray()
  return new Map(rows.map((row) => [row.bookId, row.percentage]))
}

export async function removeLocalPosition(bookId: string): Promise<void> {
  await localDb().positions.delete(bookId)
}

/** One waiting entry per book: the latest position read on this device. */
export const localPositionStore: PositionStore = {
  async put(entry) {
    await localDb().positions.put({
      bookId: entry.bookId,
      cfi: entry.cfi,
      percentage: entry.percentage,
      updatedAt: entry.updatedAt,
      pending: 1,
    })
  },

  async pending(): Promise<Array<ProgressEntry>> {
    const rows = await localDb().positions.where("pending").equals(1).toArray()
    return rows.map((row) => ({
      bookId: row.bookId,
      cfi: row.cfi,
      percentage: row.percentage,
      updatedAt: row.updatedAt,
    }))
  },

  async markSynced(entries) {
    const db = localDb()
    await db.transaction("rw", db.positions, async () => {
      for (const entry of entries) {
        const row = await db.positions.get(entry.bookId)
        if (row?.updatedAt === entry.updatedAt) {
          await db.positions.update(entry.bookId, { pending: 0 })
        }
      }
    })
  },
}
```

Buat `src/lib/local/shelf-snapshot.ts`:

```ts
import type { ShelfData } from "@/lib/book-types"
import { localDb } from "./db"

type Snapshot = { userId: string; data: ShelfData; savedAt: number }

const SNAPSHOT_KEY = "shelf"

/** Saves the shelf as it was last seen online, for offline visits (spec §11). */
export async function saveShelfSnapshot(
  userId: string,
  data: ShelfData,
  now = Date.now()
): Promise<void> {
  const value: Snapshot = { userId, data, savedAt: now }
  await localDb().meta.put({ key: SNAPSHOT_KEY, value })
}

/** The last shelf this member saw online; another member's snapshot is never returned. */
export async function loadShelfSnapshot(
  userId: string
): Promise<ShelfData | null> {
  const row = await localDb().meta.get(SNAPSHOT_KEY)
  const snapshot = row?.value as Snapshot | undefined
  return snapshot?.userId === userId ? snapshot.data : null
}
```

Buat `src/lib/local/device.ts`:

```ts
import { localDb } from "./db"
import { COVER_CACHE, READER_SETTINGS_KEY, USER_KEY } from "./keys"

const OWNER_KEY = "owner"

/** Drops the member's books, positions, shelf snapshot, cached covers and reader settings. */
async function wipeMemberData(): Promise<void> {
  const db = localDb()
  await db.transaction("rw", db.files, db.positions, db.meta, async () => {
    await Promise.all([db.files.clear(), db.positions.clear(), db.meta.clear()])
  })
  try {
    localStorage.removeItem(READER_SETTINGS_KEY)
  } catch {
    // No localStorage (private mode or tests): nothing to remove.
  }
  try {
    await caches.delete(COVER_CACHE)
  } catch {
    // No Cache Storage outside secure contexts: nothing to remove.
  }
}

/** On sign-out and account deletion: wipe everything, including the remembered member (plan 1C, decision 6). */
export async function clearLocalData(): Promise<void> {
  await wipeMemberData()
  try {
    localStorage.removeItem(USER_KEY)
  } catch {
    // No localStorage: nothing to remove.
  }
}

/**
 * Makes this device's data belong to `userId`. Another member's leftovers
 * (from a session that ended without signing out) are wiped first.
 */
export async function claimLocalData(userId: string): Promise<void> {
  const owner = await localDb().meta.get(OWNER_KEY)
  if (owner?.value === userId) return
  await wipeMemberData()
  await localDb().meta.put({ key: OWNER_KEY, value: userId })
}

/** Asks the browser to keep our storage, the first time a book is saved (spec §11). */
export async function requestPersistence(): Promise<void> {
  try {
    if (!("storage" in navigator) || !("persist" in navigator.storage)) return
    if (await navigator.storage.persisted()) return
    await navigator.storage.persist()
  } catch {
    // The browser decides; reading works either way.
  }
}
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `npx vitest run src/lib/local/local.test.ts`
Expected: PASS (7 test).

Lalu jalankan `npm run typecheck && npm run lint && npx prettier --write src/lib/local && npm run check && npm test`. Expected: bersih, dan semua unit test lulus.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/local
git commit -m "feat(local): keep books, positions and the shelf on this device"
```

---
### Task 4: Server function untuk membaca, dan progres di rak

**Files:**
- Create: `src/server/reading.ts`
- Modify:
  - `src/server/books.ts`: `listBooksFn` ikut membaca progres.
  - `src/lib/book-types.ts`: `ShelfBook.progress`.
  - `src/components/shelf/fixtures.ts`.
  - `src/lib/book-messages.ts`.
- Test: `src/lib/book-messages.test.ts`

**Interfaces:**
- Consumes:
  - `ReadingState`, `BookFileTicket`, `ProgressEntry` (Task 2);
  - `ProgressEntrySchema`, `MAX_PROGRESS_BATCH` (Task 2);
  - `ReaderSettingsSchema`, `parseReaderSettings`, `ReaderSettings` (Task 2);
  - `bookStorage` (1B);
  - RPC `save_progress` (Task 1).
- Produces:
  - `readingStateFn({ data: { bookId } }): Promise<ReadingState>` (GET);
  - `bookFileUrlFn({ data: { bookId } }): Promise<BookFileTicket>` (GET). URL bertanda tangan berlaku 1 jam dan ditandatangani dengan client anggota, sehingga RLS Storage berlaku;
  - `markBookOpenedFn({ data: { bookId } }): Promise<ActionResult>` (POST);
  - `saveProgressFn({ data: { entries }, fetch? }): Promise<ActionResult>` (POST). Posisi untuk buku yang sudah dihapus (`not_found`) dilewati. Error lain membuat seluruh panggilan gagal;
  - `saveReaderSettingsFn({ data: ReaderSettings }): Promise<ActionResult>` (POST);
  - `ShelfBook.progress: number | null`, yaitu persentase dari server, atau null jika belum pernah dibaca;
  - kode pesan baru di `bookMessage`: `offline_not_saved`, `offline_no_shelf`, `download_failed`, `device_full`, `device_full_offline`.

- [ ] **Step 1: Tulis test pesan yang gagal**

Di `src/lib/book-messages.test.ts`, tambahkan test berikut di dalam `describe("bookMessage", …)`, setelah test "explains each upload problem":

```ts
  it("explains reading and offline problems", () => {
    expect(bookMessage("offline_not_saved")).toBe(
      "Buku ini belum tersimpan di perangkat ini. Sambungkan internet untuk membukanya."
    )
    expect(bookMessage("offline_no_shelf")).toBe(
      "Rakmu belum tersimpan di perangkat ini. Sambungkan internet untuk membukanya."
    )
    expect(bookMessage("download_failed")).toBe("Buku gagal diunduh. Coba lagi.")
    expect(bookMessage("device_full")).toBe(
      "Penyimpanan perangkat penuh. Buku ini tetap bisa dibaca, tapi tidak tersimpan untuk offline."
    )
    expect(bookMessage("device_full_offline")).toBe(
      "Penyimpanan perangkat penuh. Buku ini tidak bisa disimpan untuk offline."
    )
    expect(bookMessage("offline")).toBe("Butuh internet.")
  })
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/lib/book-messages.test.ts`
Expected: FAIL. `offline_not_saved` dan kode lainnya masih jatuh ke pesan cadangan.

- [ ] **Step 3: Tambahkan pesan**

Di `src/lib/book-messages.ts`, tambahkan entri berikut ke `MESSAGES`, sebelum `offline: "Butuh internet."`:

```ts
  offline_not_saved:
    "Buku ini belum tersimpan di perangkat ini. Sambungkan internet untuk membukanya.",
  offline_no_shelf:
    "Rakmu belum tersimpan di perangkat ini. Sambungkan internet untuk membukanya.",
  download_failed: "Buku gagal diunduh. Coba lagi.",
  device_full:
    "Penyimpanan perangkat penuh. Buku ini tetap bisa dibaca, tapi tidak tersimpan untuk offline.",
  device_full_offline:
    "Penyimpanan perangkat penuh. Buku ini tidak bisa disimpan untuk offline.",
```

Run: `npx vitest run src/lib/book-messages.test.ts`
Expected: PASS.

- [ ] **Step 4: Tambahkan progres ke tipe rak**

Di `src/lib/book-types.ts`, tambahkan field berikut ke `ShelfBook`, setelah `coverUrl`:

```ts
  /** Last percentage read, as stored on the server (0–100), or null when never read. */
  progress: number | null
```

Di `src/components/shelf/fixtures.ts`, tambahkan `progress: null,` setelah `coverUrl: null,`.

Di `src/server/books.ts`, ubah `listBooksFn`:

1. Pada `.select(...)` query books, tambahkan `, reading_progress(percentage)` di akhir string kolom, sehingga menjadi:

```ts
        .select(
          "id, title, author, description, language, genre, genre_source, size_bytes, status, created_at, last_opened_at, cover_path, reading_progress(percentage)"
        )
```

2. Pada objek buku yang dikembalikan, tambahkan baris berikut setelah `coverUrl: …`:

```ts
        // RLS returns only this member's row, so there is at most one.
        progress: row.reading_progress[0]?.percentage ?? null,
```

- [ ] **Step 5: Tulis server function membaca**

Buat `src/server/reading.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { ActionResult } from "@/lib/action-result"
import { MAX_PROGRESS_BATCH, ProgressEntrySchema } from "@/lib/progress"
import {
  type ReaderSettings,
  ReaderSettingsSchema,
  parseReaderSettings,
} from "@/lib/reader-settings"
import type {
  BookFileTicket,
  ProgressEntry,
  ReadingState,
} from "@/lib/reader-types"
import { bookStorage } from "./book-storage"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })

const BookIdSchema = z.object({ bookId: z.uuid() })
const SaveProgressSchema = z.object({
  entries: z.array(ProgressEntrySchema).min(1).max(MAX_PROGRESS_BATCH),
})

/** Everything the reader needs from the server except the file (spec §9, §10). */
export const readingStateFn = createServerFn({ method: "GET" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<ReadingState> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const [bookResult, progressResult, profileResult] = await Promise.all([
      supabase
        .from("books")
        .select("id, title, author")
        .eq("id", data.bookId)
        .eq("status", "ready")
        .maybeSingle(),
      supabase
        .from("reading_progress")
        .select("cfi, percentage, updated_at")
        .eq("book_id", data.bookId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("reader_settings")
        .eq("id", user.id)
        .single(),
    ])
    const error = bookResult.error ?? progressResult.error ?? profileResult.error
    if (error) {
      console.error("reading state lookup failed", error)
      return fail("unknown")
    }
    if (!bookResult.data) return fail("not_found")

    const progress = progressResult.data
    return {
      ok: true,
      book: bookResult.data,
      progress: progress
        ? {
            cfi: progress.cfi,
            percentage: progress.percentage,
            updatedAt: progress.updated_at,
          }
        : null,
      settings: parseReaderSettings(profileResult.data.reader_settings),
    }
  })

/** A one-hour download URL for the EPUB, signed as the member so Storage RLS applies. */
export const bookFileUrlFn = createServerFn({ method: "GET" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<BookFileTicket> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data: book, error } = await supabase
      .from("books")
      .select("file_path")
      .eq("id", data.bookId)
      .eq("status", "ready")
      .maybeSingle()
    if (error) {
      console.error("book lookup failed", error)
      return fail("unknown")
    }
    if (!book) return fail("not_found")

    try {
      const urls = await bookStorage(supabase).getReadUrls([book.file_path])
      const url = urls.get(book.file_path)
      return url ? { ok: true, url } : fail("not_found")
    } catch (signError) {
      console.error("signing the book URL failed", signError)
      return fail("unknown")
    }
  })

/** "Terakhir dibuka" on the shelf (spec §9): set when a book opens online. */
export const markBookOpenedFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data: rows, error } = await supabase
      .from("books")
      .update({ last_opened_at: new Date().toISOString() })
      .eq("id", data.bookId)
      .select("id")
    if (error) {
      console.error("marking the book opened failed", error)
      return fail("unknown")
    }
    return rows.length > 0 ? { ok: true } : fail("not_found")
  })

/**
 * Stores positions waiting on a device (spec §10). save_progress keeps the
 * newest one. A position for a book deleted in the meantime has nothing left to
 * update and is skipped, so it does not stay in the queue forever.
 */
export const saveProgressFn = createServerFn({ method: "POST" })
  .validator((data: { entries: Array<ProgressEntry> }) =>
    SaveProgressSchema.parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    for (const entry of data.entries) {
      const { error } = await supabase.rpc("save_progress", {
        p_book_id: entry.bookId,
        p_cfi: entry.cfi,
        p_percentage: entry.percentage,
        p_updated_at: entry.updatedAt,
      })
      if (error && error.message !== "not_found") {
        console.error("save_progress failed", error)
        return fail(
          error.message === "not_authenticated" ? "not_authenticated" : "unknown"
        )
      }
    }
    return { ok: true }
  })

export const saveReaderSettingsFn = createServerFn({ method: "POST" })
  .validator((data: ReaderSettings) => ReaderSettingsSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { error } = await supabase
      .from("profiles")
      .update({ reader_settings: data })
      .eq("id", user.id)
    if (error) {
      console.error("saving reader settings failed", error)
      return fail("unknown")
    }
    return { ok: true }
  })
```

Catatan untuk implementer:
- Jika tipe hasil generate untuk embed `reading_progress` bukan array (misalnya objek atau `null`), sesuaikan baris `progress:` di `listBooksFn` dengan bentuk yang benar, lalu catat di laporan.
- Primary key tabel itu adalah `(user_id, book_id)`, jadi PostgREST seharusnya mengembalikan array.

- [ ] **Step 6: Verifikasi**

Run: `npm run typecheck && npm run lint && npx prettier --write src/server/reading.ts src/server/books.ts src/lib && npm run check && npm test && npm run build`
Expected: semua bersih dan unit test lulus.

Lalu jalankan `grep -rlE "SUPABASE_SECRET_KEY|sb_secret|createServerClient|auth\.admin|getSupabaseAdminClient" dist/client`. Expected: tidak ada hasil.

Lalu jalankan `npm run test:db`. Expected: 31 lulus. Daftar rak tidak punya test DB sendiri, dan embed `reading_progress` dibuktikan oleh E2E Task 12.

- [ ] **Step 7: Commit**

```bash
git add src/server/reading.ts src/server/books.ts src/lib/book-types.ts src/components/shelf/fixtures.ts src/lib/book-messages.ts src/lib/book-messages.test.ts
git commit -m "feat(reader): add server functions for reading state, files and progress"
```

---
### Task 5: Mesin sinkron posisi baca

**Files:**
- Create: `src/lib/progress-sync.ts`, `src/lib/progress-sync-client.ts`
- Modify: `src/routes/_member.tsx`. Layout anggota mengirim posisi yang tertunda saat aplikasi dibuka dan saat koneksi kembali.
- Test: `src/lib/progress-sync.test.ts`

**Interfaces:**
- Consumes: `PositionStore`, `ProgressEntry` (Task 2), `MAX_PROGRESS_BATCH` (Task 2), `localPositionStore` (Task 3), `saveProgressFn` (Task 4).
- Produces:
  - `progress-sync.ts`:
    - `SyncStatus = "synced" | "pending" | "failing"`;
    - `ProgressSync = { record(entry): Promise<void>; flush(options?: { keepalive?: boolean }): Promise<void>; status(): SyncStatus; subscribe(listener): () => void; dispose(): void }`;
    - `createProgressSync({ store, send, isOnline, debounceMs?, failLimit? }): ProgressSync`.
  - `progress-sync-client.ts`:
    - `progressSync(): ProgressSync`, satu instance per tab, hanya di browser;
    - `useProgressFlush(): void`;
    - `useSyncStatus(): SyncStatus`.
  - Arti status:
    - `pending`: ada posisi yang menunggu debounce atau sedang dikirim;
    - `failing`: ada posisi yang belum terkirim karena offline atau setelah 3 kali gagal. Toolbar menampilkan "Belum tersinkron".

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/progress-sync.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createProgressSync } from "./progress-sync"
import type { PositionStore, ProgressEntry } from "./reader-types"

type Row = ProgressEntry & { pending: boolean }

function memoryStore(initial: Array<ProgressEntry> = []) {
  const rows = new Map<string, Row>(
    initial.map((entry) => [entry.bookId, { ...entry, pending: true }])
  )
  const store: PositionStore = {
    put: async (entry) => {
      rows.set(entry.bookId, { ...entry, pending: true })
    },
    pending: async () =>
      [...rows.values()]
        .filter((row) => row.pending)
        .map((row) => ({
          bookId: row.bookId,
          cfi: row.cfi,
          percentage: row.percentage,
          updatedAt: row.updatedAt,
        })),
    markSynced: async (entries) => {
      for (const entry of entries) {
        const row = rows.get(entry.bookId)
        if (row?.updatedAt === entry.updatedAt) row.pending = false
      }
    },
  }
  return { rows, store }
}

const entry = (bookId: string, minute: number): ProgressEntry => ({
  bookId,
  cfi: `epubcfi(/6/${minute}!/4/2)`,
  percentage: minute,
  updatedAt: new Date(Date.UTC(2026, 9, 17, 8, minute)).toISOString(),
})

const ok = { ok: true as const }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createProgressSync", () => {
  it("sends a recorded position once the reader pauses for five seconds", async () => {
    const { store } = memoryStore()
    const send = vi.fn().mockResolvedValue(ok)
    const sync = createProgressSync({ store, send, isOnline: () => true })

    await sync.record(entry("a", 1))
    expect(sync.status()).toBe("pending")
    await vi.advanceTimersByTimeAsync(4_999)
    expect(send).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledWith([entry("a", 1)], { keepalive: false })
    expect(sync.status()).toBe("synced")
  })

  it("sends only the latest position of a book", async () => {
    const { store } = memoryStore()
    const send = vi.fn().mockResolvedValue(ok)
    const sync = createProgressSync({ store, send, isOnline: () => true })

    await sync.record(entry("a", 1))
    await vi.advanceTimersByTimeAsync(2_000)
    await sync.record(entry("a", 2))
    await vi.advanceTimersByTimeAsync(5_000)

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith([entry("a", 2)], { keepalive: false })
  })

  it("sends at once, with keepalive, when the page is hidden or left", async () => {
    const { store } = memoryStore()
    const send = vi.fn().mockResolvedValue(ok)
    const sync = createProgressSync({ store, send, isOnline: () => true })

    await sync.record(entry("a", 1))
    const flushed = sync.flush({ keepalive: true })
    // The request starts in the same tick: the page may be gone after it.
    expect(send).toHaveBeenCalledWith([entry("a", 1)], { keepalive: true })
    await flushed
    await vi.advanceTimersByTimeAsync(5_000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("waits while offline and reports it, then sends when back online", async () => {
    const { store } = memoryStore()
    const send = vi.fn().mockResolvedValue(ok)
    let online = false
    const sync = createProgressSync({ store, send, isOnline: () => online })

    await sync.record(entry("a", 1))
    await vi.advanceTimersByTimeAsync(5_000)
    expect(send).not.toHaveBeenCalled()
    expect(sync.status()).toBe("failing")

    online = true
    await sync.flush()
    expect(send).toHaveBeenCalledWith([entry("a", 1)], { keepalive: false })
    expect(sync.status()).toBe("synced")
  })

  it("reports failing after three failed attempts, and recovers", async () => {
    const { store } = memoryStore([entry("a", 1)])
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "unknown" })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: false, code: "unknown" })
      .mockResolvedValueOnce(ok)
    const sync = createProgressSync({ store, send, isOnline: () => true })

    await sync.flush()
    await sync.flush()
    expect(sync.status()).toBe("pending")
    await sync.flush()
    expect(sync.status()).toBe("failing")
    await sync.flush()
    expect(sync.status()).toBe("synced")
  })

  it("keeps a position that moved while it was being sent", async () => {
    const { rows, store } = memoryStore()
    let finish: (value: typeof ok) => void = () => undefined
    const send = vi.fn(
      () =>
        new Promise<typeof ok>((resolve) => {
          finish = resolve
        })
    )
    const sync = createProgressSync({ store, send, isOnline: () => true })

    await sync.record(entry("a", 1))
    const flushed = sync.flush()
    await vi.advanceTimersByTimeAsync(0)
    await sync.record(entry("a", 2))
    finish(ok)
    await flushed

    expect(rows.get("a")).toMatchObject({ percentage: 2, pending: true })
    expect(sync.status()).toBe("pending")
  })

  it("sends positions left from earlier visits in batches of fifty", async () => {
    const earlier = Array.from({ length: 51 }, (_, i) => entry(`b${i}`, i % 60))
    const { store } = memoryStore(earlier)
    const send = vi.fn().mockResolvedValue(ok)
    const sync = createProgressSync({ store, send, isOnline: () => true })

    await sync.flush()
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0][0]).toHaveLength(50)
    expect(send.mock.calls[1][0]).toHaveLength(1)
    expect(sync.status()).toBe("synced")
  })

  it("tells subscribers when the status changes", async () => {
    const { store } = memoryStore()
    const send = vi.fn().mockResolvedValue(ok)
    const sync = createProgressSync({ store, send, isOnline: () => true })
    const listener = vi.fn()
    const unsubscribe = sync.subscribe(listener)

    await sync.record(entry("a", 1))
    await sync.flush()
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    await sync.record(entry("a", 2))
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/lib/progress-sync.test.ts`
Expected: FAIL. Modul `./progress-sync` belum ada.

- [ ] **Step 3: Tulis mesin sinkron**

Buat `src/lib/progress-sync.ts`:

```ts
import { MAX_PROGRESS_BATCH } from "./progress"
import type { PositionStore, ProgressEntry } from "./reader-types"

export type SyncStatus = "synced" | "pending" | "failing"

export type SendResult = { ok: true } | { ok: false; code: string }

export type SendProgress = (
  entries: Array<ProgressEntry>,
  options: { keepalive: boolean }
) => Promise<SendResult>

export type ProgressSync = {
  /** Saves the position on this device and sends it after a pause (spec §10 step 2). */
  record: (entry: ProgressEntry) => Promise<void>
  /** Sends every waiting position now. `keepalive` lets the request outlive the page. */
  flush: (options?: { keepalive?: boolean }) => Promise<void>
  status: () => SyncStatus
  subscribe: (listener: () => void) => () => void
  dispose: () => void
}

export function createProgressSync(options: {
  store: PositionStore
  send: SendProgress
  isOnline: () => boolean
  debounceMs?: number
  failLimit?: number
}): ProgressSync {
  const { store, send, isOnline } = options
  const debounceMs = options.debounceMs ?? 5_000
  const failLimit = options.failLimit ?? 3
  const listeners = new Set<() => void>()
  // Positions recorded in this tab and not yet confirmed. When the page is
  // being hidden or closed they are sent straight away, without waiting for
  // IndexedDB, so the request starts before the page can go away.
  const recent = new Map<string, ProgressEntry>()
  let status: SyncStatus = "synced"
  let failures = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let running: Promise<void> | null = null
  let again = false
  let keepaliveNext = false

  function setStatus(next: SyncStatus) {
    if (next === status) return
    status = next
    for (const listener of listeners) listener()
  }

  const stuck = () => (failures >= failLimit ? "failing" : "pending")

  async function confirm(batch: Array<ProgressEntry>) {
    await store.markSynced(batch)
    for (const entry of batch) {
      if (recent.get(entry.bookId)?.updatedAt === entry.updatedAt) {
        recent.delete(entry.bookId)
      }
    }
  }

  async function sendWaiting(keepalive: boolean) {
    const entries =
      keepalive && recent.size > 0 ? [...recent.values()] : await store.pending()
    if (entries.length === 0) {
      setStatus("synced")
      return
    }
    if (!isOnline()) {
      setStatus("failing")
      return
    }
    for (let i = 0; i < entries.length; i += MAX_PROGRESS_BATCH) {
      const batch = entries.slice(i, i + MAX_PROGRESS_BATCH)
      let result: SendResult
      try {
        result = await send(batch, { keepalive })
      } catch {
        result = { ok: false, code: "network" }
      }
      if (!result.ok) {
        failures += 1
        setStatus(stuck())
        return
      }
      await confirm(batch)
    }
    failures = 0
    setStatus((await store.pending()).length > 0 ? "pending" : "synced")
  }

  function flush(flushOptions: { keepalive?: boolean } = {}): Promise<void> {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    keepaliveNext ||= flushOptions.keepalive === true
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      try {
        do {
          again = false
          const keepalive = keepaliveNext
          keepaliveNext = false
          await sendWaiting(keepalive)
        } while (again)
      } finally {
        running = null
      }
    })()
    return running
  }

  async function record(entry: ProgressEntry) {
    recent.set(entry.bookId, entry)
    await store.put(entry)
    if (status === "synced") setStatus("pending")
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, debounceMs)
  }

  return {
    record,
    flush,
    status: () => status,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run src/lib/progress-sync.test.ts`
Expected: PASS (8 test).

Jika test "keeps a position that moved while it was being sent" gagal karena `send` belum dipanggil saat `finish(ok)`, periksa dulu bahwa `flush` memanggil `send` setelah satu putaran `await store.pending()`. Test itu sudah memberi `advanceTimersByTimeAsync(0)` untuk menunggu putaran tersebut. Perbaiki kodenya, bukan test-nya.

- [ ] **Step 5: Tulis lem browser**

Buat `src/lib/progress-sync-client.ts`:

```ts
import { useEffect, useSyncExternalStore } from "react"
import { saveProgressFn } from "@/server/reading"
import { localPositionStore } from "./local/positions"
import {
  type ProgressSync,
  type SyncStatus,
  createProgressSync,
} from "./progress-sync"

const keepaliveFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, keepalive: true })

let engine: ProgressSync | null = null

/** The one progress sync of this tab (browser only). */
export function progressSync(): ProgressSync {
  engine ??= createProgressSync({
    store: localPositionStore,
    isOnline: () => navigator.onLine,
    send: (entries, { keepalive }) =>
      saveProgressFn({
        data: { entries },
        fetch: keepalive ? keepaliveFetch : undefined,
      }),
  })
  return engine
}

/**
 * Sends waiting positions when the app opens, when the connection comes back,
 * and when the page is hidden or left (spec §10 steps 2–3).
 */
export function useProgressFlush(): void {
  useEffect(() => {
    const sync = progressSync()
    void sync.flush()
    const onOnline = () => void sync.flush()
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void sync.flush({ keepalive: true })
      }
    }
    const onPageHide = () => void sync.flush({ keepalive: true })
    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [])
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => progressSync().subscribe(listener),
    () => progressSync().status(),
    () => "synced"
  )
}
```

Ubah `src/routes/_member.tsx`. Ganti `component: Outlet,` dengan `component: MemberLayout,`, lalu tambahkan komponen berikut di bawah definisi `Route`:

```tsx
function MemberLayout() {
  useProgressFlush()
  return <Outlet />
}
```

Tambahkan juga `import { useProgressFlush } from "@/lib/progress-sync-client"`. `beforeLoad` tidak diubah di task ini.

- [ ] **Step 6: Verifikasi**

Run: `npm run typecheck && npm run lint && npx prettier --write src/lib/progress-sync.ts src/lib/progress-sync.test.ts src/lib/progress-sync-client.ts src/routes/_member.tsx && npm run check && npm test && npm run build`
Expected: semua bersih dan unit test lulus.

Lalu jalankan `grep -rlE "SUPABASE_SECRET_KEY|sb_secret|createServerClient|auth\.admin|getSupabaseAdminClient" dist/client`. Expected: tidak ada hasil.

Lalu jalankan `npx playwright test e2e/auth.spec.ts --project=desktop`. Expected: lulus. Layout anggota masih bekerja, dan halaman lain tidak terpengaruh.

- [ ] **Step 7: Commit**

```bash
git add src/lib/progress-sync.ts src/lib/progress-sync.test.ts src/lib/progress-sync-client.ts src/routes/_member.tsx
git commit -m "feat(reader): queue reading positions and send them in the background"
```

---
### Task 6: Sesi yang tahan offline, dan perangkat dibersihkan saat keluar

**Files:**
- Create: `src/lib/session-cache.ts`, `src/lib/current-user.ts`
- Modify:
  - `src/lib/progress-sync-client.ts`: tambah `leaveDevice`.
  - `src/routes/__root.tsx`.
  - `src/routes/_member.tsx`.
  - `src/routes/index.tsx`, `src/routes/login.tsx`, `src/routes/register.tsx`, `src/routes/forgot-password.tsx`, `src/routes/reset-password.tsx`.
  - `src/routes/logout.tsx`.
  - `src/routes/_member/settings.tsx`.
- Test: `src/lib/current-user.test.ts`

**Interfaces:**
- Consumes: `getSessionUserFn` (1A), `SessionUser` (1A), `USER_KEY` (Task 3), `claimLocalData` dan `clearLocalData` (Task 3), `progressSync` dan `useProgressFlush` (Task 5).
- Produces:
  - `session-cache.ts`: `rememberUser(user)`, `cachedUser(): SessionUser | null`, `forgetUser()`.
  - `current-user.ts`:
    - `RootUser = SessionUser | null | undefined`. Nilai `undefined` hanya muncul di shell offline;
    - `currentUser(): Promise<RootUser>`, dipakai `beforeLoad` root;
    - `browserUser(): Promise<SessionUser | null>`;
    - `resolveUser(user: RootUser): Promise<SessionUser | null>`.
  - `progress-sync-client.ts`: `leaveDevice(): Promise<void>`.
  - Konteks root `user` kini bertipe `RootUser`. Guard route memanggil `resolveUser(context.user)`. Komponen anggota tetap memakai `user` hasil `_member` (`SessionUser`).

Shell offline (Task 11) di-prerender saat build untuk "orang tak dikenal".
- `beforeLoad` root mengembalikan `user: undefined` di sana.
- Setelah shell ter-hidrasi, `beforeLoad` milik route anak berjalan di browser dan memanggil `resolveUser`. Fungsi itu bertanya ke server, atau jika offline memakai anggota terakhir dari `localStorage`.
- Di SSR biasa, `user` selalu `SessionUser | null`, sama seperti sebelumnya.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/current-user.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browserUser, resolveUser } from "./current-user"
import { cachedUser, rememberUser } from "./session-cache"
import type { SessionUser } from "./session-types"

const { getSessionUserFn } = vi.hoisted(() => ({ getSessionUserFn: vi.fn() }))
vi.mock("@/server/session", () => ({ getSessionUserFn }))

const ani: SessionUser = {
  id: "7c1c3f40-5a52-4a43-9c5e-0d4c1d1f9a10",
  email: "ani@glosa.test",
  provider: "email",
  username: "ani",
  displayName: "Ani",
  memberNo: 7,
  plan: "free",
  storageLimitBytes: 104857600,
  memberSince: "2026-10-15T03:00:00+00:00",
  onboarded: true,
}

beforeEach(() => {
  localStorage.clear()
  getSessionUserFn.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("browserUser", () => {
  it("remembers the member it gets online, and forgets them after sign-out", async () => {
    getSessionUserFn.mockResolvedValueOnce(ani)
    expect(await browserUser()).toEqual(ani)
    expect(cachedUser()).toEqual(ani)

    getSessionUserFn.mockResolvedValueOnce(null)
    expect(await browserUser()).toBeNull()
    expect(cachedUser()).toBeNull()
  })

  it("uses the last member seen online when the device is offline", async () => {
    rememberUser(ani)
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    expect(await browserUser()).toEqual(ani)
    expect(getSessionUserFn).not.toHaveBeenCalled()
  })

  it("uses the last member when the request cannot reach the server", async () => {
    rememberUser(ani)
    getSessionUserFn.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    expect(await browserUser()).toEqual(ani)
  })

  it("rethrows other errors", async () => {
    getSessionUserFn.mockRejectedValueOnce(new Error("rusak"))
    await expect(browserUser()).rejects.toThrow("rusak")
  })
})

describe("cachedUser", () => {
  it("ignores values that are not a member", () => {
    localStorage.setItem("glosa:user", JSON.stringify({ id: 1 }))
    expect(cachedUser()).toBeNull()
    localStorage.setItem("glosa:user", "{bukan json")
    expect(cachedUser()).toBeNull()
  })
})

describe("resolveUser", () => {
  it("keeps a user the server already resolved", async () => {
    expect(await resolveUser(ani)).toBe(ani)
    expect(await resolveUser(null)).toBeNull()
    expect(getSessionUserFn).not.toHaveBeenCalled()
  })

  it("looks the user up in the browser inside the offline shell", async () => {
    getSessionUserFn.mockResolvedValueOnce(ani)
    expect(await resolveUser(undefined)).toEqual(ani)
  })
})
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/lib/current-user.test.ts`
Expected: FAIL. Modul `./current-user` belum ada.

- [ ] **Step 3: Tulis cache sesi dan resolver**

Buat `src/lib/session-cache.ts`:

```ts
import { USER_KEY } from "./local/keys"
import type { SessionUser } from "./session-types"

/** The last member seen online on this device, so the app still opens offline (spec §12). */
export function rememberUser(user: SessionUser): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // No localStorage (private mode): the app just will not open offline.
  }
}

export function cachedUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    return isSessionUser(value) ? value : null
  } catch {
    return null
  }
}

export function forgetUser(): void {
  try {
    localStorage.removeItem(USER_KEY)
  } catch {
    // No localStorage: nothing to forget.
  }
}

function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== "object" || value === null) return false
  const user = value as Record<string, unknown>
  return (
    typeof user.id === "string" &&
    typeof user.username === "string" &&
    typeof user.displayName === "string" &&
    typeof user.onboarded === "boolean"
  )
}
```

Buat `src/lib/current-user.ts`:

```ts
import { getSessionUserFn } from "@/server/session"
import { cachedUser, forgetUser, rememberUser } from "./session-cache"
import type { SessionUser } from "./session-types"

/**
 * The root route's `user`: the signed-in member, null for guests, or undefined
 * in the offline shell, which is prerendered at build time for nobody in
 * particular (plan 1C, decision 4).
 */
export type RootUser = SessionUser | null | undefined

export async function currentUser(): Promise<RootUser> {
  if (import.meta.env.SSR) {
    if (process.env.TSS_PRERENDERING === "true") return undefined
    return getSessionUserFn()
  }
  return browserUser()
}

/** Asks the server; offline, falls back to the last member seen online. */
export async function browserUser(): Promise<SessionUser | null> {
  if (!navigator.onLine) return cachedUser()
  try {
    const user = await getSessionUserFn()
    if (user) rememberUser(user)
    else forgetUser()
    return user
  } catch (error) {
    if (!navigator.onLine || error instanceof TypeError) return cachedUser()
    throw error
  }
}

/** For route guards: inside the offline shell the user is only known in the browser. */
export async function resolveUser(user: RootUser): Promise<SessionUser | null> {
  if (user !== undefined) return user
  return import.meta.env.SSR ? null : browserUser()
}
```

Run: `npx vitest run src/lib/current-user.test.ts`
Expected: PASS (7 test).

Di jsdom, `onLine` adalah getter di `Navigator.prototype`. Jika `vi.spyOn(navigator, "onLine", "get")` menolak properti warisan itu:
- ganti dengan `Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false })`;
- hapus properti itu di `afterEach` dengan `delete (navigator as { onLine?: boolean }).onLine`.

Pola yang sama berlaku untuk test lain di rencana ini yang memalsukan `navigator.onLine`.

- [ ] **Step 4: Pakai resolver di root dan semua guard**

Di `src/routes/__root.tsx`:

1. Ganti `import { getSessionUserFn } from "@/server/session"` dengan:

```ts
import { currentUser } from "@/lib/current-user"
import { forgetUser, rememberUser } from "@/lib/session-cache"
```

lalu tambahkan `import { useEffect } from "react"`. Jika impor `ReactNode` dari `"react"` sudah ada, gabungkan keduanya menjadi `import { type ReactNode, useEffect } from "react"`.

2. Ganti `beforeLoad: async () => ({ user: await getSessionUserFn() }),` dengan:

```ts
  beforeLoad: async () => ({ user: await currentUser() }),
```

3. Ganti `RootComponent` dengan:

```tsx
function RootComponent() {
  const { user } = Route.useRouteContext()

  // Keep the last member seen online, so the app can still open offline.
  useEffect(() => {
    if (user) rememberUser(user)
    else if (user === null) forgetUser()
  }, [user])

  return (
    <>
      {/* In the offline shell nobody is known yet and the shell was rendered for
          "/": the scene would not match the page the browser renders. */}
      {user !== undefined && <SceneBackdrop />}
      <div className="relative z-10">
        <Outlet />
      </div>
    </>
  )
}
```

Di `src/routes/_member.tsx`, tulis ulang isinya menjadi:

```tsx
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { useEffect } from "react"
import { resolveUser } from "@/lib/current-user"
import { claimLocalData } from "@/lib/local/device"
import { useProgressFlush } from "@/lib/progress-sync-client"
import { memberRedirect } from "@/lib/redirects"

export const Route = createFileRoute("/_member")({
  beforeLoad: async ({ context, location }) => {
    const user = await resolveUser(context.user)
    const target = memberRedirect(user, location.pathname)
    if (target || !user) throw redirect({ href: target ?? "/login" })
    return { user }
  },
  component: MemberLayout,
})

function MemberLayout() {
  const { user } = Route.useRouteContext()

  // Another member's copies on this device go before this member's are used.
  useEffect(() => {
    claimLocalData(user.id).catch((error: unknown) =>
      console.error("claiming this device failed", error)
    )
  }, [user.id])
  useProgressFlush()

  return <Outlet />
}
```

Di `src/routes/index.tsx`, `src/routes/login.tsx`, `src/routes/register.tsx`, dan `src/routes/forgot-password.tsx`, ganti `beforeLoad` dengan:

```ts
  beforeLoad: async ({ context }) => {
    const target = guestRedirect(await resolveUser(context.user))
    if (target) throw redirect({ href: target })
  },
```

lalu tambahkan `import { resolveUser } from "@/lib/current-user"` di setiap file itu.

Di `src/routes/reset-password.tsx`, ganti `beforeLoad` dengan kode berikut, lalu tambahkan impor yang sama:

```ts
  beforeLoad: async ({ context }) => {
    if (!(await resolveUser(context.user))) {
      throw redirect({ href: "/forgot-password" })
    }
  },
```

Jalankan `grep -rn "context.user" src/routes`. Expected: setiap baris yang tersisa ada di dalam `resolveUser(...)`.

- [ ] **Step 5: Bersihkan perangkat saat keluar dan saat akun dihapus**

Di `src/lib/progress-sync-client.ts`, tambahkan `import { clearLocalData } from "./local/device"`, lalu tambahkan fungsi berikut di akhir file:

```ts
const LEAVE_FLUSH_MS = 3_000

/**
 * Before signing out: send the positions still waiting (for a few seconds at
 * most), then wipe this device's copies (plan 1C, decision 6).
 */
export async function leaveDevice(): Promise<void> {
  await Promise.race([
    progressSync()
      .flush()
      .catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, LEAVE_FLUSH_MS)),
  ])
  await clearLocalData()
}
```

Tulis ulang `src/routes/logout.tsx` menjadi:

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { leaveDevice } from "@/lib/progress-sync-client"
import { signOutFn } from "@/server/auth"

export const Route = createFileRoute("/logout")({
  preload: false,
  loader: async () => {
    // A server render (the URL typed directly) has no device data to clear.
    if (!import.meta.env.SSR) {
      await leaveDevice().catch((error: unknown) =>
        console.error("clearing this device failed", error)
      )
    }
    return signOutFn()
  },
})
```

Di `src/routes/_member/settings.tsx`:
- tambahkan `import { clearLocalData } from "@/lib/local/device"`;
- di `onDelete`, tepat sebelum `await router.navigate({ href: "/" })`, tambahkan baris berikut beserta komentarnya:

```ts
    // The account is gone: its copies on this device go too.
    await clearLocalData().catch((error: unknown) =>
      console.error("clearing this device failed", error)
    )
```

- [ ] **Step 6: Verifikasi**

Run: `npm run typecheck && npm run lint && npx prettier --write src/lib src/routes && npm run check && npm test && npm run build`
Expected: semua bersih dan semua unit test lulus.

Lalu jalankan `grep -rlE "SUPABASE_SECRET_KEY|sb_secret|createServerClient|auth\.admin|getSupabaseAdminClient|TSS_PRERENDERING" dist/client`. Expected: tidak ada hasil. Cabang `import.meta.env.SSR` harus hilang dari bundle client.

Lalu jalankan `npm run test:e2e`. Expected: 24 lulus dan 4 dilewati, sama seperti sebelum task ini. Login, keluar, kartu anggota, rak, dan hapus akun tetap berjalan.

- [ ] **Step 7: Commit**

```bash
git add src/lib/session-cache.ts src/lib/current-user.ts src/lib/current-user.test.ts src/lib/progress-sync-client.ts src/routes
git commit -m "feat(offline): remember the member for offline visits and clear the device on sign-out"
```

---
### Task 7: foliate di reader — `ReaderView`

**Files:**
- Create: `src/lib/epub/zip-loader.ts`, `src/lib/epub/open-book.ts`, `src/components/reader/reader-input.ts`, `src/components/reader/reader-fonts.ts`, `src/components/reader/ReaderView.tsx`
- Modify:
  - `src/lib/epub/read-epub.ts`: `openZip` dan `EpubError` pindah ke `zip-loader.ts`.
  - `src/types/foliate-js.d.ts`.
  - `src/styles.css`.
  - `package.json`, `package-lock.json`: tambah `@fontsource/opendyslexic@^5.3.0`.
- Test: `src/components/reader/reader-input.test.ts`

**Interfaces:**
- Consumes: `ReaderSettings`, `readerCss`, `MARGIN_GAP`, `THEME_COLORS`, `FontSources` (Task 2), `TocItem` (Task 2).
- Produces:
  - `zip-loader.ts`: `EpubError` (dipindah; `read-epub.ts` tetap mengekspornya ulang), `openZip(file: Blob): Promise<ZipLoader>`.
  - `open-book.ts`: `OpenedBook = { book: EPUB; close(): Promise<void> }`, `openBookFile(file: Blob): Promise<OpenedBook>`. Fungsi ini melempar `EpubError("epub_invalid")`, dan `close()` aman dipanggil berkali-kali.
  - `reader-input.ts`:
    - `ReaderMove = "left" | "right" | "prev" | "next"`, `TapAction = "left" | "right" | "menu"`;
    - `tapAction(x, left, width): TapAction`;
    - `keyMove(key: string): ReaderMove | null`.
  - `reader-fonts.ts`: `readerFonts(): FontSources`, hanya untuk browser.
  - `ReaderView.tsx`:
    - tipe `ReaderLocation = { fraction: number; cfi: string; chapter: string | null; chapterHref: string | null }`;
    - tipe `ReaderControls = { goTo(target: string): Promise<void>; goToFraction(fraction: number): Promise<void>; move(move: ReaderMove): Promise<void> }`;
    - tipe `ReaderReady = { controls: ReaderControls; toc: Array<TocItem> }`;
    - komponen `<ReaderView file start settings onReady onRelocate onInteract onTapMenu onError />`.
  - Aturan input:
    - `onInteract` dipanggil sebelum setiap aksi anggota di dalam buku: tombol panah/PageUp/PageDown, ketukan kiri/kanan, `pointerdown`, dan roda;
    - ketukan di 40% tengah memanggil `onTapMenu`;
    - tombol di dalam field, `select`, atau dialog tidak membalik halaman.

- [ ] **Step 1: Tulis test input yang gagal**

Buat `src/components/reader/reader-input.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { keyMove, tapAction } from "./reader-input"

describe("tapAction", () => {
  it("turns pages from the outer 30% and opens the frame from the middle", () => {
    expect(tapAction(10, 0, 100)).toBe("left")
    expect(tapAction(50, 0, 100)).toBe("menu")
    expect(tapAction(80, 0, 100)).toBe("right")
  })

  it("measures from the reader's own left edge", () => {
    expect(tapAction(110, 100, 100)).toBe("left")
    expect(tapAction(190, 100, 100)).toBe("right")
  })
})

describe("keyMove", () => {
  it("maps arrows to the page direction and PageUp/PageDown to reading order", () => {
    expect(keyMove("ArrowLeft")).toBe("left")
    expect(keyMove("ArrowRight")).toBe("right")
    expect(keyMove("PageUp")).toBe("prev")
    expect(keyMove("PageDown")).toBe("next")
    expect(keyMove("a")).toBeNull()
  })
})
```

Run: `npx vitest run src/components/reader/reader-input.test.ts`
Expected: FAIL. Modul `./reader-input` belum ada.

- [ ] **Step 2: Tulis aturan input**

Buat `src/components/reader/reader-input.ts`:

```ts
export type ReaderMove = "left" | "right" | "prev" | "next"
export type TapAction = "left" | "right" | "menu"

/** Taps in the outer 30% turn the page; the middle shows or hides the frame (spec §9). */
export function tapAction(x: number, left: number, width: number): TapAction {
  const position = (x - left) / width
  if (position < 0.3) return "left"
  if (position > 0.7) return "right"
  return "menu"
}

/** Arrow keys follow the page direction (RTL books too); PageUp/PageDown follow reading order. */
export function keyMove(key: string): ReaderMove | null {
  switch (key) {
    case "ArrowLeft":
      return "left"
    case "ArrowRight":
      return "right"
    case "PageUp":
      return "prev"
    case "PageDown":
      return "next"
    default:
      return null
  }
}
```

Run: `npx vitest run src/components/reader/reader-input.test.ts`
Expected: PASS (3 test).

- [ ] **Step 3: Pindahkan loader zip dan buat pembuka buku**

Buat `src/lib/epub/zip-loader.ts`. Isinya adalah `EpubError` dan `openZip` yang dipindah apa adanya dari `read-epub.ts`, ditambah tipe kembalian:

```ts
import {
  BlobReader,
  BlobWriter,
  TextWriter,
  ZipReader,
  configure,
} from "@zip.js/zip.js"
import type { EpubLoader } from "foliate-js/epub.js"
import type { FileProblem } from "@/lib/upload-rules"

export class EpubError extends Error {
  constructor(readonly code: FileProblem) {
    super(code)
  }
}

export type ZipLoader = EpubLoader & { close: () => Promise<unknown> }

/** The same zip loader foliate-js uses in view.js, without its PDF/MOBI handling. */
export async function openZip(file: Blob): Promise<ZipLoader> {
  configure({ useWebWorkers: false })
  const reader = new ZipReader(new BlobReader(file))
  const entries = await reader.getEntries()
  const byName = new Map(entries.map((entry) => [entry.filename, entry]))
  return {
    // Directory entries have no getData: zip.js types them as `directory: true`.
    loadText: (name: string) => {
      const entry = byName.get(name)
      return entry && !entry.directory ? entry.getData(new TextWriter()) : null
    },
    loadBlob: (name: string, type?: string) => {
      const entry = byName.get(name)
      return entry && !entry.directory
        ? entry.getData(new BlobWriter(type))
        : null
    },
    getSize: (name: string) => byName.get(name)?.uncompressedSize ?? 0,
    close: () => reader.close(),
  }
}
```

Lalu ubah `src/lib/epub/read-epub.ts`:
- hapus impor `@zip.js/zip.js`, kelas `EpubError`, dan fungsi `openZip`;
- tambahkan baris berikut, supaya modul lain yang mengimpor `EpubError` dari `read-epub` tetap berjalan:

```ts
import { EpubError, openZip } from "./zip-loader"

export { EpubError }
```

Bagian lain `read-epub.ts` tidak berubah.

Buat `src/lib/epub/open-book.ts`:

```ts
import type { EPUB } from "foliate-js/epub.js"
import { EpubError, openZip } from "./zip-loader"

export type OpenedBook = { book: EPUB; close: () => Promise<void> }

/** Opens a stored EPUB for reading. The zip stays open until close(), which is idempotent. */
export async function openBookFile(file: Blob): Promise<OpenedBook> {
  let zip: Awaited<ReturnType<typeof openZip>>
  try {
    zip = await openZip(file)
  } catch {
    throw new EpubError("epub_invalid")
  }
  let closed = false
  const closeZip = async () => {
    if (closed) return
    closed = true
    await zip.close().catch(() => undefined)
  }
  try {
    const { EPUB } = await import("foliate-js/epub.js")
    const book = await new EPUB(zip).init()
    if (book.sections.length === 0) throw new EpubError("epub_invalid")
    return {
      book,
      close: async () => {
        if (closed) return
        book.destroy()
        await closeZip()
      },
    }
  } catch (error) {
    await closeZip()
    throw error instanceof EpubError ? error : new EpubError("epub_invalid")
  }
}
```

- [ ] **Step 4: Lengkapi tipe foliate**

Di `src/types/foliate-js.d.ts`:

1. Di dalam `class EPUB`, tambahkan setelah `sections: Array<unknown>`:

```ts
    toc?: Array<import("@/lib/reader-types").TocItem> | null
    dir?: string
```

2. Tambahkan deklarasi modul berikut di akhir file:

```ts
declare module "foliate-js/view.js" {
  import type { EPUB } from "foliate-js/epub.js"

  export type RelocateDetail = {
    /** Position in the whole book, 0–1. */
    fraction: number
    cfi: string
    tocItem?: { label?: string; href?: string } | null
  }

  /** foliate-paginator (reflowable) or foliate-fxl (fixed layout, no setStyles). */
  export interface FoliateRenderer extends HTMLElement {
    setStyles?: (styles: string) => void
  }

  /** The <foliate-view> element; importing the module defines it. */
  export class View extends HTMLElement {
    book: EPUB
    renderer: FoliateRenderer
    open(book: EPUB): Promise<void>
    init(options: {
      lastLocation?: string | null
      showTextStart?: boolean
    }): Promise<void>
    close(): void
    goTo(target: string): Promise<unknown>
    goToFraction(fraction: number): Promise<void>
    goLeft(): Promise<void>
    goRight(): Promise<void>
    prev(): Promise<void>
    next(): Promise<void>
  }
}
```

- [ ] **Step 5: Siapkan huruf reader**

Run: `npm install @fontsource/opendyslexic@^5.3.0`

Buat `src/components/reader/reader-fonts.ts`:

```ts
import atkinsonBold from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2?url"
import atkinsonItalic from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-italic.woff2?url"
import atkinsonRegular from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2?url"
import caslonBold from "@fontsource/libre-caslon-text/files/libre-caslon-text-latin-700-normal.woff2?url"
import caslonItalic from "@fontsource/libre-caslon-text/files/libre-caslon-text-latin-400-italic.woff2?url"
import caslonRegular from "@fontsource/libre-caslon-text/files/libre-caslon-text-latin-400-normal.woff2?url"
import dyslexicBold from "@fontsource/opendyslexic/files/opendyslexic-latin-700-normal.woff2?url"
import dyslexicItalic from "@fontsource/opendyslexic/files/opendyslexic-latin-400-italic.woff2?url"
import dyslexicRegular from "@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff2?url"
import type { FontSources } from "@/lib/reader-settings"

const absolute = (url: string) => new URL(url, window.location.href).href

/**
 * Font files for the book's iframe. Its documents are blob: URLs, which cannot
 * resolve relative paths, so every URL is made absolute (plan 1C, decision 11).
 */
export function readerFonts(): FontSources {
  return {
    serif: {
      family: "Glosa Serif",
      fallback: "Georgia, serif",
      regular: absolute(caslonRegular),
      bold: absolute(caslonBold),
      italic: absolute(caslonItalic),
    },
    sans: {
      family: "Glosa Sans",
      fallback: "system-ui, sans-serif",
      regular: absolute(atkinsonRegular),
      bold: absolute(atkinsonBold),
      italic: absolute(atkinsonItalic),
    },
    dyslexic: {
      family: "Glosa Dyslexic",
      fallback: "sans-serif",
      regular: absolute(dyslexicRegular),
      bold: absolute(dyslexicBold),
      italic: absolute(dyslexicItalic),
    },
  }
}
```

- [ ] **Step 6: Tulis `ReaderView`**

Buat `src/components/reader/ReaderView.tsx`:

```tsx
import type { RelocateDetail, View } from "foliate-js/view.js"
import { useEffect, useRef } from "react"
import { type OpenedBook, openBookFile } from "@/lib/epub/open-book"
import {
  MARGIN_GAP,
  type ReaderSettings,
  THEME_COLORS,
  readerCss,
} from "@/lib/reader-settings"
import type { TocItem } from "@/lib/reader-types"
import { readerFonts } from "./reader-fonts"
import { type ReaderMove, keyMove, tapAction } from "./reader-input"

export type ReaderLocation = {
  fraction: number
  cfi: string
  chapter: string | null
  chapterHref: string | null
}

export type ReaderControls = {
  goTo: (target: string) => Promise<void>
  goToFraction: (fraction: number) => Promise<void>
  move: (move: ReaderMove) => Promise<void>
}

export type ReaderReady = { controls: ReaderControls; toc: Array<TocItem> }

type Callbacks = {
  onReady: (ready: ReaderReady) => void
  onRelocate: (location: ReaderLocation) => void
  /** Called before every page turn the member makes. */
  onInteract: () => void
  onTapMenu: () => void
  onError: (error: unknown) => void
}

/** Room above and below the text for the reader's bars, which overlay the book. */
const BAR_SPACE = "64px"
const MAX_LINE_LENGTH = "720px"

function applySettings(view: View, settings: ReaderSettings) {
  const renderer = view.renderer
  renderer.setAttribute("flow", settings.flow)
  renderer.setAttribute("gap", MARGIN_GAP[settings.margin])
  renderer.setAttribute("margin", BAR_SPACE)
  renderer.setAttribute("max-inline-size", MAX_LINE_LENGTH)
  renderer.setStyles?.(readerCss(settings, readerFonts()))
}

function toLocation(detail: RelocateDetail): ReaderLocation {
  const label = detail.tocItem?.label?.trim()
  return {
    fraction: detail.fraction,
    cfi: detail.cfi,
    chapter: label ? label : null,
    chapterHref: detail.tocItem?.href ?? null,
  }
}

/**
 * Keys typed into a field or used inside a dialog never turn pages. Duck-typed:
 * events from the book's iframe carry elements from another window.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null
  return (
    typeof element?.closest === "function" &&
    element.closest(
      "input, select, textarea, [contenteditable], [role='dialog']"
    ) !== null
  )
}

/** Renders one EPUB with foliate-js (spec §9). Opens the file once per `file`. */
export function ReaderView({
  file,
  start,
  settings,
  ...callbacks
}: {
  file: Blob
  /** CFI to open at; null opens at the start of the text. */
  start: string | null
  settings: ReaderSettings
} & Callbacks) {
  const hostRef = useRef<HTMLElement>(null)
  const viewRef = useRef<View | null>(null)
  const callbacksRef = useRef(callbacks)
  const settingsRef = useRef(settings)
  const startRef = useRef(start)

  useEffect(() => {
    callbacksRef.current = callbacks
    settingsRef.current = settings
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let opened: OpenedBook | null = null
    let view: View | null = null
    const call = () => callbacksRef.current
    const interact = () => call().onInteract()

    const move = async (direction: ReaderMove) => {
      if (!view) return
      if (direction === "left") await view.goLeft()
      else if (direction === "right") await view.goRight()
      else if (direction === "prev") await view.prev()
      else await view.next()
    }

    const onKey = (event: KeyboardEvent) => {
      const direction = keyMove(event.key)
      if (!direction || event.defaultPrevented) return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      interact()
      void move(direction)
    }

    const onSectionLoad = (event: Event) => {
      const { doc } = (event as CustomEvent<{ doc: Document }>).detail
      doc.addEventListener("keydown", onKey)
      doc.addEventListener("pointerdown", interact)
      doc.addEventListener("wheel", interact, { passive: true })
      doc.addEventListener("click", (click) => {
        // foliate follows links itself and marks those clicks handled.
        if (click.defaultPrevented || doc.getSelection()?.toString()) return
        const frameLeft =
          doc.defaultView?.frameElement?.getBoundingClientRect().left ?? 0
        const box = host.getBoundingClientRect()
        const action = tapAction(frameLeft + click.clientX, box.left, box.width)
        if (action === "menu") {
          call().onTapMenu()
          return
        }
        interact()
        void move(action)
      })
    }

    const onRelocate = (event: Event) =>
      call().onRelocate(toLocation((event as CustomEvent<RelocateDetail>).detail))

    document.addEventListener("keydown", onKey)
    host.addEventListener("pointerdown", interact)
    host.addEventListener("wheel", interact, { passive: true })

    void (async () => {
      try {
        await import("foliate-js/view.js")
        opened = await openBookFile(file)
        if (cancelled) {
          await opened.close()
          return
        }
        view = document.createElement("foliate-view") as View
        view.className = "reader-view"
        view.addEventListener("relocate", onRelocate)
        view.addEventListener("load", onSectionLoad)
        host.append(view)
        await view.open(opened.book)
        applySettings(view, settingsRef.current)
        viewRef.current = view
        const startAt = startRef.current
        await view.init(
          startAt ? { lastLocation: startAt } : { showTextStart: true }
        )
        if (cancelled) return
        const current = view
        call().onReady({
          controls: {
            goTo: async (target) => {
              await current.goTo(target)
            },
            goToFraction: (fraction) => current.goToFraction(fraction),
            move,
          },
          toc: opened.book.toc ?? [],
        })
      } catch (error) {
        if (!cancelled) call().onError(error)
      }
    })()

    return () => {
      cancelled = true
      viewRef.current = null
      document.removeEventListener("keydown", onKey)
      host.removeEventListener("pointerdown", interact)
      host.removeEventListener("wheel", interact)
      view?.close()
      view?.remove()
      void opened?.close()
    }
  }, [file])

  useEffect(() => {
    const view = viewRef.current
    if (view) applySettings(view, settings)
  }, [settings])

  return (
    <section
      ref={hostRef}
      aria-label="Isi buku"
      className="reader-host"
      style={{ background: THEME_COLORS[settings.theme].background }}
    />
  )
}
```

Di `src/styles.css`, tambahkan aturan berikut di dalam blok `@layer components` yang sudah ada, di akhir blok:

```css
  .reader-host {
    position: absolute;
    inset: 0;
  }
  .reader-view {
    display: block;
    width: 100%;
    height: 100%;
  }
```

- [ ] **Step 7: Verifikasi**

Run: `npm run typecheck && npm run lint && npx prettier --write src/components/reader src/lib/epub src/types && npm run check && npm test && npm run build`
Expected: semua bersih dan semua unit test lulus.

`ReaderView` belum dipakai route mana pun, jadi belum ikut bundle. Komponen ini diperiksa di browser pada Task 9.

Lalu jalankan `npx playwright test e2e/shelf.spec.ts --project=desktop`. Expected: 5 lulus. Upload masih membaca EPUB lewat `openZip` yang sudah dipindah.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/epub src/types/foliate-js.d.ts src/components/reader src/styles.css
git commit -m "feat(reader): render EPUBs with foliate-js and turn pages by key or tap"
```

---
### Task 8: Memuat buku untuk reader, dan setelan baca

**Files:**
- Create: `src/lib/book-download.ts`, `src/lib/reader-settings-cache.ts`, `src/components/reader/load-reader.ts`, `src/components/reader/useReaderSettings.ts`
- Test: `src/lib/reader-settings-cache.test.ts`, `src/components/reader/load-reader.test.ts`

**Interfaces:**
- Consumes:
  - `readingStateFn`, `bookFileUrlFn`, `saveReaderSettingsFn` (Task 4);
  - `getLocalBook`, `saveLocalBook`, `removeLocalBook`, `getLocalPosition`, `removeLocalPosition`, `loadShelfSnapshot`, `requestPersistence`, `READER_SETTINGS_KEY` (Task 3);
  - `ReaderSettings`, `DEFAULT_READER_SETTINGS`, `parseReaderSettings` (Task 2).
- Produces:
  - `book-download.ts`:
    - `BookLoadError(code)`, error dengan `code` yang dibaca `bookMessage`;
    - `downloadBook(bookId): Promise<Blob>`, yang meminta URL baru satu kali jika unduhan ditolak (spec §12);
    - `saveBookOffline(bookId): Promise<boolean>`, yang mengunduh, menyimpan, lalu meminta persistensi. Hasilnya `false` jika perangkat penuh.
  - `reader-settings-cache.ts`: `cachedReaderSettings(): { settings, dirty } | null`, `cacheReaderSettings(settings, dirty)`, `initialReaderSettings(server: ReaderSettings | null): ReaderSettings`.
  - `load-reader.ts`:
    - `ReaderData = { book: ReaderBook; file: Blob; local: Position | null; server: Position | null; settings: ReaderSettings; online: boolean; saved: boolean }`;
    - `loadReader(bookId, userId): Promise<ReaderData>`, yang melempar `notFound()`, `redirect()` ke login, atau `BookLoadError`.
  - `useReaderSettings.ts`: `useReaderSettings(initial, online): { settings; update(patch) }`.
    - Setiap perubahan langsung disimpan di perangkat dengan tanda `dirty`, lalu dikirim ke server 800 ms kemudian.
    - Perubahan yang dibuat saat offline dikirim saat reader dibuka online.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/reader-settings-cache.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest"
import {
  cacheReaderSettings,
  cachedReaderSettings,
  initialReaderSettings,
} from "./reader-settings-cache"
import { DEFAULT_READER_SETTINGS } from "./reader-settings"

const dark = { ...DEFAULT_READER_SETTINGS, theme: "dark" as const }
const large = { ...DEFAULT_READER_SETTINGS, fontSize: 150 }

beforeEach(() => {
  localStorage.clear()
})

describe("initialReaderSettings", () => {
  it("prefers changes this device has not saved yet", () => {
    cacheReaderSettings(dark, true)
    expect(initialReaderSettings(large)).toEqual(dark)
  })

  it("otherwise follows the account and remembers it", () => {
    cacheReaderSettings(dark, false)
    expect(initialReaderSettings(large)).toEqual(large)
    expect(cachedReaderSettings()).toEqual({ settings: large, dirty: false })
  })

  it("uses this device's copy when the server is out of reach", () => {
    cacheReaderSettings(dark, false)
    expect(initialReaderSettings(null)).toEqual(dark)
  })

  it("falls back to the defaults, and repairs broken copies", () => {
    expect(initialReaderSettings(null)).toEqual(DEFAULT_READER_SETTINGS)
    localStorage.setItem(
      "glosa:reader-settings",
      JSON.stringify({ settings: { theme: "neon" }, dirty: true })
    )
    expect(initialReaderSettings(null)).toEqual(DEFAULT_READER_SETTINGS)
  })
})
```

Buat `src/components/reader/load-reader.test.ts`:

```ts
import { isNotFound } from "@tanstack/react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BookLoadError } from "@/lib/book-download"
import { DEFAULT_READER_SETTINGS } from "@/lib/reader-settings"
import { loadReader } from "./load-reader"

const mocks = vi.hoisted(() => ({
  readingStateFn: vi.fn(),
  bookFileUrlFn: vi.fn(),
  getLocalBook: vi.fn(),
  saveLocalBook: vi.fn(),
  removeLocalBook: vi.fn(),
  getLocalPosition: vi.fn(),
  removeLocalPosition: vi.fn(),
  loadShelfSnapshot: vi.fn(),
  requestPersistence: vi.fn(),
}))
vi.mock("@/server/reading", () => ({
  readingStateFn: mocks.readingStateFn,
  bookFileUrlFn: mocks.bookFileUrlFn,
}))
vi.mock("@/lib/local/book-files", () => ({
  getLocalBook: mocks.getLocalBook,
  saveLocalBook: mocks.saveLocalBook,
  removeLocalBook: mocks.removeLocalBook,
}))
vi.mock("@/lib/local/positions", () => ({
  getLocalPosition: mocks.getLocalPosition,
  removeLocalPosition: mocks.removeLocalPosition,
}))
vi.mock("@/lib/local/shelf-snapshot", () => ({
  loadShelfSnapshot: mocks.loadShelfSnapshot,
}))
vi.mock("@/lib/local/device", () => ({
  requestPersistence: mocks.requestPersistence,
}))

const BOOK_ID = "0f9f5c1e-8a4b-4c2e-9d3a-1b2c3d4e5f60"
const book = { id: BOOK_ID, title: "Sherlock", author: "Doyle" }
const local = { cfi: "epubcfi(/6/4!/4/2)", percentage: 10, updatedAt: "2026-10-17T08:00:00.000Z" }
const server = { cfi: "epubcfi(/6/8!/4/2)", percentage: 40, updatedAt: "2026-10-17T09:00:00.000Z" }
const stored = new Blob(["epub"], { type: "application/epub+zip" })
const state = { ok: true, book, progress: server, settings: DEFAULT_READER_SETTINGS }
const fetchMock = vi.fn()

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.getLocalPosition.mockResolvedValue(local)
  mocks.saveLocalBook.mockResolvedValue(true)
  mocks.requestPersistence.mockResolvedValue(undefined)
  mocks.removeLocalBook.mockResolvedValue(undefined)
  mocks.removeLocalPosition.mockResolvedValue(undefined)
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("loadReader", () => {
  it("opens a stored copy without downloading it", async () => {
    mocks.getLocalBook.mockResolvedValue(stored)
    mocks.readingStateFn.mockResolvedValue(state)

    const data = await loadReader(BOOK_ID, "u1")
    expect(data).toMatchObject({ book, local, server, online: true, saved: true })
    expect(data.file).toBe(stored)
    expect(mocks.bookFileUrlFn).not.toHaveBeenCalled()
  })

  it("downloads, stores and keeps a book that is not on this device yet", async () => {
    mocks.getLocalBook.mockResolvedValue(null)
    mocks.readingStateFn.mockResolvedValue(state)
    mocks.bookFileUrlFn.mockResolvedValue({ ok: true, url: "https://storage/a" })
    fetchMock.mockResolvedValue(new Response("epub", { status: 200 }))

    const data = await loadReader(BOOK_ID, "u1")
    expect(await data.file.text()).toBe("epub")
    expect(mocks.saveLocalBook).toHaveBeenCalledWith(BOOK_ID, data.file)
    expect(mocks.requestPersistence).toHaveBeenCalled()
    expect(data.saved).toBe(true)
  })

  it("asks for a fresh URL once when the download is refused", async () => {
    mocks.getLocalBook.mockResolvedValue(null)
    mocks.readingStateFn.mockResolvedValue(state)
    mocks.bookFileUrlFn
      .mockResolvedValueOnce({ ok: true, url: "https://storage/old" })
      .mockResolvedValueOnce({ ok: true, url: "https://storage/new" })
    fetchMock
      .mockResolvedValueOnce(new Response("expired", { status: 400 }))
      .mockResolvedValueOnce(new Response("epub", { status: 200 }))

    const data = await loadReader(BOOK_ID, "u1")
    expect(await data.file.text()).toBe("epub")
    expect(fetchMock).toHaveBeenLastCalledWith("https://storage/new")
  })

  it("gives up after the second refusal", async () => {
    mocks.getLocalBook.mockResolvedValue(null)
    mocks.readingStateFn.mockResolvedValue(state)
    mocks.bookFileUrlFn.mockResolvedValue({ ok: true, url: "https://storage/a" })
    fetchMock.mockImplementation(async () => new Response("no", { status: 403 }))

    await expect(loadReader(BOOK_ID, "u1")).rejects.toEqual(
      new BookLoadError("download_failed")
    )
  })

  it("still reads a book that does not fit on the device", async () => {
    mocks.getLocalBook.mockResolvedValue(null)
    mocks.readingStateFn.mockResolvedValue(state)
    mocks.bookFileUrlFn.mockResolvedValue({ ok: true, url: "https://storage/a" })
    fetchMock.mockResolvedValue(new Response("epub", { status: 200 }))
    mocks.saveLocalBook.mockResolvedValue(false)

    const data = await loadReader(BOOK_ID, "u1")
    expect(data.saved).toBe(false)
    expect(mocks.requestPersistence).not.toHaveBeenCalled()
  })

  it("opens a stored copy offline with the shelf snapshot's title", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    mocks.getLocalBook.mockResolvedValue(stored)
    mocks.loadShelfSnapshot.mockResolvedValue({
      books: [{ id: BOOK_ID, title: "Sherlock (salinan)", author: "Doyle" }],
      usage: { usedBytes: 0, limitBytes: 1, plan: "free" },
    })

    const data = await loadReader(BOOK_ID, "u1")
    expect(mocks.readingStateFn).not.toHaveBeenCalled()
    expect(data).toMatchObject({
      book: { id: BOOK_ID, title: "Sherlock (salinan)", author: "Doyle" },
      server: null,
      online: false,
    })
  })

  it("explains that an unsaved book needs a connection", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    mocks.getLocalBook.mockResolvedValue(null)

    await expect(loadReader(BOOK_ID, "u1")).rejects.toEqual(
      new BookLoadError("offline_not_saved")
    )
  })

  it("forgets this device's copy of a book deleted elsewhere", async () => {
    mocks.getLocalBook.mockResolvedValue(stored)
    mocks.readingStateFn.mockResolvedValue({ ok: false, code: "not_found" })

    const error: unknown = await loadReader(BOOK_ID, "u1").catch((e: unknown) => e)
    expect(isNotFound(error)).toBe(true)
    expect(mocks.removeLocalBook).toHaveBeenCalledWith(BOOK_ID)
    expect(mocks.removeLocalPosition).toHaveBeenCalledWith(BOOK_ID)
  })
})
```

Catatan: `toEqual(new BookLoadError(...))` membandingkan kelas dan `message`. Kode error dipakai sebagai `message`.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/lib/reader-settings-cache.test.ts src/components/reader/load-reader.test.ts`
Expected: FAIL. Modul-modulnya belum ada.

- [ ] **Step 3: Tulis unduhan buku dan cache setelan**

Buat `src/lib/book-download.ts`:

```ts
import { bookFileUrlFn } from "@/server/reading"
import { saveLocalBook } from "./local/book-files"
import { requestPersistence } from "./local/device"

/** A book could not be opened or saved; `code` is shown with bookMessage(). */
export class BookLoadError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

/**
 * Downloads the EPUB through a one-hour signed URL. When Storage refuses the
 * URL (it may have expired), a fresh one is requested once (spec §12).
 */
export async function downloadBook(bookId: string): Promise<Blob> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ticket = await bookFileUrlFn({ data: { bookId } })
    if (!ticket.ok) throw new BookLoadError(ticket.code)
    const response = await fetch(ticket.url)
    if (response.ok) return await response.blob()
  }
  throw new BookLoadError("download_failed")
}

/** "Simpan offline": downloads and stores the book; false when the device is full. */
export async function saveBookOffline(bookId: string): Promise<boolean> {
  const saved = await saveLocalBook(bookId, await downloadBook(bookId))
  if (saved) await requestPersistence()
  return saved
}
```

Buat `src/lib/reader-settings-cache.ts`:

```ts
import { READER_SETTINGS_KEY } from "./local/keys"
import {
  DEFAULT_READER_SETTINGS,
  type ReaderSettings,
  parseReaderSettings,
} from "./reader-settings"

type CachedSettings = { settings: ReaderSettings; dirty: boolean }

/** This device's copy of the reader settings; `dirty` while the server lacks them. */
export function cachedReaderSettings(): CachedSettings | null {
  try {
    const raw = localStorage.getItem(READER_SETTINGS_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as { settings?: unknown; dirty?: unknown }
    return {
      settings: parseReaderSettings(value.settings),
      dirty: value.dirty === true,
    }
  } catch {
    return null
  }
}

export function cacheReaderSettings(
  settings: ReaderSettings,
  dirty: boolean
): void {
  try {
    localStorage.setItem(
      READER_SETTINGS_KEY,
      JSON.stringify({ settings, dirty } satisfies CachedSettings)
    )
  } catch {
    // No localStorage: the settings still apply until the reader closes.
  }
}

/**
 * Settings for opening the reader: unsaved changes on this device win; then
 * the account's settings; then this device's copy; then the defaults.
 */
export function initialReaderSettings(
  server: ReaderSettings | null
): ReaderSettings {
  const cached = cachedReaderSettings()
  if (cached?.dirty) return cached.settings
  if (server) {
    cacheReaderSettings(server, false)
    return server
  }
  return cached?.settings ?? DEFAULT_READER_SETTINGS
}
```

Perhatikan case "repairs broken copies" pada test. Tema `neon` tidak valid, sehingga `parseReaderSettings` mengembalikan default, dan karena `dirty: true` hasilnya adalah default. Itu memang yang diharapkan.

- [ ] **Step 4: Tulis loader reader**

Buat `src/components/reader/load-reader.ts`:

```ts
import { notFound, redirect } from "@tanstack/react-router"
import { BookLoadError, downloadBook } from "@/lib/book-download"
import {
  getLocalBook,
  removeLocalBook,
  saveLocalBook,
} from "@/lib/local/book-files"
import { requestPersistence } from "@/lib/local/device"
import { getLocalPosition, removeLocalPosition } from "@/lib/local/positions"
import { loadShelfSnapshot } from "@/lib/local/shelf-snapshot"
import type { ReaderSettings } from "@/lib/reader-settings"
import { initialReaderSettings } from "@/lib/reader-settings-cache"
import type { Position, ReaderBook, ReadingState } from "@/lib/reader-types"
import { readingStateFn } from "@/server/reading"

export type ReaderData = {
  book: ReaderBook
  file: Blob
  /** This device's last position, or null. */
  local: Position | null
  /** The account's last position, or null (also when offline). */
  server: Position | null
  settings: ReaderSettings
  /** Whether the server answered: only then is the last-opened time updated. */
  online: boolean
  /** Whether the EPUB is stored on this device (false when it is full). */
  saved: boolean
}

const unreachable = (error: unknown) =>
  !navigator.onLine || error instanceof TypeError

async function offlineBook(
  bookId: string,
  userId: string
): Promise<ReaderBook> {
  const shelf = await loadShelfSnapshot(userId)
  const entry = shelf?.books.find((candidate) => candidate.id === bookId)
  return entry
    ? { id: entry.id, title: entry.title, author: entry.author }
    : { id: bookId, title: "Buku", author: "" }
}

/**
 * Loads a book for /read (spec §9): this device's copy first, otherwise a
 * download that is stored for next time. The server's state (title, position,
 * settings) is fetched when online; offline, the shelf snapshot names the book.
 */
export async function loadReader(
  bookId: string,
  userId: string
): Promise<ReaderData> {
  const [stored, local] = await Promise.all([
    getLocalBook(bookId),
    getLocalPosition(bookId),
  ])

  let state: ReadingState | null = null
  if (navigator.onLine) {
    try {
      state = await readingStateFn({ data: { bookId } })
    } catch (error) {
      if (!unreachable(error)) throw error
    }
  }
  if (state && !state.ok) {
    if (state.code === "not_found") {
      // Deleted on another device: this device's copy goes too.
      await Promise.all([removeLocalBook(bookId), removeLocalPosition(bookId)])
      throw notFound()
    }
    if (state.code === "not_authenticated") {
      throw redirect({
        href: `/login?next=${encodeURIComponent(`/read/${bookId}`)}`,
      })
    }
    throw new BookLoadError(state.code)
  }

  let file = stored
  let saved = stored !== null
  if (!file) {
    if (!state) throw new BookLoadError("offline_not_saved")
    file = await downloadBook(bookId)
    saved = await saveLocalBook(bookId, file)
    if (saved) await requestPersistence()
  }

  return {
    book: state ? state.book : await offlineBook(bookId, userId),
    file,
    local,
    server: state ? state.progress : null,
    settings: initialReaderSettings(state ? state.settings : null),
    online: state !== null,
    saved,
  }
}
```

Catatan untuk implementer: `downloadBook` mengimpor `saveLocalBook` dan `requestPersistence` dari modul yang di-mock di test, jadi `vi.mock` di atas juga berlaku untuknya.

- [ ] **Step 5: Tulis hook setelan**

Buat `src/components/reader/useReaderSettings.ts`:

```ts
import { useServerFn } from "@tanstack/react-start"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ReaderSettings } from "@/lib/reader-settings"
import {
  cacheReaderSettings,
  cachedReaderSettings,
} from "@/lib/reader-settings-cache"
import { saveReaderSettingsFn } from "@/server/reading"

const SAVE_DELAY_MS = 800

/**
 * Reader settings (spec §9): applied at once and kept on this device, then
 * saved to the account after a short pause. Changes made offline stay marked
 * as unsaved and reach the account the next time the reader opens online.
 */
export function useReaderSettings(initial: ReaderSettings, online: boolean) {
  const [settings, setSettings] = useState(initial)
  const saveSettings = useServerFn(saveReaderSettingsFn)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const waiting = useRef<ReaderSettings | null>(null)

  const push = useCallback(
    async (next: ReaderSettings) => {
      try {
        const result = await saveSettings({ data: next })
        if (result.ok && waiting.current === null) {
          cacheReaderSettings(next, false)
        }
      } catch {
        // Still marked unsaved on this device; sent again next time.
      }
    },
    [saveSettings]
  )

  useEffect(() => {
    const cached = cachedReaderSettings()
    if (online && cached?.dirty) void push(cached.settings)
  }, [online, push])

  // Leaving the reader sends a change that is still waiting for its pause.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      const next = waiting.current
      waiting.current = null
      if (next) void push(next)
    },
    [push]
  )

  const update = useCallback(
    (patch: Partial<ReaderSettings>) => {
      setSettings((current) => ({ ...current, ...patch }))
      const next = { ...(waiting.current ?? settings), ...patch }
      waiting.current = next
      cacheReaderSettings(next, true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = null
        waiting.current = null
        void push(next)
      }, SAVE_DELAY_MS)
    },
    [push, settings]
  )

  return { settings, update }
}
```

- [ ] **Step 6: Jalankan test untuk memastikan lulus**

Run: `npx vitest run src/lib/reader-settings-cache.test.ts src/components/reader/load-reader.test.ts`
Expected: PASS (4 + 8 test).

Lalu jalankan `npm run typecheck && npm run lint && npx prettier --write src/lib src/components/reader && npm run check && npm test`. Expected: semua bersih dan lulus.

- [ ] **Step 7: Commit**

```bash
git add src/lib/book-download.ts src/lib/reader-settings-cache.ts src/lib/reader-settings-cache.test.ts src/components/reader/load-reader.ts src/components/reader/load-reader.test.ts src/components/reader/useReaderSettings.ts
git commit -m "feat(reader): load books from the device or download them, and keep reader settings"
```

---
### Task 9: Route `/read/$bookId` dan bingkai reader

**Files:**
- Create:
  - `src/routes/_member/read.$bookId.tsx`;
  - `src/components/reader/ReaderToolbar.tsx`, `src/components/reader/ReaderFooter.tsx`;
  - `src/components/reader/TocPanel.tsx`, `src/components/reader/ReaderSettingsPanel.tsx`;
  - `src/components/reader/JumpOffer.tsx`, `src/components/reader/ReaderProblem.tsx`.
- Modify:
  - `vite.config.ts`: plugin `glosa:foliate-epub-only` dan `optimizeDeps.exclude`.
  - `src/styles.css`.
  - `src/routeTree.gen.ts` (dibuat ulang).
- Test: `src/components/reader/TocPanel.test.tsx`, `src/components/reader/ReaderSettingsPanel.test.tsx`, `src/components/reader/JumpOffer.test.tsx`, `src/components/reader/ReaderFooter.test.tsx`

**Interfaces:**
- Consumes:
  - `ReaderView` beserta tipe `ReaderControls`, `ReaderLocation`, `ReaderReady` (Task 7);
  - `loadReader`, `ReaderData` (Task 8);
  - `useReaderSettings` (Task 8);
  - `BookLoadError` (Task 8);
  - `progressSync`, `useSyncStatus` (Task 5);
  - `markBookOpenedFn` (Task 4);
  - `jumpOffer`, `toPercentage`, `formatPercent` (Task 2);
  - nilai dan label setelan (Task 2);
  - `EpubError` (Task 7);
  - `bookMessage` (Task 4).
- Produces:
  - route `/read/$bookId` (`ssr: false`), dipakai rak di Task 10 dengan `<Link to="/read/$bookId" params={{ bookId }}>`;
  - nama aksesibel yang dipakai E2E:
    - tombol "Kembali ke rak", "Daftar isi", "Tampilan", "Lompat", "Abaikan";
    - dialog "Daftar isi" dan "Tampilan";
    - `<output>` "Posisi baca", yang kosong sampai buku tampil, lalu berisi "{n}%";
    - `<output>` "Bab saat ini";
    - slider "Posisi dalam buku";
    - `<main>` dengan atribut `data-theme`.

- [ ] **Step 1: Tulis test komponen yang gagal**

Buat `src/components/reader/TocPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TocPanel } from "./TocPanel"

const toc = [
  {
    label: "A Scandal in Bohemia",
    href: "text/a-scandal.xhtml",
    subitems: [{ label: "I", href: "text/a-scandal.xhtml#i" }],
  },
  { label: "The Redheaded League", href: "text/the-redheaded-league.xhtml" },
]

describe("TocPanel", () => {
  it("lists the chapters, marks the current one and goes where it is told", async () => {
    const onSelect = vi.fn()
    render(
      <TocPanel
        open
        onOpenChange={() => undefined}
        toc={toc}
        currentHref="text/the-redheaded-league.xhtml"
        onSelect={onSelect}
      />
    )
    await screen.findByRole("dialog", { name: "Daftar isi" })
    expect(screen.getByRole("button", { name: "I" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "The Redheaded League" })
    ).toHaveAttribute("aria-current", "true")

    fireEvent.click(screen.getByRole("button", { name: "A Scandal in Bohemia" }))
    expect(onSelect).toHaveBeenCalledWith("text/a-scandal.xhtml")
  })

  it("says so when the book has no table of contents", async () => {
    render(
      <TocPanel
        open
        onOpenChange={() => undefined}
        toc={[]}
        currentHref={null}
        onSelect={() => undefined}
      />
    )
    expect(
      await screen.findByText("Buku ini tidak punya daftar isi.")
    ).toBeInTheDocument()
  })
})
```

Buat `src/components/reader/ReaderSettingsPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_READER_SETTINGS } from "@/lib/reader-settings"
import { ReaderSettingsPanel } from "./ReaderSettingsPanel"

function renderPanel(settings = DEFAULT_READER_SETTINGS) {
  const onChange = vi.fn()
  render(
    <ReaderSettingsPanel
      open
      onOpenChange={() => undefined}
      settings={settings}
      onChange={onChange}
    />
  )
  return onChange
}

describe("ReaderSettingsPanel", () => {
  it("changes the theme, font and layout", async () => {
    const onChange = renderPanel()
    await screen.findByRole("dialog", { name: "Tampilan" })

    fireEvent.click(screen.getByLabelText("Gelap"))
    expect(onChange).toHaveBeenLastCalledWith({ theme: "dark" })
    fireEvent.click(screen.getByLabelText("Ramah disleksia"))
    expect(onChange).toHaveBeenLastCalledWith({ font: "dyslexic" })
    fireEvent.click(screen.getByLabelText("Gulir"))
    expect(onChange).toHaveBeenLastCalledWith({ flow: "scrolled" })
    expect(screen.getByLabelText("Sepia")).toBeChecked()
  })

  it("steps the font size and line height within their limits", async () => {
    const onChange = renderPanel({ ...DEFAULT_READER_SETTINGS, fontSize: 200 })
    await screen.findByRole("dialog", { name: "Tampilan" })

    expect(screen.getByRole("button", { name: "Perbesar huruf" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Perkecil huruf" }))
    expect(onChange).toHaveBeenLastCalledWith({ fontSize: 190 })
    fireEvent.click(screen.getByRole("button", { name: "Renggangkan baris" }))
    expect(onChange).toHaveBeenLastCalledWith({ lineHeight: 1.6 })
    expect(screen.getByRole("status", { name: "Ukuran huruf" })).toHaveTextContent("200%")
  })
})
```

Buat `src/components/reader/JumpOffer.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { JumpOffer } from "./JumpOffer"

const offer = {
  cfi: "epubcfi(/6/8!/4/2)",
  percentage: 45.6,
  updatedAt: "2026-10-17T09:00:00.000Z",
}

describe("JumpOffer", () => {
  it("offers the other device's place without jumping by itself", () => {
    const onJump = vi.fn()
    const onDismiss = vi.fn()
    render(<JumpOffer offer={offer} onJump={onJump} onDismiss={onDismiss} />)

    expect(
      screen.getByText("Lanjutkan dari 45% (dibaca di perangkat lain)?")
    ).toBeInTheDocument()
    expect(onJump).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Lompat" }))
    expect(onJump).toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Abaikan" }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it("renders nothing without an offer", () => {
    const { container } = render(
      <JumpOffer offer={null} onJump={() => undefined} onDismiss={() => undefined} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
```

Buat `src/components/reader/ReaderFooter.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ReaderFooter } from "./ReaderFooter"

const location = {
  fraction: 0.25,
  cfi: "epubcfi(/6/8!/4/2)",
  chapter: "The Redheaded League",
  chapterHref: "text/the-redheaded-league.xhtml",
}

afterEach(() => {
  vi.useRealTimers()
})

describe("ReaderFooter", () => {
  it("shows nothing until the book has a position", () => {
    render(<ReaderFooter hidden={false} location={null} onSeek={() => undefined} />)
    expect(screen.getByRole("status", { name: "Posisi baca" })).toBeEmptyDOMElement()
  })

  it("shows the position and chapter, and seeks after the slider rests", () => {
    vi.useFakeTimers()
    const onSeek = vi.fn()
    render(<ReaderFooter hidden={false} location={location} onSeek={onSeek} />)
    expect(screen.getByRole("status", { name: "Posisi baca" })).toHaveTextContent("25%")
    expect(screen.getByRole("status", { name: "Bab saat ini" })).toHaveTextContent(
      "The Redheaded League"
    )

    fireEvent.change(screen.getByRole("slider", { name: "Posisi dalam buku" }), {
      target: { value: "0.5" },
    })
    expect(onSeek).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(onSeek).toHaveBeenCalledWith(0.5)
  })
})
```

Run: `npx vitest run src/components/reader`
Expected: FAIL. Modul `./TocPanel` dan lainnya belum ada. `reader-input.test.ts` tetap lulus.

- [ ] **Step 2: Tulis komponen bingkai**

Buat `src/components/reader/TocPanel.tsx`:

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { TocItem } from "@/lib/reader-types"

export function TocPanel({
  open,
  onOpenChange,
  toc,
  currentHref,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  toc: ReadonlyArray<TocItem>
  currentHref: string | null
  onSelect: (href: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Daftar isi</DialogTitle>
        </DialogHeader>
        {toc.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Buku ini tidak punya daftar isi.
          </p>
        ) : (
          <TocList items={toc} currentHref={currentHref} onSelect={onSelect} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TocList({
  items,
  currentHref,
  onSelect,
}: {
  items: ReadonlyArray<TocItem>
  currentHref: string | null
  onSelect: (href: string) => void
}) {
  return (
    <ol className="space-y-0.5 text-sm">
      {items.map((item, index) => (
        <li key={`${item.href}#${index}`}>
          <button
            type="button"
            aria-current={item.href === currentHref ? "true" : undefined}
            onClick={() => onSelect(item.href)}
            className="toc-item"
          >
            {item.label.trim() || "Tanpa judul"}
          </button>
          {item.subitems && item.subitems.length > 0 && (
            <div className="pl-4">
              <TocList
                items={item.subitems}
                currentHref={currentHref}
                onSelect={onSelect}
              />
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}
```

Buat `src/components/reader/ReaderSettingsPanel.tsx`:

```tsx
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FLOW_LABELS,
  FONT_LABELS,
  FONT_SIZE,
  LINE_HEIGHT,
  MARGIN_LABELS,
  READER_FLOWS,
  READER_FONTS,
  READER_MARGINS,
  READER_THEMES,
  type ReaderSettings,
  THEME_LABELS,
  stepFontSize,
  stepLineHeight,
} from "@/lib/reader-settings"

export function ReaderSettingsPanel({
  open,
  onOpenChange,
  settings,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: ReaderSettings
  onChange: (patch: Partial<ReaderSettings>) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Tampilan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <ChoiceGroup
            legend="Huruf"
            name="reader-font"
            options={READER_FONTS}
            labels={FONT_LABELS}
            value={settings.font}
            onChange={(font) => onChange({ font })}
          />
          <Stepper
            label="Ukuran huruf"
            value={`${settings.fontSize}%`}
            decreaseLabel="Perkecil huruf"
            increaseLabel="Perbesar huruf"
            canDecrease={settings.fontSize > FONT_SIZE.min}
            canIncrease={settings.fontSize < FONT_SIZE.max}
            onStep={(direction) =>
              onChange({ fontSize: stepFontSize(settings.fontSize, direction) })
            }
          />
          <Stepper
            label="Spasi baris"
            value={settings.lineHeight.toFixed(1)}
            decreaseLabel="Rapatkan baris"
            increaseLabel="Renggangkan baris"
            canDecrease={settings.lineHeight > LINE_HEIGHT.min}
            canIncrease={settings.lineHeight < LINE_HEIGHT.max}
            onStep={(direction) =>
              onChange({
                lineHeight: stepLineHeight(settings.lineHeight, direction),
              })
            }
          />
          <ChoiceGroup
            legend="Margin"
            name="reader-margin"
            options={READER_MARGINS}
            labels={MARGIN_LABELS}
            value={settings.margin}
            onChange={(margin) => onChange({ margin })}
          />
          <ChoiceGroup
            legend="Tema"
            name="reader-theme"
            options={READER_THEMES}
            labels={THEME_LABELS}
            value={settings.theme}
            onChange={(theme) => onChange({ theme })}
          />
          <ChoiceGroup
            legend="Tata letak"
            name="reader-flow"
            options={READER_FLOWS}
            labels={FLOW_LABELS}
            value={settings.flow}
            onChange={(flow) => onChange({ flow })}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  labels,
  value,
  onChange,
}: {
  legend: string
  name: string
  options: ReadonlyArray<T>
  labels: Record<T, string>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 font-bold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className="choice-chip">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {labels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Stepper({
  label,
  value,
  decreaseLabel,
  increaseLabel,
  canDecrease,
  canIncrease,
  onStep,
}: {
  label: string
  value: string
  decreaseLabel: string
  increaseLabel: string
  canDecrease: boolean
  canIncrease: boolean
  onStep: (direction: 1 | -1) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-bold">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={decreaseLabel}
          disabled={!canDecrease}
          onClick={() => onStep(-1)}
        >
          −
        </Button>
        <output aria-label={label} className="w-12 text-center tabular-nums">
          {value}
        </output>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={increaseLabel}
          disabled={!canIncrease}
          onClick={() => onStep(1)}
        >
          +
        </Button>
      </div>
    </div>
  )
}
```

Buat `src/components/reader/JumpOffer.tsx`:

```tsx
import { Button } from "@/components/ui/button"
import { formatPercent } from "@/lib/progress"
import type { Position } from "@/lib/reader-types"

/** The other device's newer place, offered once; the reader never jumps by itself (spec §10). */
export function JumpOffer({
  offer,
  onJump,
  onDismiss,
}: {
  offer: Position | null
  onJump: () => void
  onDismiss: () => void
}) {
  if (!offer) return null
  return (
    <aside aria-label="Posisi dari perangkat lain" className="reader-toast">
      <output className="text-sm">
        Lanjutkan dari {formatPercent(offer.percentage)} (dibaca di perangkat
        lain)?
      </output>
      <div className="flex gap-2">
        <Button size="lg" onClick={onJump}>
          Lompat
        </Button>
        <Button size="lg" variant="ghost" onClick={onDismiss}>
          Abaikan
        </Button>
      </div>
    </aside>
  )
}
```

Catatan untuk test `JumpOffer`: Prettier bisa memecah teks JSX menjadi beberapa baris, seperti di atas. `getByText` mencocokkan teks yang dinormalisasi spasinya, jadi kalimatnya tetap ditemukan utuh.

Buat `src/components/reader/ReaderFooter.tsx`:

```tsx
import { useEffect, useState } from "react"
import { formatPercent, toPercentage } from "@/lib/progress"
import { cn } from "@/lib/utils"
import type { ReaderLocation } from "./ReaderView"

const SEEK_DELAY_MS = 250

export function ReaderFooter({
  hidden,
  location,
  onSeek,
}: {
  hidden: boolean
  location: ReaderLocation | null
  onSeek: (fraction: number) => void
}) {
  const [draft, setDraft] = useState<number | null>(null)
  const fraction = draft ?? location?.fraction ?? 0

  // Seek once the slider rests, not on every step of a drag.
  useEffect(() => {
    if (draft === null) return
    const timer = setTimeout(() => {
      onSeek(draft)
      setDraft(null)
    }, SEEK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft, onSeek])

  const percent =
    draft !== null || location ? formatPercent(toPercentage(fraction)) : ""
  return (
    <footer
      className={cn("reader-bar reader-bar-bottom", hidden && "reader-bar-hidden")}
      inert={hidden}
    >
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={fraction}
          onChange={(event) => setDraft(Number(event.target.value))}
          aria-label="Posisi dalam buku"
          aria-valuetext={percent}
          className="reader-slider flex-1"
        />
        <output
          aria-label="Posisi baca"
          className="w-12 text-right text-xs tabular-nums"
        >
          {percent}
        </output>
      </div>
      <output
        aria-label="Bab saat ini"
        className="block truncate text-xs text-muted-foreground"
      >
        {location?.chapter ?? ""}
      </output>
    </footer>
  )
}
```

Buat `src/components/reader/ReaderToolbar.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { ArrowLeft, List, Type } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import type { SyncStatus } from "@/lib/progress-sync"
import { cn } from "@/lib/utils"

export function ReaderToolbar({
  title,
  hidden,
  syncStatus,
  onToc,
  onSettings,
}: {
  title: string
  hidden: boolean
  syncStatus: SyncStatus
  onToc: () => void
  onSettings: () => void
}) {
  return (
    <header
      className={cn("reader-bar reader-bar-top", hidden && "reader-bar-hidden")}
      inert={hidden}
    >
      <Link
        to="/shelf"
        aria-label="Kembali ke rak"
        className={buttonVariants({
          variant: "ghost",
          size: "icon-lg",
          className: "size-10",
        })}
      >
        <ArrowLeft aria-hidden="true" />
      </Link>
      <h1 className="min-w-0 flex-1 truncate font-heading text-sm">{title}</h1>
      {syncStatus === "failing" && (
        <output className="shrink-0 text-xs text-amber-300">
          Belum tersinkron
        </output>
      )}
      <Button
        variant="ghost"
        size="icon-lg"
        className="size-10"
        aria-label="Daftar isi"
        onClick={onToc}
      >
        <List aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-lg"
        className="size-10"
        aria-label="Tampilan"
        onClick={onSettings}
      >
        <Type aria-hidden="true" />
      </Button>
    </header>
  )
}
```

Buat `src/components/reader/ReaderProblem.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"

/** A reader page that could not show its book: the reason and a way back. */
export function ReaderProblem({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Panel className="w-full max-w-md space-y-4 p-6 text-center">
        <p role="alert" className="text-sm">
          {message}
        </p>
        <div className="grid gap-2.5">
          {onRetry && (
            <button
              type="button"
              className={buttonVariants({ size: "block" })}
              onClick={onRetry}
            >
              Coba lagi
            </button>
          )}
          <Link
            to="/shelf"
            className={buttonVariants({ variant: "outline", size: "block" })}
          >
            Kembali ke rak
          </Link>
        </div>
      </Panel>
    </main>
  )
}
```

Run: `npx vitest run src/components/reader`
Expected: PASS (semua test di folder itu).

- [ ] **Step 3: Tulis route reader**

Buat `src/routes/_member/read.$bookId.tsx`:

```tsx
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useCallback, useEffect, useRef, useState } from "react"
import { JumpOffer } from "@/components/reader/JumpOffer"
import { ReaderFooter } from "@/components/reader/ReaderFooter"
import { ReaderProblem } from "@/components/reader/ReaderProblem"
import { ReaderSettingsPanel } from "@/components/reader/ReaderSettingsPanel"
import { ReaderToolbar } from "@/components/reader/ReaderToolbar"
import {
  type ReaderControls,
  type ReaderLocation,
  type ReaderReady,
  ReaderView,
} from "@/components/reader/ReaderView"
import { TocPanel } from "@/components/reader/TocPanel"
import { loadReader } from "@/components/reader/load-reader"
import { useReaderSettings } from "@/components/reader/useReaderSettings"
import { BookLoadError } from "@/lib/book-download"
import { bookMessage } from "@/lib/book-messages"
import { EpubError } from "@/lib/epub/zip-loader"
import { jumpOffer, toPercentage } from "@/lib/progress"
import { progressSync, useSyncStatus } from "@/lib/progress-sync-client"
import { THEME_COLORS } from "@/lib/reader-settings"
import type { Position, TocItem } from "@/lib/reader-types"
import { markBookOpenedFn } from "@/server/reading"

export const Route = createFileRoute("/_member/read/$bookId")({
  // The book, its position and the settings live in the browser (spec §9).
  ssr: false,
  loader: ({ params, context }) => loadReader(params.bookId, context.user.id),
  // Keep the open book while reading; load afresh on every visit.
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: 0,
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.book.title ?? "Membaca"} — Glosa` }],
  }),
  pendingComponent: ReaderPending,
  errorComponent: ReaderError,
  notFoundComponent: () => <ReaderProblem message={bookMessage("not_found")} />,
  component: ReaderPage,
})

function ReaderPending() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <output className="text-sm text-muted-foreground">
        Menyiapkan buku…
      </output>
    </main>
  )
}

function ReaderError({ error }: { error: unknown }) {
  const router = useRouter()
  return (
    <ReaderProblem
      message={bookMessage(error instanceof BookLoadError ? error.code : null)}
      onRetry={() => void router.invalidate()}
    />
  )
}

function ReaderPage() {
  const data = Route.useLoaderData()
  const bookId = data.book.id
  const { settings, update } = useReaderSettings(data.settings, data.online)
  const syncStatus = useSyncStatus()
  const markOpened = useServerFn(markBookOpenedFn)
  const [controls, setControls] = useState<ReaderControls | null>(null)
  const [toc, setToc] = useState<Array<TocItem>>([])
  const [location, setLocation] = useState<ReaderLocation | null>(null)
  const [chromeHidden, setChromeHidden] = useState(false)
  const [panel, setPanel] = useState<"toc" | "settings" | null>(null)
  const [offer, setOffer] = useState<Position | null>(() =>
    jumpOffer(data.local, data.server)
  )
  const [viewError, setViewError] = useState<string | null>(null)
  // Positions are saved only once the book is open and the member has moved
  // in it (plan 1C, decision 8).
  const ready = useRef(false)
  const interacted = useRef(false)

  useEffect(() => {
    if (!data.online) return
    markOpened({ data: { bookId } }).catch((error: unknown) =>
      console.error("marking the book opened failed", error)
    )
  }, [bookId, data.online, markOpened])

  const onReady = useCallback((info: ReaderReady) => {
    ready.current = true
    setControls(info.controls)
    setToc(info.toc)
  }, [])

  const onRelocate = useCallback(
    (next: ReaderLocation) => {
      setLocation(next)
      if (!ready.current || !interacted.current) return
      progressSync()
        .record({
          bookId,
          cfi: next.cfi,
          percentage: toPercentage(next.fraction),
          updatedAt: new Date().toISOString(),
        })
        .catch((error: unknown) => console.error("saving the position failed", error))
    },
    [bookId]
  )

  const onInteract = useCallback(() => {
    interacted.current = true
  }, [])
  const onTapMenu = useCallback(() => setChromeHidden((hidden) => !hidden), [])
  const onError = useCallback((error: unknown) => {
    console.error("opening the book failed", error)
    setViewError(error instanceof EpubError ? error.code : "unknown")
  }, [])

  const go = useCallback(
    (action: (current: ReaderControls) => Promise<void>) => {
      if (!controls) return
      interacted.current = true
      action(controls).catch((error: unknown) =>
        console.error("moving in the book failed", error)
      )
    },
    [controls]
  )
  const onSeek = useCallback(
    (fraction: number) => go((current) => current.goToFraction(fraction)),
    [go]
  )

  if (viewError) return <ReaderProblem message={bookMessage(viewError)} />

  return (
    <main
      className="reader-page"
      data-theme={settings.theme}
      style={{ background: THEME_COLORS[settings.theme].background }}
    >
      <ReaderView
        file={data.file}
        start={data.local?.cfi ?? null}
        settings={settings}
        onReady={onReady}
        onRelocate={onRelocate}
        onInteract={onInteract}
        onTapMenu={onTapMenu}
        onError={onError}
      />
      <ReaderToolbar
        title={data.book.title}
        hidden={chromeHidden}
        syncStatus={syncStatus}
        onToc={() => setPanel("toc")}
        onSettings={() => setPanel("settings")}
      />
      {!data.saved && (
        <output className="reader-note">{bookMessage("device_full")}</output>
      )}
      <JumpOffer
        offer={offer}
        onJump={() => {
          if (offer) go((current) => current.goTo(offer.cfi))
          setOffer(null)
        }}
        onDismiss={() => setOffer(null)}
      />
      <ReaderFooter hidden={chromeHidden} location={location} onSeek={onSeek} />
      <TocPanel
        open={panel === "toc"}
        onOpenChange={(open) => setPanel(open ? "toc" : null)}
        toc={toc}
        currentHref={location?.chapterHref ?? null}
        onSelect={(href) => {
          setPanel(null)
          go((current) => current.goTo(href))
        }}
      />
      <ReaderSettingsPanel
        open={panel === "settings"}
        onOpenChange={(open) => setPanel(open ? "settings" : null)}
        settings={settings}
        onChange={update}
      />
    </main>
  )
}
```

Run: `npm run generate-routes`. Bisa juga dengan menjalankan `npm run dev` sebentar.
Expected: `src/routeTree.gen.ts` memuat `/_member/read/$bookId`.

- [ ] **Step 4: Gaya bingkai reader**

Di `src/styles.css`, tambahkan aturan berikut di dalam blok `@layer components`, setelah `.reader-view` dari Task 7:

```css
  .reader-page {
    position: fixed;
    inset: 0;
    z-index: 20;
    overflow: hidden;
  }
  .reader-bar {
    position: absolute;
    inset-inline: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    background: var(--color-panel);
    color: var(--foreground);
    backdrop-filter: blur(8px);
    transition: opacity 150ms ease;
  }
  .reader-bar-top {
    top: 0;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    padding-top: max(0.5rem, env(safe-area-inset-top));
  }
  .reader-bar-bottom {
    bottom: 0;
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
  }
  .reader-bar-hidden {
    opacity: 0;
    pointer-events: none;
  }
  .reader-slider {
    accent-color: var(--color-mint);
  }
  .reader-toast,
  .reader-note {
    position: absolute;
    inset-inline: 1rem;
    z-index: 2;
    margin-inline: auto;
    max-width: 28rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--color-panel);
    padding: 0.75rem 1rem;
    color: var(--foreground);
  }
  .reader-toast {
    bottom: 5.5rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .reader-note {
    top: 4.5rem;
    display: block;
    font-size: 0.8rem;
  }
  .toc-item {
    display: block;
    width: 100%;
    border-radius: 0.375rem;
    padding: 0.4rem 0.5rem;
    text-align: left;
  }
  .toc-item:hover {
    background: var(--muted);
  }
  .toc-item[aria-current="true"] {
    color: var(--color-mint);
    font-weight: 700;
  }
  .choice-chip {
    cursor: pointer;
    border: 1px solid var(--border);
    border-radius: 9999px;
    padding: 0.35rem 0.85rem;
  }
  .choice-chip:has(:checked) {
    border-color: var(--color-mint);
    background: rgb(47 224 184 / 0.12);
    color: var(--color-mint);
  }
  .choice-chip:has(:focus-visible) {
    outline: 2px solid var(--color-mint);
    outline-offset: 2px;
  }
```

Lalu, di luar `@layer` dan di dekat aturan reduced-motion yang sudah ada untuk dialog, tambahkan:

```css
@media (prefers-reduced-motion: reduce) {
  .reader-bar {
    transition: none;
  }
}
```

- [ ] **Step 5: Keluarkan format selain EPUB dari build**

Di `vite.config.ts`:
- ubah impor `vite` menjadi `import { type Plugin, defineConfig, loadEnv } from "vite"`;
- tambahkan kode berikut di atas `export default`;
- tambahkan `foliateEpubOnly(),` sebagai plugin **pertama** di array `plugins`;
- tambahkan `optimizeDeps: { exclude: ["foliate-js"] },` di objek konfigurasi, setelah `resolve`.

```ts
const FOLIATE_UNUSED =
  /[\\/]foliate-js[\\/](?:pdf|mobi|fb2|comic-book|tts|vendor[\\/](?:zip|fflate))\.js$/
const FOLIATE_UNUSED_ID = "\0glosa-foliate-unused"

/**
 * Glosa opens EPUBs only, through its own zip loader (plan 1C, decision 10).
 * foliate's view.js still imports its PDF, MOBI, FB2, comic and TTS modules
 * lazily; an empty module in their place keeps megabytes (pdf.js) out of the
 * build and the offline cache.
 */
function foliateEpubOnly(): Plugin {
  return {
    name: "glosa:foliate-epub-only",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer || !/[\\/]foliate-js[\\/]/.test(importer)) return null
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      })
      return resolved && FOLIATE_UNUSED.test(resolved.id)
        ? FOLIATE_UNUSED_ID
        : null
    },
    load(id) {
      return id === FOLIATE_UNUSED_ID ? "export {}" : null
    },
  }
}
```

Run: `npm run build && ls -S dist/client/assets | head -5 && grep -lE "GlobalWorkerOptions|pdfjs-dist|getDocument\(" dist/client/assets/*.js`
Expected:
- build berhasil;
- tidak ada file JS di atas ± 600 kB;
- `grep` tidak menemukan apa pun (exit code 1), artinya pdf.js tidak ikut.

Catat lima file terbesar di laporan.

- [ ] **Step 6: Periksa di browser**

Jalankan `npm run dev`, masuk sebagai anggota yang raknya berisi buku. Bisa juga dengan mengunggah `e2e/fixtures/the-adventures-of-sherlock-holmes.epub` lewat Rak Saya. Lalu buka `/read/<id buku>`. Rak belum punya tautan ke reader (Task 10), jadi id buku diambil dari URL Storage atau dari tabel `books`.

Periksa di desktop dan di lebar 390 px:
1. "Menyiapkan buku…" tampil lalu buku muncul. "Posisi baca" menunjukkan persentase, dan "Bab saat ini" menunjukkan nama cerita.
2. Panah kanan/kiri dan PageDown/PageUp membalik halaman. Ketukan di sepertiga kanan/kiri juga membalik halaman, dan ketukan di tengah menyembunyikan atau menampilkan toolbar dan footer.
3. "Daftar isi" → "The Adventure of the Speckled Band" melompat ke cerita itu.
4. "Tampilan": tema Gelap, huruf Ramah disleksia, ukuran 150%, spasi 1.8, margin Lebar, dan mode Gulir semuanya terlihat berubah. Setelah reload, setelan tetap sama.
5. Sekitar 5 detik setelah berpindah, tabel `reading_progress` berisi baris untuk buku itu (periksa lewat dashboard atau skrip admin).
6. Membuka buku yang sama di jendela incognito, lalu masuk, menampilkan "Lanjutkan dari …% (dibaca di perangkat lain)?". "Lompat" membawa ke posisi tersebut.
7. Konsol tidak menunjukkan error. Peringatan foliate tentang CSS buku boleh diabaikan.

Simpan tangkapan layar desktop (sepia) dan HP (gelap) di laporan.

- [ ] **Step 7: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npx prettier --write src/components/reader src/routes vite.config.ts && npm run check && npm test && npm run build`
Expected: semua bersih dan lulus.

Lalu jalankan `grep -rlE "SUPABASE_SECRET_KEY|sb_secret|createServerClient|auth\.admin|getSupabaseAdminClient" dist/client`. Expected: tidak ada hasil.

```bash
git add vite.config.ts src/routes src/routeTree.gen.ts src/components/reader src/styles.css
git commit -m "feat(reader): add the reader page with contents, display settings and the jump offer"
```

---
### Task 10: Rak membaca dan offline — progres, salinan perangkat, dan rak dari salinan

**Files:**
- Create: `src/components/shelf/useLocalShelf.ts`, `src/components/shelf/ReadLink.tsx`, `src/lib/shelf-loader.ts`
- Modify:
  - `src/components/shelf/BookGrid.tsx`, `src/components/shelf/BookCover.tsx`, `src/components/shelf/BookDetail.tsx`, `src/components/shelf/BookActions.tsx`;
  - `src/routes/_member/shelf.tsx`;
  - `src/styles.css`.
- Test: `src/lib/shelf-loader.test.ts`, `src/components/shelf/BookActions.test.tsx`, `src/components/shelf/BookDetail.test.tsx`, `src/components/shelf/BookCover.test.tsx`

**Interfaces:**
- Consumes:
  - `ShelfBook.progress`, `listBooksFn` (Task 4);
  - `localBookIds`, `localPercentages`, `removeLocalBook`, `removeLocalPosition`, `saveShelfSnapshot`, `loadShelfSnapshot` (Task 3);
  - `saveBookOffline`, `BookLoadError` (Task 8);
  - route `/read/$bookId` (Task 9);
  - `formatPercent` (Task 2);
  - `useOnline` (1B).
- Produces:
  - `useLocalShelf(): LocalShelf`, dengan `LocalShelf = { saved: ReadonlySet<string>; percentages: ReadonlyMap<string, number> }`. Datanya dibaca setelah mount, jadi SSR tetap cocok;
  - `announceLocalChange()`;
  - `shelfPercentage(book, local): number`;
  - `loadShelf(userId): Promise<ShelfView>`, dengan `ShelfView = ShelfData & { offline: boolean }`;
  - `<ReadLink bookId percentage />`;
  - `BookActions` kini menerima prop `saved: boolean`;
  - `BookDetail` kini menerima prop `percentage?: number`;
  - `BookGrid` kini menerima prop `local: LocalShelf`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/shelf-loader.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BookLoadError } from "./book-download"
import type { ShelfData } from "./book-types"
import { loadShelf } from "./shelf-loader"

const mocks = vi.hoisted(() => ({
  listBooksFn: vi.fn(),
  loadShelfSnapshot: vi.fn(),
}))
vi.mock("@/server/books", () => ({ listBooksFn: mocks.listBooksFn }))
vi.mock("@/server/reading", () => ({ bookFileUrlFn: vi.fn() }))
vi.mock("@/lib/local/shelf-snapshot", () => ({
  loadShelfSnapshot: mocks.loadShelfSnapshot,
}))

const shelf: ShelfData = {
  books: [],
  usage: { usedBytes: 0, limitBytes: 104857600, plan: "free" },
}

beforeEach(() => {
  mocks.listBooksFn.mockReset()
  mocks.loadShelfSnapshot.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("loadShelf", () => {
  it("reads the shelf from the server when online", async () => {
    mocks.listBooksFn.mockResolvedValue(shelf)
    expect(await loadShelf("u1")).toEqual({ ...shelf, offline: false })
    expect(mocks.loadShelfSnapshot).not.toHaveBeenCalled()
  })

  it("shows the last saved shelf when the device is offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    mocks.loadShelfSnapshot.mockResolvedValue(shelf)
    expect(await loadShelf("u1")).toEqual({ ...shelf, offline: true })
    expect(mocks.listBooksFn).not.toHaveBeenCalled()
    expect(mocks.loadShelfSnapshot).toHaveBeenCalledWith("u1")
  })

  it("falls back to the saved shelf when the server cannot be reached", async () => {
    mocks.listBooksFn.mockRejectedValue(new TypeError("Failed to fetch"))
    mocks.loadShelfSnapshot.mockResolvedValue(shelf)
    expect(await loadShelf("u1")).toEqual({ ...shelf, offline: true })
  })

  it("rethrows other server errors", async () => {
    mocks.listBooksFn.mockRejectedValue(new Error("rusak"))
    await expect(loadShelf("u1")).rejects.toThrow("rusak")
  })

  it("explains when no shelf was saved on this device", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    mocks.loadShelfSnapshot.mockResolvedValue(null)
    await expect(loadShelf("u1")).rejects.toEqual(
      new BookLoadError("offline_no_shelf")
    )
  })
})
```

Di `src/components/shelf/BookCover.test.tsx`, tambahkan test berikut di dalam `describe("BookCover", …)`:

```tsx
  it("falls back to the titled spine when the cover fails to load", () => {
    const { container } = render(
      <BookCover book={{ title: "Sherlock", coverUrl: "https://storage/old.webp" }} />
    )
    fireEvent.error(container.querySelector("img")!)
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByText("Sherlock")).toBeInTheDocument()
  })
```

Ubah juga impor di file itu menjadi `import { fireEvent, render, screen } from "@testing-library/react"`.

Di `src/components/shelf/BookDetail.test.tsx`, tambahkan test berikut di dalam `describe("BookDetail", …)`:

```tsx
  it("shows how far the book has been read", async () => {
    render(
      <BookDetail book={sherlock} percentage={45.6} onClose={() => undefined} />
    )
    const dialog = await screen.findByRole("dialog", { name: sherlock.title })
    expect(dialog).toHaveTextContent("Dibaca45%")
  })
```

Di `src/components/shelf/BookActions.test.tsx`:

1. Ganti blok `vi.hoisted` dan `vi.mock` di bagian atas dengan:

```tsx
const mocks = vi.hoisted(() => ({
  updateBookGenreFn: vi.fn(),
  deleteBookFn: vi.fn(),
  saveBookOffline: vi.fn(),
  removeLocalBook: vi.fn(),
  removeLocalPosition: vi.fn(),
}))
const { updateBookGenreFn, deleteBookFn } = mocks
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/books", () => ({
  updateBookGenreFn: mocks.updateBookGenreFn,
  deleteBookFn: mocks.deleteBookFn,
}))
vi.mock("@/lib/book-download", () => ({
  saveBookOffline: mocks.saveBookOffline,
  BookLoadError: class BookLoadError extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  },
}))
vi.mock("@/lib/local/book-files", () => ({
  removeLocalBook: mocks.removeLocalBook,
  localBookIds: vi.fn(async () => new Set()),
}))
vi.mock("@/lib/local/positions", () => ({
  removeLocalPosition: mocks.removeLocalPosition,
  localPercentages: vi.fn(async () => new Map()),
}))
```

2. Tambahkan `saved={false}` pada setiap `<BookActions …>` yang sudah ada di file itu.

3. Ubah impor Vitest menjadi `import { afterEach, describe, expect, it, vi } from "vitest"`, lalu tambahkan di bawah blok mock:

```tsx
afterEach(() => {
  vi.restoreAllMocks()
  // Call history carries over between tests otherwise ("not called" checks below).
  vi.clearAllMocks()
})
```

4. Tambahkan test berikut di akhir `describe("BookActions", …)`:

```tsx
  it("saves the book for offline reading", async () => {
    mocks.saveBookOffline.mockResolvedValueOnce(true)
    render(
      <BookActions book={sherlock} saved={false} onGenreSaved={vi.fn()} onDeleted={vi.fn()} />
    )
    fireEvent.click(screen.getByRole("button", { name: "Simpan offline" }))
    expect(await screen.findByText("Tersimpan untuk offline.")).toBeInTheDocument()
    expect(mocks.saveBookOffline).toHaveBeenCalledWith(sherlock.id)
  })

  it("explains when the device has no room for the book", async () => {
    mocks.saveBookOffline.mockResolvedValueOnce(false)
    render(
      <BookActions book={sherlock} saved={false} onGenreSaved={vi.fn()} onDeleted={vi.fn()} />
    )
    fireEvent.click(screen.getByRole("button", { name: "Simpan offline" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Penyimpanan perangkat penuh. Buku ini tidak bisa disimpan untuk offline."
    )
  })

  it("removes only this device's copy", async () => {
    mocks.removeLocalBook.mockResolvedValueOnce(undefined)
    render(
      <BookActions book={sherlock} saved onGenreSaved={vi.fn()} onDeleted={vi.fn()} />
    )
    fireEvent.click(screen.getByRole("button", { name: "Hapus dari perangkat" }))
    expect(
      await screen.findByText("Salinan di perangkat ini dihapus.")
    ).toBeInTheDocument()
    expect(mocks.removeLocalBook).toHaveBeenCalledWith(sherlock.id)
    expect(mocks.removeLocalPosition).not.toHaveBeenCalled()
    expect(deleteBookFn).not.toHaveBeenCalled()
  })

  it("deleting the book also removes this device's copy and position", async () => {
    deleteBookFn.mockResolvedValueOnce({ ok: true })
    mocks.removeLocalBook.mockResolvedValueOnce(undefined)
    mocks.removeLocalPosition.mockResolvedValueOnce(undefined)
    const onDeleted = vi.fn()
    render(
      <BookActions book={sherlock} saved onGenreSaved={vi.fn()} onDeleted={onDeleted} />
    )
    fireEvent.click(screen.getByRole("button", { name: "Hapus buku" }))
    fireEvent.click(screen.getByRole("button", { name: "Ya, hapus" }))
    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledWith(sherlock))
    expect(mocks.removeLocalBook).toHaveBeenCalledWith(sherlock.id)
    expect(mocks.removeLocalPosition).toHaveBeenCalledWith(sherlock.id)
  })

  it("needs a connection for changes, deletion and offline copies", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    render(
      <BookActions book={sherlock} saved={false} onGenreSaved={vi.fn()} onDeleted={vi.fn()} />
    )
    expect(screen.getByText("Butuh internet.")).toBeInTheDocument()
    expect(screen.getByLabelText("Genre")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Hapus buku" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Simpan offline" })).toBeDisabled()
  })
```

Run: `npx vitest run src/lib/shelf-loader.test.ts src/components/shelf`
Expected: FAIL. `shelf-loader` belum ada, `BookActions` belum punya bagian "Di perangkat ini", dan seterusnya.

- [ ] **Step 2: Status lokal rak dan tautan baca**

Buat `src/components/shelf/useLocalShelf.ts`:

```ts
import { useEffect, useState } from "react"
import type { ShelfBook } from "@/lib/book-types"
import { localBookIds } from "@/lib/local/book-files"
import { localPercentages } from "@/lib/local/positions"

const LOCAL_CHANGE_EVENT = "glosa:local-change"

/** Tells every useLocalShelf on the page that this device's copies changed. */
export function announceLocalChange(): void {
  window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT))
}

export type LocalShelf = {
  saved: ReadonlySet<string>
  percentages: ReadonlyMap<string, number>
}

const EMPTY: LocalShelf = { saved: new Set(), percentages: new Map() }

/**
 * What this device holds: books saved for offline reading and the last
 * position read here. Read after mount, so the server render stays the same.
 */
export function useLocalShelf(): LocalShelf {
  const [local, setLocal] = useState<LocalShelf>(EMPTY)

  useEffect(() => {
    let active = true
    const read = () => {
      Promise.all([localBookIds(), localPercentages()]).then(
        ([saved, percentages]) => {
          if (active) setLocal({ saved, percentages })
        },
        (error: unknown) => console.error("reading this device's books failed", error)
      )
    }
    read()
    window.addEventListener(LOCAL_CHANGE_EVENT, read)
    return () => {
      active = false
      window.removeEventListener(LOCAL_CHANGE_EVENT, read)
    }
  }, [])

  return local
}

/** Progress shown on the shelf: this device's position first, else the server's (plan 1C, decision 13). */
export function shelfPercentage(book: ShelfBook, local: LocalShelf): number {
  return local.percentages.get(book.id) ?? book.progress ?? 0
}
```

Buat `src/components/shelf/ReadLink.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import { formatPercent } from "@/lib/progress"

export function ReadLink({
  bookId,
  percentage,
}: {
  bookId: string
  percentage: number
}) {
  return (
    <Link
      to="/read/$bookId"
      params={{ bookId }}
      className={buttonVariants({ size: "block" })}
    >
      {percentage > 0
        ? `Lanjutkan membaca · ${formatPercent(percentage)}`
        : "Mulai membaca"}
    </Link>
  )
}
```

- [ ] **Step 3: Cover, kisi, dan detail**

Di `src/components/shelf/BookCover.tsx`:
- tambahkan `import { type CSSProperties, useState } from "react"`, menggantikan impor `CSSProperties`;
- ganti bagian awal fungsi `BookCover` sampai akhir cabang `if (book.coverUrl) { … }` dengan:

```tsx
export function BookCover({
  book,
  className,
}: {
  book: Pick<ShelfBook, "title" | "coverUrl">
  className?: string
}) {
  // Signed cover URLs expire after an hour (spec §12): a cover that fails to
  // load gets the titled spine instead of a broken image.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (book.coverUrl && book.coverUrl !== failedUrl) {
    const url = book.coverUrl
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        draggable={false}
        onError={() => setFailedUrl(url)}
        className={cn("book-cover", className)}
      />
    )
  }
```

Bagian `return (<span … book-cover-blank …>)` tidak berubah.

Tulis ulang `src/components/shelf/BookGrid.tsx` menjadi:

```tsx
import type { ReactNode } from "react"
import type { ShelfBook } from "@/lib/book-types"
import { formatPercent } from "@/lib/progress"
import { BookCover } from "./BookCover"
import { type LocalShelf, shelfPercentage } from "./useLocalShelf"

export function BookGrid({
  books,
  local,
  onOpen,
  footer,
}: {
  books: ReadonlyArray<ShelfBook>
  local: LocalShelf
  onOpen: (book: ShelfBook) => void
  footer?: (book: ShelfBook) => ReactNode
}) {
  return (
    <ul className="shelf-grid">
      {books.map((book) => {
        const percentage = shelfPercentage(book, local)
        return (
          <li key={book.id} className="shelf-slot">
            <button
              type="button"
              onClick={() => onOpen(book)}
              className="block w-full rounded-sm text-left outline-offset-4 focus-visible:outline-2 focus-visible:outline-mint"
            >
              <BookCover book={book} />
              {percentage > 0 && (
                <progress
                  max={100}
                  value={percentage}
                  aria-label={`Dibaca ${formatPercent(percentage)}`}
                  className="book-progress mt-1.5"
                />
              )}
              <span className="mt-2 line-clamp-2 block min-h-[2lh] text-xs font-bold">
                {book.title}
              </span>
              {book.author && (
                <span className="line-clamp-1 text-[0.7rem] text-muted-foreground">
                  {book.author}
                </span>
              )}
              {local.saved.has(book.id) && (
                <span className="offline-badge mt-1">Tersedia offline</span>
              )}
            </button>
            {footer?.(book)}
          </li>
        )
      })}
    </ul>
  )
}
```

Di `src/components/shelf/BookDetail.tsx`:
- tambahkan `import { formatPercent } from "@/lib/progress"`;
- tambahkan prop `percentage = 0` (tipe `percentage?: number`) ke parameter dan tipe props;
- di dalam `<dl>`, tepat sebelum `<dt …>Ukuran</dt>`, tambahkan:

```tsx
            {percentage > 0 && (
              <>
                <dt className="text-muted-foreground">Dibaca</dt>
                <dd>{formatPercent(percentage)}</dd>
              </>
            )}
```

Di `src/styles.css`, tambahkan aturan berikut di dalam `@layer components`, setelah `.book-cover-blank`:

```css
  .book-progress {
    display: block;
    width: 100%;
    height: 0.25rem;
    appearance: none;
    border: 0;
    border-radius: 9999px;
    overflow: hidden;
    background: rgb(255 255 255 / 0.12);
  }
  .book-progress::-webkit-progress-bar {
    background: rgb(255 255 255 / 0.12);
  }
  .book-progress::-webkit-progress-value {
    background: var(--color-mint);
  }
  .book-progress::-moz-progress-bar {
    background: var(--color-mint);
  }
  .offline-badge {
    display: inline-block;
    border-radius: 9999px;
    background: rgb(47 224 184 / 0.15);
    padding: 0.1rem 0.5rem;
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--color-mint);
  }
```

- [ ] **Step 4: Aksi buku — salinan perangkat dan butuh internet**

Tulis ulang `src/components/shelf/BookActions.tsx` menjadi:

```tsx
import { useServerFn } from "@tanstack/react-start"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { BookLoadError, saveBookOffline } from "@/lib/book-download"
import { bookMessage } from "@/lib/book-messages"
import type { ShelfBook } from "@/lib/book-types"
import {
  GENRE_LABELS,
  GENRE_VALUES,
  type Genre,
  TROLLEY_LABEL,
  isGenre,
} from "@/lib/genre"
import { removeLocalBook } from "@/lib/local/book-files"
import { removeLocalPosition } from "@/lib/local/positions"
import { formatBytes } from "@/lib/member"
import { useOnline } from "@/lib/use-online"
import { deleteBookFn } from "@/server/books"
import { announceLocalChange } from "./useLocalShelf"
import { useSaveGenre } from "./useSaveGenre"

type CopyState = "idle" | "saved" | "removed" | { code: string }

export function BookActions({
  book,
  saved,
  onGenreSaved,
  onDeleted,
}: {
  book: ShelfBook
  /** Whether this device holds the EPUB for offline reading. */
  saved: boolean
  onGenreSaved: (genre: Genre) => void
  onDeleted: (book: ShelfBook) => void
}) {
  const genreId = useId()
  const online = useOnline()
  const { save, saving } = useSaveGenre()
  const [genre, setGenre] = useState<Genre | null>(book.genre)
  const [genreState, setGenreState] = useState<
    "idle" | "saved" | { code: string }
  >("idle")

  const deleteBook = useServerFn(deleteBookFn)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [copyBusy, setCopyBusy] = useState(false)
  const [copyState, setCopyState] = useState<CopyState>("idle")

  async function onGenre(value: string) {
    if (!isGenre(value)) return
    const previous = genre
    setGenre(value)
    setGenreState("idle")
    const result = await save(book.id, value)
    if (result.ok) {
      setGenreState("saved")
      onGenreSaved(value)
    } else {
      setGenre(previous)
      setGenreState({ code: result.code })
    }
  }

  async function onConfirmDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteBook({ data: { bookId: book.id } })
      if (result.ok) {
        // The book is gone from the server: this device's copy goes too (spec §5).
        await Promise.all([
          removeLocalBook(book.id),
          removeLocalPosition(book.id),
        ]).catch((error: unknown) =>
          console.error("removing this device's copy failed", error)
        )
        announceLocalChange()
        onDeleted(book)
        return
      }
      setDeleteError(result.code)
    } catch {
      setDeleteError("unknown")
    }
    setDeleting(false)
  }

  async function onSaveOffline() {
    setCopyBusy(true)
    setCopyState("idle")
    try {
      const stored = await saveBookOffline(book.id)
      setCopyState(stored ? "saved" : { code: "device_full_offline" })
      if (stored) announceLocalChange()
    } catch (error) {
      setCopyState({
        code: error instanceof BookLoadError ? error.code : "unknown",
      })
    }
    setCopyBusy(false)
  }

  async function onRemoveCopy() {
    setCopyBusy(true)
    setCopyState("idle")
    try {
      // Only the file: a position not yet sent stays until it reaches the server.
      await removeLocalBook(book.id)
      setCopyState("removed")
      announceLocalChange()
    } catch {
      setCopyState({ code: "unknown" })
    }
    setCopyBusy(false)
  }

  return (
    <div className="space-y-4 border-t pt-4">
      {!online && (
        <p className="text-xs text-muted-foreground">{bookMessage("offline")}</p>
      )}

      <div className="space-y-1">
        <label htmlFor={genreId} className="block text-sm font-bold">
          Genre
        </label>
        <select
          id={genreId}
          value={genre ?? ""}
          disabled={saving || !online}
          onChange={(event) => void onGenre(event.target.value)}
          className="native-select w-full"
        >
          {genre === null && <option value="">{TROLLEY_LABEL}</option>}
          {GENRE_VALUES.map((value) => (
            <option key={value} value={value}>
              {GENRE_LABELS[value]}
            </option>
          ))}
        </select>
        <output className="block min-h-4 text-xs text-muted-foreground">
          {genreState === "saved" ? "Genre disimpan." : ""}
        </output>
        {typeof genreState === "object" && (
          <p role="alert" className="text-xs text-stamp">
            {bookMessage(genreState.code)}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-bold">Di perangkat ini</p>
        {saved ? (
          <Button
            variant="outline"
            onClick={() => void onRemoveCopy()}
            disabled={copyBusy}
          >
            Hapus dari perangkat
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => void onSaveOffline()}
            disabled={copyBusy || !online}
          >
            {copyBusy ? "Menyimpan…" : "Simpan offline"}
          </Button>
        )}
        <output className="block min-h-4 text-xs text-muted-foreground">
          {copyState === "saved"
            ? "Tersimpan untuk offline."
            : copyState === "removed"
              ? "Salinan di perangkat ini dihapus."
              : ""}
        </output>
        {typeof copyState === "object" && (
          <p role="alert" className="text-xs text-stamp">
            {bookMessage(copyState.code)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {!confirming ? (
          <Button
            variant="destructive"
            onClick={() => setConfirming(true)}
            disabled={!online}
          >
            Hapus buku
          </Button>
        ) : (
          <>
            <p className="text-sm">
              Hapus “{book.title}” beserta filenya? Kuota{" "}
              {formatBytes(book.sizeBytes)} kembali ke rakmu.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => void onConfirmDelete()}
                disabled={deleting || !online}
              >
                {deleting ? "Menghapus…" : "Ya, hapus"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirming(false)}
                disabled={deleting}
              >
                Batal
              </Button>
            </div>
          </>
        )}
        {deleteError && (
          <p role="alert" className="text-sm text-stamp">
            {bookMessage(deleteError)}
          </p>
        )}
      </div>
    </div>
  )
}
```

Catatan:
- Teks tombol "Simpan offline" berubah menjadi "Menyimpan…" selama proses. Test mencari tombol sebelum diklik, jadi tidak terpengaruh.
- Setelah berhasil, `announceLocalChange` membuat rak membaca ulang status lokal. Prop `saved` lalu menjadi `true`, dan tombolnya berganti menjadi "Hapus dari perangkat".

- [ ] **Step 5: Loader rak yang tahan offline**

Buat `src/lib/shelf-loader.ts`:

```ts
import { listBooksFn } from "@/server/books"
import { BookLoadError } from "./book-download"
import type { ShelfData } from "./book-types"
import { loadShelfSnapshot } from "./local/shelf-snapshot"

export type ShelfView = ShelfData & { offline: boolean }

/**
 * Online: the server's shelf. Offline in the browser: the last shelf saved on
 * this device (spec §11; plan 1C, decision 2).
 */
export async function loadShelf(userId: string): Promise<ShelfView> {
  if (import.meta.env.SSR) return { ...(await listBooksFn()), offline: false }
  if (navigator.onLine) {
    try {
      return { ...(await listBooksFn()), offline: false }
    } catch (error) {
      if (navigator.onLine && !(error instanceof TypeError)) throw error
    }
  }
  const snapshot = await loadShelfSnapshot(userId)
  if (!snapshot) throw new BookLoadError("offline_no_shelf")
  return { ...snapshot, offline: true }
}
```

Tulis ulang `src/routes/_member/shelf.tsx` menjadi:

```tsx
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { RouteError } from "@/components/RouteError"
import { BookActions } from "@/components/shelf/BookActions"
import { BookDetail } from "@/components/shelf/BookDetail"
import { BookGrid } from "@/components/shelf/BookGrid"
import { EmptyShelf } from "@/components/shelf/EmptyShelf"
import { GenreFilter } from "@/components/shelf/GenreFilter"
import { ReadLink } from "@/components/shelf/ReadLink"
import { ShelfHeader } from "@/components/shelf/ShelfHeader"
import { ShelfToolbar } from "@/components/shelf/ShelfToolbar"
import { TrolleyGenrePicker } from "@/components/shelf/TrolleyGenrePicker"
import { UploadPanel } from "@/components/shelf/UploadPanel"
import {
  shelfPercentage,
  useLocalShelf,
} from "@/components/shelf/useLocalShelf"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"
import { BookLoadError } from "@/lib/book-download"
import { bookMessage } from "@/lib/book-messages"
import { genreLabel } from "@/lib/genre"
import { saveShelfSnapshot } from "@/lib/local/shelf-snapshot"
import { countBooks, parseShelfSearch, shelfBooks } from "@/lib/shelf"
import { loadShelf } from "@/lib/shelf-loader"

export const Route = createFileRoute("/_member/shelf")({
  validateSearch: parseShelfSearch,
  loader: ({ context }) => loadShelf(context.user.id),
  // Filtering happens in the browser; reload only on invalidate or after a minute.
  staleTime: 60_000,
  head: () => ({ meta: [{ title: "Rak Saya — Glosa" }] }),
  errorComponent: ShelfError,
  component: ShelfPage,
})

function ShelfError({ error }: { error: unknown }) {
  if (!(error instanceof BookLoadError)) return <RouteError error={error} />
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Panel className="w-full max-w-md space-y-4 p-6 text-center">
        <p role="alert" className="text-sm">
          {bookMessage(error.code)}
        </p>
        <Link to="/lobby" className="text-sm text-mint underline">
          ← Lobi
        </Link>
      </Panel>
    </main>
  )
}

function ShelfPage() {
  const { books, usage, offline } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const router = useRouter()
  const local = useLocalShelf()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState("")
  const visible = useMemo(() => shelfBooks(books, search), [books, search])
  const counts = useMemo(() => countBooks(books), [books])
  const selected = books.find((book) => book.id === selectedId) ?? null
  const inTrolley = search.genre === "troli"
  const bringButton = (
    <Button onClick={() => setUploading(true)}>Bawa buku</Button>
  )

  // What this shelf looked like online is what offline visits show.
  useEffect(() => {
    if (offline) return
    saveShelfSnapshot(user.id, { books, usage }).catch((error: unknown) =>
      console.error("saving the shelf snapshot failed", error)
    )
  }, [books, usage, offline, user.id])

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-5 p-4 sm:p-8">
      <ShelfHeader
        usage={usage}
        actions={books.length > 0 ? bringButton : undefined}
      />
      {offline && (
        <output className="block rounded-lg border bg-panel px-4 py-2 text-sm">
          Kamu sedang offline. Rak ditampilkan dari salinan terakhir di
          perangkat ini.
        </output>
      )}
      <output className="block min-h-5 text-sm text-mint">{notice}</output>
      {books.length === 0 ? (
        <EmptyShelf action={bringButton} />
      ) : (
        <>
          <GenreFilter active={search.genre ?? "semua"} counts={counts} />
          <ShelfToolbar q={search.q ?? ""} sort={search.sort ?? "opened"} />
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search.q
                ? "Tidak ada buku yang cocok dengan pencarianmu."
                : "Belum ada buku di bagian ini."}
            </p>
          ) : (
            <BookGrid
              books={visible}
              local={local}
              onOpen={(book) => setSelectedId(book.id)}
              footer={
                inTrolley
                  ? (book) => (
                      <TrolleyGenrePicker
                        book={book}
                        onSaved={(genre) => {
                          setNotice(`Dipindahkan ke ${genreLabel(genre)}.`)
                          void router.invalidate()
                        }}
                      />
                    )
                  : undefined
              }
            />
          )}
        </>
      )}
      <BookDetail
        book={selected}
        percentage={selected ? shelfPercentage(selected, local) : 0}
        onClose={() => setSelectedId(null)}
      >
        {selected && (
          <>
            <ReadLink
              bookId={selected.id}
              percentage={shelfPercentage(selected, local)}
            />
            <BookActions
              key={selected.id}
              book={selected}
              saved={local.saved.has(selected.id)}
              onGenreSaved={() => void router.invalidate()}
              onDeleted={(book) => {
                setSelectedId(null)
                setNotice(`“${book.title}” dihapus dari rak.`)
                void router.invalidate()
              }}
            />
          </>
        )}
      </BookDetail>
      <UploadPanel open={uploading} onOpenChange={setUploading} usage={usage} />
    </main>
  )
}
```

`TrolleyGenrePicker` memanggil server function. Saat offline, select di dalamnya akan gagal tersimpan dan menampilkan pesan error-nya sendiri. Itu cukup untuk kasus yang jarang ini. Jangan ubah komponen itu di task ini.

- [ ] **Step 6: Jalankan test dan periksa di browser**

Run: `npx vitest run src/lib/shelf-loader.test.ts src/components/shelf`
Expected: PASS.

Lalu jalankan `npm run typecheck && npm run lint && npx prettier --write src && npm run check && npm test && npm run build`. Expected: semua bersih dan lulus.

Periksa di `npm run dev`, desktop dan lebar 390 px:
1. Buku yang pernah dibuka punya bar progres tipis dan penanda "Tersedia offline".
2. Di Detail Buku, buku yang belum dibaca menampilkan "Mulai membaca", dan buku yang sudah dibaca menampilkan "Lanjutkan membaca · n%". Tombol itu membuka reader.
3. "Hapus dari perangkat" menghapus penandanya. "Simpan offline" mengembalikannya.
4. Di DevTools → Network → Offline, lalu klik ke Lobi dan kembali ke Rak Saya: muncul "Kamu sedang offline. Rak ditampilkan dari salinan terakhir di perangkat ini.", serta "Butuh internet." di Detail Buku. Tombol genre, hapus, dan simpan offline nonaktif.

Lalu jalankan `npx playwright test e2e/shelf.spec.ts`. Expected: 10 lulus di dua proyek. Nama tombol buku kini juga berisi teks progres/penanda, tetapi regex judul di test tetap cocok.

- [ ] **Step 7: Commit**

```bash
git add src/components/shelf src/lib/shelf-loader.ts src/lib/shelf-loader.test.ts src/routes/_member/shelf.tsx src/styles.css
git commit -m "feat(shelf): show reading progress and offline copies, and open the shelf offline"
```

---
### Task 11: PWA offline — shell, service worker, dan E2E offline

**Files:**
- Create: `pwa/sw.template.js`, `scripts/build-sw.mjs`, `src/lib/pwa.ts`, `e2e/helpers/books.ts`, `e2e/offline.spec.ts`
- Modify:
  - `vite.config.ts`: shell SPA.
  - `package.json`: script `build`.
  - `src/routes/__root.tsx`: registrasi service worker.
  - `public/manifest.json`.
  - `eslint.config.js`.
  - `playwright.config.ts`.

**Interfaces:**
- Consumes:
  - `currentUser` / `resolveUser` (Task 6). Shell di-prerender dengan `user: undefined`;
  - `loadShelf` dan salinan rak (Task 10), `loadReader` (Task 8);
  - `COVER_CACHE = "glosa-covers"` (Task 3).
- Produces:
  - `dist/client/_shell.html` dan `dist/client/sw.js` setelah `npm run build`;
  - `registerServiceWorker()`;
  - helper E2E `seedBook(userId, path, meta): Promise<string>`, `storedPercentage(bookId): Promise<number | null>`, `readerSettingsOf(userId): Promise<unknown>`, yang dipakai Task 12;
  - proyek Playwright `offline` (Desktop Chrome, `http://localhost:4173`, build produksi lewat `vite preview`).

Service worker hanya ada di build produksi. Dev server (`npm run dev`) tidak mendaftarkannya, sehingga cache tidak pernah mengganggu HMR.

- [ ] **Step 1: Aktifkan shell SPA**

Di `vite.config.ts`, ganti `tanstackStart(),` dengan:

```ts
      // Also prerender the app shell (dist/client/_shell.html): the service
      // worker serves it for navigations while offline (plan 1C, decision 4).
      tanstackStart({ spa: { enabled: true } }),
```

Run: `npm run build && grep -o 'user:[^,}]*' dist/client/_shell.html`
Expected:
- build berhasil, dan log berisi `[prerender] Prerendered 1 pages`;
- `grep` mencetak `user:void 0`. `beforeLoad` root mengembalikan `undefined` saat prerender, sesuai Task 6, tanpa menghubungi Supabase.

Jika yang tercetak `user:null`, berarti `process.env.TSS_PRERENDERING` tidak terbaca. Hentikan pekerjaan dan laporkan.

- [ ] **Step 2: Tulis service worker dan pembuatnya**

Buat `pwa/sw.template.js`:

```js
// Glosa's service worker (plan 1C, Task 11). scripts/build-sw.mjs copies this
// file to dist/client/sw.js and fills in the build version and the list of
// files to precache.

const VERSION = "__GLOSA_VERSION__"
const PRECACHE = __GLOSA_PRECACHE__

const APP_CACHE = `glosa-app-${VERSION}`
// Same name as COVER_CACHE in src/lib/local/keys.ts (cleared on sign-out).
const COVER_CACHE = "glosa-covers"
const SHELL = "/_shell.html"
const PRECACHED = new Set(PRECACHE)

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(PRECACHE))
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("glosa-app-") && key !== APP_CACHE) {
          await caches.delete(key)
        }
      }
      await self.clients.claim()
    })()
  )
})

/** Signed cover URLs from Supabase Storage (the token changes every hour). */
function isCover(url) {
  return (
    url.pathname.includes("/storage/v1/object/sign/books/") &&
    /-cover\.(?:webp|jpg)$/.test(url.pathname)
  )
}

async function cacheFirst(cacheName, key, request) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(key)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok || response.type === "opaque") {
    await cache.put(key, response.clone())
  }
  return response
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)

  if (request.mode === "navigate") {
    // Pages always come from the server, so no member page is ever cached.
    // Offline, the app shell takes over and the router renders the page in
    // the browser from this device's data.
    event.respondWith(
      fetch(request).catch(async () => {
        const shell = await caches.match(SHELL)
        return shell ?? Response.error()
      })
    )
    return
  }

  if (isCover(url)) {
    // Cached by path without the token, so a cover still shows when its
    // signed URL has changed or the device is offline.
    event.respondWith(
      cacheFirst(COVER_CACHE, new Request(url.origin + url.pathname), request)
    )
    return
  }

  if (url.origin === self.location.origin && PRECACHED.has(url.pathname)) {
    event.respondWith(
      caches
        .match(url.pathname)
        .then((cached) => cached ?? fetch(request))
    )
  }
  // Everything else (server functions, EPUB downloads) goes to the network.
})
```

Buat `scripts/build-sw.mjs`:

```js
// Writes dist/client/sw.js from pwa/sw.template.js after `vite build`, with the
// files to precache: the app shell, every built asset (scripts, styles, woff2
// fonts) and the public icons and lobby images.
import { createHash } from "node:crypto"
import { readFile, readdir, stat, writeFile } from "node:fs/promises"
import { join, relative, sep } from "node:path"

const CLIENT_DIR = "dist/client"
// Source maps, woff (every browser here takes woff2), build metadata in dot
// folders (not served), the worker itself and crawler files.
const SKIP = [
  /\.map$/,
  /\.woff$/,
  /(^|\/)\./,
  /^sw\.js$/,
  /^robots\.txt$/,
  /\.xml$/,
]

async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? filesIn(path) : [path]
    })
  )
  return nested.flat()
}

const files = (await filesIn(CLIENT_DIR))
  .map((path) => relative(CLIENT_DIR, path).split(sep).join("/"))
  .filter((path) => !SKIP.some((pattern) => pattern.test(path)))
  .sort()
if (!files.includes("_shell.html")) {
  throw new Error(
    "dist/client/_shell.html is missing: is the SPA shell enabled in vite.config.ts?"
  )
}

const hash = createHash("sha256")
let bytes = 0
for (const file of files) {
  const path = join(CLIENT_DIR, file)
  hash.update(file).update(await readFile(path))
  bytes += (await stat(path)).size
}
const version = hash.digest("hex").slice(0, 12)

const template = await readFile("pwa/sw.template.js", "utf8")
const source = template
  .replace('"__GLOSA_VERSION__"', JSON.stringify(version))
  .replace("__GLOSA_PRECACHE__", JSON.stringify(files.map((file) => `/${file}`)))
if (source.includes("__GLOSA_")) {
  throw new Error("pwa/sw.template.js still has a placeholder")
}
await writeFile(join(CLIENT_DIR, "sw.js"), source)
console.log(
  `sw.js: ${files.length} files precached (${(bytes / 1024 / 1024).toFixed(1)} MB), version ${version}`
)
```

Di `package.json`, ubah script `build` menjadi:

```json
    "build": "vite build && node scripts/build-sw.mjs",
```

Di `eslint.config.js`, tambahkan `"pwa/**",` ke array `ignores`. Template ini adalah skrip service worker biasa, bukan modul TypeScript proyek, dan Prettier tetap memformatnya.

Run: `npm run build`
Expected:
- build berhasil;
- log mencetak `sw.js: N files precached (X MB), version …`, dengan X di bawah ± 5 MB;
- `dist/client/sw.js` berisi daftar file dan tidak berisi `__GLOSA_`.

Catat N dan X di laporan.

- [ ] **Step 3: Daftarkan service worker dan rapikan manifest**

Buat `src/lib/pwa.ts`:

```ts
/** Registers the offline service worker, which only exists in production builds. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return
  navigator.serviceWorker
    .register("/sw.js")
    .catch((error: unknown) =>
      console.error("service worker registration failed", error)
    )
}
```

Di `src/routes/__root.tsx`:
- tambahkan `import { registerServiceWorker } from "@/lib/pwa"`;
- di `RootComponent`, setelah effect `rememberUser`, tambahkan:

```tsx
  useEffect(() => {
    registerServiceWorker()
  }, [])
```

Di `public/manifest.json`, tambahkan `"id": "/",` dan `"scope": "/",` tepat sebelum `"start_url": "/"`.

- [ ] **Step 4: Helper E2E untuk buku**

Buat `e2e/helpers/books.ts`:

```ts
import { createHash, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { admin } from "./members"

export const SHERLOCK = {
  path: "e2e/fixtures/the-adventures-of-sherlock-holmes.epub",
  title: "The Adventures of Sherlock Holmes",
  author: "Arthur Conan Doyle",
}

/**
 * Puts an EPUB straight on a member's shelf, without the upload screen:
 * reserve, upload through the admin client, mark ready. The global teardown
 * removes it with the member.
 */
export async function seedBook(
  userId: string,
  book: { path: string; title: string; author: string } = SHERLOCK
): Promise<string> {
  const file = await readFile(book.path)
  const bookId = randomUUID()
  const client = admin()
  const { error } = await client
    .rpc("reserve_book_upload", {
      p_user_id: userId,
      p_book_id: bookId,
      p_sha256: createHash("sha256").update(file).digest("hex"),
      p_epub_bytes: file.byteLength,
      p_title: book.title,
      p_author: book.author,
      p_subjects: [],
    })
    .single()
  if (error) throw error
  const { error: uploadError } = await client.storage
    .from("books")
    .upload(`${userId}/${bookId}.epub`, file, {
      contentType: "application/epub+zip",
    })
  if (uploadError) throw uploadError
  const { error: readyError } = await client
    .from("books")
    .update({ status: "ready" })
    .eq("id", bookId)
  if (readyError) throw readyError
  return bookId
}

export async function storedPercentage(bookId: string): Promise<number | null> {
  const { data, error } = await admin()
    .from("reading_progress")
    .select("percentage")
    .eq("book_id", bookId)
    .maybeSingle()
  if (error) throw error
  return (data as { percentage: number } | null)?.percentage ?? null
}

export async function readerSettingsOf(userId: string): Promise<unknown> {
  const { data, error } = await admin()
    .from("profiles")
    .select("reader_settings")
    .eq("id", userId)
    .single()
  if (error) throw error
  return (data as { reader_settings: unknown }).reader_settings
}
```

- [ ] **Step 5: Proyek Playwright untuk build produksi**

Di `playwright.config.ts`:

1. Tambahkan konstanta berikut setelah impor:

```ts
// The service worker exists only in the production build (plan 1C, Task 11).
const PREVIEW_URL = "http://localhost:4173"
```

2. Ganti `projects` dengan:

```ts
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /offline\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore: /offline\.spec\.ts/,
    },
    {
      name: "offline",
      use: { ...devices["Desktop Chrome"], baseURL: PREVIEW_URL },
      testMatch: /offline\.spec\.ts/,
    },
  ],
```

3. Ganti `webServer` dengan:

```ts
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run build && npm run preview -- --port 4173 --strictPort",
      url: PREVIEW_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
```

Catatan untuk pengembangan lokal: jika `vite preview` lama masih berjalan di port 4173, `reuseExistingServer` akan memakainya, termasuk build lamanya. Matikan dulu setelah mengubah kode.

- [ ] **Step 6: Tulis test offline**

Buat `e2e/offline.spec.ts`:

```ts
import { expect, test } from "@playwright/test"
import { SHERLOCK, seedBook } from "./helpers/books"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

test("a book saved for offline reading opens without a connection", async ({
  page,
  context,
}) => {
  const errors: Array<string> = []
  page.on("pageerror", (error) => errors.push(error.message))

  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const bookId = await seedBook(await userIdOf(member.email))

  await page.goto("/shelf")
  await hydrated(page)
  // The service worker precaches the app and takes control (clients.claim).
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 30_000,
  })

  const book = page.getByRole("button", { name: new RegExp(SHERLOCK.title) })
  const detail = page.getByRole("dialog", { name: SHERLOCK.title })
  await book.click()
  await detail.getByRole("button", { name: "Simpan offline" }).click()
  await expect(detail.getByText("Tersimpan untuk offline.")).toBeVisible({
    timeout: 30_000,
  })
  await page.keyboard.press("Escape")
  await expect(page.getByText("Tersedia offline")).toBeVisible()

  await context.setOffline(true)
  await page.goto("/shelf")
  await expect(
    page.getByText(
      "Kamu sedang offline. Rak ditampilkan dari salinan terakhir di perangkat ini."
    )
  ).toBeVisible()

  await book.click()
  await detail.getByRole("link", { name: "Mulai membaca" }).click()
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )
  await expect(page.getByRole("heading", { name: SHERLOCK.title })).toBeVisible()

  expect(errors).toEqual([])
})
```

Run: `npx playwright test --project=offline`
Expected: 1 lulus.

Jika gagal di `waitForFunction`, periksa:
- `dist/client/sw.js` ada, dan `/sw.js` tersedia di `http://localhost:4173`;
- registrasi tidak error di konsol;
- `cache.addAll` tidak gagal karena ada file di `PRECACHE` yang tidak disajikan `vite preview`. Jika ini penyebabnya, tambahkan pola file itu ke `SKIP` dan catat di laporan.

Jika `errors` berisi error hidrasi React #418, cari komponen di root yang isinya berbeda antara shell (path `/`) dan path yang dibuka. Sembunyikan komponen itu saat `user === undefined`, seperti `SceneBackdrop` di Task 6. Jangan menonaktifkan pemeriksaan `errors`.

- [ ] **Step 7: Verifikasi penuh dan commit**

Run: `npm run typecheck && npm run lint && npx prettier --write pwa scripts src e2e playwright.config.ts vite.config.ts && npm run check && npm test && npm run build`
Expected: semua bersih dan lulus.

Lalu jalankan `grep -rlE "SUPABASE_SECRET_KEY|sb_secret|createServerClient|auth\.admin|getSupabaseAdminClient|TSS_PRERENDERING" dist/client`. Expected: tidak ada hasil.

Lalu jalankan `npm run test:e2e`. Expected: 25 lulus dan 4 dilewati, yaitu 24 lama ditambah 1 test offline.

Setelah itu matikan server di port 3000 dan 4173, lalu pastikan tidak ada user `e2e-` yang tertinggal. Cara memeriksanya sama dengan 1B: daftar user lewat admin client.

```bash
git add pwa scripts/build-sw.mjs package.json src/lib/pwa.ts src/routes/__root.tsx public/manifest.json eslint.config.js playwright.config.ts vite.config.ts e2e/helpers/books.ts e2e/offline.spec.ts
git commit -m "feat(pwa): open the app, the shelf and saved books offline"
```

---
### Task 12: E2E reader dan sinkronisasi, lalu pemeriksaan akhir

**Files:**
- Create: `e2e/reader.spec.ts`

**Interfaces:**
- Consumes: `seedBook`, `storedPercentage`, `readerSettingsOf`, `SHERLOCK` (Task 11); `createConfirmedMember`, `signIn`, `signInAndOnboard`, `hydrated`, `userIdOf` (1A/1B); nama aksesibel reader (Task 9); "Mulai membaca" (Task 10).
- Produces: cakupan E2E spec §13, "Baca → pindah halaman → buka di browser context kedua → muncul tawaran 'Lanjutkan'", di desktop dan HP.

- [ ] **Step 1: Tulis test**

Buat `e2e/reader.spec.ts`:

```ts
import { type Page, expect, test } from "@playwright/test"
import {
  SHERLOCK,
  readerSettingsOf,
  seedBook,
  storedPercentage,
} from "./helpers/books"
import {
  createConfirmedMember,
  hydrated,
  signIn,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

const SPECKLED_BAND = "The Adventure of the Speckled Band"

/** A signed-in member with Sherlock on their shelf. */
async function memberWithBook(page: Page) {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  return { member, userId, bookId }
}

/** Waits until foliate has shown the book: the position appears only then. */
async function bookShown(page: Page) {
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )
}

test("the place read on one device is offered on another", async ({
  page,
  browser,
}) => {
  const { member, bookId } = await memberWithBook(page)

  await page.goto("/shelf")
  await hydrated(page)
  await page.getByRole("button", { name: new RegExp(SHERLOCK.title) }).click()
  await page
    .getByRole("dialog", { name: SHERLOCK.title })
    .getByRole("link", { name: "Mulai membaca" })
    .click()
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))
  await bookShown(page)

  await page.getByRole("button", { name: "Daftar isi" }).click()
  await page
    .getByRole("dialog", { name: "Daftar isi" })
    .getByRole("button", { name: SPECKLED_BAND })
    .click()
  await expect(page.getByRole("status", { name: "Bab saat ini" })).toHaveText(
    SPECKLED_BAND
  )
  // Sent after the five-second pause (spec §10 step 2).
  await expect
    .poll(() => storedPercentage(bookId), { timeout: 20_000 })
    .toBeGreaterThan(40)

  // A second device: a fresh browser context signed in as the same member.
  const other = await browser.newContext()
  try {
    const second = await other.newPage()
    await signIn(second, member)
    await expect(second).toHaveURL(/\/lobby/)
    await second.goto(`/read/${bookId}`)
    await bookShown(second)
    await expect(
      second.getByText(/^Lanjutkan dari \d+% \(dibaca di perangkat lain\)\?$/)
    ).toBeVisible()
    // The reader never jumps by itself.
    await expect(
      second.getByRole("status", { name: "Bab saat ini" })
    ).not.toHaveText(SPECKLED_BAND)

    await second.getByRole("button", { name: "Lompat" }).click()
    await expect(
      second.getByRole("status", { name: "Bab saat ini" })
    ).toHaveText(SPECKLED_BAND)
  } finally {
    await other.close()
  }
})

test("turning pages by key or tap saves the new place", async ({
  page,
  isMobile,
}) => {
  const { bookId } = await memberWithBook(page)
  await page.goto(`/read/${bookId}`)
  await bookShown(page)
  // Opening the book is not reading (plan 1C, decision 8): even after the
  // five-second pause nothing reaches the server. A fixed wait is the only
  // way to show that something does not happen.
  await page.waitForTimeout(6_000)
  expect(await storedPercentage(bookId)).toBeNull()

  const viewport = page.viewportSize()!
  for (let turn = 0; turn < 3; turn++) {
    if (isMobile) {
      await page.touchscreen.tap(viewport.width * 0.85, viewport.height / 2)
    } else {
      await page.keyboard.press("ArrowRight")
    }
  }
  await expect
    .poll(() => storedPercentage(bookId), { timeout: 20_000 })
    .not.toBeNull()
})

test("display settings follow the member", async ({ page }) => {
  const { userId, bookId } = await memberWithBook(page)
  await page.goto(`/read/${bookId}`)
  await bookShown(page)
  const reader = page.locator("main.reader-page")
  await expect(reader).toHaveAttribute("data-theme", "sepia")

  await page.getByRole("button", { name: "Tampilan" }).click()
  const panel = page.getByRole("dialog", { name: "Tampilan" })
  await panel.getByText("Gelap", { exact: true }).click()
  await panel.getByRole("button", { name: "Perbesar huruf" }).click()
  await expect(reader).toHaveAttribute("data-theme", "dark")
  await expect
    .poll(() => readerSettingsOf(userId))
    .toMatchObject({ theme: "dark", fontSize: 110 })

  await page.reload()
  await bookShown(page)
  await expect(reader).toHaveAttribute("data-theme", "dark")
})
```

- [ ] **Step 2: Jalankan test**

Run: `npx playwright test e2e/reader.spec.ts`
Expected: 6 lulus (3 test × 2 proyek).

Jika test kedua gagal di HP karena ketukan tidak membalik halaman, buka trace-nya (`npx playwright show-trace …`):
- jika ketukan mengenai bar toolbar/footer, pindahkan titik ketuk ke tengah vertikal area buku;
- jika ketukan mengenai buku tetapi tidak diproses, berarti cara `ReaderView` menghitung posisi klik dari `frameElement` salah dan harus diperbaiki di sana.

Jangan mengganti ketukan dengan tombol keyboard di proyek HP.

- [ ] **Step 3: Pemeriksaan akhir**

Run, berurutan:
1. `npm run lint && npm run check && npm run typecheck && npm test`. Expected: bersih dan semua unit test lulus. Catat jumlahnya.
2. `npm run build`, lalu `grep -rlE "SUPABASE_SECRET_KEY|sb_secret|createServerClient|auth\.admin|getSupabaseAdminClient|TSS_PRERENDERING" dist/client`. Expected: tidak ada hasil.
3. `npm run test:db`. Expected: 31 lulus.
4. `npm run test:e2e`. Expected: 31 lulus dan 4 dilewati (24 lama + 1 offline + 6 reader).
5. Dengan admin client, pastikan tidak ada user `e2e-` atau `@glosa.test` yang tertinggal, dan tidak ada objek di folder mereka. Lalu matikan server di port 3000 dan 4173.

Pemeriksaan manual di HP sungguhan (Android Chrome) memakai `npm run build && npm run preview -- --host`, lalu buka dari jaringan yang sama:
- Service worker hanya aktif di `localhost` atau HTTPS. Alamat IP biasa cukup untuk memeriksa tampilan reader, tetapi tidak untuk mode offline atau install. Pemeriksaan install PWA di HP dilakukan setelah deploy HTTPS di rencana 1D.
- Catat hasil pemeriksaan tampilan di laporan.

- [ ] **Step 4: Commit**

```bash
git add e2e/reader.spec.ts
git commit -m "test(e2e): read, sync the place to another device and keep display settings"
```

---

## Cakupan spec

| Bagian spec | Task |
|---|---|
| §4 `reading_progress`, RLS, `save_progress` "terbaru menang" | 1 |
| §9 route client-only, IndexedDB dulu lalu signed URL 1 jam, unduh dan simpan | 8, 9 |
| §9 `last_opened_at` diperbarui | 4, 9 |
| §9 setelan: huruf serif/sans/ramah disleksia, ukuran, spasi, margin, tema, halaman/gulir; disimpan di `reader_settings` dan cache lokal | 2, 7, 8, 9 |
| §9 navigasi: ketuk kiri/kanan/tengah, swipe (bawaan paginator foliate), panah, PageUp/PageDown, daftar isi, slider + persentase | 7, 9 |
| §9 tampilan reader bersih, nuansa perpustakaan hanya di bingkai | 9 |
| §10 `relocate` → IndexedDB, debounce 5 detik, kirim saat `visibilitychange`/`pagehide` | 3, 5, 9 |
| §10 antrean offline, kirim ulang saat `online` dan saat aplikasi dibuka | 3, 5, 6 |
| §10 tawaran "Lanjutkan dari …%" tanpa lompat otomatis | 2, 9, 12 |
| §11 app shell, font, ilustrasi lobi di-precache; cover cache-first | 11 |
| §11 rak tetap tampil saat offline (salinan IndexedDB, keputusan 2) | 3, 10 |
| §11 "Simpan offline" / "Hapus dari perangkat", `navigator.storage.persist()` | 3, 8, 10 |
| §11 aksi online dinonaktifkan dengan "Butuh internet" | 10 (upload sudah di 1B) |
| §11 manifest `standalone` | 11 (manifest dari 1A, ditambah `id` dan `scope`) |
| §8 bar progres per buku, penanda "Tersedia offline" | 10 |
| §5 hapus buku → salinan IndexedDB ikut terhapus | 8, 10 |
| §12 signed URL kedaluwarsa → minta URL baru satu kali | 8 (EPUB), 10 (cover) |
| §12 penyimpanan perangkat penuh → hapus salinan terlama lalu coba lagi | 3, 8, 9 |
| §12 sesi habis saat offline → buku lokal tetap terbaca | 6 |
| §12 gagal sinkron berulang → "Belum tersinkron" | 5, 9 |
| §13 unit "terbaru menang" pada progres | 1, 2 |
| §13 RLS progres milik user lain | 1 |
| §13 E2E baca → pindah → context kedua menawarkan "Lanjutkan" | 12 |
| §13 E2E offline: buku tersimpan tetap terbuka | 11 |
| §7 lobi, Meja Baca, panel Detail Buku di lobi | Rencana 1D |
| §12 laporan ke Sentry, §14 deploy, sapuan Storage berkala | Rencana 1D |
