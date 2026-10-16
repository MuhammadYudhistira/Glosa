# Glosa Tahap 1B — Rak Saya, Upload, Kuota, dan Genre: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anggota bisa membawa buku EPUB ke raknya. Metadata dibaca di browser dan genrenya ditebak. File dikirim langsung ke Supabase Storage dalam batas kuota 100 MB. Di halaman Rak Saya, buku bisa disaring per genre, dicari, diurutkan, dilihat detailnya, dipindahkan genrenya (termasuk dari Troli Buku Baru), dan dihapus. Menghapus akun ikut menghapus semua file buku.

**Architecture:**
- **Browser.** Browser membuka EPUB dengan foliate-js (`epub.js`) dan zip.js. Dari sana browser mengambil judul, penulis, bahasa, deskripsi, subjek, dan cover. Browser juga menebak genre dengan `suggestGenre`, mengecilkan cover menjadi WebP 400 px, dan menghitung SHA-256.
- **`requestUploadFn`.** Server function ini memanggil fungsi Postgres `reserve_book_upload`. Fungsi tersebut mengunci baris `profiles` (`FOR UPDATE`), menolak duplikat, mengecek kuota, lalu meng-insert `books` berstatus `pending`. Setelah itu server mengembalikan signed upload URL.
- **Upload.** Browser mengunggah langsung ke Storage lewat `XMLHttpRequest`, sehingga progres per file terlihat dan bandwidth VPS tidak terpakai.
- **`confirmUploadFn`.** Server function ini mencocokkan ukuran objek dengan isi tabel, lalu mengubah status menjadi `ready`.
- **Halaman `/shelf`.** Data rak dimuat lewat server function dengan client Supabase berbasis cookie, sehingga RLS tetap berlaku. Penyaringan, pencarian, dan pengurutan dikerjakan di browser oleh fungsi murni.

**Tech Stack:** TanStack Start + Router, React 19, TypeScript 6, Tailwind CSS 4, shadcn/ui (base-mira), Supabase Cloud (Postgres, Storage, Auth), foliate-js (git, commit `78914aef4466eb960965702401634c2cb348e9b1`), `@zip.js/zip.js`, Zod 4, Vitest 5 + Testing Library, Playwright, `fflate` dan `sharp` (hanya untuk test dan skrip).

**Seri rencana tahap 1** (spec: [`docs/superpowers/specs/2026-10-15-epub-reader-tahap-1-design.md`](../specs/2026-10-15-epub-reader-tahap-1-design.md)):

| Rencana | Isi | Status |
|---|---|---|
| 1A | Fondasi proyek, `profiles`, auth, kartu anggota, pengaturan, halaman hukum, E2E, CI | Selesai (`main`) |
| **1B** | Tabel `books`, Storage, kuota, genre + Troli, Rak Saya, upload, penghapusan file saat hapus akun | **Dokumen ini** |
| 1C | Reader foliate-js, sinkronisasi posisi baca, PWA/offline, klien Supabase di browser + cache TanStack Query | Ditulis setelah 1B |
| 1D | Lobi isometrik interaktif (hotspot, panel, peta), proyek Supabase prod + SMTP, deploy VPS, Sentry | Ditulis setelah 1C |

## Keputusan dan penyimpangan dari spec

Semua keputusan berikut sudah disengaja. Reviewer tidak perlu menganggapnya sebagai cacat.

1. **Data rak dibaca lewat server function, bukan klien Supabase di browser** (spec §3, "langsung (RLS)").
   - Server function memakai client berbasis cookie atas nama anggota, sama seperti di 1A, sehingga RLS tetap berlaku.
   - Klien Supabase di browser dan cache TanStack Query yang dipersist baru dibutuhkan untuk offline, dan dibangun di 1C.
   - **Upload tetap langsung dari browser ke Storage** lewat signed upload URL, sesuai spec §5 langkah 4.
2. **pg_cron diganti pembersihan saat upload berikutnya** (spec §5 langkah 6).
   - File di Storage tidak bisa dihapus dengan SQL (objeknya ada di luar database), jadi pembersihan dijalankan oleh server.
   - Setiap kali `requestUploadFn` dipanggil, baris `pending` milik anggota yang berumur lebih dari 1 jam, beserta percobaan sebelumnya untuk file yang sama, dihapus bersama objeknya.
   - Baris `pending` yang berumur lebih dari 1 jam juga tidak dihitung ke kuota, baik di SQL maupun di `usedBytes`. Dengan begitu, unggahan yang terputus tidak pernah menyandera kuota.
3. **Parsing EPUB memakai `foliate-js/epub.js` dan loader zip.js milik sendiri**, bukan `view.js`.
   - `view.js` mendaftarkan custom element dan ikut memuat pembaca PDF dan MOBI, padahal upload tidak membutuhkannya.
   - Reader di 1C tetap memakai foliate-js versi yang sama.
4. **"Fiksi & Sastra" menjadi genre cadangan** dalam `suggestGenre` (spec §5a).
   - Katalog perpustakaan (LCSH) menandai hampir semua novel dengan "-- Fiction". Contohnya, EPUB Standard Ebooks *The Adventures of Sherlock Holmes* punya dua subjek "-- Fiction" dan satu "Detective and mystery stories".
   - Dengan aturan skor apa adanya, buku itu akan masuk Fiksi. Karena itu Fiksi & Sastra hanya dipilih jika tidak ada genre lain yang lebih spesifik yang cocok.
   - Frasa ("science fiction") juga tidak ikut dihitung sebagai kata-kata penyusunnya.
5. **Cover disimpan sebagai WebP 400 px.** Jika browser tidak bisa meng-encode WebP, cover disimpan sebagai JPEG (`-cover.jpg`).
6. **Detail Buku tampil sebagai dialog di Rak Saya.** Panel lobi baru dibuat di 1D.
   - Beberapa bagian dari §8 dan §7 bergantung pada reader dan offline: bar progres baca, penanda "Tersedia offline", tombol "Lanjutkan Membaca", "Simpan offline", dan penghapusan salinan IndexedDB. Semuanya masuk 1C.
   - Sesuai aturan "tanpa tombol mati", elemen-elemen itu **tidak ditampilkan** di 1B.

7. **Hapus buku hanya lewat server, plus penyapuan file yatim** (keputusan pemilik setelah review Task 3).
   - Jika browser boleh menghapus baris `books`, anggota bisa menghapus baris tanpa filenya. Kuotanya kembali, tetapi file tetap tersimpan dan bisa dibaca.
   - Signed upload URL berlaku 2 jam, lebih lama dari batas 1 jam baris `pending`. URL lama bisa dipakai setelah barisnya dibersihkan, sehingga meninggalkan file yatim.
   - Karena itu izin delete dari client dicabut. `deleteBookFn` menghapus objek lalu baris dengan admin client, setelah kepemilikan dibuktikan lewat RLS.
   - Setiap `requestUploadFn` dan `deleteBookFn` juga menyapu objek di folder anggota yang tidak dirujuk baris mana pun. Dengan begitu penyalahgunaan terbatas sekitar satu putaran kuota.
   - Sapuan berkala untuk semua anggota ditambahkan di rencana 1D.

## Global Constraints

- Node.js **≥ 24**. Package manager: **npm**.
- **Supabase Cloud saja**, tanpa Supabase lokal/Docker. Semua test memakai **proyek dev**.
- Teks UI dalam **bahasa Indonesia**, path URL dalam bahasa Inggris.
- **Secret key Supabase hanya dipakai di server**, di kode test, atau di secret CI. Jangan pernah dipakai di kode client atau diberi prefix `VITE_`.
- Kolom `plan`, `storage_limit_bytes`, dan `member_no` **tidak boleh** bisa diubah client.
- `books`: **tidak ada insert dari client**. Insert hanya lewat `reserve_book_upload`, dan fungsi itu hanya bisa dieksekusi `service_role`. Client hanya boleh select miliknya sendiri dan update kolom `genre`, `genre_source`, dan `last_opened_at`. **Tidak ada delete dari client.** Hapus buku hanya lewat `deleteBookFn`, yang menghapus objek Storage lebih dulu (keputusan 7).
- Bucket Storage `books` **privat**. Anggota hanya bisa membaca objek berprefix `{auth.uid()}/`. Tidak ada policy insert, update, atau delete.
- Path objek: `{user_id}/{book_id}.epub` dan `{user_id}/{book_id}-cover.webp` (atau `.jpg`).
- Ukuran EPUB maks. **52428800** byte (50 MB) per file. Cover maks. **2097152** byte (2 MB), lebar **400** px.
- Pemakaian storage **dihitung, tidak disimpan**: jumlah `size_bytes` (EPUB + cover) dari baris `ready` ditambah baris `pending` yang berumur kurang dari 1 jam.
- Nilai genre (dicek constraint): `fiksi_sastra`, `fantasi_petualangan`, `misteri_thriller`, `anak_remaja`, `sains_teknologi`, `sejarah_budaya`, `bisnis_pengembangan_diri`, `lainnya`. `null` berarti **Troli Buku Baru**. `genre_source`: `'auto' | 'user'`, null jika dan hanya jika `genre` null.
- Batas metadata: judul 1–300 karakter, penulis ≤ 300, deskripsi ≤ 2000 (teks polos, HTML dibuang), bahasa ≤ 35, subjek ≤ 30 butir dengan masing-masing ≤ 200 karakter.
- Pesan per file (persis):
  - "Hanya file .epub yang bisa dibawa masuk."
  - "File EPUB rusak atau tidak didukung."
  - "Ukurannya lebih dari 50 MB."
  - "Buku ini sudah ada di rakmu."
  - "Rakmu penuh. Hapus buku lain dulu untuk memberi tempat."
  - "Unggahan terputus. Coba lagi."
  - "File tidak terunggah utuh. Coba lagi."
- Jangan menampilkan menu, tombol, atau label untuk fitur tahap berikutnya atau rencana berikutnya, termasuk reader, offline, dan progres baca di 1C. Tidak boleh ada tombol mati.
- Semua animasi dimatikan saat `prefers-reduced-motion: reduce`. Animasi yang sedang berjalan bisa dilewati dengan klik.
- Gaya kode mengikuti starter:
  - Prettier dengan kutip ganda dan tanpa titik koma.
  - ESLint `@tanstack/eslint-config`.
  - Alias `@/*` → `src/*`, dan `cn` dari `@/lib/utils`.
  - `import type` / modifier `type` (`verbatimModuleSyntax`).
- Gunakan elemen semantik, bukan atribut `role`, jika elemennya ada:
  - `<output>` untuk pesan status;
  - `<meter>` untuk bar storage;
  - `<progress>` untuk progres unggah;
  - `<nav>` untuk filter genre.
  - `role="alert"` tetap dipakai untuk pesan error.
- Semua server function baru memvalidasi input dengan **Zod** di `.validator(...)`.
- Semua submit handler di UI membungkus panggilan server function dengan try/catch. Jika panggilan melempar error, state pending direset dan kode `"unknown"` ditampilkan. Navigasi setelah aksi cukup satu kali (`router.navigate` atau `router.invalidate`).
- Semua email user uji berisi `e2e-` atau dibuat dengan `run` unik di `tests/db`, berakhiran `@glosa.test`, lalu **dihapus** bersama objek Storage-nya setelah test selesai.

## Langkah manual pemilik proyek

Tidak ada. Bucket dan policy dibuat lewat migrasi. Batas upload global Storage di proyek dev (Storage → Settings, default 50 MB) cukup untuk file 50 MB. Batas itu hanya perlu diubah jika sebelumnya pernah diturunkan.

## Struktur file

```
supabase/migrations/20261016000100_books.sql   tabel books, RLS, grant, reserve_book_upload, bucket + policy Storage
src/lib/genre.ts                    nilai, label, suggestGenre
src/lib/upload-rules.ts             batas ukuran/metadata, checkEpubFile, cleanDescription, clampText
src/lib/quota.ts                    usedBytes, isAbandoned
src/lib/book-messages.ts            bookMessage(code)
src/lib/book-types.ts               ShelfBook, ShelfData, StorageUsage, UploadRequest, UploadTicket
src/lib/member.ts                   (ubah) formatBytes desimal di bawah 10 MB, formatUsage
src/lib/shelf.ts                    parseShelfSearch, shelfBooks, countBooks, SHELF_FILTERS, SHELF_SORTS
src/lib/epub/metadata.ts            normalizeMetadata (bentuk metadata foliate → BookMetadata)
src/lib/epub/hash.ts                sha256Hex
src/lib/epub/cover.ts               shrinkCover (WebP 400 px, cadangan JPEG)
src/lib/epub/read-epub.ts           readEpub(file) → ParsedEpub | EpubError
src/lib/xhr-upload.ts               putFile dengan progres
src/lib/use-online.ts               useOnline()
src/types/foliate-js.d.ts           deklarasi modul foliate-js/epub.js
src/server/book-storage.ts          bookStorage(client): createUploadUrl, getReadUrls, statObject, remove; objectPaths
src/server/books.ts                 requestUploadFn, confirmUploadFn, listBooksFn, updateBookGenreFn, deleteBookFn
src/server/profile.ts               (ubah) deleteAccountFn menghapus file buku dulu
src/components/ui/dialog.tsx        (shadcn) Dialog
src/components/shelf/*              ShelfHeader, StorageMeter, GenreFilter, ShelfToolbar, BookGrid, BookCover,
                                    EmptyShelf, BookDetail, TrolleyGenrePicker, UploadPanel, upload-queue,
                                    upload-book, useUploadQueue, useSaveGenre
src/routes/_member/shelf.tsx        halaman Rak Saya
src/routes/_member/lobby.tsx        (ubah) tautan Rak Saya
tests/db/books.test.ts              RLS, grant, kuota, duplikat, konkurensi, Storage
tests/db/book-storage.test.ts       signed upload → stat → signed read → remove
e2e/helpers/epub.ts                 makeEpub() untuk test
e2e/fixtures/the-adventures-of-sherlock-holmes.epub   contoh nyata dari Standard Ebooks (CC0)
e2e/shelf.spec.ts                   alur rak
e2e/global-teardown.ts              (ubah) hapus objek Storage user uji
```

---

### Task 1: Genre dan tebakan genre

**Files:**
- Create: `src/lib/genre.ts`
- Test: `src/lib/genre.test.ts`

**Interfaces:**
- Produces:
  - `GENRE_VALUES` (tuple `as const` berisi 8 nilai)
  - `type Genre`, `type GenreSource = "auto" | "user"`
  - `GENRE_LABELS: Record<Genre, string>`, `TROLLEY_LABEL = "Troli Buku Baru"`
  - `isGenre(value: unknown): value is Genre`
  - `genreLabel(genre: Genre | null): string`
  - `GENRE_KEYWORDS`
  - `suggestGenre(subjects: ReadonlyArray<string>): Genre | null`

- [ ] **Step 1: Tulis test yang gagal**

`src/lib/genre.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { type Genre, genreLabel, isGenre, suggestGenre } from "./genre"

describe("suggestGenre", () => {
  const cases: Array<[string, ReadonlyArray<string>, Genre | null]> = [
    ["no subjects", [], null],
    ["no keyword matches", ["Cooking", "Gardening"], null],
    ["juvenile fiction goes to the more specific genre", ["Juvenile fiction"], "anak_remaja"],
    ["detective stories", ["Detective and mystery stories"], "misteri_thriller"],
    [
      "Standard Ebooks: The Adventures of Sherlock Holmes",
      [
        "Holmes, Sherlock (Fictitious character) -- Fiction",
        "Private investigators -- England -- Fiction",
        "Detective and mystery stories, English",
      ],
      "misteri_thriller",
    ],
    [
      "Project Gutenberg: Pride and Prejudice",
      [
        "England -- Fiction",
        "Young women -- Fiction",
        "Love stories",
        "Sisters -- Fiction",
        "Courtship -- Fiction",
        "Domestic fiction",
        "Social classes -- Fiction",
      ],
      "fiksi_sastra",
    ],
    [
      "Project Gutenberg: Alice's Adventures in Wonderland",
      [
        "Fantasy fiction",
        "Children's stories",
        "Imaginary places -- Juvenile fiction",
        "Alice (Fictitious character from Carroll) -- Juvenile fiction",
      ],
      "anak_remaja",
    ],
    ["a phrase is not also read as its words", ["Science fiction"], "fantasi_petualangan"],
    ["a tie goes to the more specific genre", ["Fantasy", "History"], "fantasi_petualangan"],
    ["hyphenated keywords", ["Self-help techniques"], "bisnis_pengembangan_diri"],
    ["case-insensitive", ["WORLD HISTORY"], "sejarah_budaya"],
    ["whole words only", ["Historical fiction"], "fiksi_sastra"],
  ]

  it.each(cases)("%s", (_name, subjects, expected) => {
    expect(suggestGenre(subjects)).toBe(expected)
  })
})

describe("genre labels", () => {
  it("labels genres and the trolley", () => {
    expect(genreLabel("misteri_thriller")).toBe("Misteri & Thriller")
    expect(genreLabel("lainnya")).toBe("Rak Lainnya")
    expect(genreLabel(null)).toBe("Troli Buku Baru")
  })

  it("recognises only stored genre values", () => {
    expect(isGenre("bisnis_pengembangan_diri")).toBe(true)
    expect(isGenre("troli")).toBe(false)
    expect(isGenre(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/lib/genre.test.ts`
Expected: FAIL dengan "Failed to resolve import "./genre"".

- [ ] **Step 3: Implementasi**

`src/lib/genre.ts`:

```ts
/** Genre values stored in books.genre (spec §5a). null means "Troli Buku Baru". */
export const GENRE_VALUES = [
  "fiksi_sastra",
  "fantasi_petualangan",
  "misteri_thriller",
  "anak_remaja",
  "sains_teknologi",
  "sejarah_budaya",
  "bisnis_pengembangan_diri",
  "lainnya",
] as const

export type Genre = (typeof GENRE_VALUES)[number]
export type GenreSource = "auto" | "user"

export const GENRE_LABELS: Record<Genre, string> = {
  fiksi_sastra: "Fiksi & Sastra",
  fantasi_petualangan: "Fantasi & Petualangan",
  misteri_thriller: "Misteri & Thriller",
  anak_remaja: "Anak & Remaja",
  sains_teknologi: "Sains & Teknologi",
  sejarah_budaya: "Sejarah & Budaya",
  bisnis_pengembangan_diri: "Bisnis & Pengembangan Diri",
  lainnya: "Rak Lainnya",
}

export const TROLLEY_LABEL = "Troli Buku Baru"

export function isGenre(value: unknown): value is Genre {
  return (
    typeof value === "string" &&
    (GENRE_VALUES as ReadonlyArray<string>).includes(value)
  )
}

export function genreLabel(genre: Genre | null): string {
  return genre ? GENRE_LABELS[genre] : TROLLEY_LABEL
}

type GuessableGenre = Exclude<Genre, "lainnya">

/** dc:subject keywords per genre, matched as whole words or phrases. Easy to extend. */
export const GENRE_KEYWORDS: Record<GuessableGenre, ReadonlyArray<string>> = {
  fiksi_sastra: ["fiction", "novel", "literature", "romance", "poetry", "drama", "classics"],
  fantasi_petualangan: ["fantasy", "adventure", "science fiction", "quests"],
  misteri_thriller: ["mystery", "detective", "crime", "thriller", "horror", "ghost"],
  anak_remaja: ["juvenile", "children", "young adult", "fairy tales", "readers"],
  sains_teknologi: ["science", "technology", "nature", "mathematics", "computers"],
  sejarah_budaya: ["history", "biography", "travel", "culture", "philosophy", "religion"],
  bisnis_pengembangan_diri: ["business", "economics", "self-help", "psychology", "success"],
}

/** Tie-break order, most specific first (spec §5a). */
const PRIORITY: ReadonlyArray<GuessableGenre> = [
  "anak_remaja",
  "misteri_thriller",
  "fantasi_petualangan",
  "sains_teknologi",
  "sejarah_budaya",
  "bisnis_pengembangan_diri",
  "fiksi_sastra",
]

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// Longest keywords first, so "science fiction" is not also read as "science" + "fiction".
const MATCHERS = Object.entries(GENRE_KEYWORDS)
  .flatMap(([genre, keywords]) =>
    keywords.map((keyword) => ({
      genre: genre as GuessableGenre,
      keyword,
      pattern: new RegExp(`(?<![a-z])${escapeRegExp(keyword)}(?![a-z])`, "g"),
    }))
  )
  .sort((a, b) => b.keyword.length - a.keyword.length)

/**
 * Guesses a genre from EPUB dc:subject values (spec §5a). Each subject adds one
 * point to every genre it mentions; the highest score wins and ties go to the
 * more specific genre. "Fiksi & Sastra" is the fallback: library catalogues tag
 * nearly every novel "-- Fiction", so it only wins when nothing more specific matched.
 */
export function suggestGenre(subjects: ReadonlyArray<string>): Genre | null {
  const scores = new Map<GuessableGenre, number>()
  for (const subject of subjects) {
    let text = subject.toLowerCase()
    const matched = new Set<GuessableGenre>()
    for (const { genre, pattern } of MATCHERS) {
      if (text.search(pattern) === -1) continue
      matched.add(genre)
      text = text.replace(pattern, " ")
    }
    for (const genre of matched) scores.set(genre, (scores.get(genre) ?? 0) + 1)
  }

  let best: GuessableGenre | null = null
  let bestScore = 0
  for (const genre of PRIORITY) {
    if (genre === "fiksi_sastra") continue
    const score = scores.get(genre) ?? 0
    if (score > bestScore) {
      best = genre
      bestScore = score
    }
  }
  if (best) return best
  return scores.has("fiksi_sastra") ? "fiksi_sastra" : null
}
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/lib/genre.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint && npx prettier --check src/lib/genre.ts src/lib/genre.test.ts`

```bash
git add src/lib/genre.ts src/lib/genre.test.ts
git commit -m "feat(books): add genres and subject-based genre suggestion"
```

---

### Task 2: Aturan upload, kuota, pesan, tipe, dan format ukuran

**Files:**
- Create: `src/lib/upload-rules.ts`, `src/lib/quota.ts`, `src/lib/book-messages.ts`, `src/lib/book-types.ts`
- Modify: `src/lib/member.ts` (fungsi `formatBytes` dan fungsi baru `formatUsage`)
- Test: `src/lib/upload-rules.test.ts`, `src/lib/quota.test.ts`, `src/lib/book-messages.test.ts`, `src/lib/member.test.ts` (tambah kasus)

**Interfaces:**
- Consumes: `Genre`, `GenreSource` (Task 1), `Plan` (`src/lib/session-types.ts`).
- Produces:
  - Konstanta: `MAX_EPUB_BYTES`, `MAX_COVER_BYTES`, `COVER_WIDTH`, `PENDING_TTL_MS`, `METADATA_LIMITS`.
  - `type FileProblem = "not_epub" | "too_large" | "epub_invalid"`
  - `checkEpubFile(file: { name: string; size: number }): FileProblem | null`
  - `clampText(value: string, max: number): string`
  - `cleanDescription(html: string | null | undefined): string | null`
  - `type QuotaRow = { sizeBytes: number; status: "pending" | "ready"; createdAt: string }`
  - `usedBytes(rows, now?): number`, `isAbandoned(row, now?): boolean`
  - `bookMessage(code: string | null | undefined): string`
  - Tipe: `ShelfBook`, `StorageUsage`, `ShelfData`, `CoverInfo`, `UploadRequest`, `UploadTicket`.
  - `formatBytes(bytes)` (satu desimal untuk 0 < x < 10 MB), `formatUsage(used, limit): string`.

- [ ] **Step 1: Tulis test yang gagal**

`src/lib/upload-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { MAX_EPUB_BYTES, checkEpubFile, clampText, cleanDescription } from "./upload-rules"

describe("checkEpubFile", () => {
  it("accepts EPUB files up to 50 MB", () => {
    expect(checkEpubFile({ name: "Buku.EPUB", size: MAX_EPUB_BYTES })).toBeNull()
  })

  it("rejects other file types, empty files and files over 50 MB", () => {
    expect(checkEpubFile({ name: "buku.pdf", size: 10 })).toBe("not_epub")
    expect(checkEpubFile({ name: "buku.epub", size: 0 })).toBe("epub_invalid")
    expect(checkEpubFile({ name: "buku.epub", size: MAX_EPUB_BYTES + 1 })).toBe("too_large")
  })
})

describe("cleanDescription", () => {
  it("keeps plain text only", () => {
    expect(
      cleanDescription("<p>Kisah <i>detektif</i> &amp; sahabatnya.</p><p>Jilid&nbsp;1</p>")
    ).toBe("Kisah detektif & sahabatnya. Jilid 1")
  })

  it("decodes numeric entities", () => {
    expect(cleanDescription("Caf&#233; &#x2014; malam")).toBe("Café — malam")
  })

  it("returns null when nothing is left", () => {
    expect(cleanDescription("<p> </p>")).toBeNull()
    expect(cleanDescription(undefined)).toBeNull()
  })

  it("caps the text at 2000 characters", () => {
    const result = cleanDescription("kata ".repeat(1000))
    expect(result?.length).toBeLessThanOrEqual(2000)
    expect(result?.endsWith("…")).toBe(true)
  })
})

describe("clampText", () => {
  it("leaves short text alone and shortens long text with an ellipsis", () => {
    expect(clampText("pendek", 10)).toBe("pendek")
    expect(clampText("panjang sekali", 8)).toBe("panjang…")
  })
})
```

`src/lib/quota.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { isAbandoned, usedBytes } from "./quota"

const now = Date.parse("2026-10-16T12:00:00Z")
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString()

describe("usedBytes", () => {
  it("counts ready books and pending uploads younger than an hour", () => {
    expect(
      usedBytes(
        [
          { sizeBytes: 100, status: "ready", createdAt: minutesAgo(600) },
          { sizeBytes: 20, status: "pending", createdAt: minutesAgo(10) },
          { sizeBytes: 999, status: "pending", createdAt: minutesAgo(61) },
        ],
        now
      )
    ).toBe(120)
  })

  it("is zero for an empty shelf", () => {
    expect(usedBytes([], now)).toBe(0)
  })
})

describe("isAbandoned", () => {
  it("marks only pending uploads older than an hour", () => {
    expect(isAbandoned({ status: "pending", createdAt: minutesAgo(60) }, now)).toBe(true)
    expect(isAbandoned({ status: "pending", createdAt: minutesAgo(59) }, now)).toBe(false)
    expect(isAbandoned({ status: "ready", createdAt: minutesAgo(600) }, now)).toBe(false)
  })
})
```

`src/lib/book-messages.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { bookMessage } from "./book-messages"

describe("bookMessage", () => {
  it("explains each upload problem", () => {
    expect(bookMessage("not_epub")).toBe("Hanya file .epub yang bisa dibawa masuk.")
    expect(bookMessage("epub_invalid")).toBe("File EPUB rusak atau tidak didukung.")
    expect(bookMessage("too_large")).toBe("Ukurannya lebih dari 50 MB.")
    expect(bookMessage("duplicate")).toBe("Buku ini sudah ada di rakmu.")
    expect(bookMessage("quota_exceeded")).toBe(
      "Rakmu penuh. Hapus buku lain dulu untuk memberi tempat."
    )
    expect(bookMessage("upload_interrupted")).toBe("Unggahan terputus. Coba lagi.")
    expect(bookMessage("size_mismatch")).toBe("File tidak terunggah utuh. Coba lagi.")
  })

  it("falls back for unknown codes, including prototype keys", () => {
    const fallback = "Ada yang tidak beres. Coba lagi sebentar lagi."
    expect(bookMessage("unknown")).toBe(fallback)
    expect(bookMessage("constructor")).toBe(fallback)
    expect(bookMessage(null)).toBe(fallback)
  })
})
```

Tambahkan ke `src/lib/member.test.ts`, di dalam `describe("member formatting", …)`:

```ts
  it("shows small sizes with one decimal", () => {
    expect(formatBytes(0)).toBe("0 MB")
    expect(formatBytes(409600)).toBe("0.4 MB")
    expect(formatBytes(742083)).toBe("0.7 MB")
    expect(formatBytes(3.2 * 1024 * 1024)).toBe("3.2 MB")
    expect(formatBytes(34 * 1024 * 1024)).toBe("34 MB")
  })

  it("formats storage usage", () => {
    expect(formatUsage(409600, 104857600)).toBe("0.4 MB / 100 MB")
  })
```

Lalu tambahkan `formatUsage` ke import di file itu.

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/lib/upload-rules.test.ts src/lib/quota.test.ts src/lib/book-messages.test.ts src/lib/member.test.ts`
Expected: FAIL. Tiga file baru gagal resolve import, dan `member.test.ts` gagal karena `formatUsage` tidak ada dan `formatBytes(409600)` mengembalikan "0 MB".

- [ ] **Step 3: Implementasi**

`src/lib/upload-rules.ts`:

```ts
export const MAX_EPUB_BYTES = 50 * 1024 * 1024
export const MAX_COVER_BYTES = 2 * 1024 * 1024
export const COVER_WIDTH = 400
/** Pending uploads older than this are abandoned: they no longer count toward the quota. */
export const PENDING_TTL_MS = 60 * 60 * 1000

export const METADATA_LIMITS = {
  title: 300,
  author: 300,
  description: 2000,
  language: 35,
  subjects: 30,
  subject: 200,
} as const

export type FileProblem = "not_epub" | "too_large" | "epub_invalid"

/** Checks made before the file is opened. */
export function checkEpubFile(file: { name: string; size: number }): FileProblem | null {
  if (!/\.epub$/i.test(file.name)) return "not_epub"
  if (file.size === 0) return "epub_invalid"
  if (file.size > MAX_EPUB_BYTES) return "too_large"
  return null
}

export function clampText(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

function decodeEntity(match: string, entity: string): string {
  if (entity.startsWith("#")) {
    const code = /^#x/i.test(entity)
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10)
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : ""
  }
  const key = entity.toLowerCase()
  return Object.hasOwn(NAMED_ENTITIES, key) ? NAMED_ENTITIES[key] : match
}

/** EPUB descriptions are often HTML. Keep plain text, at most 2000 characters (spec §4). */
export function cleanDescription(html: string | null | undefined): string | null {
  if (!html) return null
  const text = html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/\s+/g, " ")
    .trim()
  return text ? clampText(text, METADATA_LIMITS.description) : null
}
```

`src/lib/quota.ts`:

```ts
import { PENDING_TTL_MS } from "./upload-rules"

export type QuotaRow = {
  sizeBytes: number
  status: "pending" | "ready"
  createdAt: string
}

export function isAbandoned(
  row: Pick<QuotaRow, "status" | "createdAt">,
  now: number = Date.now()
): boolean {
  return row.status === "pending" && now - Date.parse(row.createdAt) >= PENDING_TTL_MS
}

/** Storage in use is computed from the rows, never stored (spec §4). */
export function usedBytes(rows: ReadonlyArray<QuotaRow>, now: number = Date.now()): number {
  return rows.reduce((sum, row) => (isAbandoned(row, now) ? sum : sum + row.sizeBytes), 0)
}
```

`src/lib/book-messages.ts`:

```ts
const MESSAGES: Record<string, string> = {
  not_epub: "Hanya file .epub yang bisa dibawa masuk.",
  epub_invalid: "File EPUB rusak atau tidak didukung.",
  too_large: "Ukurannya lebih dari 50 MB.",
  duplicate: "Buku ini sudah ada di rakmu.",
  quota_exceeded: "Rakmu penuh. Hapus buku lain dulu untuk memberi tempat.",
  upload_interrupted: "Unggahan terputus. Coba lagi.",
  size_mismatch: "File tidak terunggah utuh. Coba lagi.",
  not_found: "Buku ini tidak ada di rakmu.",
  not_authenticated: "Sesi masukmu sudah habis. Masuk lagi, ya.",
  offline: "Butuh internet.",
}

const FALLBACK = "Ada yang tidak beres. Coba lagi sebentar lagi."

export function bookMessage(code: string | null | undefined): string {
  return (code && Object.hasOwn(MESSAGES, code) && MESSAGES[code]) || FALLBACK
}
```

`src/lib/book-types.ts`:

```ts
import type { Genre, GenreSource } from "./genre"
import type { Plan } from "./session-types"

export type ShelfBook = {
  id: string
  title: string
  author: string
  description: string | null
  language: string | null
  genre: Genre | null
  genreSource: GenreSource | null
  sizeBytes: number
  createdAt: string
  lastOpenedAt: string | null
  /** Signed URL valid for one hour, or null when the book has no cover. */
  coverUrl: string | null
}

export type StorageUsage = { usedBytes: number; limitBytes: number; plan: Plan }

export type ShelfData = { books: Array<ShelfBook>; usage: StorageUsage }

export type CoverInfo = { bytes: number; type: "image/webp" | "image/jpeg" }

export type UploadRequest = {
  sha256: string
  epubBytes: number
  cover: CoverInfo | null
  title: string
  author: string
  description: string | null
  language: string | null
  subjects: Array<string>
  genre: Genre | null
  genreSource: GenreSource | null
}

export type UploadTicket =
  | { ok: true; bookId: string; epubUploadUrl: string; coverUploadUrl: string | null }
  | { ok: false; code: string }
```

Di `src/lib/member.ts`, ganti `formatBytes` dan tambahkan `formatUsage`:

```ts
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${Number((mb / 1024).toFixed(1))} GB`
  if (mb > 0 && mb < 10) return `${Number(mb.toFixed(1))} MB`
  return `${Math.round(mb)} MB`
}

export function formatUsage(usedBytes: number, limitBytes: number): string {
  return `${formatBytes(usedBytes)} / ${formatBytes(limitBytes)}`
}
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/lib`
Expected: PASS. Semua test di `src/lib` lulus, termasuk test lama `formatBytes` seperti `104857600` → "100 MB".

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint && npm run check`

```bash
git add src/lib/upload-rules.ts src/lib/upload-rules.test.ts src/lib/quota.ts src/lib/quota.test.ts src/lib/book-messages.ts src/lib/book-messages.test.ts src/lib/book-types.ts src/lib/member.ts src/lib/member.test.ts
git commit -m "feat(books): add upload rules, quota counting and book messages"
```

---

### Task 3: Tabel `books`, fungsi reservasi, dan bucket Storage

**Files:**
- Create: `supabase/migrations/20261016000100_books.sql`
- Create: `tests/db/books.test.ts`
- Modify: `src/server/database.types.ts` (digenerate ulang)

**Interfaces:**
- Consumes:
  - `public.profiles` (1A).
  - Helper test `adminClient()`, `anonClient()`, `createTestMember({ email, metadata })`, `signedInClient(email)`, `deleteTestMembers()`, dan `TEST_PASSWORD` dari `tests/db/helpers.ts`.
- Produces:
  - **Tabel `public.books`** sesuai spec §4.
  - **RPC `reserve_book_upload`**, hanya untuk `service_role`. Parameternya:
    - wajib: `p_user_id`, `p_book_id`, `p_sha256`, `p_epub_bytes`, `p_title`, `p_author`, `p_subjects`;
    - opsional: `p_cover_bytes`, `p_cover_type`, `p_description`, `p_language`, `p_genre`, `p_genre_source`.
  - Fungsi ini mengembalikan satu baris `{ epub_path, cover_object_path }`.
  - Jika gagal, fungsi melempar error dengan pesan `too_large`, `invalid_cover`, `not_authenticated`, `duplicate`, atau `quota_exceeded`.
  - **Bucket privat `books`** dengan policy select `books_objects_select_own`.

- [ ] **Step 1: Tulis test integrasi yang gagal**

`tests/db/books.test.ts`:

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
const MB = 1024 * 1024
const emails = {
  ani: `db-books-ani-${run}@glosa.test`,
  budi: `db-books-budi-${run}@glosa.test`,
  cita: `db-books-cita-${run}@glosa.test`,
  dewi: `db-books-dewi-${run}@glosa.test`,
}
const newSha = () => `${randomUUID()}${randomUUID()}`.replaceAll("-", "")
const uploadedPaths: Array<string> = []

function reserve(
  userId: string,
  opts: {
    bookId?: string
    sha256?: string
    epubBytes?: number
    coverBytes?: number
    coverType?: string
  } = {}
) {
  return adminClient()
    .rpc("reserve_book_upload", {
      p_user_id: userId,
      p_book_id: opts.bookId ?? randomUUID(),
      p_sha256: opts.sha256 ?? newSha(),
      p_epub_bytes: opts.epubBytes ?? 1000,
      p_title: "Buku Uji",
      p_author: "Penulis Uji",
      p_subjects: ["Fiction"],
      p_cover_bytes: opts.coverBytes,
      p_cover_type: opts.coverType,
      p_genre: "fiksi_sastra",
      p_genre_source: "auto",
    })
    .single()
}

async function readyBook(userId: string): Promise<string> {
  const bookId = randomUUID()
  const { error } = await reserve(userId, { bookId })
  if (error) throw error
  const { error: updateError } = await adminClient()
    .from("books")
    .update({ status: "ready" })
    .eq("id", bookId)
  if (updateError) throw updateError
  return bookId
}

async function bookOf(id: string) {
  const { data, error } = await adminClient()
    .from("books")
    .select("genre, genre_source, size_bytes, status")
    .eq("id", id)
    .single()
  if (error) throw error
  return data
}

describe("books", () => {
  const ids = { ani: "", budi: "", cita: "", dewi: "" }

  beforeAll(async () => {
    for (const name of ["ani", "budi", "cita", "dewi"] as const) {
      ids[name] = (
        await createTestMember({
          email: emails[name],
          metadata: { username: `bk_${name}_${run}`, display_name: name },
        })
      ).id
    }
  })

  afterAll(async () => {
    if (uploadedPaths.length > 0) {
      await adminClient().storage.from("books").remove(uploadedPaths)
    }
    await deleteTestMembers()
  })

  it("lets members see only their own books", async () => {
    const aniBook = await readyBook(ids.ani)
    await readyBook(ids.budi)
    const ani = await signedInClient(emails.ani)
    const { data, error } = await ani.from("books").select("id")
    expect(error).toBeNull()
    expect(data?.map((book) => book.id)).toEqual([aniBook])
  })

  it("lets members change only the genre of their own books", async () => {
    const aniBook = await readyBook(ids.ani)
    const budiBook = await readyBook(ids.budi)
    const ani = await signedInClient(emails.ani)

    const own = await ani
      .from("books")
      .update({ genre: "sejarah_budaya", genre_source: "user" })
      .eq("id", aniBook)
      .select("id")
    expect(own.error).toBeNull()
    expect(own.data).toHaveLength(1)
    expect(await bookOf(aniBook)).toMatchObject({
      genre: "sejarah_budaya",
      genre_source: "user",
    })

    const other = await ani
      .from("books")
      .update({ genre: "lainnya", genre_source: "user" })
      .eq("id", budiBook)
      .select("id")
    expect(other.data).toEqual([])
    expect((await bookOf(budiBook)).genre).toBe("fiksi_sastra")

    for (const patch of [{ size_bytes: 1 }, { status: "pending" }, { user_id: ids.budi }]) {
      const { error } = await ani.from("books").update(patch).eq("id", aniBook)
      expect(error?.code).toBe("42501")
    }
    expect(await bookOf(aniBook)).toMatchObject({ size_bytes: 1000, status: "ready" })
  })

  it("rejects client inserts and deletes of other members' books", async () => {
    const aniBook = await readyBook(ids.ani)
    const budiBook = await readyBook(ids.budi)
    const ani = await signedInClient(emails.ani)

    const insert = await ani.from("books").insert({
      user_id: ids.ani,
      title: "Selundupan",
      file_path: `${ids.ani}/x.epub`,
      size_bytes: 1,
      sha256: newSha(),
    })
    expect(insert.error?.code).toBe("42501")

    const other = await ani.from("books").delete().eq("id", budiBook).select("id")
    expect(other.data).toEqual([])
    expect(await bookOf(budiBook)).toBeTruthy()

    const own = await ani.from("books").delete().eq("id", aniBook).select("id")
    expect(own.data).toHaveLength(1)
  })

  it("is refused to anonymous visitors", async () => {
    const { data, error } = await anonClient().from("books").select("id")
    expect(error?.code).toBe("42501")
    expect(data ?? []).toEqual([])
  })

  it("lets only the server reserve uploads", async () => {
    const ani = await signedInClient(emails.ani)
    const { error } = await ani.rpc("reserve_book_upload", {
      p_user_id: ids.ani,
      p_book_id: randomUUID(),
      p_sha256: newSha(),
      p_epub_bytes: 1000,
      p_title: "Buku",
      p_author: "",
      p_subjects: [],
    })
    expect(error?.code).toBe("42501")
  })

  it("rejects duplicates, oversized files and inconsistent covers", async () => {
    const sha256 = newSha()
    expect((await reserve(ids.ani, { sha256 })).error).toBeNull()
    expect((await reserve(ids.ani, { sha256 })).error?.message).toBe("duplicate")
    expect((await reserve(ids.ani, { epubBytes: 50 * MB + 1 })).error?.message).toBe(
      "too_large"
    )
    expect((await reserve(ids.ani, { coverBytes: 100 })).error?.message).toBe(
      "invalid_cover"
    )
    expect(
      (await reserve(ids.ani, { coverBytes: 2 * MB + 1, coverType: "image/webp" })).error
        ?.message
    ).toBe("invalid_cover")
  })

  it("enforces the quota, also for concurrent requests", async () => {
    const { error } = await adminClient()
      .from("profiles")
      .update({ storage_limit_bytes: 10 * MB })
      .eq("id", ids.cita)
    expect(error).toBeNull()

    const results = await Promise.all([
      reserve(ids.cita, { epubBytes: 6 * MB }),
      reserve(ids.cita, { epubBytes: 6 * MB }),
    ])
    const messages = results.map((result) => result.error?.message ?? "ok")
    expect(messages.sort()).toEqual(["ok", "quota_exceeded"])
  })

  it("does not count abandoned pending uploads", async () => {
    await adminClient()
      .from("profiles")
      .update({ storage_limit_bytes: 10 * MB })
      .eq("id", ids.dewi)
    const stale = randomUUID()
    const { error } = await adminClient()
      .from("books")
      .insert({
        id: stale,
        user_id: ids.dewi,
        title: "Terputus",
        file_path: `${ids.dewi}/${stale}.epub`,
        size_bytes: 9 * MB,
        sha256: newSha(),
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      })
    expect(error).toBeNull()
    expect((await reserve(ids.dewi, { epubBytes: 6 * MB })).error).toBeNull()
  })

  it("files the book under the member's folder", async () => {
    const bookId = randomUUID()
    const { data, error } = await reserve(ids.ani, {
      bookId,
      coverBytes: 500,
      coverType: "image/webp",
    })
    expect(error).toBeNull()
    expect(data).toEqual({
      epub_path: `${ids.ani}/${bookId}.epub`,
      cover_object_path: `${ids.ani}/${bookId}-cover.webp`,
    })
    expect((await bookOf(bookId)).size_bytes).toBe(1500)
  })

  it("lets members read only their own book files", async () => {
    const path = `${ids.budi}/${randomUUID()}.epub`
    const upload = await adminClient()
      .storage.from("books")
      .upload(path, new Blob([new Uint8Array(64)]), {
        contentType: "application/epub+zip",
      })
    expect(upload.error).toBeNull()
    uploadedPaths.push(path)

    const ani = await signedInClient(emails.ani)
    expect((await ani.storage.from("books").download(path)).error).not.toBeNull()

    const budi = await signedInClient(emails.budi)
    const own = await budi.storage.from("books").download(path)
    expect(own.error).toBeNull()
    expect(own.data?.size).toBe(64)

    const sneaky = await ani.storage
      .from("books")
      .upload(`${ids.ani}/${randomUUID()}.epub`, new Blob([new Uint8Array(8)]), {
        contentType: "application/epub+zip",
      })
    expect(sneaky.error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npm run test:db -- tests/db/books.test.ts`
Expected: FAIL. Error-nya, misalnya, "Could not find the table 'public.books' in the schema cache" atau "Could not find the function public.reserve_book_upload". Typecheck juga bisa gagal karena `books` belum ada di `Database`. Itu akan beres di Step 4.

- [ ] **Step 3: Tulis migrasi**

`supabase/migrations/20261016000100_books.sql`:

```sql
-- Books on a member's shelf (spec §4, §5). Clients never insert: rows are
-- created by reserve_book_upload, which only the server (service_role) may run.

create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  author text not null default '' check (char_length(author) <= 300),
  description text check (char_length(description) <= 2000),
  language text check (char_length(language) <= 35),
  file_path text not null,
  cover_path text,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  genre text check (genre in (
    'fiksi_sastra', 'fantasi_petualangan', 'misteri_thriller', 'anak_remaja',
    'sains_teknologi', 'sejarah_budaya', 'bisnis_pengembangan_diri', 'lainnya'
  )),
  genre_source text check (genre_source in ('auto', 'user')),
  subjects text[] not null default '{}' check (cardinality(subjects) <= 30),
  work_id uuid,
  created_at timestamptz not null default now(),
  last_opened_at timestamptz,
  unique (user_id, sha256),
  check ((genre is null) = (genre_source is null))
);

create index books_user_status_idx on public.books (user_id, status);

alter table public.books enable row level security;

create policy books_select_own on public.books
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy books_update_own on public.books
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy books_delete_own on public.books
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Members may read and delete their books and change only these columns.
revoke all on table public.books from anon, authenticated;
grant select, delete on table public.books to authenticated;
grant update (genre, genre_source, last_opened_at) on table public.books to authenticated;

-- Reserves room for an upload: locks the member's profile row so concurrent
-- requests queue up, rejects duplicates, checks the computed quota and inserts
-- a pending row. Returns the Storage paths to sign.
create function public.reserve_book_upload(
  p_user_id uuid,
  p_book_id uuid,
  p_sha256 text,
  p_epub_bytes bigint,
  p_title text,
  p_author text,
  p_subjects text[],
  p_cover_bytes bigint default 0,
  p_cover_type text default null,
  p_description text default null,
  p_language text default null,
  p_genre text default null,
  p_genre_source text default null
)
returns table (epub_path text, cover_object_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit bigint;
  v_used bigint;
  v_cover_bytes bigint := coalesce(p_cover_bytes, 0);
  v_epub_path text := p_user_id::text || '/' || p_book_id::text || '.epub';
  v_cover_path text := case p_cover_type
    when 'image/webp' then p_user_id::text || '/' || p_book_id::text || '-cover.webp'
    when 'image/jpeg' then p_user_id::text || '/' || p_book_id::text || '-cover.jpg'
  end;
begin
  if p_epub_bytes <= 0 or p_epub_bytes > 52428800 then
    raise exception 'too_large' using errcode = 'P0001';
  end if;
  if (v_cover_path is null) <> (v_cover_bytes = 0)
    or v_cover_bytes < 0 or v_cover_bytes > 2097152 then
    raise exception 'invalid_cover' using errcode = 'P0001';
  end if;

  select pr.storage_limit_bytes into v_limit
  from public.profiles pr
  where pr.id = p_user_id
  for update;
  if not found then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.books b
    where b.user_id = p_user_id and b.sha256 = p_sha256
  ) then
    raise exception 'duplicate' using errcode = 'P0001';
  end if;

  -- Usage is computed, never stored. Pending rows older than an hour are
  -- abandoned uploads and no longer count (the server removes them).
  select coalesce(sum(b.size_bytes), 0) into v_used
  from public.books b
  where b.user_id = p_user_id
    and (b.status = 'ready' or b.created_at > now() - interval '1 hour');

  if v_used + p_epub_bytes + v_cover_bytes > v_limit then
    raise exception 'quota_exceeded' using errcode = 'P0001';
  end if;

  insert into public.books (
    id, user_id, title, author, description, language, file_path, cover_path,
    size_bytes, sha256, genre, genre_source, subjects
  ) values (
    p_book_id, p_user_id, p_title, coalesce(p_author, ''), p_description,
    p_language, v_epub_path, v_cover_path, p_epub_bytes + v_cover_bytes,
    p_sha256, p_genre, p_genre_source, coalesce(p_subjects, '{}')
  );

  return query select v_epub_path, v_cover_path;
end;
$$;

revoke execute on function public.reserve_book_upload(
  uuid, uuid, text, bigint, text, text, text[], bigint, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.reserve_book_upload(
  uuid, uuid, text, bigint, text, text, text[], bigint, text, text, text, text, text
) to service_role;

-- Private bucket for EPUB files and covers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'books', 'books', false, 52428800,
  array['application/epub+zip', 'image/webp', 'image/jpeg']
)
on conflict (id) do nothing;

-- Members read only their own folder. No insert/update/delete policies:
-- uploads use signed upload URLs and removals go through the server.
create policy books_objects_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'books'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
```

- [ ] **Step 4: Push migrasi, generate type, jalankan test**

Run: `npm run db:push && npm run db:types && npm run test:db`
Expected:
- `db push` menerapkan `20261016000100_books.sql`.
- `src/server/database.types.ts` kini memuat tabel `books` dan fungsi `reserve_book_upload`. Parameter dengan default tampil opsional (`p_cover_type?: string`).
- Test: PASS, yaitu 10 test lama `profiles.test.ts` dan 10 test baru `books.test.ts`.

Jika `db push` menolak `create policy … on storage.objects`, laporkan sebagai BLOCKED beserta pesan errornya. Jangan memindahkan policy ke langkah manual tanpa persetujuan.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint && npm run check`

```bash
git add supabase/migrations/20261016000100_books.sql tests/db/books.test.ts src/server/database.types.ts
git commit -m "feat(db): add books with quota-checked reservations and a private storage bucket"
```

- [ ] **Step 6 (perbaikan setelah review): cabut delete dari client, tambah test kuota buku lama**

Migrasi `20261016000100_books.sql` sudah diterapkan, jadi jangan diubah. Buat migrasi lanjutan `supabase/migrations/20261016000200_books_server_delete.sql`:

```sql
-- Members no longer delete book rows themselves: a direct delete would free the
-- quota while the Storage objects stay readable. Deletion goes through the
-- server, which removes the objects first (plan 1B, decision 7).
drop policy books_delete_own on public.books;
revoke delete on table public.books from authenticated;

-- Keep the bucket private with its intended limits, even if it pre-existed.
update storage.buckets
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = array['application/epub+zip', 'image/webp', 'image/jpeg']
where id = 'books';
```

Ubah `tests/db/books.test.ts`:
1. Test "rejects client inserts and deletes of other members' books" diganti namanya menjadi `"rejects client inserts and deletes"`. Hapus baris milik Budi dan baris milik sendiri sama-sama harus gagal dengan `error.code === "42501"`, dan kedua buku tetap ada (cek dengan `bookOf`).
2. Di test "lets members change only the genre of their own books", tambahkan pengecekan bahwa update `{ last_opened_at: new Date().toISOString() }` pada buku sendiri berhasil (`error` null).
3. Di test "rejects duplicates, oversized files and inconsistent covers", tambahkan pengecekan bahwa EPUB berukuran tepat `50 * MB` diterima (`error` null).
4. Tambah member kelima `eko` dan test baru `"keeps counting ready books, however old"`:
   - Set limit eko 10 MB lewat admin dan periksa `error`.
   - Lewat admin, insert baris `status: "ready"` berukuran 9 MB dengan `created_at` 2 jam yang lalu.
   - `reserve(ids.eko, { epubBytes: 6 * MB })` harus menghasilkan `quota_exceeded`.
5. Periksa `error` pada update limit dewi. Di `afterAll`, lempar error jika `storage.remove(uploadedPaths)` gagal.

Run: `npm run db:push && npm run db:types && npm run test:db`
Expected: migrasi lanjutan diterapkan dan test DB lulus. Totalnya 21: 10 profiles dan 11 books.

```bash
git add supabase/migrations/20261016000200_books_server_delete.sql tests/db/books.test.ts src/server/database.types.ts
git commit -m "fix(db): keep book deletion on the server and test that old books keep counting"
```

---

### Task 4: Modul `bookStorage`, server function buku, dan hapus akun

**Files:**
- Create: `src/server/book-storage.ts`, `src/server/books.ts`
- Create: `tests/db/book-storage.test.ts`
- Modify: `src/server/profile.ts` (`deleteAccountFn`)

**Interfaces:**
- Consumes:
  - `getSupabaseServerClient`, `getSupabaseAdminClient` (`src/server/supabase.ts`).
  - `reserve_book_upload` (Task 3), `ActionResult` (1A).
  - `UploadRequest`, `UploadTicket`, `ShelfData` (Task 2).
  - `usedBytes`, `isAbandoned` (Task 2).
  - `GENRE_VALUES`, `isGenre`, `Genre` (Task 1).
  - `toPlan` (1A).
- Produces:
  - `bookStorage(client)` → `{ createUploadUrl(path): Promise<string>; getReadUrls(paths, expiresIn?): Promise<Map<string, string>>; statObject(path): Promise<number | null>; listFolder(folder): Promise<Array<string>>; remove(paths): Promise<void> }`
  - `objectPaths(row: { file_path: string; cover_path: string | null }): Array<string>`
  - Server function (dipanggil `fn({ data })`):
    - `requestUploadFn(UploadRequest) → UploadTicket`
    - `confirmUploadFn({ bookId }) → ActionResult`
    - `listBooksFn() → ShelfData` (GET, melempar error jika tidak login)
    - `updateBookGenreFn({ bookId, genre: Genre }) → ActionResult`
    - `deleteBookFn({ bookId }) → ActionResult`
  - Kode error: `not_authenticated`, `too_large`, `invalid_cover`, `duplicate`, `quota_exceeded`, `not_found`, `size_mismatch`, `unknown`.

- [ ] **Step 1: Tulis test integrasi yang gagal untuk `bookStorage`**

`tests/db/book-storage.test.ts`:

```ts
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { bookStorage, objectPaths } from "@/server/book-storage"
import { adminClient, createTestMember, deleteTestMembers } from "./helpers"

const run = Date.now().toString(36)

describe("bookStorage", () => {
  let folder = ""
  let path = ""

  beforeAll(async () => {
    const member = await createTestMember({ email: `db-storage-${run}@glosa.test` })
    folder = member.id
    path = `${folder}/${randomUUID()}.epub`
  })

  afterAll(async () => {
    await adminClient().storage.from("books").remove([path])
    await deleteTestMembers()
  })

  it("uploads through a signed URL, reports the size, signs reads and removes", async () => {
    const storage = bookStorage(adminClient())
    const uploadUrl = await storage.createUploadUrl(path)

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": "application/epub+zip", "x-upsert": "false" },
      body: new Blob([new Uint8Array(1234)]),
    })
    expect(response.ok).toBe(true)
    expect(await storage.statObject(path)).toBe(1234)
    expect(await storage.listFolder(folder)).toContain(path)

    const readUrls = await storage.getReadUrls([path])
    const readUrl = readUrls.get(path)
    expect(readUrl).toBeDefined()
    const file = await fetch(readUrl ?? "")
    expect((await file.arrayBuffer()).byteLength).toBe(1234)

    await storage.remove([path])
    expect(await storage.statObject(path)).toBeNull()
    expect(await storage.listFolder(folder)).not.toContain(path)
  })

  it("lists a book's objects", () => {
    expect(objectPaths({ file_path: "u/b.epub", cover_path: "u/b-cover.webp" })).toEqual([
      "u/b.epub",
      "u/b-cover.webp",
    ])
    expect(objectPaths({ file_path: "u/b.epub", cover_path: null })).toEqual(["u/b.epub"])
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npm run test:db -- tests/db/book-storage.test.ts`
Expected: FAIL dengan "Failed to resolve import "@/server/book-storage"".

- [ ] **Step 3: Implementasi `bookStorage`**

`src/server/book-storage.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

export const BOOKS_BUCKET = "books"
const REMOVE_BATCH = 100
const LIST_PAGE = 1000

/** Every Storage object that belongs to a book row. */
export function objectPaths(row: { file_path: string; cover_path: string | null }): Array<string> {
  return row.cover_path ? [row.file_path, row.cover_path] : [row.file_path]
}

/**
 * All access to book files goes through here, so the storage provider can be
 * swapped later (spec §5). Pass the admin client for signing uploads, stat and
 * removal; pass the member's client for signed reads so Storage RLS applies.
 */
export function bookStorage(client: SupabaseClient<Database>) {
  const bucket = () => client.storage.from(BOOKS_BUCKET)
  return {
    async createUploadUrl(path: string): Promise<string> {
      const { data, error } = await bucket().createSignedUploadUrl(path)
      if (error) throw error
      return data.signedUrl
    },

    async getReadUrls(paths: Array<string>, expiresIn = 3600): Promise<Map<string, string>> {
      if (paths.length === 0) return new Map()
      const { data, error } = await bucket().createSignedUrls(paths, expiresIn)
      if (error) throw error
      return new Map(
        data.flatMap((item) =>
          item.path && !item.error ? [[item.path, item.signedUrl] as const] : []
        )
      )
    },

    /** Size in bytes, or null when the object does not exist. */
    async statObject(path: string): Promise<number | null> {
      const { data, error } = await bucket().info(path)
      if (error) return null
      return data.size ?? null
    },

    /** Paths of every object directly inside a member's folder. */
    async listFolder(folder: string): Promise<Array<string>> {
      const paths: Array<string> = []
      for (let offset = 0; ; offset += LIST_PAGE) {
        const { data, error } = await bucket().list(folder, { limit: LIST_PAGE, offset })
        if (error) throw error
        paths.push(...data.map((object) => `${folder}/${object.name}`))
        if (data.length < LIST_PAGE) return paths
      }
    },

    async remove(paths: Array<string>): Promise<void> {
      for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
        const { error } = await bucket().remove(paths.slice(i, i + REMOVE_BATCH))
        if (error) throw error
      }
    },
  }
}
```

- [ ] **Step 4: Jalankan test `bookStorage` dan pastikan lulus**

Run: `npm run test:db -- tests/db/book-storage.test.ts`
Expected: PASS (2 tests).

Jika PUT dengan body mentah ditolak (status bukan 2xx) atau ukurannya tidak cocok, ganti body test dengan multipart: `const form = new FormData(); form.append("cacheControl", "3600"); form.append("", blob)`. Hapus juga header `content-type` agar diisi otomatis. Catat perubahan ini di laporan, karena `putFile` di Task 7 harus mengikutinya.

- [ ] **Step 5: Implementasi server function buku**

`src/server/books.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { ActionResult } from "@/lib/action-result"
import type { ShelfData, UploadRequest, UploadTicket } from "@/lib/book-types"
import { GENRE_VALUES, type Genre, isGenre } from "@/lib/genre"
import { isAbandoned, usedBytes } from "@/lib/quota"
import { toPlan } from "@/lib/session-types"
import { MAX_COVER_BYTES, MAX_EPUB_BYTES, METADATA_LIMITS } from "@/lib/upload-rules"
import { bookStorage, objectPaths } from "./book-storage"
import { getSupabaseAdminClient, getSupabaseServerClient } from "./supabase"

const RESERVE_ERRORS = new Set([
  "too_large",
  "invalid_cover",
  "duplicate",
  "quota_exceeded",
  "not_authenticated",
])

const fail = (code: string) => ({ ok: false as const, code })

type AdminClient = ReturnType<typeof getSupabaseAdminClient>

const UploadRequestSchema = z
  .object({
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    epubBytes: z.number().int().positive(),
    cover: z
      .object({
        bytes: z.number().int().positive().max(MAX_COVER_BYTES),
        type: z.enum(["image/webp", "image/jpeg"]),
      })
      .nullable(),
    title: z.string().trim().min(1).max(METADATA_LIMITS.title),
    author: z.string().trim().max(METADATA_LIMITS.author),
    description: z.string().trim().max(METADATA_LIMITS.description).nullable(),
    language: z.string().trim().max(METADATA_LIMITS.language).nullable(),
    subjects: z
      .array(z.string().trim().min(1).max(METADATA_LIMITS.subject))
      .max(METADATA_LIMITS.subjects),
    genre: z.enum(GENRE_VALUES).nullable(),
    genreSource: z.enum(["auto", "user"]).nullable(),
  })
  .refine((value) => (value.genre === null) === (value.genreSource === null))

const BookIdSchema = z.object({ bookId: z.uuid() })

/**
 * Replaces the spec's pg_cron job (Storage objects cannot be removed from SQL):
 * before a new reservation, drop this member's abandoned uploads and any earlier
 * attempt at the same file, together with their objects.
 */
async function removeAbandonedUploads(admin: AdminClient, userId: string, sha256: string) {
  const { data, error } = await admin
    .from("books")
    .select("id, sha256, created_at, file_path, cover_path")
    .eq("user_id", userId)
    .eq("status", "pending")
  if (error) throw error
  const stale = data.filter(
    (row) =>
      row.sha256 === sha256 || isAbandoned({ status: "pending", createdAt: row.created_at })
  )
  if (stale.length === 0) return
  await bookStorage(admin).remove(stale.flatMap(objectPaths))
  const { error: deleteError } = await admin
    .from("books")
    .delete()
    .in(
      "id",
      stale.map((row) => row.id)
    )
  if (deleteError) throw deleteError
}

/**
 * Removes objects in the member's folder that no book row refers to: files
 * uploaded through a still-valid signed URL after their row was cleaned up.
 * Runs on every upload request and deletion, which bounds what a member can
 * keep beyond their quota; plan 1D adds a periodic sweep for everyone.
 */
async function removeOrphanedObjects(admin: AdminClient, userId: string) {
  const storage = bookStorage(admin)
  const [objects, rowsResult] = await Promise.all([
    storage.listFolder(userId),
    admin.from("books").select("file_path, cover_path").eq("user_id", userId),
  ])
  if (rowsResult.error) throw rowsResult.error
  const referenced = new Set(rowsResult.data.flatMap(objectPaths))
  await storage.remove(objects.filter((path) => !referenced.has(path)))
}

export const requestUploadFn = createServerFn({ method: "POST" })
  .validator((data: UploadRequest) => UploadRequestSchema.parse(data))
  .handler(async ({ data }): Promise<UploadTicket> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")
    if (data.epubBytes > MAX_EPUB_BYTES) return fail("too_large")

    const admin = getSupabaseAdminClient()
    try {
      await removeAbandonedUploads(admin, user.id, data.sha256)
      await removeOrphanedObjects(admin, user.id)
    } catch (error) {
      console.error("upload cleanup failed", error)
      return fail("unknown")
    }

    const bookId = crypto.randomUUID()
    const { data: paths, error } = await admin
      .rpc("reserve_book_upload", {
        p_user_id: user.id,
        p_book_id: bookId,
        p_sha256: data.sha256,
        p_epub_bytes: data.epubBytes,
        p_title: data.title,
        p_author: data.author,
        p_subjects: data.subjects,
        p_cover_bytes: data.cover?.bytes ?? 0,
        p_cover_type: data.cover?.type,
        p_description: data.description ?? undefined,
        p_language: data.language ?? undefined,
        p_genre: data.genre ?? undefined,
        p_genre_source: data.genreSource ?? undefined,
      })
      .single()
    if (error) {
      if (RESERVE_ERRORS.has(error.message)) return fail(error.message)
      console.error("reserve_book_upload failed", error)
      return fail("unknown")
    }

    const storage = bookStorage(admin)
    try {
      return {
        ok: true,
        bookId,
        epubUploadUrl: await storage.createUploadUrl(paths.epub_path),
        coverUploadUrl: paths.cover_object_path
          ? await storage.createUploadUrl(paths.cover_object_path)
          : null,
      }
    } catch (signError) {
      console.error("signing upload URLs failed", signError)
      await admin.from("books").delete().eq("id", bookId)
      return fail("unknown")
    }
  })

export const confirmUploadFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data: book, error } = await supabase
      .from("books")
      .select("id, file_path, cover_path, size_bytes, status")
      .eq("id", data.bookId)
      .maybeSingle()
    if (error) {
      console.error("book lookup failed", error)
      return fail("unknown")
    }
    if (!book) return fail("not_found")
    if (book.status === "ready") return { ok: true }

    const admin = getSupabaseAdminClient()
    const storage = bookStorage(admin)
    const epubSize = await storage.statObject(book.file_path)
    const coverSize = book.cover_path ? await storage.statObject(book.cover_path) : 0
    if (
      epubSize === null ||
      coverSize === null ||
      coverSize > MAX_COVER_BYTES ||
      epubSize + coverSize !== book.size_bytes
    ) {
      try {
        await storage.remove(objectPaths(book))
      } catch (removeError) {
        console.error("removing a broken upload failed", removeError)
      }
      await admin.from("books").delete().eq("id", book.id)
      return fail("size_mismatch")
    }

    const { error: updateError } = await admin
      .from("books")
      .update({ status: "ready" })
      .eq("id", book.id)
    if (updateError) {
      console.error("marking the book ready failed", updateError)
      return fail("unknown")
    }
    return { ok: true }
  })

export const listBooksFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShelfData> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("not_authenticated")

    const [booksResult, profileResult] = await Promise.all([
      supabase
        .from("books")
        .select(
          "id, title, author, description, language, genre, genre_source, size_bytes, status, created_at, last_opened_at, cover_path"
        ),
      supabase.from("profiles").select("plan, storage_limit_bytes").eq("id", user.id).single(),
    ])
    if (booksResult.error) throw booksResult.error
    if (profileResult.error) throw profileResult.error
    const rows = booksResult.data

    const ready = rows.filter((row) => row.status === "ready")
    let covers = new Map<string, string>()
    try {
      // Signed with the member's own client, so Storage RLS applies.
      covers = await bookStorage(supabase).getReadUrls(
        ready.flatMap((row) => (row.cover_path ? [row.cover_path] : []))
      )
    } catch (error) {
      console.error("signing cover URLs failed", error)
    }

    return {
      books: ready.map((row) => ({
        id: row.id,
        title: row.title,
        author: row.author,
        description: row.description,
        language: row.language,
        genre: isGenre(row.genre) ? row.genre : null,
        genreSource:
          row.genre_source === "auto" || row.genre_source === "user" ? row.genre_source : null,
        sizeBytes: row.size_bytes,
        createdAt: row.created_at,
        lastOpenedAt: row.last_opened_at,
        coverUrl: row.cover_path ? (covers.get(row.cover_path) ?? null) : null,
      })),
      usage: {
        usedBytes: usedBytes(
          rows.map((row) => ({
            sizeBytes: row.size_bytes,
            status: row.status === "ready" ? "ready" : "pending",
            createdAt: row.created_at,
          }))
        ),
        limitBytes: profileResult.data.storage_limit_bytes,
        plan: toPlan(profileResult.data.plan),
      },
    }
  }
)

export const updateBookGenreFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string; genre: Genre }) =>
    z.object({ bookId: z.uuid(), genre: z.enum(GENRE_VALUES) }).parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data: rows, error } = await supabase
      .from("books")
      .update({ genre: data.genre, genre_source: "user" })
      .eq("id", data.bookId)
      .select("id")
    if (error) {
      console.error("updating the genre failed", error)
      return fail("unknown")
    }
    return rows.length > 0 ? { ok: true } : fail("not_found")
  })

export const deleteBookFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    // Looked up with the member's client: RLS proves ownership.
    const { data: book, error } = await supabase
      .from("books")
      .select("id, file_path, cover_path")
      .eq("id", data.bookId)
      .maybeSingle()
    if (error) {
      console.error("book lookup failed", error)
      return fail("unknown")
    }
    if (!book) return fail("not_found")

    // Members cannot delete rows themselves (decision 7): remove the files first,
    // then the row with the admin client, scoped to this member.
    const admin = getSupabaseAdminClient()
    try {
      await bookStorage(admin).remove(objectPaths(book))
    } catch (removeError) {
      console.error("removing book files failed", removeError)
      return fail("unknown")
    }
    const { error: deleteError } = await admin
      .from("books")
      .delete()
      .eq("id", book.id)
      .eq("user_id", user.id)
    if (deleteError) {
      console.error("deleting the book failed", deleteError)
      return fail("unknown")
    }
    try {
      await removeOrphanedObjects(admin, user.id)
    } catch (sweepError) {
      console.error("orphan sweep failed", sweepError)
    }
    return { ok: true }
  })
```

- [ ] **Step 6: Hapus file buku saat akun dihapus**

Di `src/server/profile.ts`:
1. Tambahkan `import { bookStorage, objectPaths } from "./book-storage"`.
2. Di `deleteAccountFn`, ganti komentar `// Plan 1B adds: remove the member's Storage objects before deleting the user.` beserta panggilan `deleteUser` di bawahnya dengan kode berikut:

```ts
    // Book files live in Storage, outside the database cascade: remove them first,
    // and keep the account if that fails so no files are orphaned.
    const admin = getSupabaseAdminClient()
    const { data: books, error: booksError } = await admin
      .from("books")
      .select("file_path, cover_path")
      .eq("user_id", user.id)
    if (booksError) {
      console.error("book lookup failed", booksError)
      return { ok: false, code: "unknown" }
    }
    try {
      await bookStorage(admin).remove(books.flatMap(objectPaths))
    } catch (removeError) {
      console.error("removing book files failed", removeError)
      return { ok: false, code: "unknown" }
    }

    const { error } = await admin.auth.admin.deleteUser(user.id)
```

Baris setelahnya, yaitu `if (error) return { ok: false, code: "unknown" }` dan pembersihan sesi, tetap sama.

- [ ] **Step 7: Pastikan secret tidak masuk ke bundle client**

Run: `npm run build && grep -rlE "SUPABASE_SECRET_KEY|sb_secret|createServerClient|auth\.admin" dist/client || echo "client bundle clean"`
Expected: `client bundle clean`.

- [ ] **Step 8: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint && npm run check && npm run test:db`
Expected: semua lulus. Test DB berjumlah 23 (10 + 11 + 2).

```bash
git add src/server/book-storage.ts src/server/books.ts src/server/profile.ts tests/db/book-storage.test.ts
git commit -m "feat(books): add storage wrapper and server functions for upload, shelf, genre and deletion"
```

---

### Task 5: Membaca EPUB di browser

**Files:**
- Modify: `package.json`, `package-lock.json`. Tambahkan `foliate-js` (git) dan `@zip.js/zip.js`.
- Create: `src/types/foliate-js.d.ts`, `src/lib/epub/metadata.ts`, `src/lib/epub/hash.ts`, `src/lib/epub/cover.ts`, `src/lib/epub/read-epub.ts`
- Test: `src/lib/epub/metadata.test.ts`, `src/lib/epub/hash.test.ts`

**Interfaces:**
- Consumes: `suggestGenre`, `Genre` (Task 1). `checkEpubFile`, `cleanDescription`, `clampText`, `METADATA_LIMITS`, `COVER_WIDTH`, `MAX_COVER_BYTES` (Task 2).
- Produces:
  - `type BookMetadata = { title: string; author: string; language: string | null; description: string | null; subjects: Array<string> }`
  - `normalizeMetadata(raw: unknown, fileName: string): BookMetadata`
  - `sha256Hex(data: ArrayBuffer): Promise<string>`
  - `type Cover = { blob: Blob; type: "image/webp" | "image/jpeg" }`, `shrinkCover(source: Blob): Promise<Cover | null>`
  - `type ParsedEpub = { metadata: BookMetadata; cover: Cover | null; sha256: string; suggestedGenre: Genre | null }`
  - `class EpubError extends Error { code: "not_epub" | "too_large" | "epub_invalid" }`
  - `readEpub(file: File): Promise<ParsedEpub>` (hanya berjalan di browser)

- [ ] **Step 1: Pasang dependensi**

Run: `npm install github:johnfactotum/foliate-js#78914aef4466eb960965702401634c2cb348e9b1 @zip.js/zip.js`
Expected: `package.json` memuat `"foliate-js": "github:johnfactotum/foliate-js#78914aef4466eb960965702401634c2cb348e9b1"` dan `@zip.js/zip.js` versi 2.x. Folder `node_modules/foliate-js/epub.js` tersedia.

- [ ] **Step 2: Tulis test yang gagal**

`src/lib/epub/metadata.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { normalizeMetadata } from "./metadata"

describe("normalizeMetadata", () => {
  it("reads plain string metadata", () => {
    expect(
      normalizeMetadata(
        {
          title: "The Adventures of Sherlock Holmes",
          author: "Arthur Conan Doyle",
          language: "en-GB",
          subject: "Detective and mystery stories, English",
          description: "<p>Twelve <i>cases</i>.</p>",
        },
        "sherlock.epub"
      )
    ).toEqual({
      title: "The Adventures of Sherlock Holmes",
      author: "Arthur Conan Doyle",
      language: "en-GB",
      description: "Twelve cases.",
      subjects: ["Detective and mystery stories, English"],
    })
  })

  it("reads foliate's contributor objects, language maps and lists", () => {
    const result = normalizeMetadata(
      {
        title: { ja: "草枕", en: "Kusamakura" },
        author: [
          { name: "Natsume Sōseki", role: ["aut"] },
          { name: { en: "Meredith McKinney" } },
        ],
        language: ["en", "ja"],
        subject: [
          { name: "Japanese fiction", code: "FIC" },
          "Artists -- Fiction",
          "Japanese fiction",
        ],
      },
      "kusamakura.epub"
    )
    expect(result.title).toBe("Kusamakura")
    expect(result.author).toBe("Natsume Sōseki, Meredith McKinney")
    expect(result.language).toBe("en")
    expect(result.subjects).toEqual(["Japanese fiction", "Artists -- Fiction"])
    expect(result.description).toBeNull()
  })

  it("falls back to the file name when the title is missing", () => {
    expect(normalizeMetadata({}, "buku_tanpa-judul.epub")).toEqual({
      title: "buku tanpa judul",
      author: "",
      language: null,
      description: null,
      subjects: [],
    })
    expect(normalizeMetadata(null, ".epub").title).toBe("Tanpa judul")
  })

  it("respects the metadata limits", () => {
    const result = normalizeMetadata(
      {
        title: "J".repeat(400),
        subject: Array.from({ length: 40 }, (_, i) => `Subjek ${i} ${"x".repeat(250)}`),
      },
      "panjang.epub"
    )
    expect(result.title.length).toBeLessThanOrEqual(300)
    expect(result.subjects).toHaveLength(30)
    expect(result.subjects.every((subject) => subject.length <= 200)).toBe(true)
  })
})
```

`src/lib/epub/hash.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest"
import { sha256Hex } from "./hash"

describe("sha256Hex", () => {
  it("hashes bytes as lowercase hex", async () => {
    const bytes = new TextEncoder().encode("abc")
    expect(await sha256Hex(bytes.buffer)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
  })
})
```

- [ ] **Step 3: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/lib/epub`
Expected: FAIL dengan "Failed to resolve import "./metadata"" dan "Failed to resolve import "./hash"".

- [ ] **Step 4: Implementasi**

`src/types/foliate-js.d.ts`:

```ts
declare module "foliate-js/epub.js" {
  export type EpubLoader = {
    loadText: (name: string) => Promise<string> | null
    loadBlob: (name: string, type?: string) => Promise<Blob> | null
    getSize: (name: string) => number
  }

  export class EPUB {
    constructor(loader: EpubLoader)
    init(): Promise<EPUB>
    /** Readium-webpub-like metadata; values may be strings, language maps or arrays. */
    metadata: unknown
    sections: Array<unknown>
    getCover(): Promise<Blob | null>
    destroy(): void
  }
}
```

`src/lib/epub/metadata.ts`:

```ts
import { METADATA_LIMITS, clampText, cleanDescription } from "@/lib/upload-rules"

export type BookMetadata = {
  title: string
  author: string
  language: string | null
  description: string | null
  subjects: Array<string>
}

const tidy = (text: string) => text.replace(/\s+/g, " ").trim()

/** foliate gives a string or a language map such as { ja: "草枕", en: "Kusamakura" }. */
function localized(value: unknown): string | null {
  if (typeof value === "string") return value
  if (value && typeof value === "object") {
    const map = value as Record<string, unknown>
    const preferred = typeof map.en === "string" ? map.en : Object.values(map).find((v) => typeof v === "string")
    return typeof preferred === "string" ? preferred : null
  }
  return null
}

/** Contributors and subjects are strings or objects with a (localized) name. */
function nameOf(value: unknown): string | null {
  if (value && typeof value === "object" && "name" in value) {
    return localized((value as { name: unknown }).name)
  }
  return localized(value)
}

function list(value: unknown): Array<unknown> {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function names(value: unknown): Array<string> {
  const seen = new Set<string>()
  for (const item of list(value)) {
    const name = nameOf(item)
    if (name && tidy(name)) seen.add(tidy(name))
  }
  return [...seen]
}

/** Maps foliate-js book.metadata to what Glosa stores (spec §5). */
export function normalizeMetadata(raw: unknown, fileName: string): BookMetadata {
  const metadata = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const fromFile = tidy(fileName.replace(/\.epub$/i, "").replace(/[_-]+/g, " "))
  const title = tidy(localized(metadata.title) ?? "") || fromFile || "Tanpa judul"
  const language = tidy(localized(list(metadata.language)[0]) ?? "")

  return {
    title: clampText(title, METADATA_LIMITS.title),
    author: clampText(names(metadata.author).join(", "), METADATA_LIMITS.author),
    language: language ? language.slice(0, METADATA_LIMITS.language) : null,
    description: cleanDescription(localized(metadata.description)),
    subjects: names(metadata.subject)
      .slice(0, METADATA_LIMITS.subjects)
      .map((subject) => clampText(subject, METADATA_LIMITS.subject)),
  }
}
```

`src/lib/epub/hash.ts`:

```ts
/** SHA-256 of the file, used to spot the same book uploaded twice (spec §5). */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
```

`src/lib/epub/cover.ts`:

```ts
import { COVER_WIDTH, MAX_COVER_BYTES } from "@/lib/upload-rules"

export type Cover = { blob: Blob; type: "image/webp" | "image/jpeg" }

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Shrinks a cover to 400 px wide WebP; JPEG where the browser cannot encode WebP. */
export async function shrinkCover(source: Blob): Promise<Cover | null> {
  const bitmap = await createImageBitmap(source)
  try {
    const scale = Math.min(1, COVER_WIDTH / bitmap.width)
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) return null
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const webp = await toBlob(canvas, "image/webp", 0.82)
    const blob = webp?.type === "image/webp" ? webp : await toBlob(canvas, "image/jpeg", 0.85)
    if (!blob || blob.size > MAX_COVER_BYTES) return null
    return { blob, type: blob.type === "image/webp" ? "image/webp" : "image/jpeg" }
  } finally {
    bitmap.close()
  }
}
```

`src/lib/epub/read-epub.ts`:

```ts
import { BlobReader, BlobWriter, TextWriter, ZipReader, configure } from "@zip.js/zip.js"
import { type Genre, suggestGenre } from "@/lib/genre"
import { type FileProblem, checkEpubFile } from "@/lib/upload-rules"
import { type Cover, shrinkCover } from "./cover"
import { sha256Hex } from "./hash"
import { type BookMetadata, normalizeMetadata } from "./metadata"

export type ParsedEpub = {
  metadata: BookMetadata
  cover: Cover | null
  sha256: string
  suggestedGenre: Genre | null
}

export class EpubError extends Error {
  constructor(readonly code: FileProblem) {
    super(code)
  }
}

/** The same zip loader foliate-js uses in view.js, without its PDF/MOBI handling. */
async function openZip(file: Blob) {
  configure({ useWebWorkers: false })
  const reader = new ZipReader(new BlobReader(file))
  const entries = await reader.getEntries()
  const byName = new Map(entries.map((entry) => [entry.filename, entry]))
  return {
    loadText: (name: string) => byName.get(name)?.getData?.(new TextWriter()) ?? null,
    loadBlob: (name: string, type?: string) =>
      byName.get(name)?.getData?.(new BlobWriter(type)) ?? null,
    getSize: (name: string) => byName.get(name)?.uncompressedSize ?? 0,
    close: () => reader.close(),
  }
}

/**
 * Opens an EPUB in the browser (spec §5 step 1): metadata, a shrunk cover,
 * SHA-256 and a genre guess. Throws EpubError for files that cannot come in.
 */
export async function readEpub(file: File): Promise<ParsedEpub> {
  const problem = checkEpubFile(file)
  if (problem) throw new EpubError(problem)

  let zip: Awaited<ReturnType<typeof openZip>>
  try {
    zip = await openZip(file)
  } catch {
    throw new EpubError("epub_invalid")
  }
  try {
    const { EPUB } = await import("foliate-js/epub.js")
    let book: InstanceType<typeof EPUB>
    try {
      book = await new EPUB(zip).init()
    } catch {
      throw new EpubError("epub_invalid")
    }
    if (book.sections.length === 0) throw new EpubError("epub_invalid")

    const metadata = normalizeMetadata(book.metadata, file.name)
    const cover = await book
      .getCover()
      .then((blob) => (blob ? shrinkCover(blob) : null))
      .catch(() => null)
    return {
      metadata,
      cover,
      sha256: await sha256Hex(await file.arrayBuffer()),
      suggestedGenre: suggestGenre(metadata.subjects),
    }
  } finally {
    await zip.close().catch(() => undefined)
  }
}
```

Kode di atas memakai `getData?.(…)` dengan optional chaining. Jika tipe zip.js versi terpasang membedakan entri file dan direktori secara lain, sesuaikan agar entri direktori mengembalikan `null`. Jangan memakai `as any`.

- [ ] **Step 5: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/lib/epub`
Expected: PASS (5 tests). `readEpub` dan `shrinkCover` diuji di browser sungguhan lewat E2E Task 11.

- [ ] **Step 6: Typecheck, test, lint, build, commit**

Run: `npm run typecheck && npm test && npm run lint && npm run check && npm run build`
Expected: semua lulus. `npm run build` sukses. Belum ada halaman yang memanggil `readEpub`, jadi chunk foliate belum muncul.

```bash
git add package.json package-lock.json src/types/foliate-js.d.ts src/lib/epub
git commit -m "feat(books): read EPUB metadata, cover and hash in the browser with foliate-js"
```

---

### Task 6: Logika rak (saring, cari, urutkan, hitung)

**Files:**
- Create: `src/lib/shelf.ts`
- Test: `src/lib/shelf.test.ts`

**Interfaces:**
- Consumes: `ShelfBook` (Task 2). `GENRE_VALUES`, `GENRE_LABELS`, `TROLLEY_LABEL`, `isGenre`, `Genre` (Task 1).
- Produces:
  - `type ShelfFilter = "semua" | Genre | "troli"`, `type ShelfSort = "opened" | "title" | "added"`
  - `type ShelfSearch = { genre?: Genre | "troli"; q?: string; sort?: "title" | "added" }`
  - `SHELF_FILTERS: ReadonlyArray<{ value: ShelfFilter; label: string }>`, `SHELF_SORTS: ReadonlyArray<{ value: ShelfSort; label: string }>`
  - `parseShelfSearch(search: Record<string, unknown>): ShelfSearch`
  - `shelfBooks(books, search): Array<ShelfBook>`
  - `countBooks(books): Record<ShelfFilter, number>`

- [ ] **Step 1: Tulis test yang gagal**

`src/lib/shelf.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { ShelfBook } from "./book-types"
import { countBooks, parseShelfSearch, shelfBooks } from "./shelf"

function book(overrides: Partial<ShelfBook>): ShelfBook {
  return {
    id: overrides.title ?? "x",
    title: "Judul",
    author: "",
    description: null,
    language: null,
    genre: null,
    genreSource: null,
    sizeBytes: 1,
    createdAt: "2026-10-01T00:00:00+00:00",
    lastOpenedAt: null,
    coverUrl: null,
    ...overrides,
  }
}

const books = [
  book({
    title: "Émile",
    author: "Rousseau",
    genre: "sejarah_budaya",
    genreSource: "auto",
    createdAt: "2026-10-03T00:00:00+00:00",
  }),
  book({
    title: "Alice",
    author: "Lewis Carroll",
    genre: "anak_remaja",
    genreSource: "auto",
    createdAt: "2026-10-01T00:00:00+00:00",
    lastOpenedAt: "2026-10-10T00:00:00+00:00",
  }),
  book({ title: "Catatan", author: "Anonim", createdAt: "2026-10-02T00:00:00+00:00" }),
  book({
    title: "Dracula",
    author: "Bram Stoker",
    genre: "misteri_thriller",
    genreSource: "user",
    createdAt: "2026-10-04T00:00:00+00:00",
    lastOpenedAt: "2026-10-12T00:00:00+00:00",
  }),
]
const titles = (list: Array<ShelfBook>) => list.map((b) => b.title)

describe("parseShelfSearch", () => {
  it("keeps valid values and drops the rest", () => {
    expect(parseShelfSearch({ genre: "troli", q: "  alice ", sort: "title" })).toEqual({
      genre: "troli",
      q: "alice",
      sort: "title",
    })
    expect(parseShelfSearch({ genre: "misteri_thriller" })).toEqual({ genre: "misteri_thriller" })
    expect(parseShelfSearch({ genre: "horor", q: "   ", sort: "opened" })).toEqual({})
    expect(parseShelfSearch({ sort: "random", q: 5 })).toEqual({})
  })

  it("caps the query length", () => {
    expect(parseShelfSearch({ q: "a".repeat(150) }).q).toHaveLength(100)
  })
})

describe("shelfBooks", () => {
  it("sorts by last opened, then newest added", () => {
    expect(titles(shelfBooks(books, {}))).toEqual(["Dracula", "Alice", "Émile", "Catatan"])
  })

  it("sorts by title and by date added", () => {
    expect(titles(shelfBooks(books, { sort: "title" }))).toEqual([
      "Alice",
      "Catatan",
      "Dracula",
      "Émile",
    ])
    expect(titles(shelfBooks(books, { sort: "added" }))).toEqual([
      "Dracula",
      "Émile",
      "Catatan",
      "Alice",
    ])
  })

  it("filters by genre and by the trolley", () => {
    expect(titles(shelfBooks(books, { genre: "anak_remaja" }))).toEqual(["Alice"])
    expect(titles(shelfBooks(books, { genre: "troli" }))).toEqual(["Catatan"])
  })

  it("searches titles and authors, ignoring case and accents", () => {
    expect(titles(shelfBooks(books, { q: "emile" }))).toEqual(["Émile"])
    expect(titles(shelfBooks(books, { q: "STOKER" }))).toEqual(["Dracula"])
    expect(shelfBooks(books, { q: "tidak ada" })).toEqual([])
  })

  it("does not reorder the input", () => {
    const input = [...books]
    shelfBooks(input, { sort: "title" })
    expect(input).toEqual(books)
  })
})

describe("countBooks", () => {
  it("counts every filter, including empty ones", () => {
    const counts = countBooks(books)
    expect(counts.semua).toBe(4)
    expect(counts.troli).toBe(1)
    expect(counts.misteri_thriller).toBe(1)
    expect(counts.fiksi_sastra).toBe(0)
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/lib/shelf.test.ts`
Expected: FAIL dengan "Failed to resolve import "./shelf"".

- [ ] **Step 3: Implementasi**

`src/lib/shelf.ts`:

```ts
import type { ShelfBook } from "./book-types"
import { GENRE_LABELS, GENRE_VALUES, type Genre, TROLLEY_LABEL, isGenre } from "./genre"

export type ShelfFilter = "semua" | Genre | "troli"
export type ShelfSort = "opened" | "title" | "added"
/** /shelf search params. Defaults ("semua", "opened") stay out of the URL. */
export type ShelfSearch = { genre?: Genre | "troli"; q?: string; sort?: "title" | "added" }

export const MAX_QUERY_LENGTH = 100

export const SHELF_FILTERS: ReadonlyArray<{ value: ShelfFilter; label: string }> = [
  { value: "semua", label: "Semua" },
  ...GENRE_VALUES.map((value) => ({ value, label: GENRE_LABELS[value] })),
  { value: "troli", label: TROLLEY_LABEL },
]

export const SHELF_SORTS: ReadonlyArray<{ value: ShelfSort; label: string }> = [
  { value: "opened", label: "Terakhir dibuka" },
  { value: "title", label: "Judul" },
  { value: "added", label: "Tanggal ditambahkan" },
]

export function parseShelfSearch(search: Record<string, unknown>): ShelfSearch {
  const result: ShelfSearch = {}
  const { genre, q, sort } = search
  if (genre === "troli" || isGenre(genre)) result.genre = genre
  if (typeof q === "string" && q.trim()) result.q = q.trim().slice(0, MAX_QUERY_LENGTH)
  if (sort === "title" || sort === "added") result.sort = sort
  return result
}

const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

const titleOrder = new Intl.Collator("id", { sensitivity: "base", numeric: true })

function matches(book: ShelfBook, filter: ShelfFilter): boolean {
  if (filter === "semua") return true
  if (filter === "troli") return book.genre === null
  return book.genre === filter
}

function comparator(sort: ShelfSort): (a: ShelfBook, b: ShelfBook) => number {
  if (sort === "title") return (a, b) => titleOrder.compare(a.title, b.title)
  if (sort === "added") return (a, b) => b.createdAt.localeCompare(a.createdAt)
  // Last opened first; books never opened follow, newest first.
  return (a, b) =>
    (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? "") ||
    b.createdAt.localeCompare(a.createdAt)
}

export function shelfBooks(books: ReadonlyArray<ShelfBook>, search: ShelfSearch): Array<ShelfBook> {
  const filter = search.genre ?? "semua"
  const query = fold(search.q ?? "")
  return books
    .filter(
      (book) =>
        matches(book, filter) && (!query || fold(`${book.title} ${book.author}`).includes(query))
    )
    .sort(comparator(search.sort ?? "opened"))
}

export function countBooks(books: ReadonlyArray<ShelfBook>): Record<ShelfFilter, number> {
  const counts = Object.fromEntries(SHELF_FILTERS.map(({ value }) => [value, 0])) as Record<
    ShelfFilter,
    number
  >
  for (const book of books) {
    counts.semua += 1
    counts[book.genre ?? "troli"] += 1
  }
  return counts
}
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/lib/shelf.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint && npm run check`

```bash
git add src/lib/shelf.ts src/lib/shelf.test.ts
git commit -m "feat(shelf): add shelf filtering, search, sorting and counts"
```

---

### Task 7: Antrean upload dan pengunggah

**Files:**
- Create: `src/components/shelf/upload-queue.ts`, `src/components/shelf/upload-book.ts`, `src/lib/xhr-upload.ts`
- Test: `src/components/shelf/upload-queue.test.ts`, `src/components/shelf/upload-book.test.ts`

**Interfaces:**
- Consumes: `Genre`, `GenreSource` (Task 1). `bookMessage` (Task 2). `UploadRequest`, `UploadTicket` (Task 2). `ActionResult` (1A). `ParsedEpub` (Task 5).
- Produces:
  - `type UploadStatus = "reading" | "ready" | "uploading" | "done" | "failed"`
  - `type UploadItem = { id; fileName; status; progress: number; title: string | null; author: string | null; suggestedGenre: Genre | null; genre: Genre | null; genreSource: GenreSource | null; code: string | null }`
  - `type UploadAction` (`added`, `read`, `genre_chosen`, `started`, `progressed`, `finished`, `failed`, `retried`, `cleared`)
  - `uploadQueueReducer(items, action)`, `canRetry(item)`, `readyItems(items)`, `uploadStatusText(item)`, `queueSummary(items)`
  - `putFile(url, body: Blob, contentType, onProgress?): Promise<void>`
  - `type UploadDeps = { requestUpload; confirmUpload; put? }`
  - `uploadBook(file, parsed, choice, deps, onProgress): Promise<ActionResult>`

- [ ] **Step 1: Tulis test yang gagal**

`src/components/shelf/upload-queue.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  type UploadAction,
  type UploadItem,
  canRetry,
  queueSummary,
  readyItems,
  uploadQueueReducer,
  uploadStatusText,
} from "./upload-queue"

const run = (actions: Array<UploadAction>) => actions.reduce(uploadQueueReducer, [] as Array<UploadItem>)
const added: UploadAction = {
  type: "added",
  files: [
    { id: "a", fileName: "a.epub" },
    { id: "b", fileName: "b.epub" },
  ],
}

describe("uploadQueueReducer", () => {
  it("adds files as reading, then ready with the guessed genre", () => {
    const items = run([
      added,
      { type: "read", id: "a", title: "Sherlock", author: "Doyle", suggestedGenre: "misteri_thriller" },
    ])
    expect(items[0]).toMatchObject({
      status: "ready",
      title: "Sherlock",
      genre: "misteri_thriller",
      genreSource: "auto",
    })
    expect(items[1]).toMatchObject({ status: "reading", genre: null })
    expect(readyItems(items).map((item) => item.id)).toEqual(["a"])
  })

  it("marks a changed genre as chosen by the member, and back to auto", () => {
    const base: Array<UploadAction> = [
      added,
      { type: "read", id: "a", title: "S", author: "", suggestedGenre: "misteri_thriller" },
    ]
    expect(run([...base, { type: "genre_chosen", id: "a", genre: "fiksi_sastra" }])[0]).toMatchObject({
      genre: "fiksi_sastra",
      genreSource: "user",
    })
    expect(
      run([
        ...base,
        { type: "genre_chosen", id: "a", genre: "fiksi_sastra" },
        { type: "genre_chosen", id: "a", genre: "misteri_thriller" },
      ])[0]
    ).toMatchObject({ genre: "misteri_thriller", genreSource: "auto" })
    expect(run([...base, { type: "genre_chosen", id: "a", genre: null }])[0]).toMatchObject({
      genre: null,
      genreSource: null,
    })
  })

  it("tracks an upload from start to finish", () => {
    const base: Array<UploadAction> = [
      added,
      { type: "read", id: "a", title: "S", author: "", suggestedGenre: null },
      { type: "started", id: "a" },
      { type: "progressed", id: "a", progress: 0.4 },
    ]
    expect(run(base)[0]).toMatchObject({ status: "uploading", progress: 0.4 })
    expect(run([...base, { type: "finished", id: "a" }])[0]).toMatchObject({ status: "done", progress: 1 })
  })

  it("retries only failures that a new attempt can fix", () => {
    const failedUpload = run([
      added,
      { type: "read", id: "a", title: "S", author: "", suggestedGenre: null },
      { type: "failed", id: "a", code: "upload_interrupted" },
    ])
    expect(canRetry(failedUpload[0])).toBe(true)
    expect(uploadQueueReducer(failedUpload, { type: "retried", id: "a" })[0]).toMatchObject({
      status: "ready",
      code: null,
      progress: 0,
    })

    const broken = run([added, { type: "failed", id: "b", code: "epub_invalid" }])
    expect(canRetry(broken[1])).toBe(false)
    const duplicate = run([
      added,
      { type: "read", id: "a", title: "S", author: "", suggestedGenre: null },
      { type: "failed", id: "a", code: "duplicate" },
    ])
    expect(canRetry(duplicate[0])).toBe(false)
  })

  it("clears finished uploads", () => {
    const items = run([
      added,
      { type: "read", id: "a", title: "S", author: "", suggestedGenre: null },
      { type: "started", id: "a" },
      { type: "finished", id: "a" },
      { type: "cleared" },
    ])
    expect(items.map((item) => item.id)).toEqual(["b"])
  })
})

describe("status texts", () => {
  it("describes each row", () => {
    const items = run([
      added,
      { type: "read", id: "a", title: "S", author: "", suggestedGenre: null },
      { type: "failed", id: "b", code: "not_epub" },
    ])
    expect(uploadStatusText(items[0])).toBe("Siap masuk rak")
    expect(uploadStatusText(items[1])).toBe("Hanya file .epub yang bisa dibawa masuk.")
    const uploading = uploadQueueReducer(
      uploadQueueReducer(items, { type: "started", id: "a" }),
      { type: "progressed", id: "a", progress: 0.456 }
    )
    expect(uploadStatusText(uploading[0])).toBe("Mengunggah… 46%")
  })

  it("summarises the queue", () => {
    expect(queueSummary([])).toBe("")
    expect(queueSummary(run([added]))).toBe("Membaca 2 file…")
    const mixed = run([
      added,
      { type: "read", id: "a", title: "S", author: "", suggestedGenre: null },
      { type: "started", id: "a" },
      { type: "finished", id: "a" },
      { type: "failed", id: "b", code: "epub_invalid" },
    ])
    expect(queueSummary(mixed)).toBe("1 buku masuk rak, 1 gagal.")
  })
})
```

`src/components/shelf/upload-book.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import type { ParsedEpub } from "@/lib/epub/read-epub"
import { uploadBook } from "./upload-book"

const parsed: ParsedEpub = {
  metadata: {
    title: "Sherlock",
    author: "Doyle",
    language: "en",
    description: null,
    subjects: ["Detective and mystery stories"],
  },
  cover: { blob: new Blob([new Uint8Array(100)], { type: "image/webp" }), type: "image/webp" },
  sha256: "a".repeat(64),
  suggestedGenre: "misteri_thriller",
}
const file = new File([new Uint8Array(300)], "sherlock.epub")
const choice = { genre: "misteri_thriller" as const, genreSource: "auto" as const }
const ticket = {
  ok: true as const,
  bookId: "b1",
  epubUploadUrl: "https://storage/epub",
  coverUploadUrl: "https://storage/cover",
}

describe("uploadBook", () => {
  it("reserves, uploads the EPUB and cover, then confirms", async () => {
    const requestUpload = vi.fn().mockResolvedValue(ticket)
    const confirmUpload = vi.fn().mockResolvedValue({ ok: true })
    const put = vi.fn(
      (_url: string, _body: Blob, _type: string, onProgress?: (f: number) => void) => {
        onProgress?.(1)
        return Promise.resolve()
      }
    )
    const progress: Array<number> = []

    const result = await uploadBook(file, parsed, choice, { requestUpload, confirmUpload, put }, (p) =>
      progress.push(p)
    )

    expect(result).toEqual({ ok: true })
    expect(requestUpload).toHaveBeenCalledWith({
      data: {
        sha256: "a".repeat(64),
        epubBytes: 300,
        cover: { bytes: 100, type: "image/webp" },
        title: "Sherlock",
        author: "Doyle",
        description: null,
        language: "en",
        subjects: ["Detective and mystery stories"],
        genre: "misteri_thriller",
        genreSource: "auto",
      },
    })
    expect(put.mock.calls.map((call) => [call[0], call[2]])).toEqual([
      ["https://storage/epub", "application/epub+zip"],
      ["https://storage/cover", "image/webp"],
    ])
    expect(confirmUpload).toHaveBeenCalledWith({ data: { bookId: "b1" } })
    expect(progress).toEqual([0.75, 1, 1])
  })

  it("stops when the reservation is refused", async () => {
    const put = vi.fn()
    const result = await uploadBook(
      file,
      parsed,
      choice,
      {
        requestUpload: vi.fn().mockResolvedValue({ ok: false, code: "quota_exceeded" }),
        confirmUpload: vi.fn(),
        put,
      },
      () => undefined
    )
    expect(result).toEqual({ ok: false, code: "quota_exceeded" })
    expect(put).not.toHaveBeenCalled()
  })

  it("reports an interrupted upload without confirming", async () => {
    const confirmUpload = vi.fn()
    const result = await uploadBook(
      file,
      parsed,
      choice,
      {
        requestUpload: vi.fn().mockResolvedValue(ticket),
        confirmUpload,
        put: vi.fn().mockRejectedValue(new Error("network")),
      },
      () => undefined
    )
    expect(result).toEqual({ ok: false, code: "upload_interrupted" })
    expect(confirmUpload).not.toHaveBeenCalled()
  })

  it("passes on a failed confirmation and skips a missing cover", async () => {
    const put = vi.fn().mockResolvedValue(undefined)
    const result = await uploadBook(
      file,
      { ...parsed, cover: null },
      choice,
      {
        requestUpload: vi.fn().mockResolvedValue({ ...ticket, coverUploadUrl: null }),
        confirmUpload: vi.fn().mockResolvedValue({ ok: false, code: "size_mismatch" }),
        put,
      },
      () => undefined
    )
    expect(result).toEqual({ ok: false, code: "size_mismatch" })
    expect(put).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/components/shelf`
Expected: FAIL dengan "Failed to resolve import "./upload-queue"" dan "Failed to resolve import "./upload-book"".

- [ ] **Step 3: Implementasi**

`src/components/shelf/upload-queue.ts`:

```ts
import { bookMessage } from "@/lib/book-messages"
import type { Genre, GenreSource } from "@/lib/genre"

export type UploadStatus = "reading" | "ready" | "uploading" | "done" | "failed"

export type UploadItem = {
  id: string
  fileName: string
  status: UploadStatus
  progress: number
  title: string | null
  author: string | null
  suggestedGenre: Genre | null
  genre: Genre | null
  genreSource: GenreSource | null
  code: string | null
}

export type UploadAction =
  | { type: "added"; files: ReadonlyArray<{ id: string; fileName: string }> }
  | { type: "read"; id: string; title: string; author: string; suggestedGenre: Genre | null }
  | { type: "genre_chosen"; id: string; genre: Genre | null }
  | { type: "started"; id: string }
  | { type: "progressed"; id: string; progress: number }
  | { type: "finished"; id: string }
  | { type: "failed"; id: string; code: string }
  | { type: "retried"; id: string }
  | { type: "cleared" }

/** Failures caused by the file itself; a new attempt with the same file cannot help. */
const FINAL_CODES = new Set(["not_epub", "epub_invalid", "too_large", "duplicate"])

export function canRetry(item: UploadItem): boolean {
  return item.status === "failed" && item.title !== null && !FINAL_CODES.has(item.code ?? "")
}

export function readyItems(items: ReadonlyArray<UploadItem>): Array<UploadItem> {
  return items.filter((item) => item.status === "ready")
}

function update(
  items: Array<UploadItem>,
  id: string,
  change: (item: UploadItem) => UploadItem
): Array<UploadItem> {
  return items.map((item) => (item.id === id ? change(item) : item))
}

export function uploadQueueReducer(items: Array<UploadItem>, action: UploadAction): Array<UploadItem> {
  switch (action.type) {
    case "added":
      return [
        ...items,
        ...action.files.map(
          (file): UploadItem => ({
            id: file.id,
            fileName: file.fileName,
            status: "reading",
            progress: 0,
            title: null,
            author: null,
            suggestedGenre: null,
            genre: null,
            genreSource: null,
            code: null,
          })
        ),
      ]
    case "read":
      return update(items, action.id, (item) =>
        item.status === "reading"
          ? {
              ...item,
              status: "ready",
              title: action.title,
              author: action.author,
              suggestedGenre: action.suggestedGenre,
              genre: action.suggestedGenre,
              genreSource: action.suggestedGenre ? "auto" : null,
            }
          : item
      )
    case "genre_chosen":
      return update(items, action.id, (item) =>
        item.status === "ready" || canRetry(item)
          ? {
              ...item,
              genre: action.genre,
              genreSource:
                action.genre === null ? null : action.genre === item.suggestedGenre ? "auto" : "user",
            }
          : item
      )
    case "started":
      return update(items, action.id, (item) =>
        item.status === "ready" ? { ...item, status: "uploading", progress: 0, code: null } : item
      )
    case "progressed":
      return update(items, action.id, (item) =>
        item.status === "uploading"
          ? { ...item, progress: Math.min(1, Math.max(0, action.progress)) }
          : item
      )
    case "finished":
      return update(items, action.id, (item) =>
        item.status === "uploading" ? { ...item, status: "done", progress: 1 } : item
      )
    case "failed":
      return update(items, action.id, (item) =>
        item.status === "done" ? item : { ...item, status: "failed", code: action.code }
      )
    case "retried":
      return update(items, action.id, (item) =>
        canRetry(item) ? { ...item, status: "ready", progress: 0, code: null } : item
      )
    case "cleared":
      return items.filter((item) => item.status !== "done")
  }
}

export function uploadStatusText(item: UploadItem): string {
  switch (item.status) {
    case "reading":
      return "Membaca file…"
    case "ready":
      return "Siap masuk rak"
    case "uploading":
      return `Mengunggah… ${Math.round(item.progress * 100)}%`
    case "done":
      return "Masuk rak ✓"
    case "failed":
      return bookMessage(item.code)
  }
}

export function queueSummary(items: ReadonlyArray<UploadItem>): string {
  const count = (status: UploadStatus) => items.filter((item) => item.status === status).length
  const reading = count("reading")
  if (reading > 0) return `Membaca ${reading} file…`
  if (count("uploading") > 0) return "Mengunggah buku ke rak…"
  const parts = [
    count("done") > 0 ? `${count("done")} buku masuk rak` : null,
    count("failed") > 0 ? `${count("failed")} gagal` : null,
    count("ready") > 0 ? `${count("ready")} siap` : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? `${parts.join(", ")}.` : ""
}
```

`src/lib/xhr-upload.ts`:

```ts
/** PUTs a file to a signed Storage upload URL, reporting progress (fetch cannot). */
export function putFile(
  url: string,
  body: Blob,
  contentType: string,
  onProgress?: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("PUT", url)
    request.setRequestHeader("content-type", contentType)
    request.setRequestHeader("x-upsert", "false")
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`upload failed: ${request.status}`))
    request.onerror = () => reject(new Error("upload failed: network"))
    request.onabort = () => reject(new Error("upload aborted"))
    request.send(body)
  })
}
```

Jika Step 4 di Task 4 berpindah ke multipart, kirim `FormData` berisi `cacheControl` dan file dengan nama field `""`, dan jangan pasang header `content-type`.

`src/components/shelf/upload-book.ts`:

```ts
import type { ActionResult } from "@/lib/action-result"
import type { UploadRequest, UploadTicket } from "@/lib/book-types"
import type { ParsedEpub } from "@/lib/epub/read-epub"
import type { Genre, GenreSource } from "@/lib/genre"
import { putFile } from "@/lib/xhr-upload"

export type UploadDeps = {
  requestUpload: (input: { data: UploadRequest }) => Promise<UploadTicket>
  confirmUpload: (input: { data: { bookId: string } }) => Promise<ActionResult>
  put?: typeof putFile
}

/** Reserve → upload EPUB and cover straight to Storage → confirm (spec §5). */
export async function uploadBook(
  file: File,
  parsed: ParsedEpub,
  choice: { genre: Genre | null; genreSource: GenreSource | null },
  deps: UploadDeps,
  onProgress: (fraction: number) => void
): Promise<ActionResult> {
  const put = deps.put ?? putFile
  const { metadata, cover } = parsed
  const ticket = await deps.requestUpload({
    data: {
      sha256: parsed.sha256,
      epubBytes: file.size,
      cover: cover ? { bytes: cover.blob.size, type: cover.type } : null,
      title: metadata.title,
      author: metadata.author,
      description: metadata.description,
      language: metadata.language,
      subjects: metadata.subjects,
      genre: choice.genre,
      genreSource: choice.genreSource,
    },
  })
  if (!ticket.ok) return ticket

  const total = file.size + (cover?.blob.size ?? 0)
  try {
    await put(ticket.epubUploadUrl, file, "application/epub+zip", (fraction) =>
      onProgress((fraction * file.size) / total)
    )
    if (cover && ticket.coverUploadUrl) {
      await put(ticket.coverUploadUrl, cover.blob, cover.type, (fraction) =>
        onProgress((file.size + fraction * cover.blob.size) / total)
      )
    }
  } catch {
    return { ok: false, code: "upload_interrupted" }
  }
  onProgress(1)
  return deps.confirmUpload({ data: { bookId: ticket.bookId } })
}
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/components/shelf`
Expected: PASS (11 tests).

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint && npm run check`

```bash
git add src/components/shelf/upload-queue.ts src/components/shelf/upload-queue.test.ts src/components/shelf/upload-book.ts src/components/shelf/upload-book.test.ts src/lib/xhr-upload.ts
git commit -m "feat(shelf): add the upload queue and the reserve-upload-confirm sequence"
```

---

### Task 8: Halaman Rak Saya

**Files:**
- Create (via shadcn): `src/components/ui/dialog.tsx`
- Create: `src/components/shelf/StorageMeter.tsx`, `src/components/shelf/ShelfHeader.tsx`, `src/components/shelf/GenreFilter.tsx`, `src/components/shelf/ShelfToolbar.tsx`, `src/components/shelf/BookCover.tsx`, `src/components/shelf/BookGrid.tsx`, `src/components/shelf/EmptyShelf.tsx`, `src/components/shelf/BookDetail.tsx`, `src/routes/_member/shelf.tsx`
- Modify: `src/routes/_member/lobby.tsx`, `src/styles.css`
- Create (data uji bersama): `src/components/shelf/fixtures.ts`
- Test: `src/components/shelf/BookCover.test.tsx`, `src/components/shelf/BookDetail.test.tsx`

**Interfaces:**
- Consumes:
  - `listBooksFn` (Task 4).
  - `parseShelfSearch`, `shelfBooks`, `countBooks`, `SHELF_FILTERS`, `SHELF_SORTS`, `ShelfFilter`, `ShelfSort` (Task 6).
  - `ShelfBook`, `StorageUsage` (Task 2).
  - `formatBytes`, `formatUsage`, `planLabel` (`src/lib/member.ts`).
  - `genreLabel` (Task 1).
  - `formatLongDate` (`src/lib/dates.ts`).
  - Dari 1A: `Panel`, `Button`, `buttonVariants`, `Input`, `LibrarianBubble`.
- Produces:
  - Route `/shelf` dengan search `{ genre?, q?, sort? }`.
  - Komponen:
    - `<StorageMeter usage />`
    - `<ShelfHeader usage actions? />`
    - `<GenreFilter active counts />`
    - `<ShelfToolbar q sort />`
    - `<BookCover book className? />`
    - `<BookGrid books onOpen footer? />`
    - `<EmptyShelf action? />`
    - `<BookDetail book onClose children? />`
  - Fungsi `coverHue(title: string): number`.

Di task ini Rak Saya masih **hanya untuk dilihat**. Tombol "Bawa buku" ditambahkan di Task 9, sedangkan ubah genre, Troli, dan hapus buku ditambahkan di Task 10. Jangan menambahkan tombol yang belum berfungsi.

- [ ] **Step 1: Tambah komponen dialog shadcn**

Run: `npx shadcn@latest add dialog`
Expected: `src/components/ui/dialog.tsx` dibuat. Baca file itu dan pastikan ia mengekspor `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, dan `DialogDescription`. Jika ada teks bawaan berbahasa Inggris (misalnya label tombol tutup `Close` untuk screen reader), ganti menjadi `Tutup`. Jangan menimpa komponen yang sudah ada seperti `button.tsx`.

- [ ] **Step 2: Tulis test yang gagal**

`src/components/shelf/BookCover.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BookCover, coverHue } from "./BookCover"

describe("BookCover", () => {
  it("shows the cover image when there is one", () => {
    const { container } = render(
      <BookCover book={{ title: "Sherlock", coverUrl: "https://storage/cover.webp" }} />
    )
    expect(container.querySelector("img")).toHaveAttribute("src", "https://storage/cover.webp")
  })

  it("draws a titled spine when there is no cover", () => {
    render(<BookCover book={{ title: "Catatan Tanpa Sampul", coverUrl: null }} />)
    expect(screen.getByText("Catatan Tanpa Sampul")).toBeInTheDocument()
  })

  it("gives each title a stable hue", () => {
    expect(coverHue("Sherlock")).toBe(coverHue("Sherlock"))
    expect(coverHue("Sherlock")).toBeGreaterThanOrEqual(0)
    expect(coverHue("Sherlock")).toBeLessThan(360)
  })
})
```

`src/components/shelf/fixtures.ts` (data uji bersama; jangan meng-export data dari file test, karena meng-import file test ikut mendaftarkan test-nya):

```ts
import type { ShelfBook } from "@/lib/book-types"

export const sherlock: ShelfBook = {
  id: "0f9f5c1e-8a4b-4c2e-9d3a-1b2c3d4e5f60",
  title: "The Adventures of Sherlock Holmes",
  author: "Arthur Conan Doyle",
  description: "Twelve cases.",
  language: "en-GB",
  genre: "misteri_thriller",
  genreSource: "auto",
  sizeBytes: 742083,
  createdAt: "2026-10-15T03:00:00+00:00",
  lastOpenedAt: null,
  coverUrl: null,
}
```

`src/components/shelf/BookDetail.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BookDetail } from "./BookDetail"
import { sherlock } from "./fixtures"

describe("BookDetail", () => {
  it("shows the book's details in a dialog named after it", async () => {
    render(<BookDetail book={sherlock} onClose={() => undefined} />)
    const dialog = await screen.findByRole("dialog", { name: sherlock.title })
    expect(dialog).toHaveTextContent("Arthur Conan Doyle")
    expect(dialog).toHaveTextContent("Twelve cases.")
    expect(dialog).toHaveTextContent("Misteri & Thriller")
    expect(dialog).toHaveTextContent("0.7 MB")
    expect(dialog).toHaveTextContent("Kamis, 15 Oktober 2026")
  })

  it("renders nothing without a book", () => {
    render(<BookDetail book={null} onClose={() => undefined} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/components/shelf/BookCover.test.tsx src/components/shelf/BookDetail.test.tsx`
Expected: FAIL dengan "Failed to resolve import "./BookCover"" dan "Failed to resolve import "./BookDetail"".

- [ ] **Step 4: Implementasi komponen**

`src/components/shelf/BookCover.tsx`:

```tsx
import type { CSSProperties } from "react"
import type { ShelfBook } from "@/lib/book-types"
import { cn } from "@/lib/utils"

export function coverHue(title: string): number {
  let hue = 0
  for (const char of title) hue = (hue * 31 + (char.codePointAt(0) ?? 0)) % 360
  return hue
}

export function BookCover({
  book,
  className,
}: {
  book: Pick<ShelfBook, "title" | "coverUrl">
  className?: string
}) {
  if (book.coverUrl) {
    return (
      <img
        src={book.coverUrl}
        alt=""
        loading="lazy"
        draggable={false}
        className={cn("book-cover", className)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn("book-cover book-cover-blank", className)}
      style={{ "--cover-hue": coverHue(book.title) } as CSSProperties}
    >
      <span className="font-heading">{book.title}</span>
    </span>
  )
}
```

`src/components/shelf/StorageMeter.tsx`:

```tsx
import { useId } from "react"
import type { StorageUsage } from "@/lib/book-types"
import { formatUsage, planLabel } from "@/lib/member"

export function StorageMeter({ usage }: { usage: StorageUsage }) {
  const id = useId()
  return (
    <div className="w-full min-w-44 text-xs sm:w-auto">
      <div className="mb-1 flex justify-between gap-3">
        <label htmlFor={id}>Penyimpanan</label>
        <span className="font-bold tracking-wide text-mint">{planLabel(usage.plan)}</span>
      </div>
      <meter
        id={id}
        min={0}
        max={usage.limitBytes}
        value={usage.usedBytes}
        high={usage.limitBytes * 0.9}
        optimum={0}
        className="storage-meter"
      />
      <p className="mt-1 text-muted-foreground">
        {formatUsage(usage.usedBytes, usage.limitBytes)}
      </p>
    </div>
  )
}
```

`src/components/shelf/ShelfHeader.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import type { StorageUsage } from "@/lib/book-types"
import { StorageMeter } from "./StorageMeter"

export function ShelfHeader({ usage, actions }: { usage: StorageUsage; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Link to="/lobby" className="text-sm text-mint underline">
          ← Lobi
        </Link>
        <h1 className="font-heading text-3xl font-bold">Rak Saya</h1>
      </div>
      <div className="flex w-full flex-wrap items-end gap-4 sm:w-auto">
        <StorageMeter usage={usage} />
        {actions}
      </div>
    </header>
  )
}
```

`src/components/shelf/GenreFilter.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { SHELF_FILTERS, type ShelfFilter } from "@/lib/shelf"
import { cn } from "@/lib/utils"

export function GenreFilter({
  active,
  counts,
}: {
  active: ShelfFilter
  counts: Record<ShelfFilter, number>
}) {
  return (
    <nav aria-label="Filter genre" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2 pb-1">
        {SHELF_FILTERS.map(({ value, label }) => (
          <li key={value} className="shrink-0">
            <Link
              to="/shelf"
              search={(prev) => ({ ...prev, genre: value === "semua" ? undefined : value })}
              aria-current={active === value ? "page" : undefined}
              className={cn("genre-chip", counts[value] === 0 && active !== value && "opacity-60")}
            >
              {label} <span className="tabular-nums">· {counts[value]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

`src/components/shelf/ShelfToolbar.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useId, useState } from "react"
import { Input } from "@/components/ui/input"
import { SHELF_SORTS, type ShelfSort } from "@/lib/shelf"

export function ShelfToolbar({ q, sort }: { q: string; sort: ShelfSort }) {
  const navigate = useNavigate({ from: "/shelf" })
  const [text, setText] = useState(q)
  const searchId = useId()
  const sortId = useId()

  // Debounce typing into the URL (?q=) so results follow without a jump per keystroke.
  useEffect(() => {
    const query = text.trim()
    if (query === q) return
    const timer = setTimeout(() => {
      void navigate({ search: (prev) => ({ ...prev, q: query || undefined }), replace: true })
    }, 250)
    return () => clearTimeout(timer)
  }, [text, q, navigate])

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <label htmlFor={searchId} className="mb-1 block text-xs text-muted-foreground">
          Cari judul atau penulis
        </label>
        <Input
          id={searchId}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoComplete="off"
          maxLength={100}
        />
      </div>
      <div>
        <label htmlFor={sortId} className="mb-1 block text-xs text-muted-foreground">
          Urutkan
        </label>
        <select
          id={sortId}
          value={sort}
          onChange={(event) => {
            const value = event.target.value
            void navigate({
              search: (prev) => ({
                ...prev,
                sort: value === "title" || value === "added" ? value : undefined,
              }),
              replace: true,
            })
          }}
          className="native-select"
        >
          {SHELF_SORTS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
```

`src/components/shelf/BookGrid.tsx`:

```tsx
import type { ReactNode } from "react"
import type { ShelfBook } from "@/lib/book-types"
import { BookCover } from "./BookCover"

export function BookGrid({
  books,
  onOpen,
  footer,
}: {
  books: ReadonlyArray<ShelfBook>
  onOpen: (book: ShelfBook) => void
  footer?: (book: ShelfBook) => ReactNode
}) {
  return (
    <ul className="shelf-grid">
      {books.map((book) => (
        <li key={book.id} className="shelf-slot">
          <button
            type="button"
            onClick={() => onOpen(book)}
            className="block w-full rounded-sm text-left outline-offset-4 focus-visible:outline-2 focus-visible:outline-mint"
          >
            <BookCover book={book} />
            <span className="mt-2 line-clamp-2 text-xs font-bold">{book.title}</span>
            {book.author && (
              <span className="line-clamp-1 text-[0.7rem] text-muted-foreground">
                {book.author}
              </span>
            )}
          </button>
          {footer?.(book)}
        </li>
      ))}
    </ul>
  )
}
```

`src/components/shelf/EmptyShelf.tsx`:

```tsx
import type { ReactNode } from "react"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import { Panel } from "@/components/ui/panel"

export function EmptyShelf({ action }: { action?: ReactNode }) {
  return (
    <Panel className="flex flex-col gap-4 p-6">
      <LibrarianBubble>Rakmu masih kosong. Bawa buku pertamamu ke sini!</LibrarianBubble>
      {action}
      <p className="text-sm text-muted-foreground">
        Belum punya EPUB? Ambil yang legal dan gratis di{" "}
        <a
          href="https://standardebooks.org"
          target="_blank"
          rel="noreferrer"
          className="text-mint underline"
        >
          Standard Ebooks
        </a>{" "}
        atau{" "}
        <a
          href="https://www.gutenberg.org"
          target="_blank"
          rel="noreferrer"
          className="text-mint underline"
        >
          Project Gutenberg
        </a>
        .
      </p>
    </Panel>
  )
}
```

`src/components/shelf/BookDetail.tsx`:

```tsx
import type { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ShelfBook } from "@/lib/book-types"
import { formatLongDate } from "@/lib/dates"
import { genreLabel } from "@/lib/genre"
import { formatBytes } from "@/lib/member"
import { BookCover } from "./BookCover"

export function BookDetail({
  book,
  onClose,
  children,
}: {
  book: ShelfBook | null
  onClose: () => void
  children?: ReactNode
}) {
  return (
    <Dialog
      open={book !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {book && (
        <DialogContent className="max-w-lg">
          <div className="flex gap-4">
            <BookCover book={book} className="w-24 shrink-0" />
            <DialogHeader className="text-left">
              <DialogTitle className="font-heading text-xl">{book.title}</DialogTitle>
              {book.author && <DialogDescription>{book.author}</DialogDescription>}
            </DialogHeader>
          </div>
          {book.description && (
            <p className="max-h-48 overflow-y-auto text-sm leading-relaxed text-muted-foreground">
              {book.description}
            </p>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Genre</dt>
            <dd>{genreLabel(book.genre)}</dd>
            {book.language && (
              <>
                <dt className="text-muted-foreground">Bahasa</dt>
                <dd>{book.language}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Ukuran</dt>
            <dd>{formatBytes(book.sizeBytes)}</dd>
            <dt className="text-muted-foreground">Ditambahkan</dt>
            <dd>{formatLongDate(new Date(book.createdAt))}</dd>
          </dl>
          {children}
        </DialogContent>
      )}
    </Dialog>
  )
}
```

`src/routes/_member/shelf.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { BookDetail } from "@/components/shelf/BookDetail"
import { BookGrid } from "@/components/shelf/BookGrid"
import { EmptyShelf } from "@/components/shelf/EmptyShelf"
import { GenreFilter } from "@/components/shelf/GenreFilter"
import { ShelfHeader } from "@/components/shelf/ShelfHeader"
import { ShelfToolbar } from "@/components/shelf/ShelfToolbar"
import { countBooks, parseShelfSearch, shelfBooks } from "@/lib/shelf"
import { listBooksFn } from "@/server/books"

export const Route = createFileRoute("/_member/shelf")({
  validateSearch: parseShelfSearch,
  loader: () => listBooksFn(),
  // Filtering happens in the browser; reload only on invalidate or after a minute.
  staleTime: 60_000,
  head: () => ({ meta: [{ title: "Rak Saya — Glosa" }] }),
  component: ShelfPage,
})

function ShelfPage() {
  const { books, usage } = Route.useLoaderData()
  const search = Route.useSearch()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const visible = useMemo(() => shelfBooks(books, search), [books, search])
  const counts = useMemo(() => countBooks(books), [books])
  const selected = books.find((book) => book.id === selectedId) ?? null

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-5 p-4 sm:p-8">
      <ShelfHeader usage={usage} />
      {books.length === 0 ? (
        <EmptyShelf />
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
            <BookGrid books={visible} onOpen={(book) => setSelectedId(book.id)} />
          )}
        </>
      )}
      <BookDetail book={selected} onClose={() => setSelectedId(null)} />
    </main>
  )
}
```

- [ ] **Step 5: Tautan dari lobi dan gaya rak**

Di `src/routes/_member/lobby.tsx`, tambahkan tautan berikut sebagai item **pertama** di dalam `<div className="flex w-full flex-col gap-2.5 sm:max-w-48">`, sebelum tautan Pengaturan:

```tsx
          <Link to="/shelf" className={buttonVariants({ size: "block" })}>
            Rak Saya
          </Link>
```

Tambahkan blok berikut di akhir `src/styles.css`:

```css
/* Rak Saya: covers stand on wooden shelf boards (spec §8). */
.shelf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  row-gap: 2rem;
}
.shelf-slot {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.4rem;
  padding: 0 0.6rem 0.8rem;
  border-bottom: 0.7rem solid #5b3a1f;
  box-shadow: 0 10px 12px -8px rgb(0 0 0 / 0.7);
}
.book-cover {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: 2px 4px 4px 2px;
  box-shadow:
    2px 3px 8px rgb(0 0 0 / 0.45),
    inset 3px 0 0 rgb(255 255 255 / 0.08);
}
.book-cover-blank {
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  padding: 0.6rem;
  font-size: 0.8rem;
  line-height: 1.2;
  color: #f4ecd8;
  background: linear-gradient(
    160deg,
    hsl(var(--cover-hue) 35% 32%),
    hsl(var(--cover-hue) 40% 18%)
  );
}
.genre-chip {
  display: inline-block;
  border: 1px solid var(--border);
  border-radius: 9999px;
  padding: 0.3rem 0.8rem;
  font-size: 0.8rem;
  white-space: nowrap;
}
.genre-chip[aria-current="page"] {
  border-color: var(--color-mint);
  background: rgb(47 224 184 / 0.12);
  color: var(--color-mint);
}
.native-select {
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--background);
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
}
.storage-meter {
  display: block;
  width: 100%;
  height: 0.5rem;
}
```

- [ ] **Step 6: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/components/shelf`
Expected: PASS. Ini mencakup 5 test baru ditambah test dari Task 7.

- [ ] **Step 7: Verifikasi visual**

Jalankan `npm run dev`, lalu buka `/lobby` sebagai anggota yang sudah onboarding dan klik "Rak Saya". Untuk anggota uji, ikuti pola skrip Playwright di 1A: buat user terkonfirmasi lewat admin API, isi `onboarded_at`, lalu hapus user-nya di `finally`.

Expected:
- **Rak kosong:** balon "Rakmu masih kosong. Bawa buku pertamamu ke sini!" muncul beserta tautan Standard Ebooks dan Project Gutenberg.
- **Bar storage:** tertulis "0 MB / 100 MB" dengan label "GRATIS".
- **Rak berisi buku:** isi rak lewat SQL atau admin di skrip yang sama, dengan `reserve_book_upload` lalu `status = 'ready'` tanpa cover. Kartu buku tampil dengan sampul polos berwarna, filter genre menampilkan jumlah, dan klik buku membuka dialog detail.
- Simpan screenshot desktop (1440×900) dan HP (390×844) di folder scratchpad.

- [ ] **Step 8: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint && npm run check`

```bash
git add src/components/ui/dialog.tsx src/components/shelf src/routes/_member/shelf.tsx src/routes/_member/lobby.tsx src/routeTree.gen.ts src/styles.css package.json package-lock.json
git commit -m "feat(shelf): add the Rak Saya page with genre filter, search, sorting and book details"
```

`package.json` dan `package-lock.json` hanya di-stage jika `shadcn add dialog` mengubahnya.

---

### Task 9: Panel upload

**Files:**
- Create: `src/lib/use-online.ts`, `src/components/shelf/useUploadQueue.ts`, `src/components/shelf/UploadPanel.tsx`
- Modify: `src/routes/_member/shelf.tsx`
- Test: `src/components/shelf/UploadPanel.test.tsx`

**Interfaces:**
- Consumes:
  - `readEpub`, `EpubError`, `ParsedEpub` (Task 5).
  - `requestUploadFn`, `confirmUploadFn` (Task 4).
  - `uploadQueueReducer`, `readyItems`, `canRetry`, `uploadStatusText`, `queueSummary`, `UploadItem` (Task 7).
  - `uploadBook` (Task 7).
  - `GENRE_VALUES`, `GENRE_LABELS`, `isGenre` (Task 1).
  - `StorageMeter` (Task 8), `Dialog*` (Task 8).
- Produces:
  - `useOnline(): boolean`
  - `useUploadQueue()` → `{ items, running, addFiles(files), chooseGenre(id, genre), retry(item), uploadAll(items), clearDone() }`
  - `<UploadPanel open onOpenChange usage />`
  - Tombol "Bawa buku" di header dan di rak kosong.

- [ ] **Step 1: Tulis test yang gagal**

`src/components/shelf/UploadPanel.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { UploadPanel } from "./UploadPanel"

const { readEpub, uploadBook, invalidate } = vi.hoisted(() => ({
  readEpub: vi.fn(),
  uploadBook: vi.fn(),
  invalidate: vi.fn(),
}))

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ invalidate }) }))
vi.mock("@/server/books", () => ({ requestUploadFn: vi.fn(), confirmUploadFn: vi.fn() }))
vi.mock("@/lib/epub/read-epub", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/epub/read-epub")>()),
  readEpub,
}))
vi.mock("./upload-book", () => ({ uploadBook }))

const usage = { usedBytes: 0, limitBytes: 104857600, plan: "free" as const }

describe("UploadPanel", () => {
  it("guesses the genre, lets the member change it, and uploads with that choice", async () => {
    readEpub.mockResolvedValueOnce({
      metadata: {
        title: "The Adventures of Sherlock Holmes",
        author: "Arthur Conan Doyle",
        language: "en",
        description: null,
        subjects: [],
      },
      cover: null,
      sha256: "a".repeat(64),
      suggestedGenre: "misteri_thriller",
    })
    uploadBook.mockImplementationOnce(
      (_file: File, _parsed: unknown, _choice: unknown, _deps: unknown, onProgress: (p: number) => void) => {
        onProgress(1)
        return Promise.resolve({ ok: true })
      }
    )

    render(<UploadPanel open onOpenChange={() => undefined} usage={usage} />)
    const dialog = await screen.findByRole("dialog", { name: "Bawa buku ke rak" })
    const input = dialog.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error("file input missing")
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(10)], "sherlock.epub")] },
    })

    expect(await screen.findByText("The Adventures of Sherlock Holmes")).toBeInTheDocument()
    const genre = screen.getByLabelText("Genre")
    expect(genre).toHaveValue("misteri_thriller")
    fireEvent.change(genre, { target: { value: "fiksi_sastra" } })
    fireEvent.click(screen.getByRole("button", { name: "Terima semua" }))

    expect(await screen.findByText("Masuk rak ✓")).toBeInTheDocument()
    expect(uploadBook.mock.calls[0][2]).toEqual({ genre: "fiksi_sastra", genreSource: "user" })
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
    expect(screen.getByText("1 buku masuk rak.")).toBeInTheDocument()
  })

  it("explains files that cannot come in", async () => {
    render(<UploadPanel open onOpenChange={() => undefined} usage={usage} />)
    const dialog = await screen.findByRole("dialog", { name: "Bawa buku ke rak" })
    const input = dialog.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error("file input missing")
    const { EpubError } = await import("@/lib/epub/read-epub")
    readEpub.mockRejectedValueOnce(new EpubError("not_epub"))
    fireEvent.change(input, { target: { files: [new File(["x"], "catatan.txt")] } })

    expect(await screen.findByText("Hanya file .epub yang bisa dibawa masuk.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Terima semua" })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/components/shelf/UploadPanel.test.tsx`
Expected: FAIL dengan "Failed to resolve import "./UploadPanel"".

- [ ] **Step 3: Implementasi**

`src/lib/use-online.ts`:

```ts
import { useSyncExternalStore } from "react"

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

/** Uploads need a connection (spec §11); the server render assumes online. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  )
}
```

`src/components/shelf/useUploadQueue.ts`:

```ts
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useCallback, useReducer, useRef, useState } from "react"
import type { ActionResult } from "@/lib/action-result"
import { EpubError, type ParsedEpub, readEpub } from "@/lib/epub/read-epub"
import type { Genre } from "@/lib/genre"
import { confirmUploadFn, requestUploadFn } from "@/server/books"
import { uploadBook } from "./upload-book"
import { type UploadItem, uploadQueueReducer } from "./upload-queue"

type Entry = { file: File; parsed: ParsedEpub | null }

export function useUploadQueue() {
  const [items, dispatch] = useReducer(uploadQueueReducer, [])
  const [running, setRunning] = useState(false)
  // Files and parse results are not serialisable, so they live beside the reducer.
  const entries = useRef(new Map<string, Entry>())
  const requestUpload = useServerFn(requestUploadFn)
  const confirmUpload = useServerFn(confirmUploadFn)
  const router = useRouter()

  const addFiles = useCallback((files: Iterable<File>) => {
    const added = Array.from(files, (file) => ({ id: crypto.randomUUID(), file }))
    for (const { id, file } of added) entries.current.set(id, { file, parsed: null })
    dispatch({ type: "added", files: added.map(({ id, file }) => ({ id, fileName: file.name })) })
    for (const { id, file } of added) {
      readEpub(file)
        .then((parsed) => {
          const entry = entries.current.get(id)
          if (entry) entry.parsed = parsed
          dispatch({
            type: "read",
            id,
            title: parsed.metadata.title,
            author: parsed.metadata.author,
            suggestedGenre: parsed.suggestedGenre,
          })
        })
        .catch((error: unknown) =>
          dispatch({
            type: "failed",
            id,
            // Not every failure means a broken file (e.g. the file vanished after selection).
            code: error instanceof EpubError ? error.code : "unknown",
          })
        )
    }
  }, [])

  const uploadAll = useCallback(
    async (targets: ReadonlyArray<UploadItem>) => {
      if (targets.length === 0) return
      setRunning(true)
      try {
        for (const item of targets) {
          const entry = entries.current.get(item.id)
          if (!entry?.parsed) continue
          dispatch({ type: "started", id: item.id })
          let result: ActionResult
          try {
            result = await uploadBook(
              entry.file,
              entry.parsed,
              { genre: item.genre, genreSource: item.genreSource },
              { requestUpload, confirmUpload },
              (progress) => dispatch({ type: "progressed", id: item.id, progress })
            )
          } catch {
            result = { ok: false, code: "unknown" }
          }
          dispatch(
            result.ok
              ? { type: "finished", id: item.id }
              : { type: "failed", id: item.id, code: result.code }
          )
        }
      } finally {
        setRunning(false)
        await router.invalidate()
      }
    },
    [requestUpload, confirmUpload, router]
  )

  const retry = useCallback(
    (item: UploadItem) => {
      dispatch({ type: "retried", id: item.id })
      void uploadAll([{ ...item, status: "ready", code: null, progress: 0 }])
    },
    [uploadAll]
  )

  const chooseGenre = useCallback((id: string, genre: Genre | null) => {
    dispatch({ type: "genre_chosen", id, genre })
  }, [])

  const clearDone = useCallback(() => {
    dispatch({ type: "cleared" })
  }, [])

  return { items, running, addFiles, chooseGenre, retry, uploadAll, clearDone }
}
```

`src/components/shelf/UploadPanel.tsx`:

```tsx
import { type DragEvent, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { StorageUsage } from "@/lib/book-types"
import { GENRE_LABELS, GENRE_VALUES, type Genre, isGenre } from "@/lib/genre"
import { useOnline } from "@/lib/use-online"
import { cn } from "@/lib/utils"
import { StorageMeter } from "./StorageMeter"
import {
  type UploadItem,
  canRetry,
  queueSummary,
  readyItems,
  uploadStatusText,
} from "./upload-queue"
import { useUploadQueue } from "./useUploadQueue"

export function UploadPanel({
  open,
  onOpenChange,
  usage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  usage: StorageUsage
}) {
  const queue = useUploadQueue()
  const online = useOnline()
  const [dragging, setDragging] = useState(false)
  const ready = readyItems(queue.items)

  function close(next: boolean) {
    if (next || queue.running) return
    queue.clearDone()
    onOpenChange(false)
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    if (online) queue.addFiles(event.dataTransfer.files)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Bawa buku ke rak</DialogTitle>
          <DialogDescription>
            EPUB maksimal 50 MB per file. Genrenya sudah kami tebak; ganti kalau kurang pas.
          </DialogDescription>
        </DialogHeader>

        <StorageMeter usage={usage} />

        <label
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-6 text-center text-sm",
            dragging && "border-mint bg-mint/10",
            !online && "cursor-not-allowed opacity-60"
          )}
        >
          <input
            type="file"
            accept=".epub,application/epub+zip"
            multiple
            disabled={!online}
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) queue.addFiles(event.target.files)
              event.target.value = ""
            }}
          />
          <span className="font-bold">Pilih file EPUB</span>
          <span className="text-muted-foreground">atau tarik ke sini</span>
        </label>
        {!online && <p className="text-sm text-stamp">Butuh internet.</p>}

        {queue.items.length > 0 && (
          <ul className="max-h-72 divide-y overflow-y-auto">
            {queue.items.map((item) => (
              <UploadRow
                key={item.id}
                item={item}
                disabled={queue.running}
                onGenre={queue.chooseGenre}
                onRetry={queue.retry}
              />
            ))}
          </ul>
        )}

        <output className="block min-h-5 text-sm">{queueSummary(queue.items)}</output>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => close(false)} disabled={queue.running}>
            Tutup
          </Button>
          <Button
            onClick={() => void queue.uploadAll(ready)}
            disabled={ready.length === 0 || queue.running || !online}
          >
            Terima semua
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function UploadRow({
  item,
  disabled,
  onGenre,
  onRetry,
}: {
  item: UploadItem
  disabled: boolean
  onGenre: (id: string, genre: Genre | null) => void
  onRetry: (item: UploadItem) => void
}) {
  const selectId = useId()
  const editable = item.status === "ready" || canRetry(item)
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{item.title ?? item.fileName}</p>
        {item.author && <p className="truncate text-xs text-muted-foreground">{item.author}</p>}
        <p
          className={cn(
            "text-xs",
            item.status === "failed" ? "text-stamp" : "text-muted-foreground"
          )}
        >
          {uploadStatusText(item)}
        </p>
        {item.status === "uploading" && (
          <progress
            max={1}
            value={item.progress}
            aria-label={`Mengunggah ${item.title ?? item.fileName}`}
            className="mt-1 block h-1.5 w-full"
          />
        )}
      </div>
      {editable && (
        <div className="flex flex-col gap-1">
          <label htmlFor={selectId} className="text-xs text-muted-foreground">
            Genre
          </label>
          <select
            id={selectId}
            value={item.genre ?? ""}
            disabled={disabled}
            onChange={(event) =>
              onGenre(item.id, isGenre(event.target.value) ? event.target.value : null)
            }
            className="native-select"
          >
            <option value="">Pilih genre</option>
            {GENRE_VALUES.map((value) => (
              <option key={value} value={value}>
                {GENRE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      )}
      {canRetry(item) && (
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onRetry(item)}>
          Coba lagi
        </Button>
      )}
    </li>
  )
}
```

Di `src/routes/_member/shelf.tsx`, ganti seluruh isinya dengan kode berikut. Yang ditambahkan adalah tombol "Bawa buku" dan panel upload:

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { BookDetail } from "@/components/shelf/BookDetail"
import { BookGrid } from "@/components/shelf/BookGrid"
import { EmptyShelf } from "@/components/shelf/EmptyShelf"
import { GenreFilter } from "@/components/shelf/GenreFilter"
import { ShelfHeader } from "@/components/shelf/ShelfHeader"
import { ShelfToolbar } from "@/components/shelf/ShelfToolbar"
import { UploadPanel } from "@/components/shelf/UploadPanel"
import { Button } from "@/components/ui/button"
import { countBooks, parseShelfSearch, shelfBooks } from "@/lib/shelf"
import { listBooksFn } from "@/server/books"

export const Route = createFileRoute("/_member/shelf")({
  validateSearch: parseShelfSearch,
  loader: () => listBooksFn(),
  // Filtering happens in the browser; reload only on invalidate or after a minute.
  staleTime: 60_000,
  head: () => ({ meta: [{ title: "Rak Saya — Glosa" }] }),
  component: ShelfPage,
})

function ShelfPage() {
  const { books, usage } = Route.useLoaderData()
  const search = Route.useSearch()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const visible = useMemo(() => shelfBooks(books, search), [books, search])
  const counts = useMemo(() => countBooks(books), [books])
  const selected = books.find((book) => book.id === selectedId) ?? null
  const bringButton = <Button onClick={() => setUploading(true)}>Bawa buku</Button>

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-5 p-4 sm:p-8">
      <ShelfHeader usage={usage} actions={books.length > 0 ? bringButton : undefined} />
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
            <BookGrid books={visible} onOpen={(book) => setSelectedId(book.id)} />
          )}
        </>
      )}
      <BookDetail book={selected} onClose={() => setSelectedId(null)} />
      <UploadPanel open={uploading} onOpenChange={setUploading} usage={usage} />
    </main>
  )
}
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/components/shelf`
Expected: PASS. Ini mencakup 2 test baru `UploadPanel.test.tsx`.

- [ ] **Step 5: Verifikasi di browser sungguhan**

Jalankan `npm run dev` dan siapkan anggota uji (lihat Task 8 Step 7). Unggah `e2e/fixtures/the-adventures-of-sherlock-holmes.epub` lewat panel. File ini diunduh di Task 11 Step 1; untuk sekarang, unduh sementara ke scratchpad dengan perintah yang sama.

Expected:
- Baris menampilkan judul "The Adventures of Sherlock Holmes" dengan Genre "Misteri & Thriller".
- Setelah "Terima semua", progres berjalan sampai "Masuk rak ✓".
- Setelah panel ditutup, buku muncul dengan cover asli dan bar storage berubah menjadi "0.7 MB / 100 MB".

Hapus anggota uji dan objek Storage-nya setelah selesai.

- [ ] **Step 6: Typecheck, test, lint, build, commit**

Run: `npm run typecheck && npm test && npm run lint && npm run check && npm run build`

```bash
git add src/lib/use-online.ts src/components/shelf/useUploadQueue.ts src/components/shelf/UploadPanel.tsx src/components/shelf/UploadPanel.test.tsx src/routes/_member/shelf.tsx
git commit -m "feat(shelf): add the upload panel with per-file genre, progress and messages"
```

---

### Task 10: Ubah genre, Troli Buku Baru, dan hapus buku

**Files:**
- Create: `src/components/shelf/useSaveGenre.ts`, `src/components/shelf/TrolleyGenrePicker.tsx`, `src/components/shelf/BookActions.tsx`
- Modify: `src/components/shelf/BookDetail.tsx`, `src/routes/_member/shelf.tsx`
- Test: `src/components/shelf/BookActions.test.tsx`, `src/components/shelf/TrolleyGenrePicker.test.tsx`

**Interfaces:**
- Consumes: `updateBookGenreFn`, `deleteBookFn` (Task 4). `bookMessage` (Task 2). `GENRE_VALUES`, `GENRE_LABELS`, `genreLabel`, `isGenre`, `Genre` (Task 1). `BookDetail`, `BookGrid` (Task 8).
- Produces:
  - `useSaveGenre()` → `{ save(bookId, genre): Promise<ActionResult>; saving: boolean }`
  - `<BookActions book onGenreSaved(genre) onDeleted(book) />`, berisi pemilih genre dan hapus buku dengan konfirmasi.
  - `<TrolleyGenrePicker book onSaved(genre) />`
  - `BookDetail` kini **tidak** menampilkan baris Genre di `<dl>`, karena genre dipilih lewat `BookActions`.

- [ ] **Step 1: Tulis test yang gagal**

`src/components/shelf/BookActions.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BookActions } from "./BookActions"
import { sherlock } from "./fixtures"

const { updateBookGenreFn, deleteBookFn } = vi.hoisted(() => ({
  updateBookGenreFn: vi.fn(),
  deleteBookFn: vi.fn(),
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/books", () => ({ updateBookGenreFn, deleteBookFn }))

describe("BookActions", () => {
  it("moves the book to another genre", async () => {
    updateBookGenreFn.mockResolvedValueOnce({ ok: true })
    const onGenreSaved = vi.fn()
    render(<BookActions book={sherlock} onGenreSaved={onGenreSaved} onDeleted={vi.fn()} />)

    fireEvent.change(screen.getByLabelText("Genre"), { target: { value: "fiksi_sastra" } })

    expect(await screen.findByText("Genre disimpan.")).toBeInTheDocument()
    expect(updateBookGenreFn).toHaveBeenCalledWith({
      data: { bookId: sherlock.id, genre: "fiksi_sastra" },
    })
    expect(onGenreSaved).toHaveBeenCalledWith("fiksi_sastra")
  })

  it("deletes only after confirmation", async () => {
    deleteBookFn.mockResolvedValueOnce({ ok: true })
    const onDeleted = vi.fn()
    render(<BookActions book={sherlock} onGenreSaved={vi.fn()} onDeleted={onDeleted} />)

    fireEvent.click(screen.getByRole("button", { name: "Hapus buku" }))
    expect(deleteBookFn).not.toHaveBeenCalled()
    expect(screen.getByText(/Kuota 0.7 MB kembali ke rakmu/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ya, hapus" }))

    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledWith(sherlock))
    expect(deleteBookFn).toHaveBeenCalledWith({ data: { bookId: sherlock.id } })
  })

  it("explains a failed deletion and lets the member try again", async () => {
    deleteBookFn.mockRejectedValueOnce(new Error("network down"))
    render(<BookActions book={sherlock} onGenreSaved={vi.fn()} onDeleted={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: "Hapus buku" }))
    fireEvent.click(screen.getByRole("button", { name: "Ya, hapus" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Ada yang tidak beres")
    expect(screen.getByRole("button", { name: "Ya, hapus" })).toBeEnabled()
  })
})
```

`src/components/shelf/TrolleyGenrePicker.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "./fixtures"
import { TrolleyGenrePicker } from "./TrolleyGenrePicker"

const { updateBookGenreFn } = vi.hoisted(() => ({ updateBookGenreFn: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/books", () => ({ updateBookGenreFn, deleteBookFn: vi.fn() }))

describe("TrolleyGenrePicker", () => {
  it("gives a trolley book its genre in one choice", async () => {
    updateBookGenreFn.mockResolvedValueOnce({ ok: true })
    const onSaved = vi.fn()
    const book = { ...sherlock, genre: null, genreSource: null }
    render(<TrolleyGenrePicker book={book} onSaved={onSaved} />)

    fireEvent.change(screen.getByLabelText(`Genre untuk ${book.title}`), {
      target: { value: "sejarah_budaya" },
    })

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith("sejarah_budaya"))
    expect(updateBookGenreFn).toHaveBeenCalledWith({
      data: { bookId: book.id, genre: "sejarah_budaya" },
    })
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/components/shelf/BookActions.test.tsx src/components/shelf/TrolleyGenrePicker.test.tsx`
Expected: FAIL dengan "Failed to resolve import "./BookActions"" dan "Failed to resolve import "./TrolleyGenrePicker"".

- [ ] **Step 3: Implementasi**

`src/components/shelf/useSaveGenre.ts`:

```ts
import { useServerFn } from "@tanstack/react-start"
import { useCallback, useState } from "react"
import type { ActionResult } from "@/lib/action-result"
import type { Genre } from "@/lib/genre"
import { updateBookGenreFn } from "@/server/books"

/** Sets a book's genre (genre_source becomes 'user'); a thrown call becomes "unknown". */
export function useSaveGenre() {
  const updateGenre = useServerFn(updateBookGenreFn)
  const [saving, setSaving] = useState(false)

  const save = useCallback(
    async (bookId: string, genre: Genre): Promise<ActionResult> => {
      setSaving(true)
      try {
        return await updateGenre({ data: { bookId, genre } })
      } catch {
        return { ok: false, code: "unknown" }
      } finally {
        setSaving(false)
      }
    },
    [updateGenre]
  )

  return { save, saving }
}
```

`src/components/shelf/TrolleyGenrePicker.tsx`:

```tsx
import { useId, useState } from "react"
import { bookMessage } from "@/lib/book-messages"
import type { ShelfBook } from "@/lib/book-types"
import { GENRE_LABELS, GENRE_VALUES, type Genre, isGenre } from "@/lib/genre"
import { useSaveGenre } from "./useSaveGenre"

/** "Susun buku": one choice per trolley book gives it a genre (spec §7). */
export function TrolleyGenrePicker({
  book,
  onSaved,
}: {
  book: ShelfBook
  onSaved: (genre: Genre) => void
}) {
  const id = useId()
  const { save, saving } = useSaveGenre()
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Genre untuk {book.title}
      </label>
      <select
        id={id}
        value=""
        disabled={saving}
        onChange={async (event) => {
          const genre = event.target.value
          if (!isGenre(genre)) return
          setError(null)
          const result = await save(book.id, genre)
          if (result.ok) onSaved(genre)
          else setError(result.code)
        }}
        className="native-select w-full text-xs"
      >
        <option value="">Pilih genre</option>
        {GENRE_VALUES.map((value) => (
          <option key={value} value={value}>
            {GENRE_LABELS[value]}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs text-stamp">
          {bookMessage(error)}
        </p>
      )}
    </div>
  )
}
```

`src/components/shelf/BookActions.tsx`:

```tsx
import { useServerFn } from "@tanstack/react-start"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { bookMessage } from "@/lib/book-messages"
import type { ShelfBook } from "@/lib/book-types"
import { GENRE_LABELS, GENRE_VALUES, type Genre, TROLLEY_LABEL, isGenre } from "@/lib/genre"
import { formatBytes } from "@/lib/member"
import { deleteBookFn } from "@/server/books"
import { useSaveGenre } from "./useSaveGenre"

export function BookActions({
  book,
  onGenreSaved,
  onDeleted,
}: {
  book: ShelfBook
  onGenreSaved: (genre: Genre) => void
  onDeleted: (book: ShelfBook) => void
}) {
  const genreId = useId()
  const { save, saving } = useSaveGenre()
  const [genre, setGenre] = useState<Genre | null>(book.genre)
  const [genreState, setGenreState] = useState<"idle" | "saved" | { code: string }>("idle")

  const deleteBook = useServerFn(deleteBookFn)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
        onDeleted(book)
        return
      }
      setDeleteError(result.code)
    } catch {
      setDeleteError("unknown")
    }
    setDeleting(false)
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="space-y-1">
        <label htmlFor={genreId} className="block text-sm font-bold">
          Genre
        </label>
        <select
          id={genreId}
          value={genre ?? ""}
          disabled={saving}
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

      <div className="space-y-2">
        {!confirming ? (
          <Button variant="destructive" onClick={() => setConfirming(true)}>
            Hapus buku
          </Button>
        ) : (
          <>
            <p className="text-sm">
              Hapus “{book.title}” beserta filenya? Kuota {formatBytes(book.sizeBytes)} kembali ke
              rakmu.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => void onConfirmDelete()}
                disabled={deleting}
              >
                {deleting ? "Menghapus…" : "Ya, hapus"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
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

Di `src/components/shelf/BookDetail.tsx`, hapus dua baris Genre di dalam `<dl>` (`<dt className="text-muted-foreground">Genre</dt>` dan `<dd>{genreLabel(book.genre)}</dd>`) beserta import `genreLabel`.

Lalu di `src/components/shelf/BookDetail.test.tsx`, ganti `expect(dialog).toHaveTextContent("Misteri & Thriller")` dengan `expect(dialog).not.toHaveTextContent("Misteri & Thriller")`. Genre kini ditampilkan oleh `BookActions`, yang diteruskan lewat `children`.

Di `src/routes/_member/shelf.tsx`, ganti seluruh isinya:

```tsx
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { BookActions } from "@/components/shelf/BookActions"
import { BookDetail } from "@/components/shelf/BookDetail"
import { BookGrid } from "@/components/shelf/BookGrid"
import { EmptyShelf } from "@/components/shelf/EmptyShelf"
import { GenreFilter } from "@/components/shelf/GenreFilter"
import { ShelfHeader } from "@/components/shelf/ShelfHeader"
import { ShelfToolbar } from "@/components/shelf/ShelfToolbar"
import { TrolleyGenrePicker } from "@/components/shelf/TrolleyGenrePicker"
import { UploadPanel } from "@/components/shelf/UploadPanel"
import { Button } from "@/components/ui/button"
import { genreLabel } from "@/lib/genre"
import { countBooks, parseShelfSearch, shelfBooks } from "@/lib/shelf"
import { listBooksFn } from "@/server/books"

export const Route = createFileRoute("/_member/shelf")({
  validateSearch: parseShelfSearch,
  loader: () => listBooksFn(),
  // Filtering happens in the browser; reload only on invalidate or after a minute.
  staleTime: 60_000,
  head: () => ({ meta: [{ title: "Rak Saya — Glosa" }] }),
  component: ShelfPage,
})

function ShelfPage() {
  const { books, usage } = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState("")
  const visible = useMemo(() => shelfBooks(books, search), [books, search])
  const counts = useMemo(() => countBooks(books), [books])
  const selected = books.find((book) => book.id === selectedId) ?? null
  const inTrolley = search.genre === "troli"
  const bringButton = <Button onClick={() => setUploading(true)}>Bawa buku</Button>

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-5 p-4 sm:p-8">
      <ShelfHeader usage={usage} actions={books.length > 0 ? bringButton : undefined} />
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
      <BookDetail book={selected} onClose={() => setSelectedId(null)}>
        {selected && (
          <BookActions
            key={selected.id}
            book={selected}
            onGenreSaved={() => void router.invalidate()}
            onDeleted={(book) => {
              setSelectedId(null)
              setNotice(`“${book.title}” dihapus dari rak.`)
              void router.invalidate()
            }}
          />
        )}
      </BookDetail>
      <UploadPanel open={uploading} onOpenChange={setUploading} usage={usage} />
    </main>
  )
}
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/components/shelf`
Expected: PASS, termasuk 4 test baru.

- [ ] **Step 5: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint && npm run check`

```bash
git add src/components/shelf src/routes/_member/shelf.tsx
git commit -m "feat(shelf): change genres, sort out the trolley and delete books"
```

---

### Task 11: E2E Rak Saya dan pembersihan Storage pada test

**Files:**
- Create: `e2e/fixtures/the-adventures-of-sherlock-holmes.epub` (diunduh), `e2e/helpers/epub.ts`, `e2e/shelf.spec.ts`
- Modify: `e2e/helpers/members.ts` (tambah `userIdOf`), `e2e/global-teardown.ts`, `package.json` / `package-lock.json` (tambah `fflate` sebagai devDependency)

**Interfaces:**
- Consumes:
  - Semua UI dari Task 8–10. Label dan teks yang dipakai test:
    - Dialog: "Bawa buku ke rak".
    - Tombol: "Bawa buku", "Terima semua", "Tutup", "Hapus buku", "Ya, hapus", "Hapus akun saya permanen".
    - Label select: "Genre", "Genre untuk {judul}".
    - Navigasi: "Filter genre".
    - Teks status: "Masuk rak ✓".
    - Notifikasi: "Dipindahkan ke {label}." dan "“{judul}” dihapus dari rak."
  - Helper 1A: `createConfirmedMember`, `signInAndOnboard`, `hydrated`, `admin`.
- Produces:
  - `makeEpub({ title, author, subjects, cover? }): Promise<Buffer>`
  - `userIdOf(email): Promise<string>`
  - `npm run test:e2e` yang hijau.
  - Teardown yang menghapus objek Storage milik user uji.

- [ ] **Step 1: Siapkan fixture dan dependensi**

Run:
```bash
npm install --save-dev fflate
curl -sL -A "Mozilla/5.0" -o e2e/fixtures/the-adventures-of-sherlock-holmes.epub "https://standardebooks.org/ebooks/arthur-conan-doyle/the-adventures-of-sherlock-holmes/downloads/arthur-conan-doyle_the-adventures-of-sherlock-holmes.epub?source=download"
head -c 4 e2e/fixtures/the-adventures-of-sherlock-holmes.epub | od -c | head -1
```
Expected:
- File sekitar 700–800 KB.
- Empat byte pertamanya `P K 003 004`.
- OPF di dalamnya memuat `<dc:subject>Detective and mystery stories, English</dc:subject>`. Cek dengan `unzip -p e2e/fixtures/the-adventures-of-sherlock-holmes.epub epub/content.opf | grep dc:subject`.

File ini berlisensi CC0 dari Standard Ebooks, jadi boleh di-commit.

- [ ] **Step 2: Helper**

`e2e/helpers/epub.ts`:

```ts
import { randomUUID } from "node:crypto"
import { strToU8, zipSync } from "fflate"
import sharp from "sharp"

const escapeXml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

/** A small valid EPUB 3 for tests: one chapter, a navigation document and an optional cover. */
export async function makeEpub(book: {
  title: string
  author: string
  subjects: ReadonlyArray<string>
  cover?: boolean
}): Promise<Buffer> {
  const cover =
    book.cover === false
      ? null
      : await sharp({
          create: { width: 600, height: 900, channels: 3, background: { r: 30, g: 70, b: 60 } },
        })
          .png()
          .toBuffer()
  const subjects = book.subjects
    .map((subject) => `<dc:subject>${escapeXml(subject)}</dc:subject>`)
    .join("")
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">urn:uuid:${randomUUID()}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:creator>${escapeXml(book.author)}</dc:creator>
    <dc:language>id</dc:language>
    ${subjects}
    <meta property="dcterms:modified">2026-10-16T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="bab1" href="bab1.xhtml" media-type="application/xhtml+xml"/>
    ${cover ? '<item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>' : ""}
  </manifest>
  <spine><itemref idref="bab1"/></spine>
</package>`
  const xhtml = (title: string, body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${escapeXml(title)}</title></head><body>${body}</body></html>`

  const files: Parameters<typeof zipSync>[0] = {
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
    ),
    "OEBPS/content.opf": strToU8(opf),
    "OEBPS/nav.xhtml": strToU8(
      xhtml(
        "Daftar isi",
        '<nav epub:type="toc"><ol><li><a href="bab1.xhtml">Bab 1</a></li></ol></nav>'
      )
    ),
    "OEBPS/bab1.xhtml": strToU8(
      xhtml("Bab 1", `<h1>Bab 1</h1><p>${escapeXml(book.title)}</p>`)
    ),
  }
  if (cover) files["OEBPS/cover.png"] = cover
  return Buffer.from(zipSync(files))
}
```

Tambahkan ke `e2e/helpers/members.ts`:

```ts
export async function userIdOf(email: string): Promise<string> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const user = data.users.find((candidate) => candidate.email === email)
    if (user) return user.id
    if (data.users.length < 1000) throw new Error(`No user with email ${email}`)
  }
}
```

Ganti isi `e2e/global-teardown.ts`. Versi baru menghapus objek Storage sebelum user, dan mengumpulkan semua halaman dulu sebelum menghapus, supaya paginasi tidak melompati user:

```ts
import { existsSync } from "node:fs"
import { E2E_MARKER, admin } from "./helpers/members"

/** Deletes every E2E user (emails contain the marker) and their book files. */
export default async function globalTeardown() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local")
  const client = admin()
  const stale: Array<string> = []
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const user of data.users) {
      if (user.email?.includes(E2E_MARKER)) stale.push(user.id)
    }
    if (data.users.length < 1000) break
  }
  for (const id of stale) {
    const { data: objects } = await client.storage.from("books").list(id, { limit: 1000 })
    if (objects && objects.length > 0) {
      await client.storage.from("books").remove(objects.map((object) => `${id}/${object.name}`))
    }
    await client.auth.admin.deleteUser(id)
  }
}
```

- [ ] **Step 3: Tulis spesifikasi E2E**

`e2e/shelf.spec.ts`:

```ts
import { expect, test, type Locator, type Page } from "@playwright/test"
import { makeEpub } from "./helpers/epub"
import {
  admin,
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

const SHERLOCK = "e2e/fixtures/the-adventures-of-sherlock-holmes.epub"
type Files = Parameters<Page["setInputFiles"]>[1]

async function openShelf(page: Page) {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.getByRole("link", { name: "Rak Saya" }).click()
  await expect(page).toHaveURL(/\/shelf$/)
  await hydrated(page)
  return member
}

async function bringBooks(page: Page, files: Files): Promise<Locator> {
  await page.getByRole("button", { name: "Bawa buku" }).first().click()
  const dialog = page.getByRole("dialog", { name: "Bawa buku ke rak" })
  await dialog.locator('input[type="file"]').setInputFiles(files)
  return dialog
}

async function acceptAll(dialog: Locator, uploaded = 1) {
  await dialog.getByRole("button", { name: "Terima semua" }).click()
  await expect(dialog.getByText("Masuk rak ✓")).toHaveCount(uploaded, { timeout: 30_000 })
}

const epubFile = async (name: string, book: Parameters<typeof makeEpub>[0]) => ({
  name,
  mimeType: "application/epub+zip",
  buffer: await makeEpub(book),
})

test("a Standard Ebooks EPUB lands in its guessed genre and frees its space when deleted", async ({
  page,
}) => {
  await openShelf(page)
  await expect(page.getByText("Rakmu masih kosong. Bawa buku pertamamu ke sini!")).toBeVisible()

  const dialog = await bringBooks(page, SHERLOCK)
  await expect(dialog.getByText("The Adventures of Sherlock Holmes")).toBeVisible()
  await expect(dialog.getByLabel("Genre")).toHaveValue("misteri_thriller")
  await acceptAll(dialog)
  await dialog.getByRole("button", { name: "Tutup" }).click()

  const filters = page.getByRole("navigation", { name: "Filter genre" })
  const book = page.getByRole("button", { name: /The Adventures of Sherlock Holmes/ })
  await filters.getByRole("link", { name: /Misteri & Thriller/ }).click()
  await expect(book).toBeVisible()
  await filters.getByRole("link", { name: /Fiksi & Sastra/ }).click()
  await expect(book).toHaveCount(0)
  await expect(page.getByText(/^0\.[78] MB \/ 100 MB$/)).toBeVisible()

  await filters.getByRole("link", { name: /Semua/ }).click()
  await book.click()
  const detail = page.getByRole("dialog", { name: "The Adventures of Sherlock Holmes" })
  await detail.getByRole("button", { name: "Hapus buku" }).click()
  await detail.getByRole("button", { name: "Ya, hapus" }).click()
  await expect(page.getByText("“The Adventures of Sherlock Holmes” dihapus dari rak.")).toBeVisible()
  await expect(page.getByText("0 MB / 100 MB")).toBeVisible()
})

test("a book without subjects waits in the trolley until it gets a genre", async ({ page }) => {
  await openShelf(page)
  const dialog = await bringBooks(
    page,
    await epubFile("tanpa-subjek.epub", {
      title: "Catatan Tanpa Subjek",
      author: "Penulis Uji",
      subjects: [],
    })
  )
  await expect(dialog.getByText("Catatan Tanpa Subjek")).toBeVisible()
  await expect(dialog.getByLabel("Genre")).toHaveValue("")
  await acceptAll(dialog)
  await dialog.getByRole("button", { name: "Tutup" }).click()

  const filters = page.getByRole("navigation", { name: "Filter genre" })
  await filters.getByRole("link", { name: /Troli Buku Baru/ }).click()
  await page.getByLabel("Genre untuk Catatan Tanpa Subjek").selectOption("sejarah_budaya")
  await expect(page.getByText("Dipindahkan ke Sejarah & Budaya.")).toBeVisible()
  await expect(page.getByRole("button", { name: /Catatan Tanpa Subjek/ })).toHaveCount(0)
  await filters.getByRole("link", { name: /Sejarah & Budaya/ }).click()
  await expect(page.getByRole("button", { name: /Catatan Tanpa Subjek/ })).toBeVisible()
})

test("explains why a file cannot come in", async ({ page }) => {
  await openShelf(page)
  const twin = await epubFile("kembar.epub", {
    title: "Buku Kembar",
    author: "Penulis Uji",
    subjects: ["History"],
  })
  const dialog = await bringBooks(page, [
    { name: "catatan.txt", mimeType: "text/plain", buffer: Buffer.from("bukan buku") },
    {
      name: "rusak.epub",
      mimeType: "application/epub+zip",
      buffer: Buffer.from("PK\u0003\u0004 bukan arsip yang utuh"),
    },
    twin,
  ])
  await expect(dialog.getByText("Hanya file .epub yang bisa dibawa masuk.")).toBeVisible()
  await expect(dialog.getByText("File EPUB rusak atau tidak didukung.")).toBeVisible()
  await acceptAll(dialog)

  await dialog.locator('input[type="file"]').setInputFiles(twin)
  await expect(dialog.getByRole("button", { name: "Terima semua" })).toBeEnabled()
  await dialog.getByRole("button", { name: "Terima semua" }).click()
  await expect(dialog.getByText("Buku ini sudah ada di rakmu.")).toBeVisible()
})

test("a full shelf refuses new books", async ({ page }) => {
  const member = await openShelf(page)
  const { error } = await admin()
    .from("profiles")
    .update({ storage_limit_bytes: 1000 })
    .eq("id", await userIdOf(member.email))
  expect(error).toBeNull()

  const dialog = await bringBooks(
    page,
    await epubFile("penuh.epub", { title: "Buku Kebesaran", author: "Penulis Uji", subjects: [] })
  )
  await expect(dialog.getByText("Buku Kebesaran")).toBeVisible()
  await dialog.getByRole("button", { name: "Terima semua" }).click()
  await expect(
    dialog.getByText("Rakmu penuh. Hapus buku lain dulu untuk memberi tempat.")
  ).toBeVisible()
})

test("deleting the account removes the member's book files", async ({ page }) => {
  const member = await openShelf(page)
  const userId = await userIdOf(member.email)
  const dialog = await bringBooks(
    page,
    await epubFile("milikku.epub", { title: "Buku Milikku", author: "Penulis Uji", subjects: [] })
  )
  await expect(dialog.getByText("Buku Milikku")).toBeVisible()
  await acceptAll(dialog)

  const files = async () => (await admin().storage.from("books").list(userId)).data ?? []
  await expect.poll(async () => (await files()).length).toBe(2)

  await page.goto("/settings")
  await hydrated(page)
  await page.getByLabel("Ketik nama penggunamu untuk konfirmasi").fill(member.username)
  await page.getByRole("button", { name: "Hapus akun saya permanen" }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await files()).length).toBe(0)
})
```

- [ ] **Step 4: Jalankan E2E**

Run: `npm run test:e2e`
Expected:
- Hasilnya **24 passed, 4 skipped**: 14 test lama ditambah 10 test baru (5 test × proyek `desktop`/`mobile`). Dua test SMTP di-skip di masing-masing proyek.
- Setelah selesai, cek dengan admin client: tidak ada user `e2e-` yang tersisa, dan tidak ada objek di bucket `books` dengan folder milik user uji.

Jika ada yang gagal, buka trace dengan `npx playwright show-trace test-results/<folder>/trace.zip`, lalu perbaiki **kode aplikasi**, bukan melemahkan assertion. Satu pengecualian: jika teks di test berbeda dari teks UI yang ditetapkan di Task 8–10, ikuti teks UI dari task tersebut.

- [ ] **Step 5: Validasi seluruh rangkaian dan commit**

Run: `npm run lint && npm run check && npm run typecheck && npm test && npm run build && npm run test:db && npm run test:e2e`
Expected: semua lulus.

```bash
git add e2e/fixtures/the-adventures-of-sherlock-holmes.epub e2e/helpers/epub.ts e2e/helpers/members.ts e2e/global-teardown.ts e2e/shelf.spec.ts package.json package-lock.json
git commit -m "test(e2e): cover uploads, genres, the trolley, quota, deletion and account cleanup"
```

---

## Cakupan terhadap spec (untuk reviewer)

| Spec | Task |
|---|---|
| §4 `books`: kolom, `unique (user_id, sha256)`, `genre`/`genre_source`, `subjects`, `work_id` | 3 |
| §4 RLS `books`: tanpa insert client. RLS Storage: hanya prefix sendiri, tanpa policy insert | 3 |
| §4 Kuota dihitung, tidak disimpan | 2 (`usedBytes`), 3 (SQL) |
| §5 langkah 1: parsing di browser, metadata, cover WebP 400 px, SHA-256, `suggestGenre` | 1, 5 |
| §5 langkah 2: daftar upload dengan genre per file, "Terima semua", file tanpa genre masuk Troli | 7, 9 |
| §5 langkah 3: `requestUpload` dengan login, 50 MB, duplikat, `FOR UPDATE`, insert `pending`, signed URL | 3, 4 |
| §5 langkah 4: upload langsung ke Storage dengan progres per file | 7, 9 |
| §5 langkah 5: `confirmUpload` mencocokkan ukuran, `ready`, atau hapus jika tidak cocok | 4 |
| §5 langkah 6: pembersihan `pending` > 1 jam | 3, 4 (penyimpangan 2) |
| §5 Ubah genre (`genre_source = 'user'`), Hapus buku (kuota langsung kembali) | 4, 10 |
| §5 Modul `bookStorage` | 4 |
| §5a Nilai genre, kata kunci, prioritas seri, `null` = Troli | 1 (penyimpangan 4) |
| §8 Filter genre `?genre=`, grid di atas papan rak, pencarian, tiga urutan, upload banyak file dengan pesan per file, bar storage + nama paket | 6, 8, 9 |
| §7 Empty state dengan petugas, Standard Ebooks, dan Project Gutenberg | 8 |
| §7 Detail Buku (versi Rak Saya), Troli "Susun buku" | 8, 10 (penyimpangan 6) |
| §12 EPUB rusak, kuota penuh, file > 50 MB, duplikat, upload terputus, ukuran tidak cocok | 2, 4, 7, 9, 11 |
| §13 Unit: validasi upload, logika kuota, wrapper metadata EPUB, `suggestGenre` | 1, 2, 5, 6, 7 |
| §13 Database: RLS buku dan Storage, insert client ditolak, kuota termasuk permintaan bersamaan | 3, 4 |
| §13 E2E: upload contoh Standard Ebooks, genre tertebak, zona benar, Troli, hapus buku dan kuota kembali | 11 |
| 1A ditunda ke 1B: penghapusan file buku saat hapus akun | 4, 11 |
| §8 bar progres, "Tersedia offline", reader, sinkronisasi, offline | Rencana 1C |
| §7 lobi isometrik, hotspot zona, panel, peta | Rencana 1D |
