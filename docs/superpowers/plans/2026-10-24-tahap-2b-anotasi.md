# Glosa Tahap 2B — Anotasi: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Member memilih teks di reader lalu membuat highlight 4 warna (dengan catatan bila mau), menandai halaman dengan bookmark, dan membuka semuanya di tab **Anotasi** di samping Daftar isi. Semua anotasi tersinkron antar perangkat dan tetap jalan offline.

**Architecture:**
- **Server.** Tabel `annotations` (id dibuat di perangkat, tombstone untuk hapus) dengan fungsi `save_annotations`: per entri, yang terbaru menang, dan tiap entri dijawab `ok`, `limit_reached`, atau `invalid`. Browser memanggilnya lewat `syncAnnotationsFn` dan membaca daftar per buku lewat `listAnnotationsFn` (`src/server/annotations.ts`). Sapuan per jam menghapus tombstone yang berumur lebih dari 30 hari.
- **Perangkat.** Dexie versi 3 menambah tabel `annotations` (satu baris per anotasi, `pending` selama server belum punya). Mesin antrean 2A dipisah menjadi `createQueueSync` yang dipakai bersama oleh kata tersimpan dan anotasi.
- **Reader.** Highlight digambar lewat overlay foliate (`addAnnotation`, `draw-annotation`). Klik di dokumen section diperiksa berurutan: tautan, menu seleksi yang terbuka, highlight, seleksi yang sedang dibuat, kata, lalu zona lama. Seleksi yang selesai membuka menu *Highlight · Catatan · Salin*. Ketukan di highlight membuka popup anotasi. Bookmark lewat tombol di toolbar, dengan pita di pojok halaman.

**Tech Stack:** TanStack Start + Router, React 19, TypeScript, Tailwind CSS 4, Base UI (Popover, Dialog, Tabs), Dexie 4, Supabase (Postgres, RLS, PostgREST RPC), zod 4, foliate-js (`view.js`, `overlayer.js`, `epubcfi.js`), Vitest + Testing Library (jsdom, `fake-indexeddb`), Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md`](../specs/2026-10-22-tahap-2-ketuk-kata-design.md) §2 (keputusan 8–11), §3 (2B), §4.3, §4.5, §5, §6.1, §6.6, §7, §8, §10.

## Global Constraints

- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris (mengikuti kode yang ada). Array ditulis `Array<T>`, seperti kode yang ada.
- **Dependensi:** tidak ada dependensi baru.
- **Breakpoint desktop:** `(min-width: 1024px)` (`useWideScreen()` di `src/lib/use-wide-screen.ts`).
- **Batas (persis dari spec):** CFI maksimal 2.000 karakter; catatan maksimal 2.000 karakter, hanya untuk highlight; kutipan maksimal 1.000 karakter; batch maksimal 50 entri; 10.000 anotasi aktif per user; tombstone dihapus setelah 30 hari.
- **Warna highlight (persis dari spec):** `yellow`, `green`, `blue`, `pink`; bookmark tanpa warna (`null`).
- **Waktu (persis dari spec):** antrean dikirim 2 detik setelah perubahan terakhir, saat online kembali, dan saat buku dibuka. Stempel waktu dari masa depan dipangkas ke `now()`, persis seperti `save_progress`.
- **Teks dari spec, persis:** "Highlight", "Catatan", "Salin", "Hapus", "Daftar isi", "Anotasi", "Posisi itu tidak ditemukan di buku ini".
- **SQL:** tabel memakai RLS "baca milik sendiri"; penulisan lewat fungsi `security definer` dengan `set search_path = ''`; `revoke execute … from public, anon` lalu `grant` ke `authenticated` (pola `save_progress`).
- **Migrasi:** di-push ke proyek Supabase dev sebelum branch di-push (`npm run db:push`), lalu tipe dibuat ulang (`npm run db:types` + `npx prettier --write src/server/database.types.ts`). Hanya tambahan, sesuai aturan migrasi prod di [`docs/ops/deploy.md`](../../ops/deploy.md) §7.
- **Proyek dev dipakai bersama** oleh situs dev, CI, dan test. Test hanya menulis baris milik member test-nya sendiri. Jangan memanggil `dict_swap` atau `dict_staging_reset`.
- **Line ending:** LF. Di Windows, jangan menulis file lewat Python tanpa `newline=''`.
- **E2E:** jalankan dengan `--workers=2`. Kalau port 3000 dipegang aplikasi lain (cek `curl -sL localhost:3000/login | grep -o "<title>[^<]*"`), jalankan dengan config sementara di port 3100, jangan matikan server lain. Satu kegagalan dijalankan ulang sendirian sebelum disebut regresi.

## Keputusan dan penyimpangan dari spec

Semua keputusan berikut disengaja. Spec diperbarui mengikutinya di Task 12.

1. **`note` adalah `text not null default ''`**, bukan nullable. Catatan kosong berarti tidak ada catatan, jadi tidak ada dua cara menulis "kosong".
2. **`save_annotations` mengembalikan `text[]`**, satu jawaban per entri: `ok`, `limit_reached`, atau `invalid`. Nilai yang ditolak tabel (kelas SQLSTATE 22 dan 23) hanya menolak entri itu, supaya satu entri buruk tidak menahan antrean di belakangnya (pelajaran dari 2A).
3. **Entri untuk buku yang sudah tidak ada dijawab `ok` dan dilewati**, seperti posisi baca di `saveProgressFn`. Anotasinya sudah ikut terhapus bersama buku. Buku milik user lain atau buku yang belum `ready` dijawab `invalid`.
4. **Yang bisa berubah pada anotasi yang sudah ada hanya `color`, `note`, `excerpt`, `updated_at`, dan `deleted_at`.** `kind`, `book_id`, dan `cfi` tetap seperti saat dibuat. `book_id` yang berbeda untuk `id` yang sama dijawab `invalid`.
5. **Sapuan tombstone memakai fungsi baru `purgeTombstones`** (`src/server/sweep/tombstones.ts`), dijalankan di ronde sapuan yang sama setelah `runSweep`. Batas jumlah hapus sapuan (`SWEEP_LIMITS`) tidak berlaku untuknya, karena yang dihapus memang sudah dihapus member. Di dry run hanya dihitung.
6. **Mesin antrean 2A dipisah menjadi `createQueueSync`** (`src/lib/sync/queue-sync.ts`), dipakai `createWordSync` dan `createAnnotationSync`. Hook `useQueueFlush` dipakai `useWordFlush` dan `useAnnotationFlush`. Perilaku 2A tidak berubah; test 2A menjadi pengamannya.
7. **Perubahan anotasi yang ditolak server dibatalkan dengan menghapus baris perangkat**, kecuali anotasi itu sudah berubah lagi. Saat buku dibuka berikutnya, versi server (bila ada) masuk lagi.
8. **Klik highlight dibaca sendiri lewat `overlayer.hitTest`** di handler klik reader, bukan lewat event `show-annotation`. foliate memasang listener overlay-nya setelah listener reader, jadi hanya dengan cara ini urutan klik (§6.1) dan posisi popup bisa diatur di satu tempat.
9. **Menu seleksi muncul 300 ms setelah seleksi berhenti berubah**, atau langsung saat jari/mouse diangkat. Di HP, gagang seleksi bawaan browser tidak mengirim `touchend` ke halaman, jadi `selectionchange` yang dipakai.
10. **Ketukan apa pun saat menu seleksi terbuka hanya menutup menu dan seleksinya**, tidak membuka arti atau membalik halaman.
11. **Popup anotasi menampilkan tombol `Arti "kata"` untuk kata yang diketuk di dalam highlight.** Untuk highlight satu kata, kata itu sama dengan isi highlight, jadi satu tombol mencakup kedua kasus di spec.
12. **Ikon catatan berupa kotak kecil berwarna sama tepat setelah baris terakhir highlight**, digambar di overlay yang sama. Overlay foliate tidak tahu letak tepi kolom, jadi "pinggir teks" diartikan sebagai ujung highlight.
13. **Nama bab di panel dihitung saat panel dibuka** lewat `view.getProgressOf`, bukan disimpan di tabel. Dokumen tiap section dimuat sekali per pembukaan panel.
14. **Panel Anotasi punya tombol hapus per anotasi**, karena E2E di spec §10 menghapus dari panel.
15. **Judul panel menjadi "Daftar isi dan anotasi"** (tersembunyi, untuk pembaca layar), dan tombol toolbar ikut bernama begitu. Tab yang terlihat bernama "Daftar isi" dan "Anotasi".
16. **Bookmark disimpan di awal halaman** (`collapse` dari CFI halaman). Halaman dianggap berisi bookmark bila CFI bookmark berada di antara awal (termasuk) dan akhir (tidak termasuk) halaman yang tampil. Kutipan bookmark adalah 200 karakter pertama halaman.
17. **Popup reader (arti dan anotasi) memakai komponen bersama `ReaderPopup`**: popover di layar lebar, bottom sheet di HP. Menu seleksi selalu popover kecil tanpa memindahkan fokus, supaya seleksi di HP tidak hilang.
18. **Pesan penolakan memakai komponen bersama `SyncNotice`**: `words_full`/`word_invalid` (2A) dan `annotations_full`/`annotation_invalid` (baru) di `src/lib/book-messages.ts`.
19. **`Salin` tidak menampilkan pesan.** Menu tertutup dan seleksi hilang; teks ada di clipboard.
20. **Lompat dari panel ke tempat yang tidak ada di buku** (buku diganti versi lain) menampilkan "Posisi itu tidak ditemukan di buku ini" dan halaman tetap di tempatnya (spec §8). `ReaderControls.canOpen` memakai pemeriksaan yang sama dengan `?cfi`.

## Struktur file

| File | Status | Tanggung jawab |
|---|---|---|
| `supabase/migrations/20261024000400_annotations.sql` | Baru | Tabel `annotations`, RLS, `save_annotations` |
| `src/server/database.types.ts` | Dibuat ulang | `npm run db:types` |
| `tests/db/annotations.test.ts` | Baru | `save_annotations`, RLS, batas, cascade |
| `src/server/sweep/tombstones.ts` | Baru | `purgeTombstones` |
| `src/server/sweep/main.ts` | Ubah | Ronde sapuan juga menghapus tombstone |
| `tests/db/sweep.test.ts` | Ubah | Test `purgeTombstones` |
| `src/lib/stored-text.ts` | Baru | `StoredText` (teks tanpa NUL), dipakai skema kata dan anotasi |
| `src/lib/words/schemas.ts` | Ubah | Memakai `StoredText` |
| `src/lib/annotations/types.ts` | Baru | Tipe anotasi, warna, batas |
| `src/lib/annotations/schemas.ts` | Baru | Skema zod (client dan server), `isValidAnnotation` |
| `src/lib/annotations/changes.ts` | Baru | `stamp`, `excerptOf`, `newHighlight`, `newBookmark`, `edited`, `deleted` |
| `src/server/annotations.ts` | Baru | `syncAnnotationsFn`, `listAnnotationsFn` |
| `src/lib/sync/queue-sync.ts` | Baru | `createQueueSync` (dari `word-sync.ts`) |
| `src/lib/sync/use-queue-flush.ts` | Baru | `useQueueFlush` (dari `word-sync-client.ts`) |
| `src/lib/words/word-sync.ts` | Ubah | Memakai `createQueueSync` |
| `src/lib/words/word-sync-client.ts` | Ubah | `useWordFlush` memakai `useQueueFlush` |
| `src/lib/local/db.ts` | Ubah | Dexie versi 3: `annotations` |
| `src/lib/local/annotations.ts` | Baru | Anotasi di perangkat dan antreannya |
| `src/lib/local/device.ts` | Ubah | Hapus data juga mengosongkan `annotations` |
| `src/components/shelf/BookActions.tsx` | Ubah | Hapus buku juga menghapus anotasi perangkat |
| `src/components/reader/load-reader.ts` | Ubah | Buku yang hilang di server: anotasi perangkat ikut hilang |
| `src/lib/annotations/annotation-sync.ts` | Baru | `createAnnotationSync` |
| `src/lib/annotations/annotation-sync-client.ts` | Baru | Mesin satu-satunya di tab, `refreshBookAnnotations`, hook React |
| `src/routes/_member.tsx` | Ubah | `useAnnotationFlush()` |
| `src/lib/progress-sync-client.ts` | Ubah | `leaveDevice` juga mengirim antrean anotasi |
| `src/lib/book-messages.ts` | Ubah | `annotations_full`, `annotation_invalid` |
| `src/components/reader/SyncNotice.tsx` | Baru | Pesan penolakan server |
| `src/components/vocabulary/VocabularyNotice.tsx` | Ubah | Memakai `SyncNotice` |
| `src/components/reader/AnnotationNotice.tsx` | Baru | Pesan penolakan anotasi |
| `src/types/foliate-js.d.ts` | Ubah | Overlay, anotasi, `epubcfi.js`, `overlayer.js` |
| `src/lib/annotations/places.ts` | Baru | `pageStart`, `onPage`, `inBookOrder` |
| `src/lib/annotations/draw.ts` | Baru | `HIGHLIGHT_FILL`, `drawHighlight` |
| `src/lib/annotations/selection.ts` | Baru | `selectedRange`, `endRect`, `rectAt` |
| `src/components/reader/ReaderPopup.tsx` | Baru | Popover/bottom sheet bersama |
| `src/components/reader/WordPopup.tsx` | Ubah | Memakai `ReaderPopup` |
| `src/components/reader/SelectionMenu.tsx` | Baru | Menu *Highlight · Catatan · Salin* |
| `src/components/reader/AnnotationPopup.tsx` | Baru | Warna, Catatan, Hapus, Arti |
| `src/components/reader/NoteEditor.tsx` | Baru | Edit catatan |
| `src/components/reader/AnnotationList.tsx` | Baru | Isi tab Anotasi |
| `src/components/reader/TocPanel.tsx` | Ubah | Tab *Daftar isi · Anotasi* |
| `src/components/reader/ReaderToolbar.tsx` | Ubah | Tombol bookmark |
| `src/components/reader/ReaderView.tsx` | Ubah | Gambar highlight, seleksi, urutan klik, `clearSelection`, `chaptersOf` |
| `src/routes/_member/read.$bookId.tsx` | Ubah | Menyatukan semuanya |
| `src/styles.css` | Ubah | Menu seleksi, popup anotasi, catatan, panel, pita, warna overlay |
| `src/routes/privacy.tsx` | Ubah | Anotasi di daftar data |
| `e2e/helpers/reading.ts` | Baru | `startReading` (dipindah dari `vocabulary.spec.ts`) |
| `e2e/helpers/annotations.ts` | Baru | Memilih teks, membaca `annotations` |
| `e2e/vocabulary.spec.ts` | Ubah | Memakai `startReading` |
| `e2e/annotations.spec.ts` | Baru | E2E 2B |
| `docs/ops/deploy.md` | Ubah | Sapuan juga menghapus tombstone |
| `docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md` | Ubah | Keputusan di atas |

---

### Task 1: Tabel `annotations` dan `save_annotations`

**Files:**
- Create: `supabase/migrations/20261024000400_annotations.sql`
- Create: `tests/db/annotations.test.ts`
- Regenerate: `src/server/database.types.ts`

**Interfaces:**
- Consumes: `public.profiles`, `public.books` (status `ready`), helper test `createTestMember`, `newTestBook`, `signedInClient`, `adminClient`, `anonClient`, `deleteTestMembers`, `forgetTestMember` (`tests/db/helpers.ts`).
- Produces:
  - Tabel `public.annotations (id uuid, user_id, book_id, kind, cfi, color, note, excerpt, created_at, updated_at, deleted_at)`.
  - RPC `save_annotations(p_entries jsonb) returns text[]`. Tiap entri adalah objek snake_case: `{ id, book_id, kind, cfi, color, note, excerpt, created_at, updated_at, deleted_at }`. Jawaban per entri, berurutan: `'ok' | 'limit_reached' | 'invalid'`. Batch lebih dari 50 atau bukan array: error `invalid`. Tanpa sesi: error `not_authenticated`.
  - Tipe `Database["public"]["Tables"]["annotations"]` dan `Functions["save_annotations"]` di `database.types.ts`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `tests/db/annotations.test.ts`:

```ts
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  adminClient,
  anonClient,
  createTestMember,
  deleteTestMembers,
  forgetTestMember,
  newTestBook,
  signedInClient,
} from "./helpers"

const run = Date.now().toString(36)
const emails = {
  ani: `db-notes-ani-${run}@glosa.test`,
  budi: `db-notes-budi-${run}@glosa.test`,
  cita: `db-notes-cita-${run}@glosa.test`,
  dedi: `db-notes-dedi-${run}@glosa.test`,
}
type Client = Awaited<ReturnType<typeof signedInClient>>

const MINUTE = 60_000
// An hour ago, so the server's clamp to now() never touches these stamps.
const base = Date.now() - 60 * MINUTE
const at = (minutes: number) => new Date(base + minutes * MINUTE).toISOString()

type Entry = {
  id: string
  book_id: string
  kind: string
  cfi: string
  color: string | null
  note: string
  excerpt: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function highlight(bookId: string, changes: Partial<Entry> = {}): Entry {
  return {
    id: randomUUID(),
    book_id: bookId,
    kind: "highlight",
    cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
    color: "yellow",
    note: "",
    excerpt: "To Sherlock",
    created_at: at(0),
    updated_at: at(0),
    deleted_at: null,
    ...changes,
  }
}

function bookmark(bookId: string, changes: Partial<Entry> = {}): Entry {
  return highlight(bookId, {
    kind: "bookmark",
    cfi: "epubcfi(/6/4!/4/2/1:0)",
    color: null,
    ...changes,
  })
}

async function save(client: Client, entries: Array<Entry>) {
  const { data, error } = await client.rpc("save_annotations", {
    p_entries: entries,
  })
  if (error) throw error
  return data
}

async function rowOf(id: string) {
  const { data, error } = await adminClient()
    .from("annotations")
    .select("user_id, color, note, updated_at, deleted_at")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data
}

describe("annotations", () => {
  const ids = { ani: "", budi: "", cita: "", dedi: "" }
  const books = { ani: "", aniPending: "", budi: "", cita: "" }
  let ani: Client
  let budi: Client

  beforeAll(async () => {
    for (const name of ["ani", "budi", "cita", "dedi"] as const) {
      ids[name] = (await createTestMember({ email: emails[name] })).id
    }
    books.ani = await newTestBook(ids.ani)
    books.aniPending = await newTestBook(ids.ani, { ready: false })
    books.budi = await newTestBook(ids.budi)
    books.cita = await newTestBook(ids.cita)
    ani = await signedInClient(emails.ani)
    budi = await signedInClient(emails.budi)
  })

  afterAll(async () => {
    await deleteTestMembers()
  })

  it("stores a highlight that only its member can read", async () => {
    const entry = highlight(books.ani)
    expect(await save(ani, [entry])).toEqual(["ok"])

    const own = await ani.from("annotations").select("id").eq("id", entry.id)
    expect(own.data).toEqual([{ id: entry.id }])
    const other = await budi
      .from("annotations")
      .select("id")
      .eq("id", entry.id)
    expect(other.data).toEqual([])
    const anon = await anonClient().from("annotations").select("id")
    expect(anon.error).not.toBeNull()
  })

  it("keeps the newest change", async () => {
    const entry = highlight(books.ani)
    await save(ani, [entry])

    expect(
      await save(ani, [{ ...entry, color: "green", updated_at: at(-1) }])
    ).toEqual(["ok"])
    expect((await rowOf(entry.id))?.color).toBe("yellow")

    expect(
      await save(ani, [{ ...entry, color: "blue", updated_at: at(1) }])
    ).toEqual(["ok"])
    expect((await rowOf(entry.id))?.color).toBe("blue")
  })

  it("clamps a time from the future to now", async () => {
    const future = new Date(Date.now() + 24 * 60 * MINUTE).toISOString()
    const entry = highlight(books.ani, { updated_at: future })
    await save(ani, [entry])
    const row = await rowOf(entry.id)
    expect(Date.parse(row?.updated_at ?? "")).toBeLessThan(Date.parse(future))
  })

  it("keeps a deletion as a tombstone the member still reads", async () => {
    const entry = highlight(books.ani)
    await save(ani, [entry])
    expect(
      await save(ani, [{ ...entry, deleted_at: at(1), updated_at: at(1) }])
    ).toEqual(["ok"])
    const own = await ani
      .from("annotations")
      .select("deleted_at")
      .eq("id", entry.id)
      .single()
    expect(own.data?.deleted_at).not.toBeNull()
  })

  it("refuses another member's id, another member's book and a book not ready", async () => {
    const entry = highlight(books.ani)
    await save(ani, [entry])

    expect(
      await save(budi, [
        { ...entry, book_id: books.budi, color: "pink", updated_at: at(5) },
        highlight(books.ani),
      ])
    ).toEqual(["invalid", "invalid"])
    expect(await rowOf(entry.id)).toMatchObject({
      user_id: ids.ani,
      color: "yellow",
    })
    expect(await save(ani, [highlight(books.aniPending)])).toEqual(["invalid"])
  })

  it("skips a change for a book that is gone", async () => {
    const entry = highlight(randomUUID())
    expect(await save(ani, [entry])).toEqual(["ok"])
    expect(await rowOf(entry.id)).toBeNull()
  })

  it("refuses a bad entry alone and keeps the rest of the batch", async () => {
    const good = highlight(books.ani)
    expect(
      await save(ani, [
        good,
        highlight(books.ani, { note: "x".repeat(2001) }),
        bookmark(books.ani, { color: "yellow" }),
        bookmark(books.ani, { note: "Catatan" }),
      ])
    ).toEqual(["ok", "invalid", "invalid", "invalid"])
    expect(await rowOf(good.id)).not.toBeNull()
  })

  it("refuses more than 50 entries at once", async () => {
    const entries = Array.from({ length: 51 }, () => bookmark(books.ani))
    const { error } = await ani.rpc("save_annotations", {
      p_entries: entries,
    })
    expect(error?.message).toBe("invalid")
  })

  it("stops at 10,000 active annotations; tombstones do not count", async () => {
    const cita = await signedInClient(emails.cita)
    const rows = Array.from({ length: 9999 }, () => ({
      ...bookmark(books.cita),
      user_id: ids.cita,
    }))
    for (let i = 0; i < rows.length; i += 2500) {
      const { error } = await adminClient()
        .from("annotations")
        .insert(rows.slice(i, i + 2500))
      expect(error).toBeNull()
    }

    const last = bookmark(books.cita)
    expect(await save(cita, [last])).toEqual(["ok"])
    expect(await save(cita, [bookmark(books.cita)])).toEqual(["limit_reached"])
    // A change to one already there is still fine.
    expect(
      await save(cita, [{ ...last, excerpt: "Lagi", updated_at: at(1) }])
    ).toEqual(["ok"])

    expect(
      await save(cita, [{ ...last, deleted_at: at(2), updated_at: at(2) }])
    ).toEqual(["ok"])
    expect(await save(cita, [bookmark(books.cita)])).toEqual(["ok"])
  })

  it("leaves with the book and with the account", async () => {
    const dedi = await signedInClient(emails.dedi)
    const firstBook = await newTestBook(ids.dedi)
    const secondBook = await newTestBook(ids.dedi)
    const first = highlight(firstBook)
    const second = highlight(secondBook)
    expect(await save(dedi, [first, second])).toEqual(["ok", "ok"])

    const removed = await adminClient()
      .from("books")
      .delete()
      .eq("id", firstBook)
    expect(removed.error).toBeNull()
    expect(await rowOf(first.id)).toBeNull()
    expect(await rowOf(second.id)).not.toBeNull()

    const { error } = await adminClient().auth.admin.deleteUser(ids.dedi)
    expect(error).toBeNull()
    forgetTestMember(ids.dedi)
    expect(await rowOf(second.id)).toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run --config vitest.db.config.ts tests/db/annotations.test.ts`
Expected: FAIL. `save_annotations` belum ada (`Could not find the function public.save_annotations`).

- [ ] **Step 3: Tulis migrasi**

Buat `supabase/migrations/20261024000400_annotations.sql`:

```sql
-- Annotations (spec 2 §4.3): highlights and bookmarks. The id is made on the
-- device, so a change made offline keeps its identity on the way. Members
-- read their own rows, tombstones included; every write goes through
-- save_annotations, where the newest change wins.
create table public.annotations (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Annotations mean nothing without their book (spec 2 §2, decision 8).
  book_id uuid not null references public.books (id) on delete cascade,
  kind text not null check (kind in ('highlight', 'bookmark')),
  cfi text not null check (char_length(cfi) between 1 and 2000),
  color text check (color in ('yellow', 'green', 'blue', 'pink')),
  note text not null default '' check (char_length(note) <= 2000),
  excerpt text not null default '' check (char_length(excerpt) <= 1000),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  -- A deletion stays as a tombstone, so it reaches devices that were offline.
  deleted_at timestamptz,
  -- A highlight has a colour and may have a note; a bookmark has neither.
  check ((kind = 'highlight') = (color is not null)),
  check (kind = 'highlight' or note = '')
);

create index annotations_user_book_idx on public.annotations (user_id, book_id);
create index annotations_book_id_idx on public.annotations (book_id);
create index annotations_deleted_at_idx on public.annotations (deleted_at)
  where deleted_at is not null;

alter table public.annotations enable row level security;

create policy annotations_select_own on public.annotations
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.annotations from anon, authenticated;
grant select on table public.annotations to authenticated;

-- Stores a batch of changes from a device's queue (at most 50) and answers
-- each one, in order: 'ok', 'limit_reached' or 'invalid'. A change is kept
-- only when it is newer than the stored one ("newest wins", by the device's
-- clock); a time from the future is clamped to now(), as in save_progress.
-- An older change, or one for a book deleted in the meantime, has nothing to
-- do and is 'ok'. Another member's id or book, a book not ready, and values
-- the table refuses are 'invalid', for that change alone, so one bad change
-- cannot hold up the queue behind it. At most 10,000 active annotations per
-- member: the profile row is locked so two batches cannot both pass it.
create function public.save_annotations(p_entries jsonb)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_results text[] := '{}';
  v_entry jsonb;
  v_id uuid;
  v_book_id uuid;
  v_updated_at timestamptz;
  v_deleted_at timestamptz;
  v_existing public.annotations;
  v_exists boolean;
  v_owner uuid;
  v_status text;
  v_active integer;
  v_delta integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array'
    or jsonb_array_length(p_entries) > 50 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  perform 1 from public.profiles pr where pr.id = v_user_id for update;
  if not found then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select count(*) into v_active
  from public.annotations a
  where a.user_id = v_user_id and a.deleted_at is null;

  for v_entry in
    select e.value
    from jsonb_array_elements(p_entries) with ordinality as e (value, n)
    order by e.n
  loop
    begin
      if v_entry ->> 'id' is null
        or v_entry ->> 'book_id' is null
        or v_entry ->> 'updated_at' is null then
        raise exception 'invalid' using errcode = '22023';
      end if;
      v_id := (v_entry ->> 'id')::uuid;
      v_book_id := (v_entry ->> 'book_id')::uuid;
      v_updated_at := least((v_entry ->> 'updated_at')::timestamptz, now());
      -- least() skips nulls, so a missing deletion is kept apart.
      v_deleted_at := case
        when v_entry ->> 'deleted_at' is null then null
        else least((v_entry ->> 'deleted_at')::timestamptz, now())
      end;

      select * into v_existing from public.annotations a where a.id = v_id;
      v_exists := found;
      if v_exists and v_existing.user_id <> v_user_id then
        v_results := v_results || 'invalid'::text;
        continue;
      end if;
      if v_exists and v_existing.updated_at >= v_updated_at then
        v_results := v_results || 'ok'::text;
        continue;
      end if;

      select b.user_id, b.status into v_owner, v_status
      from public.books b
      where b.id = v_book_id;
      if not found then
        -- The book went in the meantime, and its annotations with it.
        v_results := v_results || 'ok'::text;
        continue;
      end if;
      if v_owner <> v_user_id
        or v_status <> 'ready'
        or (v_exists and v_existing.book_id <> v_book_id) then
        v_results := v_results || 'invalid'::text;
        continue;
      end if;

      v_delta := case
        when v_deleted_at is null
          and (not v_exists or v_existing.deleted_at is not null) then 1
        when v_deleted_at is not null
          and v_exists and v_existing.deleted_at is null then -1
        else 0
      end;
      if v_delta > 0 and v_active >= 10000 then
        v_results := v_results || 'limit_reached'::text;
        continue;
      end if;

      insert into public.annotations as an (
        id, user_id, book_id, kind, cfi, color, note, excerpt,
        created_at, updated_at, deleted_at
      ) values (
        v_id, v_user_id, v_book_id, v_entry ->> 'kind', v_entry ->> 'cfi',
        v_entry ->> 'color', coalesce(v_entry ->> 'note', ''),
        coalesce(v_entry ->> 'excerpt', ''),
        least(
          coalesce((v_entry ->> 'created_at')::timestamptz, v_updated_at),
          now()
        ),
        v_updated_at, v_deleted_at
      )
      on conflict (id) do update
        set color = excluded.color,
            note = excluded.note,
            excerpt = excluded.excerpt,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at
        where an.user_id = excluded.user_id
          and an.updated_at < excluded.updated_at;
      -- Counted only once the row is in: a refused insert changes nothing.
      v_active := v_active + v_delta;
      v_results := v_results || 'ok'::text;
    exception
      when data_exception or integrity_constraint_violation then
        v_results := v_results || 'invalid'::text;
    end;
  end loop;
  return v_results;
end;
$$;

revoke execute on function public.save_annotations(jsonb) from public, anon;
grant execute on function public.save_annotations(jsonb) to authenticated;
```

- [ ] **Step 4: Push migrasi dan buat ulang tipe**

Run:
```bash
npm run db:push
npm run db:types
npx prettier --write src/server/database.types.ts
```
Expected: `Applying migration 20261024000400_annotations.sql...` lalu `Finished supabase db push.` `database.types.ts` kini memuat tabel `annotations` dan `save_annotations: { Args: { p_entries: Json }; Returns: string[] }`.

Kalau migrasi harus diubah setelah di-push: buang fungsi dan tabelnya lewat CLI (`npx supabase db query --linked "drop function public.save_annotations(jsonb); drop table public.annotations;"`), lalu `npx supabase migration repair --status reverted 20261024000400 --linked`, edit, dan push lagi. Kalau itu tidak berhasil, berhenti dan laporkan.

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `npx vitest run --config vitest.db.config.ts tests/db/annotations.test.ts`
Expected: PASS, 10 test.

- [ ] **Step 6: Typecheck dan commit**

Run: `npm run typecheck`
Expected: tanpa error.

```bash
git add supabase/migrations/20261024000400_annotations.sql src/server/database.types.ts tests/db/annotations.test.ts
git commit -m "feat(db): annotations with save_annotations, newest change wins

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Sapuan tombstone

**Files:**
- Create: `src/server/sweep/tombstones.ts`
- Modify: `src/server/sweep/main.ts`
- Modify: `tests/db/sweep.test.ts`

**Interfaces:**
- Consumes: tabel `annotations` (Task 1), klien admin `SupabaseClient<Database>`.
- Produces:
  - `TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000`
  - `purgeTombstones(options: { admin: SupabaseClient<Database>; now?: number; dryRun?: boolean; onlyUserIds?: ReadonlyArray<string> }): Promise<number>`: menghapus anotasi dengan `deleted_at` lebih tua dari 30 hari dan mengembalikan jumlahnya. Dry run hanya menghitung.

- [ ] **Step 1: Tulis test yang gagal**

Di `tests/db/sweep.test.ts`, tambahkan import:

```ts
import { purgeTombstones } from "@/server/sweep/tombstones"
```

dan tambahkan `newTestBook` ke import dari `./helpers`. Lalu tambahkan di akhir file:

```ts
describe("purgeTombstones (limited to a test member)", () => {
  const DAY = 24 * HOUR
  let member = ""
  const ids = { old: randomUUID(), recent: randomUUID(), active: randomUUID() }

  async function exists(id: string) {
    const { data, error } = await adminClient()
      .from("annotations")
      .select("id")
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    return data !== null
  }

  beforeAll(async () => {
    member = (
      await createTestMember({ email: `db-sweep-notes-${run}@glosa.test` })
    ).id
    const bookId = await newTestBook(member)
    const long = new Date(Date.now() - 40 * DAY).toISOString()
    const row = (id: string, deletedAt: string | null) => ({
      id,
      user_id: member,
      book_id: bookId,
      kind: "bookmark",
      cfi: "epubcfi(/6/4!/4/2/1:0)",
      color: null,
      created_at: long,
      updated_at: deletedAt ?? long,
      deleted_at: deletedAt,
    })
    const { error } = await adminClient()
      .from("annotations")
      .insert([
        row(ids.old, new Date(Date.now() - 31 * DAY).toISOString()),
        row(ids.recent, new Date(Date.now() - DAY).toISOString()),
        row(ids.active, null),
      ])
    if (error) throw error
  })

  afterAll(async () => {
    await deleteTestMembers()
  })

  it("only counts in a dry run", async () => {
    const count = await purgeTombstones({
      admin: adminClient(),
      onlyUserIds: [member],
      dryRun: true,
    })
    expect(count).toBe(1)
    expect(await exists(ids.old)).toBe(true)
  })

  it("removes tombstones older than 30 days and nothing else", async () => {
    const count = await purgeTombstones({
      admin: adminClient(),
      onlyUserIds: [member],
    })
    expect(count).toBe(1)
    expect(await exists(ids.old)).toBe(false)
    expect(await exists(ids.recent)).toBe(true)
    expect(await exists(ids.active)).toBe(true)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run --config vitest.db.config.ts tests/db/sweep.test.ts`
Expected: FAIL, `Cannot find module '@/server/sweep/tombstones'`.

- [ ] **Step 3: Tulis `purgeTombstones`**

Buat `src/server/sweep/tombstones.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/server/database.types"

/** A deleted annotation stays this long for devices that were offline (spec 2 §4.3). */
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Removes annotations deleted more than 30 days ago and returns how many; a
 * dry run only counts them. A device offline for longer reads the book's list
 * afresh and drops what is gone from it.
 */
export async function purgeTombstones(options: {
  admin: SupabaseClient<Database>
  now?: number
  dryRun?: boolean
  /** Limits the round to these members (integration tests). */
  onlyUserIds?: ReadonlyArray<string>
}): Promise<number> {
  const { admin, dryRun = false } = options
  const cutoff = new Date(
    (options.now ?? Date.now()) - TOMBSTONE_TTL_MS
  ).toISOString()
  const only = options.onlyUserIds ? [...options.onlyUserIds] : null

  if (dryRun) {
    const query = admin
      .from("annotations")
      .select("id", { count: "exact", head: true })
      .lt("deleted_at", cutoff)
    const { count, error } = await (only ? query.in("user_id", only) : query)
    if (error) throw error
    return count ?? 0
  }
  const query = admin
    .from("annotations")
    .delete({ count: "exact" })
    .lt("deleted_at", cutoff)
  const { count, error } = await (only ? query.in("user_id", only) : query)
  if (error) throw error
  return count ?? 0
}
```

- [ ] **Step 4: Jalankan di ronde sapuan**

Di `src/server/sweep/main.ts`, tambahkan import:

```ts
import { purgeTombstones } from "./tombstones"
```

lalu ganti bagian blok `try` di `main()` dari `const result = await runSweep({` sampai `return 0` dengan:

```ts
    const dryRun = process.env.SWEEP_DRY_RUN === "1"
    const result = await runSweep({ admin, dryRun, limits: limitsFromEnv() })
    const summary = summarize(result)
    if (result.status === "too_many") {
      console.log(JSON.stringify({ sweep: summary, plan: result.plan }))
      logServerError(
        "sweep stopped: too many deletions",
        new Error(
          `sweep would delete ${summary.objects} objects and ${summary.users} accounts`
        )
      )
      return 1
    }
    // Deleted annotations are already gone for the member: the round's limits do not apply.
    const tombstones = await purgeTombstones({ admin, dryRun })
    console.log(
      JSON.stringify({ sweep: summary, plan: result.plan, tombstones })
    )
    await sendHeartbeat(
      `${summary.status}: ${summary.books} books, ${summary.objects} objects, ${summary.users} accounts, ${tombstones} tombstones`
    )
    return 0
```

(`const admin = createClient<Database>(…)` di atasnya tetap seperti sekarang.)

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `npx vitest run --config vitest.db.config.ts tests/db/sweep.test.ts`
Expected: PASS, termasuk dua test baru.

- [ ] **Step 6: Typecheck, lint, dan commit**

Run: `npm run typecheck && npm run lint`
Expected: tanpa error.

```bash
git add src/server/sweep/tombstones.ts src/server/sweep/main.ts tests/db/sweep.test.ts
git commit -m "feat(sweep): tombstones older than 30 days leave the database

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tipe, skema, perubahan, dan server function anotasi

**Files:**
- Create: `src/lib/stored-text.ts`
- Modify: `src/lib/words/schemas.ts`
- Create: `src/lib/annotations/types.ts`
- Create: `src/lib/annotations/schemas.ts`
- Create: `src/lib/annotations/changes.ts`
- Create: `src/server/annotations.ts`
- Test: `src/lib/annotations/schemas.test.ts`, `src/lib/annotations/changes.test.ts`

**Interfaces:**
- Consumes: `MAX_CFI_LENGTH` (`src/lib/progress.ts`), RPC `save_annotations` dan tabel `annotations` (Task 1), `logServerError`, `getSupabaseServerClient`.
- Produces:
  - `StoredText` (zod string tanpa NUL).
  - `HIGHLIGHT_COLORS`, `HighlightColor`, `ANNOTATION_KINDS`, `AnnotationKind`, `MAX_NOTE_LENGTH = 2000`, `MAX_EXCERPT_LENGTH = 1000`, `MAX_ANNOTATION_BATCH = 50`.
  - `Annotation = { id; bookId; kind; cfi; color: HighlightColor | null; note: string; excerpt: string; createdAt; updatedAt; deletedAt: string | null }` (semua stempel ISO).
  - `AnnotationResult = "ok" | "limit_reached" | "invalid"`, `AnnotationSyncAnswer`, `AnnotationsAnswer`.
  - `AnnotationSchema`, `AnnotationSyncSchema`, `BookAnnotationsSchema`, `isValidAnnotation(annotation: Annotation): boolean`.
  - `stamp(): string`, `excerptOf(text: string, max?: number): string`, `BOOKMARK_EXCERPT_LENGTH = 200`, `newHighlight({ bookId, cfi, text }, color?)`, `newBookmark({ bookId, cfi, text })`, `edited(annotation, changes: { color?: HighlightColor; note?: string })`, `deleted(annotation)`.
  - `syncAnnotationsFn({ data: { entries: Array<Annotation> } }): Promise<AnnotationSyncAnswer>`, `listAnnotationsFn({ data: { bookId } }): Promise<AnnotationsAnswer>` (semua anotasi buku, tombstone juga, stempel dinormalisasi `toISOString()`).

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/annotations/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { AnnotationSyncSchema, isValidAnnotation } from "./schemas"
import type { Annotation } from "./types"

const highlight: Annotation = {
  id: "8b1f7c2e-4a5d-4c3b-9e2f-1a2b3c4d5e6f",
  bookId: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  kind: "highlight",
  cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  color: "yellow",
  note: "",
  excerpt: "To Sherlock Holmes",
  createdAt: "2026-10-24T08:00:00.000Z",
  updatedAt: "2026-10-24T08:00:00.000Z",
  deletedAt: null,
}
const bookmark: Annotation = {
  ...highlight,
  kind: "bookmark",
  cfi: "epubcfi(/6/4!/4/2/1:0)",
  color: null,
}

describe("isValidAnnotation", () => {
  it("takes a highlight and a bookmark as the table does", () => {
    expect(isValidAnnotation(highlight)).toBe(true)
    expect(isValidAnnotation(bookmark)).toBe(true)
    expect(
      isValidAnnotation({ ...highlight, deletedAt: highlight.updatedAt })
    ).toBe(true)
  })

  it("refuses what the table would refuse", () => {
    expect(isValidAnnotation({ ...highlight, color: null })).toBe(false)
    expect(isValidAnnotation({ ...bookmark, color: "blue" })).toBe(false)
    expect(isValidAnnotation({ ...bookmark, note: "Catatan" })).toBe(false)
    expect(isValidAnnotation({ ...highlight, note: "x".repeat(2001) })).toBe(
      false
    )
    expect(
      isValidAnnotation({ ...highlight, excerpt: "x".repeat(1001) })
    ).toBe(false)
    expect(isValidAnnotation({ ...highlight, cfi: "" })).toBe(false)
    expect(isValidAnnotation({ ...highlight, note: "a\u0000b" })).toBe(false)
    expect(isValidAnnotation({ ...highlight, id: "not-a-uuid" })).toBe(false)
  })
})

describe("AnnotationSyncSchema", () => {
  it("takes 1 to 50 entries", () => {
    expect(AnnotationSyncSchema.safeParse({ entries: [] }).success).toBe(false)
    expect(
      AnnotationSyncSchema.safeParse({
        entries: Array.from({ length: 50 }, () => highlight),
      }).success
    ).toBe(true)
    expect(
      AnnotationSyncSchema.safeParse({
        entries: Array.from({ length: 51 }, () => highlight),
      }).success
    ).toBe(false)
  })
})
```

Buat `src/lib/annotations/changes.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  deleted,
  edited,
  excerptOf,
  newBookmark,
  newHighlight,
  stamp,
} from "./changes"
import { isValidAnnotation } from "./schemas"

const BOOK = "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e"

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-24T08:00:00.000Z"))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("stamp", () => {
  it("never gives the same time twice", () => {
    const first = stamp()
    const second = stamp()
    expect(Date.parse(second)).toBeGreaterThan(Date.parse(first))
  })
})

describe("excerptOf", () => {
  it("keeps the text on one line, without control characters", () => {
    expect(excerptOf("  To  Sherlock\n\tHolmes\u0007 ")).toBe(
      "To Sherlock Holmes"
    )
  })

  it("cuts a long text with an ellipsis, inside the limit", () => {
    const cut = excerptOf("word ".repeat(400), 20)
    expect(cut.length).toBeLessThanOrEqual(20)
    expect(cut.endsWith("…")).toBe(true)
  })

  it("does not leave half of an emoji behind", () => {
    const cut = excerptOf(`${"a".repeat(18)}😀😀`, 20)
    expect(cut.isWellFormed()).toBe(true)
  })
})

describe("annotation changes", () => {
  it("makes a valid yellow highlight from a selection", () => {
    const highlight = newHighlight({
      bookId: BOOK,
      cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
      text: " To Sherlock ",
    })
    expect(highlight).toMatchObject({
      bookId: BOOK,
      kind: "highlight",
      color: "yellow",
      note: "",
      excerpt: "To Sherlock",
      deletedAt: null,
    })
    expect(highlight.createdAt).toBe(highlight.updatedAt)
    expect(isValidAnnotation(highlight)).toBe(true)
  })

  it("makes a valid bookmark with the start of the page as its excerpt", () => {
    const bookmark = newBookmark({
      bookId: BOOK,
      cfi: "epubcfi(/6/4!/4/2/1:0)",
      text: "x".repeat(500),
    })
    expect(bookmark).toMatchObject({ kind: "bookmark", color: null, note: "" })
    expect(bookmark.excerpt.length).toBeLessThanOrEqual(200)
    expect(isValidAnnotation(bookmark)).toBe(true)
  })

  it("stamps every change, and an empty note is no note", () => {
    const highlight = newHighlight({ bookId: BOOK, cfi: "epubcfi(/6/4)", text: "a" })
    const green = edited(highlight, { color: "green" })
    expect(green.color).toBe("green")
    expect(Date.parse(green.updatedAt)).toBeGreaterThan(
      Date.parse(highlight.updatedAt)
    )
    expect(edited(green, { note: "  Penting  " }).note).toBe("Penting")
    expect(edited(green, { note: "   " }).note).toBe("")

    const gone = deleted(green)
    expect(gone.deletedAt).toBe(gone.updatedAt)
    expect(Date.parse(gone.updatedAt)).toBeGreaterThan(
      Date.parse(green.updatedAt)
    )
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/annotations`
Expected: FAIL, `Cannot find module './schemas'` dan `'./changes'`.

- [ ] **Step 3: Teks yang bisa disimpan Postgres, dipakai bersama**

Buat `src/lib/stored-text.ts`:

```ts
import { z } from "zod"

/** Text Postgres can store: a text value cannot hold NUL. */
export const StoredText = z
  .string()
  .refine((text) => !text.includes("\u0000"), { message: "NUL" })
```

Di `src/lib/words/schemas.ts`, ganti

```ts
/** Text Postgres can store: a text value cannot hold NUL. */
const Text = z.string().refine((text) => !text.includes("\u0000"), {
  message: "NUL",
})
```

dengan

```ts
const Text = StoredText
```

dan tambahkan `import { StoredText } from "@/lib/stored-text"` di bawah import `MAX_CFI_LENGTH`.

- [ ] **Step 4: Tipe dan skema anotasi**

Buat `src/lib/annotations/types.ts`:

```ts
/** Highlight colours (spec 2 §4.3); a bookmark has none. */
export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

export const ANNOTATION_KINDS = ["highlight", "bookmark"] as const
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number]

export const MAX_NOTE_LENGTH = 2000
export const MAX_EXCERPT_LENGTH = 1000
/** Changes sent in one request (spec 2 §4.3). */
export const MAX_ANNOTATION_BATCH = 50

/**
 * A highlight or a bookmark (spec 2 §4.3), as the server and this device keep
 * it. The id is made on the device. A deletion is a tombstone: `deletedAt`
 * set, so it reaches the member's other devices too.
 */
export type Annotation = {
  id: string
  bookId: string
  kind: AnnotationKind
  /** A range for a highlight, a point for a bookmark. */
  cfi: string
  color: HighlightColor | null
  /** Empty when there is no note; only highlights have one. */
  note: string
  /** The text, for the panel. */
  excerpt: string
  createdAt: string
  /** The device's clock at the last change: the newest change wins. */
  updatedAt: string
  deletedAt: string | null
}

export type AnnotationResult = "ok" | "limit_reached" | "invalid"

type Failed = { ok: false; code: string }
export type AnnotationSyncAnswer =
  { ok: true; results: Array<AnnotationResult> } | Failed
export type AnnotationsAnswer =
  { ok: true; annotations: Array<Annotation> } | Failed
```

Buat `src/lib/annotations/schemas.ts`:

```ts
import { z } from "zod"
import { MAX_CFI_LENGTH } from "@/lib/progress"
import { StoredText } from "@/lib/stored-text"
import {
  ANNOTATION_KINDS,
  type Annotation,
  HIGHLIGHT_COLORS,
  MAX_ANNOTATION_BATCH,
  MAX_EXCERPT_LENGTH,
  MAX_NOTE_LENGTH,
} from "./types"

const Stamp = z.iso.datetime({ offset: true })

export const AnnotationSchema = z
  .object({
    id: z.uuid(),
    bookId: z.uuid(),
    kind: z.enum(ANNOTATION_KINDS),
    cfi: StoredText.min(1).max(MAX_CFI_LENGTH),
    color: z.enum(HIGHLIGHT_COLORS).nullable(),
    note: StoredText.max(MAX_NOTE_LENGTH),
    excerpt: StoredText.max(MAX_EXCERPT_LENGTH),
    createdAt: Stamp,
    updatedAt: Stamp,
    deletedAt: Stamp.nullable(),
  })
  // The table's own rules: a highlight has a colour, only a highlight has a note.
  .refine((entry) => (entry.kind === "highlight") === (entry.color !== null), {
    message: "color",
  })
  .refine((entry) => entry.kind === "highlight" || entry.note === "", {
    message: "note",
  })

export const AnnotationSyncSchema = z.object({
  entries: z.array(AnnotationSchema).min(1).max(MAX_ANNOTATION_BATCH),
})

export const BookAnnotationsSchema = z.object({ bookId: z.uuid() })

/**
 * Whether the server will take this change. One it would refuse never enters
 * the queue (plan 2B, decision 2).
 */
export function isValidAnnotation(annotation: Annotation): boolean {
  return AnnotationSchema.safeParse(annotation).success
}
```

- [ ] **Step 5: Perubahan anotasi**

Buat `src/lib/annotations/changes.ts`:

```ts
import {
  type Annotation,
  type HighlightColor,
  MAX_EXCERPT_LENGTH,
  MAX_NOTE_LENGTH,
} from "./types"

/** A bookmark's excerpt: the start of its page (plan 2B, decision 16). */
export const BOOKMARK_EXCERPT_LENGTH = 200

// Two changes within one millisecond still get different times, so a sent
// change is never mistaken for the one made after it.
let last = 0

/** Now, as an ISO time, later than any time this tab gave before. */
export function stamp(): string {
  last = Math.max(Date.now(), last + 1)
  return new Date(last).toISOString()
}

// eslint-disable-next-line no-control-regex -- control characters are the point
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/** Book text on one line, cut to `max` characters with an ellipsis. */
export function excerptOf(text: string, max = MAX_EXCERPT_LENGTH): string {
  const flat = text.replace(CONTROL, "").replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  // A cut between the two halves of an emoji would leave half of it behind.
  const cut = flat.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, "")
  return `${cut.trimEnd()}…`
}

type Place = { bookId: string; cfi: string; text: string }

export function newHighlight(
  { bookId, cfi, text }: Place,
  color: HighlightColor = "yellow"
): Annotation {
  const now = stamp()
  return {
    id: crypto.randomUUID(),
    bookId,
    kind: "highlight",
    cfi,
    color,
    note: "",
    excerpt: excerptOf(text),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}

export function newBookmark({ bookId, cfi, text }: Place): Annotation {
  const now = stamp()
  return {
    id: crypto.randomUUID(),
    bookId,
    kind: "bookmark",
    cfi,
    color: null,
    note: "",
    excerpt: excerptOf(text, BOOKMARK_EXCERPT_LENGTH),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}

/** A new colour or note. An empty note removes the note, not the highlight (spec 2 §6.6). */
export function edited(
  annotation: Annotation,
  changes: { color?: HighlightColor; note?: string }
): Annotation {
  return {
    ...annotation,
    color: changes.color ?? annotation.color,
    note:
      changes.note === undefined
        ? annotation.note
        : changes.note.trim().slice(0, MAX_NOTE_LENGTH),
    updatedAt: stamp(),
  }
}

/** The tombstone that deletes an annotation on every device. */
export function deleted(annotation: Annotation): Annotation {
  const now = stamp()
  return { ...annotation, updatedAt: now, deletedAt: now }
}
```

Catatan: kalau `npm run lint` tidak mengeluh soal `no-control-regex`, buang baris `eslint-disable-next-line` (lint menolak disable yang tidak terpakai).

- [ ] **Step 6: Jalankan test, pastikan lulus**

Run: `npx vitest run src/lib/annotations src/lib/words/schemas.test.ts`
Expected: PASS.

- [ ] **Step 7: Server function**

Buat `src/server/annotations.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import {
  AnnotationSyncSchema,
  BookAnnotationsSchema,
} from "@/lib/annotations/schemas"
import type {
  Annotation,
  AnnotationKind,
  AnnotationResult,
  AnnotationSyncAnswer,
  AnnotationsAnswer,
  HighlightColor,
} from "@/lib/annotations/types"
import type { Database } from "./database.types"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })
/** PostgREST answers at most this many rows at once. */
const PAGE = 1000

type AnnotationRow = Database["public"]["Tables"]["annotations"]["Row"]

/** Postgres writes times its own way; the device compares and sends ISO times. */
const iso = (time: string) => new Date(time).toISOString()

const toAnnotation = (row: AnnotationRow): Annotation => ({
  id: row.id,
  bookId: row.book_id,
  kind: row.kind as AnnotationKind,
  cfi: row.cfi,
  color: row.color as HighlightColor | null,
  note: row.note,
  excerpt: row.excerpt,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  deletedAt: row.deleted_at === null ? null : iso(row.deleted_at),
})

const toEntry = (annotation: Annotation) => ({
  id: annotation.id,
  book_id: annotation.bookId,
  kind: annotation.kind,
  cfi: annotation.cfi,
  color: annotation.color,
  note: annotation.note,
  excerpt: annotation.excerpt,
  created_at: annotation.createdAt,
  updated_at: annotation.updatedAt,
  deleted_at: annotation.deletedAt,
})

/**
 * Applies the annotation changes waiting on a device (spec 2 §4.3), with one
 * answer per change. save_annotations keeps the newest of each.
 */
export const syncAnnotationsFn = createServerFn({ method: "POST" })
  .validator((data: { entries: Array<Annotation> }) =>
    AnnotationSyncSchema.parse(data)
  )
  .handler(async ({ data }): Promise<AnnotationSyncAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data: results, error } = await supabase.rpc("save_annotations", {
      p_entries: data.entries.map(toEntry),
    })
    if (error) {
      if (error.message === "not_authenticated") {
        return fail("not_authenticated")
      }
      logServerError("save_annotations failed", error)
      return fail("unknown")
    }
    return { ok: true, results: results as Array<AnnotationResult> }
  })

/** Every annotation of a book, tombstones too, read a page at a time (spec 2 §4.3). */
export const listAnnotationsFn = createServerFn({ method: "GET" })
  .validator((data: { bookId: string }) => BookAnnotationsSchema.parse(data))
  .handler(async ({ data }): Promise<AnnotationsAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const annotations: Array<Annotation> = []
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await supabase
        .from("annotations")
        .select(
          "id, user_id, book_id, kind, cfi, color, note, excerpt, created_at, updated_at, deleted_at"
        )
        .eq("book_id", data.bookId)
        .order("id")
        .range(from, from + PAGE - 1)
      if (error) {
        logServerError("listing annotations failed", error)
        return fail("unknown")
      }
      annotations.push(...rows.map(toAnnotation))
      if (rows.length < PAGE) return { ok: true, annotations }
    }
  })
```

- [ ] **Step 8: Typecheck, lint, test, dan commit**

Run: `npm run typecheck && npm run lint && npx vitest run src/lib/annotations src/lib/words`
Expected: tanpa error, test PASS.

```bash
git add src/lib/stored-text.ts src/lib/words/schemas.ts src/lib/annotations src/server/annotations.ts
git commit -m "feat(annotations): types, schemas, changes and server functions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Mesin antrean bersama

**Files:**
- Create: `src/lib/sync/queue-sync.ts`
- Create: `src/lib/sync/use-queue-flush.ts`
- Modify: `src/lib/words/word-sync.ts`
- Modify: `src/lib/words/word-sync-client.ts`
- Test: `src/lib/sync/queue-sync.test.ts` (baru); `src/lib/words/word-sync.test.ts` dan `src/lib/words/word-sync-client.test.tsx` harus tetap lulus tanpa diubah.

**Interfaces:**
- Consumes: `claimLocalData(userId)` (`src/lib/local/device.ts`).
- Produces:
  - `QueueResult = "ok" | "limit_reached" | "invalid"`, `QueueAnswer = { ok: true; results: Array<QueueResult> } | { ok: false; code: string }`.
  - `QueueStore<T> = { pending(): Promise<Array<T>>; confirm(sent: ReadonlyArray<T>): Promise<void>; revert(item: T): Promise<void> }`.
  - `Refused<T> = { item: T; result: "limit_reached" | "invalid" }`.
  - `createQueueSync<T>(options: { store; send(batch: Array<T>): Promise<QueueAnswer>; isOnline(): boolean; keyOf(item: T): string; batchSize: number; onRefused(refused: Array<Refused<T>>): void; onSynced?(): Promise<void>; debounceMs?: number }): QueueSync`.
  - `QueueSync = { flush(): Promise<void>; later(): void; changed(): void; version(): number; subscribe(listener): () => void; dispose(): void }`.
  - `useQueueFlush(userId: string, flush: () => Promise<void>): void` (`flush` harus fungsi tingkat modul).
  - API `createWordSync`, `wordSync`, `useWordFlush` tidak berubah.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/sync/queue-sync.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  type QueueAnswer,
  type QueueStore,
  type Refused,
  createQueueSync,
} from "./queue-sync"

type Item = { key: string; stamp: number }

/** A queue in memory: one item per key, the latest wins. */
function memoryStore() {
  const items = new Map<string, Item>()
  const reverted: Array<Item> = []
  const store: QueueStore<Item> = {
    pending: async () => [...items.values()].sort((a, b) => a.stamp - b.stamp),
    confirm: async (sent) => {
      for (const item of sent) {
        if (items.get(item.key)?.stamp === item.stamp) items.delete(item.key)
      }
    },
    revert: async (item) => {
      reverted.push(item)
    },
  }
  return { items, reverted, store }
}

const allOk = async (batch: Array<Item>): Promise<QueueAnswer> => ({
  ok: true,
  results: batch.map(() => "ok"),
})

function queueOf(
  store: QueueStore<Item>,
  send: (batch: Array<Item>) => Promise<QueueAnswer>,
  onRefused: (refused: Array<Refused<Item>>) => void = () => undefined
) {
  return createQueueSync<Item>({
    store,
    send,
    isOnline: () => true,
    keyOf: (item) => item.key,
    batchSize: 2,
    onRefused,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createQueueSync", () => {
  it("sends two seconds after the last change, in batches", async () => {
    const { items, store } = memoryStore()
    const send = vi.fn(allOk)
    const queue = queueOf(store, send)
    for (const [index, key] of ["a", "b", "c"].entries()) {
      items.set(key, { key, stamp: index })
    }

    queue.later()
    await vi.advanceTimersByTimeAsync(1_999)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(send.mock.calls.map(([batch]) => batch.map((i) => i.key))).toEqual([
      ["a", "b"],
      ["c"],
    ])
    expect(items.size).toBe(0)
  })

  it("takes back a refused item and reports it, unless it changed again in flight", async () => {
    const { items, reverted, store } = memoryStore()
    const onRefused = vi.fn()
    items.set("a", { key: "a", stamp: 1 })
    items.set("b", { key: "b", stamp: 2 })
    const queue = queueOf(
      store,
      async (batch) => {
        // "b" changes again while the batch is on its way.
        items.set("b", { key: "b", stamp: 3 })
        return { ok: true, results: batch.map(() => "limit_reached") }
      },
      onRefused
    )

    await queue.flush()
    expect(reverted.map((item) => item.key)).toEqual(["a", "b"])
    expect(onRefused).toHaveBeenCalledWith([
      { item: { key: "a", stamp: 1 }, result: "limit_reached" },
    ])
  })

  it("keeps everything for the next try when sending fails or the device is offline", async () => {
    const { items, store } = memoryStore()
    items.set("a", { key: "a", stamp: 1 })
    const failing = queueOf(store, async () => ({ ok: false, code: "unknown" }))
    await failing.flush()
    expect(items.size).toBe(1)

    const send = vi.fn(allOk)
    const offline = createQueueSync<Item>({
      store,
      send,
      isOnline: () => false,
      keyOf: (item) => item.key,
      batchSize: 2,
      onRefused: () => undefined,
    })
    await offline.flush()
    expect(send).not.toHaveBeenCalled()
  })

  it("tells listeners about changes", () => {
    const { store } = memoryStore()
    const queue = queueOf(store, allOk)
    const listener = vi.fn()
    const stop = queue.subscribe(listener)
    queue.changed()
    expect(queue.version()).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    queue.changed()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/sync`
Expected: FAIL, `Cannot find module './queue-sync'`.

- [ ] **Step 3: Pindahkan mesin antrean**

Buat `src/lib/sync/queue-sync.ts`:

```ts
export type QueueResult = "ok" | "limit_reached" | "invalid"

export type QueueAnswer =
  { ok: true; results: Array<QueueResult> } | { ok: false; code: string }

/** Where the waiting changes live (IndexedDB in the browser). */
export type QueueStore<T> = {
  /** Oldest first. */
  pending: () => Promise<Array<T>>
  /** Drops sent changes, unless they changed again since. */
  confirm: (sent: ReadonlyArray<T>) => Promise<void>
  /** Takes back a change the server refused, unless it changed again since. */
  revert: (item: T) => Promise<void>
}

export type Refused<T> = { item: T; result: Exclude<QueueResult, "ok"> }

export type QueueSync = {
  /** Sends every waiting change now. Never rejects. */
  flush: () => Promise<void>
  /** Sends the waiting changes after the pause. */
  later: () => void
  /** Tells the listeners something on this device changed. */
  changed: () => void
  /** Grows on every change, so views read the device's copy again. */
  version: () => number
  subscribe: (listener: () => void) => () => void
  dispose: () => void
}

/**
 * A queue of changes made on this device (spec 2 §7): sent `debounceMs`
 * after the last change, in batches, with one answer per change. A change the
 * server refuses is taken back, and reported unless it changed again while
 * the batch was on its way.
 */
export function createQueueSync<T>(options: {
  store: QueueStore<T>
  send: (batch: Array<T>) => Promise<QueueAnswer>
  isOnline: () => boolean
  /** Which item a later change replaces. */
  keyOf: (item: T) => string
  batchSize: number
  onRefused: (refused: Array<Refused<T>>) => void
  /** After the server took changes. */
  onSynced?: () => Promise<void>
  debounceMs?: number
}): QueueSync {
  const { store, send, isOnline, keyOf, batchSize } = options
  const debounceMs = options.debounceMs ?? 2_000
  const listeners = new Set<() => void>()
  let version = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let running: Promise<void> | null = null
  let again = false

  function changed() {
    version += 1
    for (const listener of listeners) listener()
  }

  function later() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, debounceMs)
  }

  /** Sends the waiting changes until a batch fails; the next trigger retries. */
  async function sendWaiting() {
    if (!isOnline()) return
    const waiting = await store.pending()
    let delivered = false
    try {
      for (let i = 0; i < waiting.length; i += batchSize) {
        const batch = waiting.slice(i, i + batchSize)
        let answer: QueueAnswer
        try {
          answer = await send(batch)
        } catch {
          return
        }
        if (!answer.ok) return
        await store.confirm(batch)
        delivered = true
        const refused: Array<Refused<T>> = []
        for (const [index, result] of answer.results.entries()) {
          if (result === "ok") continue
          const item = batch[index]
          await store.revert(item)
          refused.push({ item, result })
        }
        if (refused.length > 0) {
          // A change made again while the batch was in flight is not refused news.
          const queued = new Set((await store.pending()).map(keyOf))
          const news = refused.filter(({ item }) => !queued.has(keyOf(item)))
          if (news.length > 0) options.onRefused(news)
        }
      }
    } finally {
      if (delivered) await options.onSynced?.()
    }
  }

  function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      try {
        do {
          again = false
          try {
            await sendWaiting()
          } catch {
            // A storage error: the changes stay queued for the next trigger.
          }
          // again is set by a flush() made while the loop awaits; TS cannot see it.
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        } while (again)
      } finally {
        running = null
      }
    })()
    return running
  }

  return {
    flush,
    later,
    changed,
    version: () => version,
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

- [ ] **Step 4: `createWordSync` di atas mesin bersama**

Di `src/lib/words/word-sync.ts`:

1. Biarkan import dari `./types` dan `./schemas`, lalu tambahkan:

```ts
import { type QueueStore, createQueueSync } from "@/lib/sync/queue-sync"
```

2. Ganti tipe `WordStore` dengan:

```ts
/** Where Kosakata and its waiting changes live (IndexedDB in the browser). */
export type WordStore = QueueStore<QueuedWordOp> & {
  /** Shows the word at once and queues its save; `forms` underline it until the server's arrive. */
  save: (word: SavedWord, forms: Array<string>) => Promise<void>
  /** Hides the word at once and queues its deletion. */
  remove: (headword: string) => Promise<void>
}
```

3. Ganti seluruh fungsi `createWordSync` (dari komentar di atasnya sampai `}` penutupnya) dengan:

```ts
/**
 * Saves and deletions of words (spec 2 §7): shown on this device at once,
 * then sent two seconds after the last change, in batches of 50. A change the
 * server refuses is taken back, and its reason kept for the page to show.
 */
export function createWordSync(options: {
  store: WordStore
  send: SendWords
  isOnline: () => boolean
  /** After the server took changes: fetch the saved words' forms again. */
  onSynced?: () => Promise<void>
  debounceMs?: number
}): WordSync {
  const { store } = options
  let rejection: WordRejection | null = null
  const queue = createQueueSync<QueuedWordOp>({
    store,
    send: (batch) => options.send(batch.map(toWordOp)),
    isOnline: options.isOnline,
    keyOf: (op) => op.headword,
    batchSize: MAX_WORD_OPS,
    onRefused: (refused) => {
      for (const { item, result } of refused) {
        refuse(
          result === "limit_reached" ? "words_full" : "word_invalid",
          item.headword
        )
      }
    },
    onSynced: options.onSynced,
    debounceMs: options.debounceMs,
  })

  function refuse(code: WordRejection["code"], headword: string) {
    rejection = { code, headword }
    queue.changed()
  }

  return {
    async save(word, forms) {
      const op: QueuedWordOp = {
        headword: word.headword,
        kind: "save",
        word,
        queuedAt: 0,
      }
      if (!isValidWordOp(toWordOp(op))) {
        refuse("word_invalid", word.headword)
        return
      }
      await store.save(word, forms)
      queue.changed()
      queue.later()
    },
    async remove(headword) {
      await store.remove(headword)
      queue.changed()
      queue.later()
    },
    flush: queue.flush,
    version: queue.version,
    notify: queue.changed,
    rejection: () => rejection,
    dismissRejection() {
      if (!rejection) return
      rejection = null
      queue.changed()
    },
    subscribe: queue.subscribe,
    dispose: queue.dispose,
  }
}
```

4. Hapus import `type WordSyncAnswer` bila sekarang tidak terpakai selain di `SendWords` (biarkan bila `SendWords` masih memakainya).

- [ ] **Step 5: `useQueueFlush`**

Buat `src/lib/sync/use-queue-flush.ts`:

```ts
import { useEffect } from "react"
import { claimLocalData } from "@/lib/local/device"

/**
 * Sends a queue's waiting changes when the app opens and when the connection
 * comes back (spec 2 §7). It waits for this device to be the member's first:
 * otherwise the previous member's queue could be sent under the new session.
 * `flush` must keep the same identity (a module-level function).
 */
export function useQueueFlush(
  userId: string,
  flush: () => Promise<void>
): void {
  useEffect(() => {
    let live = true
    const onOnline = () => void flush()
    claimLocalData(userId)
      .then(() => {
        if (!live) return
        void flush()
        window.addEventListener("online", onOnline)
      })
      .catch((error: unknown) =>
        console.error("claiming this device failed", error)
      )
    return () => {
      live = false
      window.removeEventListener("online", onOnline)
    }
  }, [userId, flush])
}
```

Di `src/lib/words/word-sync-client.ts`, ganti seluruh fungsi `useWordFlush` (dengan komentarnya) dengan:

```ts
const flushWords = () => wordSync().flush()

/** Sends waiting word changes when the app opens and when the connection comes back. */
export function useWordFlush(userId: string): void {
  useQueueFlush(userId, flushWords)
}
```

Tambahkan `import { useQueueFlush } from "@/lib/sync/use-queue-flush"` dan buang `claimLocalData` dari import bila tidak terpakai lagi. `useEffect` masih dipakai `useLocal` dan `useLocalWords`, jadi tetap di-import.

- [ ] **Step 6: Jalankan semua test antrean**

Run: `npx vitest run src/lib/sync src/lib/words src/lib/local`
Expected: PASS. `word-sync.test.ts` dan `word-sync-client.test.tsx` lulus tanpa diubah.

- [ ] **Step 7: Typecheck, lint, dan commit**

Run: `npm run typecheck && npm run lint`
Expected: tanpa error.

```bash
git add src/lib/sync src/lib/words/word-sync.ts src/lib/words/word-sync-client.ts
git commit -m "refactor(sync): one queue engine for words and, next, annotations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Anotasi di perangkat

**Files:**
- Modify: `src/lib/local/db.ts`
- Create: `src/lib/local/annotations.ts`
- Modify: `src/lib/local/device.ts`
- Modify: `src/components/shelf/BookActions.tsx`
- Modify: `src/components/reader/load-reader.ts`
- Test: `src/lib/local/annotations.test.ts`

**Interfaces:**
- Consumes: `Annotation` (Task 3), `QueueStore<T>` (Task 4).
- Produces:
  - Dexie versi 3: tabel `annotations` (`"id, bookId, pending"`), baris `LocalAnnotation = Annotation & { pending: 0 | 1 }`.
  - `AnnotationStore = QueueStore<Annotation> & { put(annotation: Annotation): Promise<void> }` (diekspor dari file ini; Task 6 memakainya).
  - `localAnnotationStore: AnnotationStore`: `put` menyimpan dan menandai `pending: 1`; `pending()` urut `updatedAt` naik; `confirm` menurunkan `pending` bila `updatedAt` masih sama; `revert` menghapus baris bila `updatedAt` masih sama.
  - `bookAnnotations(bookId): Promise<Array<Annotation>>`: anotasi aktif (tanpa tombstone) buku itu.
  - `mergeServerAnnotations(bookId, server: Array<Annotation>): Promise<void>`: daftar server menggantikan salinan perangkat, kecuali perubahan perangkat yang masih menunggu dan lebih baru.
  - `removeLocalAnnotations(bookId): Promise<void>`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/local/annotations.test.ts`:

```ts
// @vitest-environment node
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import type { Annotation } from "@/lib/annotations/types"
import {
  bookAnnotations,
  localAnnotationStore,
  mergeServerAnnotations,
  removeLocalAnnotations,
} from "./annotations"
import { localDb } from "./db"
import { clearLocalData } from "./device"

const BOOK = "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e"
const OTHER_BOOK = "7d6c5b4a-3f2e-4d1c-8b0a-1f2e3d4c5b6a"
const time = (minute: number) =>
  new Date(Date.UTC(2026, 9, 24, 8, minute)).toISOString()

const highlight = (
  id: string,
  minute = 0,
  changes: Partial<Annotation> = {}
): Annotation => ({
  id,
  bookId: BOOK,
  kind: "highlight",
  cfi: `epubcfi(/6/4!/4/${id.length * 2})`,
  color: "yellow",
  note: "",
  excerpt: `Teks ${id}`,
  createdAt: time(0),
  updatedAt: time(minute),
  deletedAt: null,
  ...changes,
})

const ids = async () => (await bookAnnotations(BOOK)).map((a) => a.id)

beforeEach(async () => {
  await clearLocalData()
})

describe("annotations on this device", () => {
  it("shows a change at once and queues it, oldest first", async () => {
    await localAnnotationStore.put(highlight("b", 2))
    await localAnnotationStore.put(highlight("a", 1))
    expect((await ids()).sort()).toEqual(["a", "b"])
    expect((await localAnnotationStore.pending()).map((a) => a.id)).toEqual([
      "a",
      "b",
    ])
  })

  it("lists a book's annotations without tombstones or other books", async () => {
    await localAnnotationStore.put(highlight("a"))
    await localAnnotationStore.put(highlight("b", 1, { deletedAt: time(1) }))
    await localAnnotationStore.put(highlight("c", 0, { bookId: OTHER_BOOK }))
    expect(await ids()).toEqual(["a"])
  })

  it("confirms only the change that was sent", async () => {
    const sent = highlight("a", 1)
    await localAnnotationStore.put(sent)
    await localAnnotationStore.put(highlight("a", 2, { color: "green" }))
    await localAnnotationStore.confirm([sent])
    expect((await localAnnotationStore.pending()).map((a) => a.color)).toEqual(
      ["green"]
    )

    await localAnnotationStore.confirm([highlight("a", 2, { color: "green" })])
    expect(await localAnnotationStore.pending()).toEqual([])
    expect(await ids()).toEqual(["a"])
  })

  it("takes back a refused change unless it changed again", async () => {
    const refused = highlight("a", 1)
    await localAnnotationStore.put(refused)
    await localAnnotationStore.revert(refused)
    expect(await ids()).toEqual([])

    await localAnnotationStore.put(highlight("b", 1))
    await localAnnotationStore.put(highlight("b", 2))
    await localAnnotationStore.revert(highlight("b", 1))
    expect(await ids()).toEqual(["b"])
  })

  it("takes the server's list, keeping newer changes still waiting here", async () => {
    // Waiting here and newer than the server's: stays.
    await localAnnotationStore.put(highlight("mine", 5, { color: "pink" }))
    // Waiting here but older than the server's: the server's wins.
    await localAnnotationStore.put(highlight("theirs", 1, { color: "pink" }))
    // On this device only, already sent, and gone from the server: leaves.
    await localAnnotationStore.put(highlight("gone", 1))
    await localAnnotationStore.confirm([highlight("gone", 1)])

    await mergeServerAnnotations(BOOK, [
      highlight("mine", 2),
      highlight("theirs", 3, { color: "blue" }),
      highlight("new", 1),
    ])

    const byId = new Map(
      (await bookAnnotations(BOOK)).map((a) => [a.id, a.color])
    )
    expect(Object.fromEntries(byId)).toEqual({
      mine: "pink",
      theirs: "blue",
      new: "yellow",
    })
    expect((await localAnnotationStore.pending()).map((a) => a.id)).toEqual([
      "mine",
    ])
  })

  it("compares the server's times as times, not as text", async () => {
    await localAnnotationStore.put(highlight("a", 5, { color: "pink" }))
    // The same moment as minute 5, written the way Postgres writes it.
    const server = highlight("a", 0, {
      color: "blue",
      updatedAt: "2026-10-24T08:05:00.000001+00:00",
    })
    await mergeServerAnnotations(BOOK, [server])
    expect((await bookAnnotations(BOOK))[0].color).toBe("blue")
  })

  it("forgets a deleted book's annotations, and everything on sign-out", async () => {
    await localAnnotationStore.put(highlight("a"))
    await localAnnotationStore.put(highlight("b", 0, { bookId: OTHER_BOOK }))
    await removeLocalAnnotations(BOOK)
    expect(await ids()).toEqual([])
    expect(await localDb().annotations.count()).toBe(1)

    await clearLocalData()
    expect(await localDb().annotations.count()).toBe(0)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/local/annotations.test.ts`
Expected: FAIL, `Cannot find module './annotations'`.

- [ ] **Step 3: Dexie versi 3**

Di `src/lib/local/db.ts`:

```ts
import type { Annotation } from "@/lib/annotations/types"
```

di atas import tipe kata, lalu di bawah tipe `LocalWordOp`:

```ts
/** An annotation as this device keeps it; `pending` is 1 until the server has this change. */
export type LocalAnnotation = Annotation & { pending: 0 | 1 }
```

Tambahkan anggota kelas di bawah `wordOps!`:

```ts
  annotations!: EntityTable<LocalAnnotation, "id">
```

dan versi baru di bawah `this.version(2)…`:

```ts
    // Tahap 2B: highlights and bookmarks, with their queue (spec 2 §5).
    this.version(3).stores({
      annotations: "id, bookId, pending",
    })
```

- [ ] **Step 4: Penyimpanan anotasi**

Buat `src/lib/local/annotations.ts`:

```ts
import type { Annotation } from "@/lib/annotations/types"
import type { QueueStore } from "@/lib/sync/queue-sync"
import { type LocalAnnotation, localDb } from "./db"

/** Where annotations and their waiting changes live (IndexedDB in the browser). */
export type AnnotationStore = QueueStore<Annotation> & {
  /** Shows the change at once and queues it. */
  put: (annotation: Annotation) => Promise<void>
}

const toAnnotation = (row: LocalAnnotation): Annotation => ({
  id: row.id,
  bookId: row.bookId,
  kind: row.kind,
  cfi: row.cfi,
  color: row.color,
  note: row.note,
  excerpt: row.excerpt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  deletedAt: row.deletedAt,
})

// The server writes its times differently (+00:00, microseconds): compare them as times.
const newer = (a: string, b: string) => Date.parse(a) > Date.parse(b)

/** The book's annotations on this device, without tombstones. */
export async function bookAnnotations(
  bookId: string
): Promise<Array<Annotation>> {
  const rows = await localDb()
    .annotations.where("bookId")
    .equals(bookId)
    .toArray()
  return rows.filter((row) => row.deletedAt === null).map(toAnnotation)
}

/**
 * The server's list for a book (tombstones included), with this device's
 * waiting changes laid over it when they are newer (spec 2 §7). What the
 * server no longer has and this device is not still sending goes.
 */
export async function mergeServerAnnotations(
  bookId: string,
  server: Array<Annotation>
): Promise<void> {
  const db = localDb()
  await db.transaction("rw", db.annotations, async () => {
    const theirs = new Map(server.map((annotation) => [annotation.id, annotation]))
    const local = await db.annotations.where("bookId").equals(bookId).toArray()
    for (const row of local) {
      const remote = theirs.get(row.id)
      if (row.pending === 1 && (!remote || newer(row.updatedAt, remote.updatedAt))) {
        theirs.delete(row.id)
        continue
      }
      if (!remote) await db.annotations.delete(row.id)
    }
    await db.annotations.bulkPut(
      [...theirs.values()].map((annotation) => ({ ...annotation, pending: 0 as const }))
    )
  })
}

/** A deleted book's annotations leave this device too. */
export async function removeLocalAnnotations(bookId: string): Promise<void> {
  await localDb().annotations.where("bookId").equals(bookId).delete()
}

/** Annotations in IndexedDB: a change shows at once and waits for the server. */
export const localAnnotationStore: AnnotationStore = {
  async put(annotation) {
    await localDb().annotations.put({ ...annotation, pending: 1 })
  },

  async pending() {
    const rows = await localDb().annotations.where("pending").equals(1).toArray()
    return rows
      .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))
      .map(toAnnotation)
  },

  async confirm(sent) {
    const db = localDb()
    await db.transaction("rw", db.annotations, async () => {
      for (const annotation of sent) {
        const row = await db.annotations.get(annotation.id)
        if (row?.updatedAt === annotation.updatedAt) {
          await db.annotations.update(annotation.id, { pending: 0 })
        }
      }
    })
  },

  // The whole row goes: the server's version, if any, comes back with the
  // book's list the next time it opens (plan 2B, decision 7).
  async revert(annotation) {
    const db = localDb()
    await db.transaction("rw", db.annotations, async () => {
      const row = await db.annotations.get(annotation.id)
      if (row?.updatedAt === annotation.updatedAt) {
        await db.annotations.delete(annotation.id)
      }
    })
  },
}
```

- [ ] **Step 5: Hapus data dan hapus buku**

Di `src/lib/local/device.ts`, tambahkan `db.annotations` ke daftar `tables` di `wipeMemberData` (setelah `db.wordOps`), dan ubah komentar fungsinya menjadi `/** Drops the member's books, positions, Kosakata, annotations, shelf snapshot, cached covers and reader settings. */`.

Di `src/components/shelf/BookActions.tsx`, tambahkan import:

```ts
import { removeLocalAnnotations } from "@/lib/local/annotations"
```

dan ubah blok di `onConfirmDelete` menjadi:

```ts
        await Promise.all([
          removeLocalBook(book.id),
          removeLocalPosition(book.id),
          removeLocalAnnotations(book.id),
        ]).catch((error: unknown) =>
```

Di `src/components/reader/load-reader.ts`, tambahkan import yang sama dan ubah baris di cabang `not_found` menjadi:

```ts
      await Promise.all([
        removeLocalBook(bookId),
        removeLocalPosition(bookId),
        removeLocalAnnotations(bookId),
      ])
```

- [ ] **Step 6: Jalankan test, pastikan lulus**

Run: `npx vitest run src/lib/local src/components/shelf src/components/reader/load-reader.test.ts`
Expected: PASS. Kalau `load-reader.test.ts` atau `BookActions.test.tsx` me-mock `@/lib/local/positions` lalu memeriksa panggilan hapus, tambahkan mock `@/lib/local/annotations` dengan `removeLocalAnnotations: vi.fn(async () => undefined)` di file test itu.

- [ ] **Step 7: Typecheck, lint, dan commit**

Run: `npm run typecheck && npm run lint`
Expected: tanpa error.

```bash
git add src/lib/local src/components/shelf/BookActions.tsx src/components/reader/load-reader.ts src/components/shelf/BookActions.test.tsx src/components/reader/load-reader.test.ts
git commit -m "feat(annotations): this device keeps annotations and their queue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git add` untuk file test yang tidak berubah tidak apa-apa.)

---

### Task 6: Sinkron anotasi dan pesan penolakan

**Files:**
- Create: `src/lib/annotations/annotation-sync.ts`
- Create: `src/lib/annotations/annotation-sync-client.ts`
- Modify: `src/routes/_member.tsx`
- Modify: `src/lib/progress-sync-client.ts`
- Modify: `src/lib/book-messages.ts`
- Create: `src/components/reader/SyncNotice.tsx`
- Modify: `src/components/vocabulary/VocabularyNotice.tsx`
- Create: `src/components/reader/AnnotationNotice.tsx`
- Test: `src/lib/annotations/annotation-sync.test.ts`, `src/lib/book-messages.test.ts`

**Interfaces:**
- Consumes: `createQueueSync`, `useQueueFlush` (Task 4); `AnnotationStore`, `localAnnotationStore`, `bookAnnotations`, `mergeServerAnnotations` (Task 5); `syncAnnotationsFn`, `listAnnotationsFn`, `isValidAnnotation`, `MAX_ANNOTATION_BATCH` (Task 3).
- Produces:
  - `AnnotationRejection = { code: "annotations_full" | "annotation_invalid" }`.
  - `createAnnotationSync({ store, send, isOnline, debounceMs? }): AnnotationSync` dengan `put(annotation): Promise<void>`, `flush`, `version`, `notify`, `rejection`, `dismissRejection`, `subscribe`, `dispose`.
  - `annotationSync(): AnnotationSync` (satu per tab), `refreshBookAnnotations(bookId): Promise<void>` (tidak pernah reject), `useAnnotationFlush(userId)`, `useAnnotationsVersion(): number`, `useBookAnnotations(bookId): Array<Annotation>` (aktif saja), `useAnnotationRejection(): AnnotationRejection | null`.
  - `SyncNotice({ label, code, onClose, className? })`, `AnnotationNotice()`.
  - Pesan `annotations_full`, `annotation_invalid`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/annotations/annotation-sync.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AnnotationStore } from "@/lib/local/annotations"
import { createAnnotationSync } from "./annotation-sync"
import type { Annotation, AnnotationSyncAnswer } from "./types"

/** The same rules as localAnnotationStore, in memory. */
function memoryStore() {
  const rows = new Map<string, { annotation: Annotation; pending: boolean }>()
  const store: AnnotationStore = {
    put: async (annotation) => {
      rows.set(annotation.id, { annotation, pending: true })
    },
    pending: async () =>
      [...rows.values()]
        .filter((row) => row.pending)
        .map((row) => row.annotation)
        .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt)),
    confirm: async (sent) => {
      for (const annotation of sent) {
        const row = rows.get(annotation.id)
        if (row?.annotation.updatedAt === annotation.updatedAt) row.pending = false
      }
    },
    revert: async (annotation) => {
      if (rows.get(annotation.id)?.annotation.updatedAt === annotation.updatedAt)
        rows.delete(annotation.id)
    },
  }
  return { rows, store }
}

const highlight = (n: number): Annotation => ({
  id: `8b1f7c2e-4a5d-4c3b-9e2f-${String(n).padStart(12, "0")}`,
  bookId: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  kind: "highlight",
  cfi: `epubcfi(/6/4!/4/${n * 2})`,
  color: "yellow",
  note: "",
  excerpt: "Teks",
  createdAt: "2026-10-24T08:00:00.000Z",
  updatedAt: new Date(Date.UTC(2026, 9, 24, 8, 0, n)).toISOString(),
  deletedAt: null,
})

const allOk = async (
  entries: Array<Annotation>
): Promise<AnnotationSyncAnswer> => ({
  ok: true,
  results: entries.map(() => "ok"),
})

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createAnnotationSync", () => {
  it("shows a change at once and sends it two seconds later", async () => {
    const { rows, store } = memoryStore()
    const send = vi.fn(allOk)
    const sync = createAnnotationSync({ store, send, isOnline: () => true })
    const listener = vi.fn()
    sync.subscribe(listener)

    await sync.put(highlight(1))
    expect(rows.has(highlight(1).id)).toBe(true)
    expect(listener).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_999)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledWith([highlight(1)])
    expect(await store.pending()).toEqual([])
  })

  it("sends at most 50 changes per request", async () => {
    const { store } = memoryStore()
    const send = vi.fn(allOk)
    const sync = createAnnotationSync({ store, send, isOnline: () => true })
    for (let n = 1; n <= 51; n++) await sync.put(highlight(n))
    await sync.flush()
    expect(send.mock.calls.map(([entries]) => entries.length)).toEqual([50, 1])
  })

  it("takes back a change refused as full, and says why", async () => {
    const { rows, store } = memoryStore()
    const sync = createAnnotationSync({
      store,
      isOnline: () => true,
      send: async (entries) => ({
        ok: true,
        results: entries.map(() => "limit_reached"),
      }),
    })
    await sync.put(highlight(1))
    await sync.flush()
    expect(rows.size).toBe(0)
    expect(sync.rejection()).toEqual({ code: "annotations_full" })
    sync.dismissRejection()
    expect(sync.rejection()).toBeNull()
  })

  it("refuses a change the server would refuse, without queueing it", async () => {
    const { rows, store } = memoryStore()
    const sync = createAnnotationSync({ store, send: allOk, isOnline: () => true })
    await sync.put({ ...highlight(1), color: null })
    expect(rows.size).toBe(0)
    expect(sync.rejection()).toEqual({ code: "annotation_invalid" })
  })
})
```

Di `src/lib/book-messages.test.ts`, tambahkan test:

```ts
  it("explains refused annotations", () => {
    expect(bookMessage("annotations_full")).toBe(
      "Anotasi sudah penuh (10.000). Hapus beberapa anotasi untuk membuat yang baru."
    )
    expect(bookMessage("annotation_invalid")).toBe(
      "Anotasi ini tidak bisa disimpan."
    )
  })
```

(di dalam `describe` yang sudah ada; sesuaikan import bila belum ada `bookMessage`.)

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/annotations/annotation-sync.test.ts src/lib/book-messages.test.ts`
Expected: FAIL, `Cannot find module './annotation-sync'`, dan pesan baru belum ada.

- [ ] **Step 3: Mesin sinkron anotasi**

Buat `src/lib/annotations/annotation-sync.ts`:

```ts
import type { AnnotationStore } from "@/lib/local/annotations"
import { createQueueSync } from "@/lib/sync/queue-sync"
import { isValidAnnotation } from "./schemas"
import {
  type Annotation,
  type AnnotationSyncAnswer,
  MAX_ANNOTATION_BATCH,
} from "./types"

/** A change the server refused, shown until dismissed. `code` is a bookMessage key. */
export type AnnotationRejection = {
  code: "annotations_full" | "annotation_invalid"
}

export type AnnotationSync = {
  /** Shows a new, changed or deleted annotation at once and queues it. */
  put: (annotation: Annotation) => Promise<void>
  /** Sends every waiting change now. Never rejects. */
  flush: () => Promise<void>
  /** Grows on every change to annotations on this device. */
  version: () => number
  /** For changes made beside the queue, such as the server's list arriving. */
  notify: () => void
  rejection: () => AnnotationRejection | null
  dismissRejection: () => void
  subscribe: (listener: () => void) => () => void
  dispose: () => void
}

/**
 * Highlights and bookmarks (spec 2 §7): shown on this device at once, then
 * sent two seconds after the last change, in batches of 50.
 */
export function createAnnotationSync(options: {
  store: AnnotationStore
  send: (entries: Array<Annotation>) => Promise<AnnotationSyncAnswer>
  isOnline: () => boolean
  debounceMs?: number
}): AnnotationSync {
  const { store } = options
  let rejection: AnnotationRejection | null = null
  const queue = createQueueSync<Annotation>({
    store,
    send: options.send,
    isOnline: options.isOnline,
    keyOf: (annotation) => annotation.id,
    batchSize: MAX_ANNOTATION_BATCH,
    onRefused: (refused) =>
      refuse(
        refused.some(({ result }) => result === "limit_reached")
          ? "annotations_full"
          : "annotation_invalid"
      ),
    debounceMs: options.debounceMs,
  })

  function refuse(code: AnnotationRejection["code"]) {
    rejection = { code }
    queue.changed()
  }

  return {
    async put(annotation) {
      if (!isValidAnnotation(annotation)) {
        refuse("annotation_invalid")
        return
      }
      await store.put(annotation)
      queue.changed()
      queue.later()
    },
    flush: queue.flush,
    version: queue.version,
    notify: queue.changed,
    rejection: () => rejection,
    dismissRejection() {
      if (!rejection) return
      rejection = null
      queue.changed()
    },
    subscribe: queue.subscribe,
    dispose: queue.dispose,
  }
}
```

- [ ] **Step 4: Mesin satu-satunya di tab dan hook React**

Buat `src/lib/annotations/annotation-sync-client.ts`:

```ts
import { useEffect, useState, useSyncExternalStore } from "react"
import {
  bookAnnotations,
  localAnnotationStore,
  mergeServerAnnotations,
} from "@/lib/local/annotations"
import { useQueueFlush } from "@/lib/sync/use-queue-flush"
import { listAnnotationsFn, syncAnnotationsFn } from "@/server/annotations"
import {
  type AnnotationRejection,
  type AnnotationSync,
  createAnnotationSync,
} from "./annotation-sync"
import type { Annotation } from "./types"

let engine: AnnotationSync | null = null

/** The one annotation sync of this tab (browser only). */
export function annotationSync(): AnnotationSync {
  engine ??= createAnnotationSync({
    store: localAnnotationStore,
    isOnline: () => navigator.onLine,
    send: (entries) => syncAnnotationsFn({ data: { entries } }),
  })
  return engine
}

/**
 * Reads the book's annotations from the server, tombstones too, so changes
 * made on other devices show here (spec 2 §4.3). Without a connection the
 * device's copy stays. Never rejects.
 */
export async function refreshBookAnnotations(bookId: string): Promise<void> {
  try {
    const answer = await listAnnotationsFn({ data: { bookId } })
    if (!answer.ok) return
    await mergeServerAnnotations(bookId, answer.annotations)
    annotationSync().notify()
  } catch (error) {
    console.error("fetching the book's annotations failed", error)
  }
}

const flushAnnotations = () => annotationSync().flush()

/** Sends waiting annotation changes when the app opens and when the connection comes back. */
export function useAnnotationFlush(userId: string): void {
  useQueueFlush(userId, flushAnnotations)
}

export function useAnnotationsVersion(): number {
  return useSyncExternalStore(
    (listener) => annotationSync().subscribe(listener),
    () => annotationSync().version(),
    () => 0
  )
}

const NONE: Array<Annotation> = []

/** The book's annotations on this device, read again after every change. */
export function useBookAnnotations(bookId: string): Array<Annotation> {
  const version = useAnnotationsVersion()
  const [state, setState] = useState<{
    bookId: string
    annotations: Array<Annotation>
  }>({ bookId, annotations: NONE })
  useEffect(() => {
    let live = true
    bookAnnotations(bookId)
      .then((annotations) => {
        if (live) setState({ bookId, annotations })
      })
      .catch((error: unknown) =>
        console.error("reading annotations on this device failed", error)
      )
    return () => {
      live = false
    }
  }, [bookId, version])
  return state.bookId === bookId ? state.annotations : NONE
}

export function useAnnotationRejection(): AnnotationRejection | null {
  useAnnotationsVersion()
  return import.meta.env.SSR ? null : annotationSync().rejection()
}
```

- [ ] **Step 5: Kirim antrean saat app terbuka dan saat keluar**

Di `src/routes/_member.tsx`, tambahkan import:

```ts
import { useAnnotationFlush } from "@/lib/annotations/annotation-sync-client"
```

dan panggil `useAnnotationFlush(user.id)` tepat di bawah `useWordFlush(user.id)`.

Di `src/lib/progress-sync-client.ts`, tambahkan import:

```ts
import { annotationSync } from "./annotations/annotation-sync-client"
```

lalu ubah `leaveDevice` menjadi:

```ts
/**
 * Before signing out: send the positions, word and annotation changes still
 * waiting (for a few seconds at most), then wipe this device's copies (plan
 * 1C, decision 6).
 */
export async function leaveDevice(): Promise<void> {
  await Promise.race([
    Promise.all([
      progressSync().flush(),
      wordSync().flush(),
      annotationSync().flush(),
    ]).catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, LEAVE_FLUSH_MS)),
  ])
  await clearLocalData()
  // A refusal notice belongs to this member, not to the next one.
  wordSync().dismissRejection()
  annotationSync().dismissRejection()
}
```

- [ ] **Step 6: Pesan penolakan**

Di `src/lib/book-messages.ts`, tambahkan di bawah `word_invalid`:

```ts
  annotations_full:
    "Anotasi sudah penuh (10.000). Hapus beberapa anotasi untuk membuat yang baru.",
  annotation_invalid: "Anotasi ini tidak bisa disimpan.",
```

Buat `src/components/reader/SyncNotice.tsx`:

```tsx
import { Button } from "@/components/ui/button"
import { bookMessage } from "@/lib/book-messages"
import { cn } from "@/lib/utils"

/** Why the server did not keep a change (spec 2 §7), until the member closes it. */
export function SyncNotice({
  label,
  code,
  onClose,
  className,
}: {
  label: string
  /** A bookMessage key. */
  code: string
  onClose: () => void
  className?: string
}) {
  return (
    <aside aria-label={label} className={cn("reader-toast", className)}>
      <output className="text-sm">{bookMessage(code)}</output>
      <Button size="lg" variant="ghost" onClick={onClose}>
        Tutup
      </Button>
    </aside>
  )
}
```

Ganti isi `src/components/vocabulary/VocabularyNotice.tsx` dengan:

```tsx
import { SyncNotice } from "@/components/reader/SyncNotice"
import { useWordRejection, wordSync } from "@/lib/words/word-sync-client"

/** Why the server did not keep a word (spec 2 §7), until the member closes it. */
export function VocabularyNotice({ className }: { className?: string }) {
  const rejection = useWordRejection()
  if (!rejection) return null
  return (
    <SyncNotice
      label="Kosakata"
      code={rejection.code}
      onClose={() => wordSync().dismissRejection()}
      className={className}
    />
  )
}
```

Buat `src/components/reader/AnnotationNotice.tsx`:

```tsx
import {
  annotationSync,
  useAnnotationRejection,
} from "@/lib/annotations/annotation-sync-client"
import { SyncNotice } from "./SyncNotice"

/** Why the server did not keep an annotation (spec 2 §8), until the member closes it. */
export function AnnotationNotice() {
  const rejection = useAnnotationRejection()
  if (!rejection) return null
  return (
    <SyncNotice
      label="Anotasi"
      code={rejection.code}
      onClose={() => annotationSync().dismissRejection()}
    />
  )
}
```

- [ ] **Step 7: Jalankan test, pastikan lulus**

Run: `npx vitest run src/lib src/components/vocabulary src/routes`
Expected: PASS. Kalau ada test yang me-mock `@/lib/progress-sync-client` atau merender `_member.tsx` dan sekarang gagal karena `@/server/annotations`, tambahkan mock modul itu di test tersebut seperti mock `@/server/words` yang sudah ada.

- [ ] **Step 8: Typecheck, lint, dan commit**

Run: `npm run typecheck && npm run lint`
Expected: tanpa error.

```bash
git add src/lib/annotations src/routes/_member.tsx src/lib/progress-sync-client.ts src/lib/book-messages.ts src/lib/book-messages.test.ts src/components/reader/SyncNotice.tsx src/components/reader/AnnotationNotice.tsx src/components/vocabulary/VocabularyNotice.tsx
git commit -m "feat(annotations): the queue reaches the server, refusals are explained

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tempat di buku, gambar highlight, dan seleksi

**Files:**
- Modify: `src/types/foliate-js.d.ts`
- Create: `src/lib/annotations/places.ts`
- Create: `src/lib/annotations/draw.ts`
- Create: `src/lib/annotations/selection.ts`
- Test: `src/lib/annotations/places.test.ts`, `src/lib/annotations/draw.test.ts`, `src/lib/annotations/selection.test.ts`

**Interfaces:**
- Consumes: `HighlightColor`, `HIGHLIGHT_COLORS` (Task 3); `foliate-js/epubcfi.js` (`collapse`, `compare`), `foliate-js/overlayer.js` (`Overlayer.highlight`).
- Produces:
  - `pageStart(pageCfi: string): string` — awal halaman.
  - `onPage(cfi: string, pageCfi: string): boolean` — awal termasuk, akhir tidak.
  - `inBookOrder<T extends { cfi: string }>(items: ReadonlyArray<T>): Array<T>`.
  - `HIGHLIGHT_FILL: Record<HighlightColor, string>`, `drawHighlight(rects: ArrayLike<DOMRect>, options: { color: string; note: boolean }): SVGElement`.
  - `selectedRange(doc: Document): { range: Range; text: string } | null`, `endRect(range: Range): DOMRect`, `rectAt(range: Range, x: number, y: number): DOMRect`.
  - Tipe foliate: `RelocateDetail.range`, `getContents()` dengan `index` dan `overlayer.hitTest`, `View.addAnnotation`, `View.deleteAnnotation`, `View.getProgressOf`, `DrawAnnotationDetail`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/annotations/places.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { inBookOrder, onPage, pageStart } from "./places"

const PAGE = "epubcfi(/6/4!/4,/2/1:0,/8/1:30)"

describe("pageStart", () => {
  it("is where the page begins", () => {
    expect(pageStart(PAGE)).toBe("epubcfi(/6/4!/4/2/1:0)")
  })
})

describe("onPage", () => {
  it("counts the start of the page but not its end", () => {
    expect(onPage("epubcfi(/6/4!/4/2/1:0)", PAGE)).toBe(true)
    expect(onPage("epubcfi(/6/4!/4/6/1:10)", PAGE)).toBe(true)
    expect(onPage("epubcfi(/6/4!/4/8/1:30)", PAGE)).toBe(false)
    expect(onPage("epubcfi(/6/6!/4/2/1:0)", PAGE)).toBe(false)
  })

  it("is false for a place it cannot read", () => {
    expect(onPage("nonsense", PAGE)).toBe(false)
  })
})

describe("inBookOrder", () => {
  it("sorts by place in the book", () => {
    const items = [
      { id: "c", cfi: "epubcfi(/6/6!/4/2/1:0)" },
      { id: "b", cfi: "epubcfi(/6/4!/4/10/1:0)" },
      { id: "a", cfi: "epubcfi(/6/4!/4/2,/1:0,/1:5)" },
    ]
    expect(inBookOrder(items).map((item) => item.id)).toEqual(["a", "b", "c"])
    expect(items[0].id).toBe("c")
  })
})
```

Buat `src/lib/annotations/draw.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { HIGHLIGHT_FILL, drawHighlight } from "./draw"
import { HIGHLIGHT_COLORS } from "./types"

/** A line's box as layout would give it (jsdom has no layout). */
const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
  }) as DOMRect

describe("drawHighlight", () => {
  it("fills every line in the highlight's colour", () => {
    const drawn = drawHighlight([rect(10, 20, 100, 18), rect(10, 40, 60, 18)], {
      color: HIGHLIGHT_FILL.green,
      note: false,
    })
    expect(drawn.getAttribute("fill")).toBe(HIGHLIGHT_FILL.green)
    expect(drawn.querySelectorAll("rect")).toHaveLength(2)
  })

  it("adds a small mark after the last line when there is a note", () => {
    const drawn = drawHighlight([rect(10, 20, 100, 18), rect(10, 40, 60, 18)], {
      color: HIGHLIGHT_FILL.blue,
      note: true,
    })
    const mark = drawn.querySelector(".glosa-note-mark")
    expect(mark).not.toBeNull()
    expect(Number(mark?.getAttribute("x"))).toBeGreaterThanOrEqual(70)
    expect(Number(mark?.getAttribute("y"))).toBe(40)
  })

  it("has a fill for every colour", () => {
    for (const color of HIGHLIGHT_COLORS) {
      expect(HIGHLIGHT_FILL[color]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
```

Buat `src/lib/annotations/selection.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { endRect, rectAt, selectedRange } from "./selection"

function docWith(html: string) {
  document.body.innerHTML = html
  return document
}

function select(node: Node, start: number, end: number) {
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)
  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

describe("selectedRange", () => {
  it("gives the selected text", () => {
    const doc = docWith("<p>To Sherlock Holmes she is always the woman.</p>")
    const text = doc.querySelector("p")?.firstChild as Text
    select(text, 3, 11)
    expect(selectedRange(doc)?.text).toBe("Sherlock")
  })

  it("is null with nothing selected or only spaces", () => {
    const doc = docWith("<p>To  Sherlock</p>")
    const text = doc.querySelector("p")?.firstChild as Text
    document.getSelection()?.removeAllRanges()
    expect(selectedRange(doc)).toBeNull()
    select(text, 2, 4)
    expect(selectedRange(doc)).toBeNull()
  })
})

/** A box as layout would give it (jsdom has no layout). */
const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
  }) as DOMRect

/** A range with the boxes layout would give it. */
function rangeWith(rects: Array<DOMRect>) {
  return {
    getClientRects: () => rects,
    getBoundingClientRect: () => rect(0, 0, 500, 500),
  } as unknown as Range
}

describe("endRect and rectAt", () => {
  const lines = [rect(10, 20, 200, 18), rect(10, 40, 80, 18)]

  it("finds where a selection ends", () => {
    expect(endRect(rangeWith(lines))).toBe(lines[1])
    expect(endRect(rangeWith([])).width).toBe(500)
  })

  it("finds the line under a tap", () => {
    expect(rectAt(rangeWith(lines), 50, 45)).toBe(lines[1])
    expect(rectAt(rangeWith(lines), 50, 25)).toBe(lines[0])
    expect(rectAt(rangeWith(lines), 400, 400).width).toBe(500)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/annotations/places.test.ts src/lib/annotations/draw.test.ts src/lib/annotations/selection.test.ts`
Expected: FAIL, modul belum ada.

- [ ] **Step 3: Tipe foliate**

Di `src/types/foliate-js.d.ts`, tambahkan dua modul baru di akhir file:

```ts
declare module "foliate-js/epubcfi.js" {
  /** The start (or, with `toEnd`, the end) of a range CFI; a point stays as it is. */
  export function collapse(cfi: string, toEnd?: boolean): string
  /** Negative, zero or positive, by place in the book. */
  export function compare(a: string, b: string): number
}

declare module "foliate-js/overlayer.js" {
  export class Overlayer {
    static highlight(
      rects: ArrayLike<DOMRect>,
      options?: { color?: string }
    ): SVGElement
    /** The annotation drawn under a point, in the section's coordinates. */
    hitTest(point: { x: number; y: number }): [string, Range] | []
  }
}
```

Di modul `foliate-js/view.js`:

1. Tambahkan import tipe di bawah import `EPUB`:

```ts
  import type { Overlayer } from "foliate-js/overlayer.js"
```

2. Di `RelocateDetail`, tambahkan:

```ts
    /** The text shown now. */
    range?: Range
```

3. Ganti baris `getContents?: () => Array<{ doc: Document | null }>` di `FoliateRenderer` dengan:

```ts
    getContents?: () => Array<{
      doc: Document | null
      index?: number
      overlayer?: Overlayer
    }>
```

4. Tambahkan tipe di bawah `RelocateDetail`:

```ts
  /** foliate asks how to draw an annotation added with addAnnotation. */
  export type DrawAnnotationDetail = {
    draw: <O>(
      draw: (rects: DOMRectList, options: O) => SVGElement,
      options: O
    ) => void
    annotation: { value: string }
  }
```

5. Di kelas `View`, tambahkan:

```ts
    /** Draws (or, with remove, clears) an annotation; `value` is its CFI. */
    addAnnotation(
      annotation: { value: string },
      remove?: boolean
    ): Promise<unknown>
    deleteAnnotation(annotation: { value: string }): Promise<unknown>
    /** The table-of-contents entry a range in section `index` belongs to. */
    getProgressOf(
      index: number,
      range?: Range
    ): { tocItem?: { label?: string } | null }
```

- [ ] **Step 4: Tempat di buku**

Buat `src/lib/annotations/places.ts`:

```ts
import { collapse, compare } from "foliate-js/epubcfi.js"

/** Where the page shown begins: a bookmark's place (plan 2B, decision 16). */
export function pageStart(pageCfi: string): string {
  return collapse(pageCfi)
}

/** Whether a place is on the page shown: from its start, up to (not at) its end. */
export function onPage(cfi: string, pageCfi: string): boolean {
  const start = collapse(pageCfi)
  const end = collapse(pageCfi, true)
  if (compare(start, end) === 0) return compare(cfi, start) === 0
  return compare(cfi, start) >= 0 && compare(cfi, end) < 0
}

/** Annotations in the order they come in the book (spec 2 §6.6). */
export function inBookOrder<T extends { cfi: string }>(
  items: ReadonlyArray<T>
): Array<T> {
  return [...items].sort((a, b) => compare(a.cfi, b.cfi))
}
```

- [ ] **Step 5: Gambar highlight**

Buat `src/lib/annotations/draw.ts`:

```ts
import { Overlayer } from "foliate-js/overlayer.js"
import type { HighlightColor } from "./types"

/** The fill of each highlight colour; the overlay draws it see-through. */
export const HIGHLIGHT_FILL: Record<HighlightColor, string> = {
  yellow: "#f5d000",
  green: "#3ccf6e",
  blue: "#4aa3ff",
  pink: "#ff6fae",
}

const SVG = "http://www.w3.org/2000/svg"
const MARK_SIZE = 7

/**
 * foliate's highlight, with a small square right after the last line when the
 * highlight has a note (spec 2 §6.6; plan 2B, decision 12).
 */
export function drawHighlight(
  rects: ArrayLike<DOMRect>,
  options: { color: string; note: boolean }
): SVGElement {
  const fill = Overlayer.highlight(rects, { color: options.color })
  const last = rects.length > 0 ? rects[rects.length - 1] : null
  if (!options.note || !last) return fill
  const group = document.createElementNS(SVG, "g")
  const mark = document.createElementNS(SVG, "rect")
  mark.setAttribute("class", "glosa-note-mark")
  mark.setAttribute("x", String(last.right + 2))
  mark.setAttribute("y", String(last.top))
  mark.setAttribute("width", String(MARK_SIZE))
  mark.setAttribute("height", String(MARK_SIZE))
  mark.setAttribute("rx", "1.5")
  mark.setAttribute("fill", options.color)
  group.append(fill, mark)
  return group
}
```

Catatan: test pertama memeriksa `fill` pada elemen yang dikembalikan, yaitu grup `g` dari `Overlayer.highlight` (foliate memasang `fill` di grup itu).

- [ ] **Step 6: Seleksi**

Buat `src/lib/annotations/selection.ts`:

```ts
/** The text selected in a section's document, or null when nothing (or only spaces) is. */
export function selectedRange(
  doc: Document
): { range: Range; text: string } | null {
  const selection = doc.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
    return null
  const range = selection.getRangeAt(0)
  const text = range.toString()
  return text.trim() ? { range, text } : null
}

/** The last line of a range: where a selection ends, for its menu. */
export function endRect(range: Range): DOMRect {
  const rects = range.getClientRects()
  return rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect()
}

/** The line of a range under a tap, for a tapped highlight's popup. */
export function rectAt(range: Range, x: number, y: number): DOMRect {
  for (const rect of Array.from(range.getClientRects())) {
    if (x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom)
      return rect
  }
  return range.getBoundingClientRect()
}
```

- [ ] **Step 7: Jalankan test, pastikan lulus**

Run: `npx vitest run src/lib/annotations`
Expected: PASS.

- [ ] **Step 8: Typecheck, lint, dan commit**

Run: `npm run typecheck && npm run lint`
Expected: tanpa error.

```bash
git add src/types/foliate-js.d.ts src/lib/annotations
git commit -m "feat(annotations): places in the book, highlight drawing and selections

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Popup bersama, menu seleksi, popup anotasi, dan editor catatan

**Files:**
- Create: `src/components/reader/ReaderPopup.tsx`
- Modify: `src/components/reader/WordPopup.tsx`
- Create: `src/components/reader/SelectionMenu.tsx`
- Create: `src/components/reader/AnnotationPopup.tsx`
- Create: `src/components/reader/NoteEditor.tsx`
- Modify: `src/styles.css`
- Test: `src/components/reader/SelectionMenu.test.tsx`, `src/components/reader/AnnotationPopup.test.tsx`, `src/components/reader/NoteEditor.test.tsx`; `src/components/reader/WordPopup.test.tsx` tetap lulus tanpa diubah.

**Interfaces:**
- Consumes: `Annotation`, `HighlightColor`, `HIGHLIGHT_COLORS`, `MAX_NOTE_LENGTH` (Task 3); `HIGHLIGHT_FILL` (Task 7); `WordTap` (`WordPopup.tsx`); `stubWideScreen`/`unstubWideScreen` (`src/test/media.ts`).
- Produces:
  - `WordRect` (pindah ke `ReaderPopup.tsx`; `WordPopup.tsx` mengekspor ulang), `anchorAt(rect)`.
  - `ReaderPopup({ rect, label, onClose, finalFocus, children })`.
  - `TextSelection = { cfi: string; text: string; rect: WordRect }`; `SelectionMenu({ selection, onHighlight, onNote, onCopy, onClose })`, popup bernama "Teks terpilih".
  - `HighlightTap = { cfi: string; rect: WordRect; word: WordTap | null }`; `AnnotationPopup({ tap, annotation, onColor, onNote, onDelete, onMeaning, onClose, finalFocus })`, popup bernama "Highlight".
  - `NoteEditor({ annotation, onClose, finalFocus })`, dialog bernama "Catatan", kotak teks "Isi catatan". `onClose(note)` dipanggil sekali dengan teks saat itu, bagaimana pun cara menutupnya.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/components/reader/SelectionMenu.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SelectionMenu, type TextSelection } from "./SelectionMenu"

const selection: TextSelection = {
  cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  text: "To Sherlock",
  rect: { left: 100, top: 100, width: 50, height: 20 },
}

describe("SelectionMenu", () => {
  it("offers Highlight, Catatan and Salin", async () => {
    const actions = {
      onHighlight: vi.fn(),
      onNote: vi.fn(),
      onCopy: vi.fn(),
      onClose: vi.fn(),
    }
    render(<SelectionMenu selection={selection} {...actions} />)
    await screen.findByRole("dialog", { name: "Teks terpilih" })
    fireEvent.click(screen.getByRole("button", { name: "Highlight" }))
    fireEvent.click(screen.getByRole("button", { name: "Catatan" }))
    fireEvent.click(screen.getByRole("button", { name: "Salin" }))
    expect(actions.onHighlight).toHaveBeenCalledTimes(1)
    expect(actions.onNote).toHaveBeenCalledTimes(1)
    expect(actions.onCopy).toHaveBeenCalledTimes(1)
  })

  it("shows nothing without a selection", () => {
    render(
      <SelectionMenu
        selection={null}
        onHighlight={vi.fn()}
        onNote={vi.fn()}
        onCopy={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
```

Buat `src/components/reader/AnnotationPopup.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Annotation } from "@/lib/annotations/types"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { AnnotationPopup, type HighlightTap } from "./AnnotationPopup"

const annotation: Annotation = {
  id: "8b1f7c2e-4a5d-4c3b-9e2f-1a2b3c4d5e6f",
  bookId: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  kind: "highlight",
  cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  color: "yellow",
  note: "Penting untuk bab 2",
  excerpt: "To Sherlock",
  createdAt: "2026-10-24T08:00:00.000Z",
  updatedAt: "2026-10-24T08:00:00.000Z",
  deletedAt: null,
}
const rect = { left: 100, top: 100, width: 50, height: 20 }
const tap: HighlightTap = {
  cfi: annotation.cfi,
  rect,
  word: { word: "sherlock", sentence: "To Sherlock.", next: [], cfi: null, rect },
}

function show(extra: Partial<Parameters<typeof AnnotationPopup>[0]> = {}) {
  const props = {
    tap,
    annotation,
    onColor: vi.fn(),
    onNote: vi.fn(),
    onDelete: vi.fn(),
    onMeaning: vi.fn(),
    onClose: vi.fn(),
    finalFocus: () => null,
    ...extra,
  }
  render(<AnnotationPopup {...props} />)
  return props
}

beforeEach(() => stubWideScreen(true))
afterEach(() => unstubWideScreen())

describe("AnnotationPopup", () => {
  it("shows the colours, the note and what can be done", async () => {
    const props = show()
    await screen.findByRole("dialog", { name: "Highlight" })
    expect(screen.getByText("Penting untuk bab 2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Kuning" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    fireEvent.click(screen.getByRole("button", { name: "Hijau" }))
    expect(props.onColor).toHaveBeenCalledWith("green")
    fireEvent.click(screen.getByRole("button", { name: "Catatan" }))
    expect(props.onNote).toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Hapus" }))
    expect(props.onDelete).toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: 'Arti "sherlock"' }))
    expect(props.onMeaning).toHaveBeenCalled()
  })

  it("has no meaning button when no word was tapped", async () => {
    show({ tap: { ...tap, word: null } })
    await screen.findByRole("dialog", { name: "Highlight" })
    expect(screen.queryByRole("button", { name: /^Arti/ })).toBeNull()
  })

  it("shows nothing once the highlight is gone", () => {
    show({ annotation: null })
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
```

Buat `src/components/reader/NoteEditor.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Annotation } from "@/lib/annotations/types"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { NoteEditor } from "./NoteEditor"

const annotation: Annotation = {
  id: "8b1f7c2e-4a5d-4c3b-9e2f-1a2b3c4d5e6f",
  bookId: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  kind: "highlight",
  cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  color: "yellow",
  note: "Lama",
  excerpt: "To Sherlock",
  createdAt: "2026-10-24T08:00:00.000Z",
  updatedAt: "2026-10-24T08:00:00.000Z",
  deletedAt: null,
}

afterEach(() => unstubWideScreen())

describe.each([true, false])("NoteEditor (wide: %s)", (wide) => {
  beforeEach(() => stubWideScreen(wide))

  it("starts from the note and gives the text back on Selesai", async () => {
    const onClose = vi.fn()
    render(
      <NoteEditor annotation={annotation} onClose={onClose} finalFocus={() => null} />
    )
    await screen.findByRole("dialog", { name: "Catatan" })
    const box = screen.getByRole("textbox", { name: "Isi catatan" })
    expect(box).toHaveValue("Lama")
    expect(screen.getByText("To Sherlock")).toBeInTheDocument()
    fireEvent.change(box, { target: { value: "Baru" } })
    fireEvent.click(screen.getByRole("button", { name: "Selesai" }))
    expect(onClose).toHaveBeenCalledWith("Baru")
  })

  it("gives the text back on Escape too", async () => {
    const onClose = vi.fn()
    render(
      <NoteEditor annotation={annotation} onClose={onClose} finalFocus={() => null} />
    )
    const box = await screen.findByRole("textbox", { name: "Isi catatan" })
    fireEvent.change(box, { target: { value: "" } })
    fireEvent.keyDown(box, { key: "Escape" })
    expect(onClose).toHaveBeenCalledWith("")
  })
})
```

Periksa tanda tangan `stubWideScreen` di `src/test/media.ts` dulu; kalau namanya atau argumennya berbeda, pakai seperti `WordPopup.test.tsx` memakainya.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/reader/SelectionMenu.test.tsx src/components/reader/AnnotationPopup.test.tsx src/components/reader/NoteEditor.test.tsx`
Expected: FAIL, modul belum ada.

- [ ] **Step 3: `ReaderPopup` dan `WordPopup` di atasnya**

Buat `src/components/reader/ReaderPopup.tsx`:

```tsx
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Popover } from "@base-ui/react/popover"
import type { ReactNode } from "react"
import { useWideScreen } from "@/lib/use-wide-screen"

/** Where a tapped word or highlight is, in this window's coordinates. */
export type WordRect = {
  left: number
  top: number
  width: number
  height: number
}

/** A virtual element at the rect, for a popover to sit beside. */
export function anchorAt({ left, top, width, height }: WordRect) {
  const box = {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }
  return { getBoundingClientRect: () => ({ ...box, toJSON: () => box }) }
}

/**
 * A reader popup (spec 2 §6.3, §6.6): a popover beside `rect` on wide
 * screens, a bottom sheet on phones. Escape or a tap outside closes it, and
 * the focus goes back to the book.
 */
export function ReaderPopup({
  rect,
  label,
  onClose,
  finalFocus,
  children,
}: {
  rect: WordRect
  label: string
  onClose: () => void
  finalFocus: () => HTMLElement | null
  children: ReactNode
}) {
  const wide = useWideScreen()
  const onOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  if (wide) {
    return (
      <Popover.Root open onOpenChange={onOpenChange}>
        <Popover.Portal>
          <Popover.Positioner
            anchor={anchorAt(rect)}
            side="bottom"
            sideOffset={8}
            collisionPadding={16}
            className="word-positioner"
          >
            <Popover.Popup
              aria-label={label}
              className="word-popup"
              finalFocus={finalFocus}
            >
              {children}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    )
  }
  return (
    <DialogPrimitive.Root open onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="word-sheet-backdrop" />
        <DialogPrimitive.Popup
          aria-label={label}
          className="word-sheet"
          finalFocus={finalFocus}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
```

Di `src/components/reader/WordPopup.tsx`:

1. Hapus import `Dialog as DialogPrimitive`, `Popover`, dan `useWideScreen`; hapus tipe `WordRect` dan fungsi `anchorAt`.
2. Tambahkan:

```tsx
import { ReaderPopup, type WordRect } from "./ReaderPopup"

export type { WordRect } from "./ReaderPopup"
```

3. Ganti fungsi `WordPopup` (dengan komentarnya) dengan:

```tsx
/**
 * A tapped word's meanings (spec 2 §6.3): a popover beside the word on wide
 * screens, a bottom sheet on phones.
 */
export function WordPopup({
  tap,
  onClose,
  finalFocus,
  ...card
}: Omit<CardProps, "tap"> & {
  tap: WordTap | null
  onClose: () => void
  finalFocus: () => HTMLElement | null
}) {
  if (!tap) return null
  return (
    <ReaderPopup
      rect={tap.rect}
      label={`Arti ${tap.word}`}
      onClose={onClose}
      finalFocus={finalFocus}
    >
      <WordCard tap={tap} {...card} />
    </ReaderPopup>
  )
}
```

`WordTap` tetap memakai `rect: WordRect` (dari import di atas).

- [ ] **Step 4: Menu seleksi**

Buat `src/components/reader/SelectionMenu.tsx`:

```tsx
import { Popover } from "@base-ui/react/popover"
import { CopyIcon, HighlighterIcon, StickyNoteIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type WordRect, anchorAt } from "./ReaderPopup"

/** Text selected in the book, and where the selection ends. */
export type TextSelection = { cfi: string; text: string; rect: WordRect }

/**
 * Highlight · Catatan · Salin beside a selection (spec 2 §6.6). It leaves the
 * focus in the book, so a phone keeps the selection's handles.
 */
export function SelectionMenu({
  selection,
  onHighlight,
  onNote,
  onCopy,
  onClose,
}: {
  selection: TextSelection | null
  onHighlight: () => void
  onNote: () => void
  onCopy: () => void
  onClose: () => void
}) {
  if (!selection) return null
  return (
    <Popover.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchorAt(selection.rect)}
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          className="word-positioner"
        >
          <Popover.Popup
            aria-label="Teks terpilih"
            className="selection-menu"
            initialFocus={false}
            finalFocus={false}
          >
            <Button size="lg" variant="ghost" onClick={onHighlight}>
              <HighlighterIcon aria-hidden="true" />
              Highlight
            </Button>
            <Button size="lg" variant="ghost" onClick={onNote}>
              <StickyNoteIcon aria-hidden="true" />
              Catatan
            </Button>
            <Button size="lg" variant="ghost" onClick={onCopy}>
              <CopyIcon aria-hidden="true" />
              Salin
            </Button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

- [ ] **Step 5: Popup anotasi**

Buat `src/components/reader/AnnotationPopup.tsx`:

```tsx
import { Button } from "@/components/ui/button"
import { HIGHLIGHT_FILL } from "@/lib/annotations/draw"
import {
  type Annotation,
  HIGHLIGHT_COLORS,
  type HighlightColor,
} from "@/lib/annotations/types"
import { ReaderPopup, type WordRect } from "./ReaderPopup"
import type { WordTap } from "./WordPopup"

/** A tap on a highlight: which one, where, and the word under the tap if any. */
export type HighlightTap = { cfi: string; rect: WordRect; word: WordTap | null }

export const COLOR_LABELS: Record<HighlightColor, string> = {
  yellow: "Kuning",
  green: "Hijau",
  blue: "Biru",
  pink: "Merah muda",
}

/**
 * What a tapped highlight can do (spec 2 §6.6): another colour, its note,
 * deletion, and the meaning of the word tapped inside it.
 */
export function AnnotationPopup({
  tap,
  annotation,
  onColor,
  onNote,
  onDelete,
  onMeaning,
  onClose,
  finalFocus,
}: {
  tap: HighlightTap | null
  /** The highlight tapped, or null once it is gone. */
  annotation: Annotation | null
  onColor: (color: HighlightColor) => void
  onNote: () => void
  onDelete: () => void
  onMeaning: () => void
  onClose: () => void
  finalFocus: () => HTMLElement | null
}) {
  if (!tap || !annotation) return null
  return (
    <ReaderPopup
      rect={tap.rect}
      label="Highlight"
      onClose={onClose}
      finalFocus={finalFocus}
    >
      <div className="annotation-card">
        <div role="group" aria-label="Warna" className="annotation-colors">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={COLOR_LABELS[color]}
              aria-pressed={annotation.color === color}
              className="annotation-swatch"
              style={{ background: HIGHLIGHT_FILL[color] }}
              onClick={() => onColor(color)}
            />
          ))}
        </div>
        {annotation.note && (
          <p className="annotation-note">{annotation.note}</p>
        )}
        <div className="annotation-actions">
          <Button size="lg" variant="outline" onClick={onNote}>
            Catatan
          </Button>
          <Button size="lg" variant="destructive" onClick={onDelete}>
            Hapus
          </Button>
          {tap.word && (
            <Button size="lg" variant="ghost" onClick={onMeaning}>
              {`Arti "${tap.word.word}"`}
            </Button>
          )}
        </div>
      </div>
    </ReaderPopup>
  )
}
```

- [ ] **Step 6: Editor catatan**

Buat `src/components/reader/NoteEditor.tsx`:

```tsx
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { type Annotation, MAX_NOTE_LENGTH } from "@/lib/annotations/types"
import { useWideScreen } from "@/lib/use-wide-screen"

/**
 * A highlight's note (spec 2 §6.6): a dialog on wide screens, a bottom sheet
 * on phones. Closing it in any way keeps what was typed; the page decides
 * what an empty note means. Give it a `key` per annotation.
 */
export function NoteEditor({
  annotation,
  onClose,
  finalFocus,
}: {
  annotation: Annotation | null
  onClose: (note: string) => void
  finalFocus: () => HTMLElement | null
}) {
  const wide = useWideScreen()
  const [text, setText] = useState(annotation?.note ?? "")
  if (!annotation) return null
  const close = () => onClose(text)
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="word-sheet-backdrop" />
        <DialogPrimitive.Popup
          aria-label="Catatan"
          className={wide ? "note-dialog" : "word-sheet note-sheet"}
          finalFocus={finalFocus}
        >
          <DialogPrimitive.Title className="font-heading text-lg">
            Catatan
          </DialogPrimitive.Title>
          <blockquote className="vocab-sentence">{annotation.excerpt}</blockquote>
          <textarea
            aria-label="Isi catatan"
            className="note-input"
            value={text}
            maxLength={MAX_NOTE_LENGTH}
            rows={6}
            onChange={(event) => setText(event.target.value)}
          />
          <Button size="lg" className="justify-self-end" onClick={close}>
            Selesai
          </Button>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
```

Catatan: Escape menutup dialog lewat `onOpenChange(false)`, jadi `onClose` terpanggil sekali dengan teks terakhir. Tombol Selesai memanggil `close()` langsung; halaman lalu melepas `annotation` (null), jadi dialog hilang tanpa memanggil `onOpenChange` lagi.

- [ ] **Step 7: Gaya**

Di `src/styles.css`, tepat **sebelum** baris `  /* Kosakata (spec 2 §6.4). */` (di tingkat yang sama dengan `.word-card`, bukan di dalam `@media`), tambahkan:

```css
  /* Annotations (spec 2 §6.6). */
  .selection-menu {
    display: flex;
    gap: 0.25rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--color-panel);
    padding: 0.25rem;
    color: var(--foreground);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.25);
    outline: none;
  }
  .annotation-card {
    display: grid;
    gap: 0.75rem;
    font-size: 0.9rem;
  }
  .annotation-colors {
    display: flex;
    gap: 0.5rem;
  }
  .annotation-swatch {
    width: 2rem;
    height: 2rem;
    border: 2px solid transparent;
    border-radius: 9999px;
  }
  .annotation-swatch[aria-pressed="true"] {
    border-color: var(--foreground);
  }
  .annotation-swatch:focus-visible {
    outline: 2px solid var(--color-mint);
    outline-offset: 2px;
  }
  .annotation-note {
    white-space: pre-wrap;
    color: var(--muted-foreground);
  }
  .annotation-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .note-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 50;
    display: grid;
    gap: 0.75rem;
    width: min(32rem, calc(100vw - 2rem));
    translate: -50% -50%;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--color-panel);
    padding: 1rem;
    color: var(--foreground);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.25);
    outline: none;
  }
  .note-sheet {
    display: grid;
    gap: 0.75rem;
  }
  .note-input {
    width: 100%;
    min-height: 8rem;
    resize: vertical;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--background);
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
  }
  .note-input:focus-visible {
    outline: 2px solid var(--color-mint);
  }
```

- [ ] **Step 8: Jalankan test, pastikan lulus**

Run: `npx vitest run src/components/reader`
Expected: PASS, termasuk `WordPopup.test.tsx` tanpa diubah.

- [ ] **Step 9: Typecheck, lint, format, dan commit**

Run: `npm run typecheck && npm run lint && npm run check`
Expected: tanpa error.

```bash
git add src/components/reader src/styles.css
git commit -m "feat(reader): selection menu, highlight popup and note editor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Panel anotasi dan tombol bookmark

**Files:**
- Create: `src/components/reader/AnnotationList.tsx`
- Modify: `src/components/reader/TocPanel.tsx`
- Modify: `src/components/reader/ReaderToolbar.tsx`
- Modify: `src/styles.css`
- Test: `src/components/reader/AnnotationList.test.tsx` (baru), `src/components/reader/TocPanel.test.tsx` (ubah), `src/components/reader/ReaderToolbar.test.tsx` (baru)

**Interfaces:**
- Consumes: `Annotation` (Task 3), `inBookOrder` (Task 7), `HIGHLIGHT_FILL` (Task 7), `COLOR_LABELS` (Task 8).
- Produces:
  - `AnnotationList({ annotations, chaptersOf, onSelect, onDelete })`. `chaptersOf: ((cfis: ReadonlyArray<string>) => Promise<Array<string | null>>) | null`.
  - `TocPanel` dengan prop tambahan `annotations: ReadonlyArray<Annotation>`, `chaptersOf`, `onSelectPlace(cfi: string)`, `onDeleteAnnotation(annotation: Annotation)`. Dialog bernama "Daftar isi dan anotasi", tab "Daftar isi" (awal) dan "Anotasi".
  - `ReaderToolbar` dengan prop tambahan `bookmarked: boolean`, `onBookmark: () => void`. Tombol "Bookmark halaman ini" / "Hapus bookmark" (`aria-pressed`). Tombol daftar isi bernama "Daftar isi dan anotasi".

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/components/reader/AnnotationList.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Annotation } from "@/lib/annotations/types"
import { AnnotationList } from "./AnnotationList"

const base: Annotation = {
  id: "a",
  bookId: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  kind: "highlight",
  cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  color: "green",
  note: "Penting",
  excerpt: "To Sherlock Holmes",
  createdAt: "2026-10-24T08:00:00.000Z",
  updatedAt: "2026-10-24T08:00:00.000Z",
  deletedAt: null,
}
const later: Annotation = {
  ...base,
  id: "b",
  kind: "bookmark",
  cfi: "epubcfi(/6/8!/4/2/1:0)",
  color: null,
  note: "",
  excerpt: "Chapter two begins",
}

describe("AnnotationList", () => {
  it("lists annotations in book order with their chapters", async () => {
    const chaptersOf = vi.fn(async (cfis: ReadonlyArray<string>) =>
      cfis.map((cfi) => (cfi.includes("/6/4!") ? "Bab Satu" : null))
    )
    render(
      <AnnotationList
        annotations={[later, base]}
        chaptersOf={chaptersOf}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("To Sherlock Holmes")
    expect(items[0]).toHaveTextContent("Penting")
    expect(items[1]).toHaveTextContent("Bookmark")
    expect(await within(items[0]).findByText(/Bab Satu/)).toBeInTheDocument()
  })

  it("goes to an annotation and deletes one", () => {
    const onSelect = vi.fn()
    const onDelete = vi.fn()
    render(
      <AnnotationList
        annotations={[base]}
        chaptersOf={null}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /To Sherlock Holmes/ }))
    expect(onSelect).toHaveBeenCalledWith(base.cfi)
    fireEvent.click(screen.getByRole("button", { name: "Hapus anotasi" }))
    expect(onDelete).toHaveBeenCalledWith(base)
  })

  it("says how to make one when there are none", () => {
    render(
      <AnnotationList
        annotations={[]}
        chaptersOf={null}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText(/Belum ada anotasi/)).toBeInTheDocument()
  })
})
```

Ubah `src/components/reader/TocPanel.test.tsx`:
- Di kedua render, tambahkan prop `annotations={[]}`, `chaptersOf={null}`, `onSelectPlace={() => undefined}`, `onDeleteAnnotation={() => undefined}`.
- Ganti `await screen.findByRole("dialog", { name: "Daftar isi" })` dengan `await screen.findByRole("dialog", { name: "Daftar isi dan anotasi" })`.
- Tambahkan test:

```tsx
  it("shows the annotations in their own tab", async () => {
    render(
      <TocPanel
        open
        onOpenChange={() => undefined}
        toc={toc}
        currentHref={null}
        onSelect={() => undefined}
        annotations={[]}
        chaptersOf={null}
        onSelectPlace={() => undefined}
        onDeleteAnnotation={() => undefined}
      />
    )
    fireEvent.click(await screen.findByRole("tab", { name: "Anotasi" }))
    expect(await screen.findByText(/Belum ada anotasi/)).toBeInTheDocument()
  })
```

Buat `src/components/reader/ReaderToolbar.test.tsx`:

```tsx
import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { renderWithRouter } from "@/test/router"
import { ReaderToolbar } from "./ReaderToolbar"

const props = {
  title: "Buku Uji",
  hidden: false,
  syncStatus: "synced" as const,
  onToc: () => undefined,
  onSettings: () => undefined,
}

// ReaderToolbar has a <Link>, so it renders inside a small router.
describe("ReaderToolbar", () => {
  it("bookmarks the page", async () => {
    const onBookmark = vi.fn()
    renderWithRouter(
      <ReaderToolbar {...props} bookmarked={false} onBookmark={onBookmark} />
    )
    const button = await screen.findByRole("button", {
      name: "Bookmark halaman ini",
    })
    expect(button).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(button)
    expect(onBookmark).toHaveBeenCalled()
  })

  it("shows that the page has a bookmark", async () => {
    renderWithRouter(
      <ReaderToolbar {...props} bookmarked onBookmark={() => undefined} />
    )
    expect(
      await screen.findByRole("button", { name: "Hapus bookmark" })
    ).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.getByRole("button", { name: "Daftar isi dan anotasi" })
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/reader/AnnotationList.test.tsx src/components/reader/TocPanel.test.tsx src/components/reader/ReaderToolbar.test.tsx`
Expected: FAIL, `AnnotationList` belum ada, dialog dan tombol belum bernama baru.

- [ ] **Step 3: Daftar anotasi**

Buat `src/components/reader/AnnotationList.tsx`:

```tsx
import { BookmarkIcon, Trash2Icon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { HIGHLIGHT_FILL } from "@/lib/annotations/draw"
import { inBookOrder } from "@/lib/annotations/places"
import type { Annotation } from "@/lib/annotations/types"
import { COLOR_LABELS } from "./AnnotationPopup"

type ChaptersOf = (cfis: ReadonlyArray<string>) => Promise<Array<string | null>>

/**
 * The Anotasi tab (spec 2 §6.6): bookmarks and highlights in book order, with
 * their text, colour, note and chapter. A tap goes to the place.
 */
export function AnnotationList({
  annotations,
  chaptersOf,
  onSelect,
  onDelete,
}: {
  annotations: ReadonlyArray<Annotation>
  /** Null until the book is open. */
  chaptersOf: ChaptersOf | null
  onSelect: (cfi: string) => void
  onDelete: (annotation: Annotation) => void
}) {
  const ordered = useMemo(() => inBookOrder(annotations), [annotations])
  const [chapters, setChapters] = useState<ReadonlyMap<string, string | null>>(
    new Map()
  )

  useEffect(() => {
    if (!chaptersOf || ordered.length === 0) return
    let live = true
    const cfis = ordered.map((annotation) => annotation.cfi)
    chaptersOf(cfis)
      .then((labels) => {
        if (live) setChapters(new Map(cfis.map((cfi, i) => [cfi, labels[i]])))
      })
      .catch((error: unknown) =>
        console.error("reading the chapters of annotations failed", error)
      )
    return () => {
      live = false
    }
  }, [ordered, chaptersOf])

  if (ordered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada anotasi. Pilih teks untuk membuat highlight, atau ketuk tombol
        bookmark untuk menandai halaman.
      </p>
    )
  }
  return (
    <ol className="annotation-list">
      {ordered.map((annotation) => {
        const chapter = chapters.get(annotation.cfi)
        const bookmark = annotation.kind === "bookmark"
        return (
          <li key={annotation.id} className="annotation-item">
            <button
              type="button"
              className="annotation-place"
              onClick={() => onSelect(annotation.cfi)}
            >
              <span className="annotation-kind">
                {bookmark ? (
                  <BookmarkIcon aria-hidden="true" className="size-3" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="annotation-dot"
                    style={{
                      background: HIGHLIGHT_FILL[annotation.color ?? "yellow"],
                    }}
                  />
                )}
                {bookmark
                  ? "Bookmark"
                  : `Highlight ${COLOR_LABELS[annotation.color ?? "yellow"].toLowerCase()}`}
                {chapter ? ` · ${chapter}` : ""}
              </span>
              <span className="annotation-excerpt">
                {annotation.excerpt || "…"}
              </span>
              {annotation.note && (
                <span className="annotation-note">{annotation.note}</span>
              )}
            </button>
            <Button
              variant="ghost"
              size="icon-lg"
              className="size-10"
              aria-label="Hapus anotasi"
              onClick={() => onDelete(annotation)}
            >
              <Trash2Icon aria-hidden="true" />
            </Button>
          </li>
        )
      })}
    </ol>
  )
}
```

- [ ] **Step 4: Tab di panel**

Di `src/components/reader/TocPanel.tsx`:

1. Buang `DialogHeader` dari import `@/components/ui/dialog` (tidak dipakai lagi), lalu tambahkan:

```tsx
import { Tabs } from "@base-ui/react/tabs"
import type { Annotation } from "@/lib/annotations/types"
import { AnnotationList } from "./AnnotationList"
```

2. Ganti fungsi `TocPanel` dengan:

```tsx
/** The table of contents and the book's annotations, as two tabs (spec 2 §6.6). */
export function TocPanel({
  open,
  onOpenChange,
  toc,
  currentHref,
  onSelect,
  annotations,
  chaptersOf,
  onSelectPlace,
  onDeleteAnnotation,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  toc: ReadonlyArray<TocItem>
  currentHref: string | null
  onSelect: (href: string) => void
  annotations: ReadonlyArray<Annotation>
  chaptersOf: Parameters<typeof AnnotationList>[0]["chaptersOf"]
  onSelectPlace: (cfi: string) => void
  onDeleteAnnotation: (annotation: Annotation) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-md">
        <DialogTitle className="sr-only">Daftar isi dan anotasi</DialogTitle>
        <Tabs.Root defaultValue="toc" className="grid gap-3">
          <Tabs.List className="reader-tabs">
            <Tabs.Tab value="toc" className="reader-tab">
              Daftar isi
            </Tabs.Tab>
            <Tabs.Tab value="annotations" className="reader-tab">
              Anotasi
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="toc">
            {toc.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Buku ini tidak punya daftar isi.
              </p>
            ) : (
              <TocList
                items={toc}
                currentHref={currentHref}
                onSelect={onSelect}
              />
            )}
          </Tabs.Panel>
          <Tabs.Panel value="annotations">
            <AnnotationList
              annotations={annotations}
              chaptersOf={chaptersOf}
              onSelect={onSelectPlace}
              onDelete={onDeleteAnnotation}
            />
          </Tabs.Panel>
        </Tabs.Root>
      </DialogContent>
    </Dialog>
  )
}
```

`TocList` tetap seperti sekarang.

- [ ] **Step 5: Tombol bookmark**

Di `src/components/reader/ReaderToolbar.tsx`:

1. Ganti import ikon menjadi `import { ArrowLeft, Bookmark, BookmarkCheck, List, Type } from "lucide-react"`.
2. Tambahkan prop `bookmarked: boolean` dan `onBookmark: () => void` (tipe dan destrukturisasi).
3. Sisipkan sebelum tombol "Daftar isi":

```tsx
      <Button
        variant="ghost"
        size="icon-lg"
        className="size-10"
        aria-label={bookmarked ? "Hapus bookmark" : "Bookmark halaman ini"}
        aria-pressed={bookmarked}
        onClick={onBookmark}
      >
        {bookmarked ? (
          <BookmarkCheck aria-hidden="true" />
        ) : (
          <Bookmark aria-hidden="true" />
        )}
      </Button>
```

4. Ubah `aria-label="Daftar isi"` menjadi `aria-label="Daftar isi dan anotasi"`.

- [ ] **Step 6: Gaya**

Di `src/styles.css`, tepat setelah blok `.toc-item[aria-current="true"] { … }`, tambahkan:

```css
  .reader-tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid var(--border);
    padding-right: 2rem;
  }
  .reader-tab {
    border-bottom: 2px solid transparent;
    padding: 0.4rem 0.75rem;
    font-size: 0.875rem;
    color: var(--muted-foreground);
  }
  .reader-tab[aria-selected="true"] {
    border-color: var(--color-mint);
    color: var(--foreground);
    font-weight: 700;
  }
  .annotation-list {
    display: grid;
    gap: 0.25rem;
  }
  .annotation-item {
    display: flex;
    align-items: flex-start;
    gap: 0.25rem;
  }
  .annotation-place {
    display: grid;
    flex: 1;
    gap: 0.2rem;
    border-radius: 0.375rem;
    padding: 0.5rem;
    text-align: left;
    font-size: 0.85rem;
  }
  .annotation-place:hover {
    background: var(--muted);
  }
  .annotation-kind {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.7rem;
    color: var(--muted-foreground);
  }
  .annotation-dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 9999px;
  }
  .annotation-excerpt {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
  }
  /* The ribbon of a bookmarked page (spec 2 §6.6), below the top bar. */
  .reader-ribbon {
    position: absolute;
    top: 0;
    right: max(1.5rem, env(safe-area-inset-right));
    z-index: 0;
    width: 1.25rem;
    height: 5.5rem;
    background: var(--color-mint);
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);
    pointer-events: none;
  }
```

- [ ] **Step 7: Sambungan sementara di reader**

Supaya build tetap hijau sampai Task 11 menyambungkan semuanya, di `src/routes/_member/read.$bookId.tsx`:
- beri `<ReaderToolbar … bookmarked={false} onBookmark={() => undefined} />`;
- beri `<TocPanel … annotations={[]} chaptersOf={null} onSelectPlace={(cfi) => { setPanel(null); go((current) => current.goTo(cfi)) }} onDeleteAnnotation={() => undefined} />`.

Task 11 mengganti keduanya.

- [ ] **Step 8: Jalankan test, pastikan lulus**

Run: `npx vitest run src/components/reader && npm run typecheck`
Expected: PASS, tanpa error tipe.

- [ ] **Step 9: Lint, format, dan commit**

Run: `npm run lint && npm run check`
Expected: tanpa error.

```bash
git add src/components/reader src/styles.css src/routes/_member/read.\$bookId.tsx
git commit -m "feat(reader): annotations tab beside the contents, bookmark button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: ReaderView — highlight, seleksi, dan urutan klik

**Files:**
- Modify: `src/components/reader/ReaderView.tsx`
- Modify: `src/routes/_member/read.$bookId.tsx` (hanya nama prop yang berubah)
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `drawHighlight`, `HIGHLIGHT_FILL`, `selectedRange`, `endRect`, `rectAt` (Task 7); `excerptOf`, `BOOKMARK_EXCERPT_LENGTH` (Task 3); tipe `TextSelection` (Task 8, `SelectionMenu.tsx`), `HighlightTap` (Task 8, `AnnotationPopup.tsx`), `Annotation`.
- Produces (dipakai Task 11):
  - `ReaderLocation` mendapat `pageText: string` (awal teks halaman, maksimal 200 karakter).
  - `ReaderControls` mendapat `clearSelection(): void`, `canOpen(cfi: string): Promise<boolean>`, dan `chaptersOf(cfis: ReadonlyArray<string>): Promise<Array<string | null>>`.
  - Prop baru `highlights: ReadonlyArray<Annotation>` (yang digambar) dan `popupOpen: boolean` (popup apa pun terbuka: ketukan di ruang kosong hanya menutupnya).
  - Callback baru `onSelection(selection: TextSelection | null)`, `onHighlight(tap: HighlightTap)`. `onDismissWord` berganti nama menjadi `onDismiss`.
  - Urutan klik di dokumen section: tautan (foliate) → ada teks terpilih (diam; menunya menyusul) → menu seleksi terbuka (hanya menutup) → highlight → kata → popup terbuka (hanya menutup) → zona.

Tidak ada unit test baru di task ini: semua yang bisa diuji tanpa layout ada di Task 7, dan perilakunya diuji E2E di Task 11. Penjaga regresinya adalah `e2e/reader.spec.ts` dan `e2e/vocabulary.spec.ts`.

- [ ] **Step 1: Ganti `ReaderView.tsx`**

Ganti seluruh isi `src/components/reader/ReaderView.tsx` dengan:

```tsx
import type {
  DrawAnnotationDetail,
  FoliateRenderer,
  RelocateDetail,
  View,
} from "foliate-js/view.js"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { BOOKMARK_EXCERPT_LENGTH, excerptOf } from "@/lib/annotations/changes"
import { HIGHLIGHT_FILL, drawHighlight } from "@/lib/annotations/draw"
import { endRect, rectAt, selectedRange } from "@/lib/annotations/selection"
import type { Annotation } from "@/lib/annotations/types"
import { type OpenedBook, openBookFile } from "@/lib/epub/open-book"
import {
  type FontSources,
  MARGIN_GAP,
  type ReaderSettings,
  THEME_COLORS,
  readerCss,
} from "@/lib/reader-settings"
import type { TocItem } from "@/lib/reader-types"
import {
  type SavedForms,
  markSavedWords,
  showActiveWord,
  whenIdle,
} from "@/lib/words/saved-marks"
import { type WordHit, wordAt } from "@/lib/words/word-at"
import type { HighlightTap } from "./AnnotationPopup"
import { loadReaderFonts } from "./reader-fonts"
import {
  type ReaderMove,
  type TapAction,
  createWheelPager,
  isControlTarget,
  isTypingTarget,
  keyMove,
  swipeVelocity,
  tapAction,
} from "./reader-input"
import type { TextSelection } from "./SelectionMenu"
import type { WordRect, WordTap } from "./WordPopup"

export type ReaderLocation = {
  fraction: number
  cfi: string
  chapter: string | null
  chapterHref: string | null
  /** The start of the page's text: a bookmark's excerpt. */
  pageText: string
}

export type ReaderControls = {
  goTo: (target: string) => Promise<void>
  goToFraction: (fraction: number) => Promise<void>
  move: (move: ReaderMove) => Promise<void>
  /** Drops the text selected in the book. */
  clearSelection: () => void
  /** Whether the book has this place (spec 2 §8). Never rejects. */
  canOpen: (cfi: string) => Promise<boolean>
  /** The chapter of each place, for the annotations panel. Never rejects. */
  chaptersOf: (cfis: ReadonlyArray<string>) => Promise<Array<string | null>>
}

export type ReaderReady = { controls: ReaderControls; toc: Array<TocItem> }

type Callbacks = {
  onReady: (ready: ReaderReady) => void
  onRelocate: (location: ReaderLocation) => void
  /** Called before every page turn the member makes. */
  onInteract: () => void
  onTapMenu: () => void
  /** A tap on a word (spec 2 §6.1, step 4). */
  onWord: (tap: WordTap) => void
  /** A tap on a highlight (spec 2 §6.1, step 2). */
  onHighlight: (tap: HighlightTap) => void
  /** Text selected, or the selection gone (spec 2 §6.6). */
  onSelection: (selection: TextSelection | null) => void
  /** A tap beside the words while a popup shows: it closes, the page stays. */
  onDismiss: () => void
  /** `target` is not a place in this book (spec 2 §8). */
  onTargetMissing: () => void
  onError: (error: unknown) => void
}

/** Room above and below the text for the reader's bars, which overlay the book. */
const BAR_SPACE = "64px"
const MAX_LINE_LENGTH = "720px"
/** A selection that has stopped changing this long gets its menu (plan 2B, decision 9). */
const SELECTION_SETTLE_MS = 300

function applySettings(
  view: View,
  settings: ReaderSettings,
  fonts: FontSources
) {
  const renderer = view.renderer
  renderer.setAttribute("flow", settings.flow)
  renderer.setAttribute("gap", MARGIN_GAP[settings.margin])
  renderer.setAttribute("margin", BAR_SPACE)
  renderer.setAttribute("max-inline-size", MAX_LINE_LENGTH)
  renderer.setStyles?.(readerCss(settings, fonts))
}

/**
 * foliate's paginator lays its section out again whenever its box resizes,
 * even while the section's document is still loading and has no root element
 * yet, and then throws. It lays the section out itself once it has loaded, so
 * a resize during loading can wait for that.
 */
function skipLayoutWhileLoading(renderer: FoliateRenderer) {
  const render = renderer.render?.bind(renderer)
  const getContents = renderer.getContents?.bind(renderer)
  if (!render || !getContents) return
  renderer.render = () => {
    const loading = getContents().some(
      ({ doc }) => doc?.readyState === "loading"
    )
    if (!loading) render()
  }
}

/**
 * Lets foliate settle each swipe by the whole swipe rather than by how fast
 * the finger was moving just before it lifted (see swipeVelocity). Returns
 * the touch listeners that measure the swipe, for the host and every section.
 */
function snapByWholeSwipe(renderer: FoliateRenderer) {
  const snap = renderer.snap?.bind(renderer)
  let start: { x: number; y: number } | null = null
  let swipe: number | null = null
  if (snap) {
    renderer.snap = (vx, vy) => {
      const velocity = swipe
      swipe = null
      snap(velocity ?? vx, vy)
    }
  }
  return {
    touchstart: (event: TouchEvent) => {
      const touches = event.touches
      start =
        touches.length === 1
          ? { x: touches[0].screenX, y: touches[0].screenY }
          : null
      swipe = null
    },
    // foliate snaps on the next frame, after this has run.
    touchend: (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      if (start && event.touches.length === 0)
        swipe = swipeVelocity(touch.screenX - start.x, touch.screenY - start.y)
      start = null
    },
  }
}

/**
 * foliate slides from page to page while the renderer is "animated"; it stays
 * still for members who asked their device for less motion. Returns a stop.
 */
function animateUnlessReduced(renderer: FoliateRenderer): () => void {
  if (typeof window.matchMedia !== "function") return () => {}
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
  const apply = () => renderer.toggleAttribute("animated", !reduce.matches)
  apply()
  reduce.addEventListener("change", apply)
  return () => reduce.removeEventListener("change", apply)
}

/**
 * Whether the book has the place a CFI points at: its section exists and the
 * path inside it leads somewhere. Never rejects.
 */
async function canOpen(view: View, cfi: string): Promise<boolean> {
  try {
    const resolved = view.resolveNavigation(cfi)
    if (
      resolved === undefined ||
      resolved.index < 0 ||
      resolved.index >= view.book.sections.length
    )
      return false
    const { anchor } = resolved
    if (!anchor) return true
    const doc = await view.book.sections[resolved.index].createDocument?.()
    if (!doc) return false
    // foliate resolves the path lazily and throws when it leads nowhere.
    return Boolean(anchor(doc))
  } catch {
    return false
  }
}

/**
 * The chapter of each place (plan 2B, decision 13). Each section's document
 * is read once per call. Never rejects: a place it cannot find has none.
 */
async function chaptersOf(
  view: View,
  cfis: ReadonlyArray<string>
): Promise<Array<string | null>> {
  const docs = new Map<number, Promise<Document | undefined>>()
  const docOf = (index: number) => {
    let doc = docs.get(index)
    if (!doc) {
      doc = Promise.resolve(view.book.sections[index]?.createDocument?.())
      docs.set(index, doc)
    }
    return doc
  }
  return Promise.all(
    cfis.map(async (cfi) => {
      try {
        const resolved = view.resolveNavigation(cfi)
        if (!resolved || resolved.index < 0) return null
        const doc = await docOf(resolved.index)
        const target = doc && resolved.anchor ? resolved.anchor(doc) : null
        let range: Range | undefined
        if (target instanceof Range) range = target
        else if (doc && target instanceof Node) {
          range = doc.createRange()
          range.selectNodeContents(target)
        }
        const label = view
          .getProgressOf(resolved.index, range)
          .tocItem?.label?.trim()
        return label ? label : null
      } catch {
        return null
      }
    })
  )
}

/** How a highlight looks: drawn again when this changes. */
const lookOf = (highlight: Annotation) =>
  `${highlight.color ?? ""} ${highlight.note === "" ? "" : "note"}`

const drawFailed = (error: unknown) =>
  console.error("drawing a highlight failed", error)

/**
 * Brings the overlay in line with the highlights wanted: gone ones are
 * cleared, new or changed ones drawn. A section not shown has no overlay;
 * its highlights are drawn when it loads ("create-overlay").
 */
function redrawHighlights(
  view: View,
  wanted: ReadonlyMap<string, Annotation>,
  drawn: Map<string, string>
) {
  for (const cfi of [...drawn.keys()]) {
    if (wanted.has(cfi)) continue
    drawn.delete(cfi)
    view.deleteAnnotation({ value: cfi }).catch(drawFailed)
  }
  for (const [cfi, highlight] of wanted) {
    const look = lookOf(highlight)
    if (drawn.get(cfi) === look) continue
    drawn.set(cfi, look)
    view.addAnnotation({ value: cfi }).catch(drawFailed)
  }
}

function toLocation(detail: RelocateDetail): ReaderLocation {
  const label = detail.tocItem?.label?.trim()
  return {
    fraction: detail.fraction,
    cfi: detail.cfi,
    chapter: label ? label : null,
    chapterHref: detail.tocItem?.href ?? null,
    pageText: excerptOf(
      detail.range?.toString() ?? "",
      BOOKMARK_EXCERPT_LENGTH
    ),
  }
}

/** Renders one EPUB with foliate-js (spec §9). Opens the file once per `file`. */
export function ReaderView({
  file,
  start,
  target,
  settings,
  wordOpen,
  popupOpen,
  savedForms,
  highlights,
  ...callbacks
}: {
  file: Blob
  /** CFI to open at; null opens at the start of the text. */
  start: string | null
  /** A place asked for (Kosakata's "Buka di buku"); opened instead of `start`. */
  target: string | null
  settings: ReaderSettings
  /** A word's meaning shows: the tapped word stays lit. */
  wordOpen: boolean
  /** Any popup shows: a tap beside the words closes it. */
  popupOpen: boolean
  savedForms: SavedForms
  /** The book's highlights, drawn over the text. */
  highlights: ReadonlyArray<Annotation>
} & Callbacks) {
  const hostRef = useRef<HTMLElement>(null)
  const viewRef = useRef<View | null>(null)
  const callbacksRef = useRef(callbacks)
  const settingsRef = useRef(settings)
  const fontsRef = useRef<FontSources | null>(null)
  // Read once on purpose: the start position applies only when a file opens.
  const startRef = useRef(start)
  const targetRef = useRef(target)
  const popupOpenRef = useRef(popupOpen)
  const savedFormsRef = useRef(savedForms)
  // The highlights wanted, by CFI, and how each one is drawn now.
  const highlightsRef = useRef<ReadonlyMap<string, Annotation>>(new Map())
  const drawnRef = useRef(new Map<string, string>())
  const [hoverTurn, setHoverTurn] = useState<"left" | "right" | null>(null)

  useEffect(() => {
    callbacksRef.current = callbacks
    settingsRef.current = settings
    popupOpenRef.current = popupOpen
    savedFormsRef.current = savedForms
  })

  useEffect(() => {
    highlightsRef.current = new Map(
      highlights.map((highlight) => [highlight.cfi, highlight])
    )
    const view = viewRef.current
    if (view) redrawHighlights(view, highlightsRef.current, drawnRef.current)
  }, [highlights])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false as boolean
    let opened: OpenedBook | null = null
    let view: View | null = null
    const isCancelled = () => cancelled
    const call = () => callbacksRef.current
    const interact = () => call().onInteract()
    let swipes: ReturnType<typeof snapByWholeSwipe> | null = null
    let stopAnimating = () => {}
    const wheelPager = createWheelPager()
    // The section shown now, whose cursor follows the mouse.
    let sectionDoc: Document | null = null
    // Whether the page was told about a selection it has not been told is gone.
    let selectionShown = false
    // A new book: nothing of it is drawn yet.
    drawnRef.current = new Map()

    const zoneAt = (x: number): TapAction => {
      const box = host.getBoundingClientRect()
      return tapAction(x, box.left, box.width)
    }

    /** A click or tap at x (in this window) turns the page or shows the frame. */
    const tapAt = (x: number) => {
      const action = zoneAt(x)
      if (action === "menu") {
        call().onTapMenu()
        return
      }
      interact()
      void move(action)
    }

    const cfiOf = (index: number, range: Range): string | null => {
      try {
        return view?.getCFI(index, range) ?? null
      } catch {
        return null
      }
    }

    const clearSelection = () => {
      selectionShown = false
      for (const { doc } of view?.renderer.getContents?.() ?? []) {
        doc?.getSelection()?.removeAllRanges()
      }
    }

    /** Closes whatever popup shows, the selection menu with its selection. */
    const dismiss = () => {
      if (selectionShown) clearSelection()
      call().onDismiss()
    }

    /** A mouse over the outer 30% shows which way a click there turns. */
    const hoverAt = (x: number | null) => {
      const zone = x === null ? null : zoneAt(x)
      const turn = zone === "left" || zone === "right" ? zone : null
      const cursor = turn ? "pointer" : ""
      host.style.cursor = cursor
      if (sectionDoc) sectionDoc.documentElement.style.cursor = cursor
      setHoverTurn(turn)
    }

    // Clicks beside the book's frame: on wide screens foliate leaves a band
    // on each side outside it. Clicks inside the frame stay in its document.
    const onHostClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      // A popup is open: this click only closes it (spec 2 decision 9).
      if (popupOpenRef.current || selectionShown) {
        dismiss()
        return
      }
      tapAt(event.clientX)
    }
    const onHostPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hoverAt(event.clientX)
    }
    const onHostPointerLeave = () => hoverAt(null)

    const turn = async (direction: ReaderMove) => {
      if (!view) return
      if (direction === "left") await view.goLeft()
      else if (direction === "right") await view.goRight()
      else if (direction === "prev") await view.prev()
      else await view.next()
    }

    // foliate drops a turn asked for while the last one still slides, so a
    // quick second press or tap waits for it instead (the latest one only).
    let turning = false
    let queued: ReaderMove | null = null
    const takeQueued = () => {
      const next = queued
      queued = null
      return next
    }
    const move = async (direction: ReaderMove) => {
      if (turning) {
        queued = direction
        return
      }
      turning = true
      try {
        for (let next: ReaderMove | null = direction; next; next = takeQueued())
          await turn(next)
      } finally {
        turning = false
      }
    }

    let tornDown = false
    // Shared by cleanup and the early exits; never throws, so the element and
    // the book are always released even if the paginator cannot close.
    const teardown = async () => {
      if (tornDown) return
      tornDown = true
      viewRef.current = null
      document.removeEventListener("keydown", onKey)
      host.removeEventListener("pointerdown", interact)
      host.removeEventListener("wheel", interact)
      host.removeEventListener("wheel", onWheel)
      host.removeEventListener("click", onHostClick)
      host.removeEventListener("pointermove", onHostPointerMove)
      host.removeEventListener("pointerleave", onHostPointerLeave)
      stopAnimating()
      if (swipes) {
        host.removeEventListener("touchstart", swipes.touchstart)
        host.removeEventListener("touchend", swipes.touchend)
      }
      try {
        view?.close()
      } catch (error) {
        console.error(error)
      }
      view?.remove()
      await opened?.close()
    }

    const onKey = (event: KeyboardEvent) => {
      const direction = keyMove(event.key, event.shiftKey)
      if (!direction || event.defaultPrevented) return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (isTypingTarget(event.target)) return
      if (event.key === " " && isControlTarget(event.target)) return
      event.preventDefault()
      interact()
      void move(direction)
    }

    // In paginated flow foliate ignores the wheel; scrolled flow scrolls natively.
    const onWheel = (event: WheelEvent) => {
      if (settingsRef.current.flow !== "paginated" || event.ctrlKey) return
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? host.clientHeight
            : 1
      // timeStamp counts from its own window's start, and every section has
      // its own frame: made absolute, times from any of them compare.
      const origin = (event.view ?? window).performance.timeOrigin
      const direction = wheelPager(
        event.deltaX * unit,
        event.deltaY * unit,
        origin + event.timeStamp
      )
      if (!direction) return
      interact()
      void move(direction)
    }

    const onSectionLoad = (event: Event) => {
      const { doc, index } = (
        event as CustomEvent<{ doc: Document; index: number }>
      ).detail
      doc.addEventListener("keydown", onKey)
      doc.addEventListener("pointerdown", interact)
      doc.addEventListener("wheel", interact, { passive: true })
      doc.addEventListener("wheel", onWheel, { passive: true })
      if (swipes) {
        doc.addEventListener("touchstart", swipes.touchstart, { passive: true })
        doc.addEventListener("touchend", swipes.touchend)
      }
      // The frame's own coordinates, moved into this window's.
      const frameBox = () =>
        doc.defaultView?.frameElement?.getBoundingClientRect()
      const inWindow = (x: number) => x + (frameBox()?.left ?? 0)
      const rectInWindow = (box: DOMRect): WordRect => ({
        left: box.left + (frameBox()?.left ?? 0),
        top: box.top + (frameBox()?.top ?? 0),
        width: box.width,
        height: box.height,
      })
      const tapOf = (hit: WordHit): WordTap => ({
        word: hit.word,
        sentence: hit.sentence,
        next: hit.next,
        cfi: cfiOf(index, hit.range),
        rect: rectInWindow(hit.range.getBoundingClientRect()),
      })

      // A selection gets its menu once it holds still (spec 2 §6.6).
      let pointerHeld = false
      let settle: ReturnType<typeof setTimeout> | undefined
      const reportSelection = () => {
        const selected = selectedRange(doc)
        if (!selected) {
          if (selectionShown) {
            selectionShown = false
            call().onSelection(null)
          }
          return
        }
        const cfi = cfiOf(index, selected.range)
        if (!cfi) return
        selectionShown = true
        call().onSelection({
          cfi,
          text: selected.text,
          rect: rectInWindow(endRect(selected.range)),
        })
      }
      const reportLater = (ms: number) => {
        clearTimeout(settle)
        settle = setTimeout(reportSelection, ms)
      }
      doc.addEventListener("pointerdown", () => {
        pointerHeld = true
      })
      doc.addEventListener("pointerup", () => {
        pointerHeld = false
        reportLater(0)
      })
      doc.addEventListener("pointercancel", () => {
        pointerHeld = false
      })
      // A phone's selection handles send no touch events to the page.
      doc.addEventListener("selectionchange", () => {
        if (!pointerHeld) reportLater(SELECTION_SETTLE_MS)
      })

      // In order (spec 2 §6.1): links (foliate), the selection, a highlight,
      // a word, then the zones.
      doc.addEventListener("click", (click) => {
        // foliate follows links itself and marks those clicks handled.
        if (click.defaultPrevented) return
        // Text is selected (a drag just ended): its menu follows once it holds still.
        if (doc.getSelection()?.toString()) return
        // The selection menu is open and this tap undid the selection: it
        // only puts the menu away (plan 2B, decision 10).
        if (selectionShown) {
          dismiss()
          return
        }
        const hit = wordAt(doc, click.clientX, click.clientY)
        // The overlay is foliate's; its own click listener comes after this one (plan 2B, decision 8).
        const overlayer = view?.renderer
          .getContents?.()
          .find((content) => content.doc === doc)?.overlayer
        const [cfi, range] = overlayer?.hitTest(click) ?? []
        if (cfi && range) {
          call().onHighlight({
            cfi,
            rect: rectInWindow(rectAt(range, click.clientX, click.clientY)),
            word: hit ? tapOf(hit) : null,
          })
          return
        }
        if (hit) {
          showActiveWord(doc, hit.range)
          call().onWord(tapOf(hit))
          return
        }
        if (popupOpenRef.current) {
          dismiss()
          return
        }
        tapAt(inWindow(click.clientX))
      })
      const win = doc.defaultView
      if (win) whenIdle(win, () => markSavedWords(doc, savedFormsRef.current))
      doc.addEventListener("pointermove", (pointer) => {
        if (pointer.pointerType !== "mouse") return
        sectionDoc = doc
        hoverAt(inWindow(pointer.clientX))
      })
      // Leaving the document altogether: to the bars, a panel or the window's edge.
      doc.addEventListener("pointerout", (pointer) => {
        if (!pointer.relatedTarget) hoverAt(null)
      })
    }

    const onRelocate = (event: Event) =>
      call().onRelocate(
        toLocation((event as CustomEvent<RelocateDetail>).detail)
      )

    // A section's overlay is new: draw its highlights (spec 2 §6.6).
    const onCreateOverlay = (event: Event) => {
      const { index } = (event as CustomEvent<{ index: number }>).detail
      if (!view) return
      for (const [cfi, highlight] of highlightsRef.current) {
        if (view.resolveNavigation(cfi)?.index !== index) continue
        drawnRef.current.set(cfi, lookOf(highlight))
        view.addAnnotation({ value: cfi }).catch(drawFailed)
      }
    }

    const onDrawAnnotation = (event: Event) => {
      const { draw, annotation } = (event as CustomEvent<DrawAnnotationDetail>)
        .detail
      const highlight = highlightsRef.current.get(annotation.value)
      if (!highlight) return
      draw(drawHighlight, {
        color: HIGHLIGHT_FILL[highlight.color ?? "yellow"],
        note: highlight.note !== "",
      })
    }

    document.addEventListener("keydown", onKey)
    host.addEventListener("pointerdown", interact)
    host.addEventListener("wheel", interact, { passive: true })
    host.addEventListener("wheel", onWheel, { passive: true })
    host.addEventListener("click", onHostClick)
    host.addEventListener("pointermove", onHostPointerMove)
    host.addEventListener("pointerleave", onHostPointerLeave)

    void (async () => {
      try {
        // Fetched while the book opens; never rejects (absolute URLs as fallback).
        const fontsLoading = loadReaderFonts()
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
        view.addEventListener("create-overlay", onCreateOverlay)
        view.addEventListener("draw-annotation", onDrawAnnotation)
        host.append(view)
        await view.open(opened.book)
        if (isCancelled()) {
          await teardown()
          return
        }
        skipLayoutWhileLoading(view.renderer)
        stopAnimating = animateUnlessReduced(view.renderer)
        // Before init, which loads the first section and so fires "load".
        swipes = snapByWholeSwipe(view.renderer)
        host.addEventListener("touchstart", swipes.touchstart, {
          passive: true,
        })
        host.addEventListener("touchend", swipes.touchend)
        const fonts = await fontsLoading
        if (isCancelled()) {
          await teardown()
          return
        }
        fontsRef.current = fonts
        applySettings(view, settingsRef.current, fonts)
        viewRef.current = view
        const wanted = targetRef.current
        const reachable = wanted !== null && (await canOpen(view, wanted))
        if (wanted !== null && !reachable) call().onTargetMissing()
        const startAt = reachable ? wanted : startRef.current
        await view.init(
          startAt ? { lastLocation: startAt } : { showTextStart: true }
        )
        if (isCancelled()) {
          await teardown()
          return
        }
        const current = view
        call().onReady({
          controls: {
            goTo: async (place) => {
              await current.goTo(place)
            },
            goToFraction: (fraction) => current.goToFraction(fraction),
            move,
            clearSelection,
            chaptersOf: (cfis) => chaptersOf(current, cfis),
            canOpen: (cfi) => canOpen(current, cfi),
          },
          toc: opened.book.toc ?? [],
        })
      } catch (error) {
        if (!cancelled) call().onError(error)
      }
    })()

    return () => {
      cancelled = true
      void teardown()
    }
  }, [file])

  useEffect(() => {
    const view = viewRef.current
    const fonts = fontsRef.current
    if (view && fonts) applySettings(view, settings, fonts)
  }, [settings])

  // The tapped word stays lit only while its meaning shows.
  useEffect(() => {
    if (wordOpen) return
    for (const { doc } of viewRef.current?.renderer.getContents?.() ?? []) {
      if (doc) showActiveWord(doc, null)
    }
  }, [wordOpen])

  // A word saved or deleted: the open section underlines again.
  useEffect(() => {
    const contents = viewRef.current?.renderer.getContents?.() ?? []
    const cancels = contents.flatMap(({ doc }) => {
      const win = doc?.defaultView
      return doc && win
        ? [whenIdle(win, () => markSavedWords(doc, savedForms))]
        : []
    })
    return () => {
      for (const cancel of cancels) cancel()
    }
  }, [savedForms])

  const colors = THEME_COLORS[settings.theme]
  return (
    <>
      <section
        ref={hostRef}
        aria-label="Isi buku"
        tabIndex={-1}
        className="reader-host"
        style={{ background: colors.background }}
      />
      {/* Mouse only, and a hint for clicks; keys and taps turn pages as well. */}
      <div
        aria-hidden
        className="reader-turn reader-turn-left"
        data-shown={hoverTurn === "left"}
        style={{ color: colors.text }}
      >
        <ChevronLeftIcon />
      </div>
      <div
        aria-hidden
        className="reader-turn reader-turn-right"
        data-shown={hoverTurn === "right"}
        style={{ color: colors.text }}
      >
        <ChevronRightIcon />
      </div>
    </>
  )
}
```

`WordHit` sudah diekspor oleh `src/lib/words/word-at.ts`.

- [ ] **Step 2: Nama prop di halaman reader**

Di `src/routes/_member/read.$bookId.tsx`, ubah pemakaian `<ReaderView …>` sementara (Task 11 menyambungkan isinya):
- ganti `onDismissWord={closeWord}` dengan `onDismiss={closeWord}`;
- tambahkan `popupOpen={tap !== null}`, `highlights={NO_HIGHLIGHTS}`, `onSelection={ignoreSelection}`, `onHighlight={ignoreHighlight}`, dengan konstanta tingkat modul di bawah `NO_WORDS`:

```ts
const NO_HIGHLIGHTS: Array<Annotation> = []
const ignoreSelection = () => undefined
const ignoreHighlight = () => undefined
```

dan `import type { Annotation } from "@/lib/annotations/types"`.

- [ ] **Step 3: Warna overlay per tema**

Di `src/styles.css`, tepat setelah blok `.reader-view { … }`, tambahkan:

```css
  /* Highlights (spec 2 §6.6): see-through over the text; foliate reads these. */
  .reader-page .reader-view {
    --overlayer-highlight-opacity: 0.4;
    --overlayer-highlight-blend-mode: multiply;
  }
  .reader-page[data-theme="dark"] .reader-view {
    --overlayer-highlight-opacity: 0.35;
    --overlayer-highlight-blend-mode: screen;
  }
```

- [ ] **Step 4: Typecheck, lint, unit test**

Run: `npm run typecheck && npm run lint && npm run check && npx vitest run`
Expected: tanpa error, semua unit test PASS.

- [ ] **Step 5: E2E reader dan kosakata tetap lulus**

Run: `npx playwright test e2e/reader.spec.ts e2e/vocabulary.spec.ts --project=desktop --project=mobile --workers=2`
Expected: PASS (ketuk kata, ketukan di tepi membalik halaman, popup tertutup saat halaman dibalik). Kegagalan tunggal dijalankan ulang sendirian dulu.

- [ ] **Step 6: Commit**

```bash
git add src/components/reader/ReaderView.tsx src/routes/_member/read.\$bookId.tsx src/styles.css
git commit -m "feat(reader): highlights drawn over the text, selections reported, clicks in order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Halaman reader menyatukan anotasi, dan E2E 2B

**Files:**
- Modify: `src/routes/_member/read.$bookId.tsx`
- Create: `e2e/helpers/reading.ts`
- Create: `e2e/helpers/annotations.ts`
- Modify: `e2e/vocabulary.spec.ts`
- Create: `e2e/annotations.spec.ts`

**Interfaces:**
- Consumes: semua yang di atas — `annotationSync`, `refreshBookAnnotations`, `useBookAnnotations` (Task 6); `newHighlight`, `newBookmark`, `edited`, `deleted` (Task 3); `onPage`, `pageStart` (Task 7); `SelectionMenu`, `AnnotationPopup`, `NoteEditor` (Task 8); `TocPanel`, `ReaderToolbar` (Task 9); `ReaderView` (Task 10); `AnnotationNotice` (Task 6).
- Produces: fitur 2B yang bisa dipakai; helper E2E `startReading(page)`, `selectWords(page, count)`, `annotationsOf(userId)`.

- [ ] **Step 1: Tulis E2E yang gagal**

Buat `e2e/helpers/reading.ts` (dipindah dari `e2e/vocabulary.spec.ts`):

```ts
import { type Page, expect } from "@playwright/test"
import { seedBook } from "./books"
import {
  createConfirmedMember,
  signInAndOnboard,
  userIdOf,
} from "./members"

/** A new member with one book, open in the reader past its title page. */
export async function startReading(page: Page) {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  await page.goto(`/read/${bookId}`)
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )
  // Away from the title page, into the text.
  await page.keyboard.press("PageDown")
  await page.keyboard.press("PageDown")
  return { userId, bookId }
}
```

Di `e2e/vocabulary.spec.ts`, hapus fungsi `memberReading` beserta import yang hanya dipakainya (`seedBook`, `createConfirmedMember`, `signInAndOnboard`, `userIdOf`; `hydrated` dan `storedPosition` tetap bila masih dipakai), tambahkan `import { startReading } from "./helpers/reading"`, dan ganti setiap `memberReading(page)` dengan `startReading(page)`.

Buat `e2e/helpers/annotations.ts`:

```ts
import type { Page } from "@playwright/test"
import { admin } from "./members"

/**
 * Selects the first few words that show on the current page, as a drag
 * would, and returns them with the middle of the first word in this window.
 * foliate's frame is reached through its renderer; its shadow root is closed
 * to locators.
 */
export async function selectWords(
  page: Page,
  count = 3
): Promise<{ text: string; x: number; y: number }> {
  const found = await page.evaluate((count) => {
    const view = document.querySelector("foliate-view") as unknown as {
      renderer: { getContents: () => Array<{ doc: Document }> }
    }
    const doc = view.renderer.getContents()[0].doc
    const frame = doc.defaultView?.frameElement?.getBoundingClientRect()
    if (!frame) return null
    const words = new RegExp(`\\b[A-Za-z]{3,}(?:\\s+[A-Za-z]{3,}){${count - 1}}\\b`, "g")
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text
      for (const match of text.data.matchAll(words)) {
        const range = doc.createRange()
        range.setStart(text, match.index)
        range.setEnd(text, match.index + match[0].length)
        const lines = range.getClientRects()
        if (lines.length !== 1) continue
        const box = lines[0]
        const x = frame.left + box.left + 8
        const y = frame.top + box.top + box.height / 2
        // Clear of the bars and of the window's edges.
        if (x > 40 && x + box.width < innerWidth - 40 && y > 90 && y < innerHeight - 110) {
          const selection = doc.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)
          return { text: match[0], x, y }
        }
      }
    }
    return null
  }, count)
  if (!found) throw new Error("No run of words shows on this page")
  return found
}

export async function annotationsOf(userId: string): Promise<
  Array<{
    kind: string
    color: string | null
    note: string
    excerpt: string
    deleted_at: string | null
  }>
> {
  const { data, error } = await admin()
    .from("annotations")
    .select("kind, color, note, excerpt, deleted_at")
    .eq("user_id", userId)
  if (error) throw error
  return data
}
```

Buat `e2e/annotations.spec.ts`:

```ts
import { type Page, expect, test } from "@playwright/test"
import { annotationsOf, selectWords } from "./helpers/annotations"
import { startReading } from "./helpers/reading"

/** Opens the annotations tab of the reader's panel. */
async function openAnnotations(page: Page) {
  await page.getByRole("button", { name: "Daftar isi dan anotasi" }).click()
  const panel = page.getByRole("dialog", { name: "Daftar isi dan anotasi" })
  await panel.getByRole("tab", { name: "Anotasi" }).click()
  return panel
}

test("a selection becomes a highlight with a note, which stays and can be deleted", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(120_000)
  const { userId } = await startReading(page)
  // A page turn slides: let it settle before selecting.
  await page.waitForTimeout(800)

  const picked = await selectWords(page)
  const menu = page.getByRole("dialog", { name: "Teks terpilih" })
  await menu.getByRole("button", { name: "Highlight" }).click()
  await expect(menu).toBeHidden()
  // Sent two seconds after the last change (spec 2 §7).
  await expect
    .poll(async () => await annotationsOf(userId), { timeout: 20_000 })
    .toEqual([
      expect.objectContaining({
        kind: "highlight",
        color: "yellow",
        // Kept on one line (excerptOf).
        excerpt: picked.text.replace(/\s+/g, " "),
      }),
    ])

  // A tap on the highlight opens its popup (spec 2 §6.1, step 2).
  if (isMobile) await page.touchscreen.tap(picked.x, picked.y)
  else await page.mouse.click(picked.x, picked.y)
  const popup = page.getByRole("dialog", { name: "Highlight" })
  await popup.getByRole("button", { name: "Hijau" }).click()
  await popup.getByRole("button", { name: "Catatan" }).click()
  const editor = page.getByRole("dialog", { name: "Catatan" })
  await editor.getByRole("textbox", { name: "Isi catatan" }).fill("Catatan uji")
  await editor.getByRole("button", { name: "Selesai" }).click()
  await expect(editor).toBeHidden()
  await expect
    .poll(async () => (await annotationsOf(userId))[0], { timeout: 20_000 })
    .toMatchObject({ color: "green", note: "Catatan uji" })

  // Still there after a reload, from this device and from the server.
  await page.reload()
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )
  const panel = await openAnnotations(page)
  const item = panel.getByRole("listitem").filter({ hasText: "Catatan uji" })
  await expect(item).toContainText(picked.text)
  await item.getByRole("button", { name: "Hapus anotasi" }).click()
  await expect(item).toBeHidden()
  await expect
    .poll(async () => (await annotationsOf(userId))[0]?.deleted_at ?? null, {
      timeout: 20_000,
    })
    .not.toBeNull()
})

test("the bookmark button marks the page, and the panel lists it", async ({
  page,
}) => {
  const { userId } = await startReading(page)
  await page.getByRole("button", { name: "Bookmark halaman ini" }).click()
  await expect(
    page.getByRole("button", { name: "Hapus bookmark" })
  ).toHaveAttribute("aria-pressed", "true")
  await expect
    .poll(async () => (await annotationsOf(userId)).map((a) => a.kind), {
      timeout: 20_000,
    })
    .toEqual(["bookmark"])

  const panel = await openAnnotations(page)
  await expect(
    panel.getByRole("listitem").filter({ hasText: "Bookmark" })
  ).toBeVisible()
})
```

- [ ] **Step 2: Jalankan E2E, pastikan gagal**

Run: `npx playwright test e2e/annotations.spec.ts --project=desktop --workers=2`
Expected: FAIL — menu "Teks terpilih" tidak muncul dan tombol bookmark belum tersambung.

- [ ] **Step 3: Sambungkan halaman reader**

Di `src/routes/_member/read.$bookId.tsx`:

1. Tambahkan import:

```ts
import { AnnotationNotice } from "@/components/reader/AnnotationNotice"
import {
  AnnotationPopup,
  type HighlightTap,
} from "@/components/reader/AnnotationPopup"
import { NoteEditor } from "@/components/reader/NoteEditor"
import {
  SelectionMenu,
  type TextSelection,
} from "@/components/reader/SelectionMenu"
import {
  annotationSync,
  refreshBookAnnotations,
  useBookAnnotations,
} from "@/lib/annotations/annotation-sync-client"
import {
  deleted,
  edited,
  newBookmark,
  newHighlight,
} from "@/lib/annotations/changes"
import { onPage, pageStart } from "@/lib/annotations/places"
import type { Annotation, HighlightColor } from "@/lib/annotations/types"
```

Hapus konstanta sementara `NO_HIGHLIGHTS`, `ignoreSelection`, dan `ignoreHighlight` dari Task 10, dan ganti import `type Annotation` dari Task 10 dengan baris import gabungan di atas.

2. Tambahkan di bawah `function ReaderError…` (tingkat modul):

```ts
function putAnnotation(annotation: Annotation) {
  annotationSync()
    .put(annotation)
    .catch((error: unknown) =>
      console.error("saving the annotation failed", error)
    )
}
```

3. Di `ReaderPage`, tepat di bawah `const [location, setLocation] = useState<ReaderLocation | null>(null)`, tambahkan:

```ts
  const annotations = useBookAnnotations(bookId)
  const highlights = useMemo(
    () => annotations.filter((annotation) => annotation.kind === "highlight"),
    [annotations]
  )
  // The bookmarks on the page shown (plan 2B, decision 16).
  const pageBookmarks = useMemo(
    () =>
      location
        ? annotations.filter(
            (annotation) =>
              annotation.kind === "bookmark" &&
              onPage(annotation.cfi, location.cfi)
          )
        : [],
    [annotations, location]
  )
  const [selection, setSelection] = useState<TextSelection | null>(null)
  const [marked, setMarked] = useState<HighlightTap | null>(null)
  const [noteFor, setNoteFor] = useState<Annotation | null>(null)
  const markedHighlight = marked
    ? (highlights.find((highlight) => highlight.cfi === marked.cfi) ?? null)
    : null
  const popupOpen = tap !== null || marked !== null || selection !== null
```

4. Ganti efek "Waiting word changes go when a book opens" dengan:

```ts
  // Waiting changes go when a book opens (spec 2 §7): words and annotations.
  // The forms of words saved on other devices come in for the underline, and
  // the book's annotations from other devices for the overlay. All of it
  // waits for this device to be the member's: another member's queue must
  // not go under this session.
  useEffect(() => {
    let live = true
    claimLocalData(user.id)
      .then(() => {
        if (!live) return
        void wordSync().flush()
        if (data.online) void refreshSavedForms()
        void annotationSync()
          .flush()
          .then(() => (data.online ? refreshBookAnnotations(bookId) : undefined))
      })
      .catch((error: unknown) =>
        console.error("claiming this device failed", error)
      )
    return () => {
      live = false
    }
  }, [bookId, data.online, user.id])
```

5. Di `onRelocate`, ganti baris

```ts
      if (next.cfi !== tappedAtCfi.current) setTap(null)
```

dengan

```ts
      if (next.cfi !== tappedAtCfi.current) {
        setTap(null)
        setMarked(null)
      }
```

dan tepat setelah `const moved = next.cfi !== shownCfi.current` tambahkan:

```ts
      if (moved) setSelection(null)
```

6. Ganti `openWord` dan `closeWord` dengan:

```ts
  const openWord = useCallback((next: WordTap) => {
    tappedAtCfi.current = shownCfi.current
    setMarked(null)
    setTap(next)
  }, [])
  const closeWord = useCallback(() => setTap(null), [])
  const openHighlight = useCallback((next: HighlightTap) => {
    tappedAtCfi.current = shownCfi.current
    setTap(null)
    setMarked(next)
  }, [])
  const showSelection = useCallback((next: TextSelection | null) => {
    if (next) {
      setTap(null)
      setMarked(null)
    }
    setSelection(next)
  }, [])
  // A tap beside the words closes whatever shows.
  const closePopups = useCallback(() => {
    setTap(null)
    setMarked(null)
    setSelection(null)
  }, [])
```

7. Tambahkan aksi anotasi tepat di bawah `toggleSave`:

```ts
  const dropSelection = () => {
    controls?.clearSelection()
    setSelection(null)
  }
  /** Highlight · Catatan (spec 2 §6.6); the same text twice is one highlight. */
  const highlightSelection = (withNote: boolean) => {
    if (!selection) return
    const existing = highlights.find(
      (highlight) => highlight.cfi === selection.cfi
    )
    const highlight =
      existing ??
      newHighlight({ bookId, cfi: selection.cfi, text: selection.text })
    if (!existing) putAnnotation(highlight)
    dropSelection()
    if (withNote) setNoteFor(highlight)
  }
  const copySelection = () => {
    if (!selection) return
    navigator.clipboard
      .writeText(selection.text)
      .catch((error: unknown) => console.error("copying the text failed", error))
    dropSelection()
  }
  const recolor = (color: HighlightColor) => {
    if (markedHighlight) putAnnotation(edited(markedHighlight, { color }))
  }
  const editNote = () => {
    if (markedHighlight) setNoteFor(markedHighlight)
    setMarked(null)
  }
  const removeMarked = () => {
    if (markedHighlight) putAnnotation(deleted(markedHighlight))
    setMarked(null)
  }
  const meaningOfMarked = () => {
    if (marked?.word) setTap(marked.word)
    setMarked(null)
  }
  const saveNote = (note: string) => {
    const target = noteFor
    setNoteFor(null)
    if (!target) return
    // The highlight may have changed since the editor opened (a colour).
    const current =
      highlights.find((highlight) => highlight.id === target.id) ?? target
    if (note.trim() !== current.note) putAnnotation(edited(current, { note }))
  }
  const toggleBookmark = () => {
    if (!location) return
    if (pageBookmarks.length > 0) {
      for (const bookmark of pageBookmarks) putAnnotation(deleted(bookmark))
      return
    }
    putAnnotation(
      newBookmark({
        bookId,
        cfi: pageStart(location.cfi),
        text: location.pageText,
      })
    )
  }
```

8. Ganti `<ReaderView …>` dengan:

```tsx
      <ReaderView
        file={data.file}
        start={data.local?.cfi ?? null}
        target={target}
        settings={settings}
        wordOpen={tap !== null}
        popupOpen={popupOpen}
        savedForms={savedForms}
        highlights={highlights}
        onReady={onReady}
        onRelocate={onRelocate}
        onInteract={onInteract}
        onTapMenu={onTapMenu}
        onWord={openWord}
        onHighlight={openHighlight}
        onSelection={showSelection}
        onDismiss={closePopups}
        onTargetMissing={onTargetMissing}
        onError={onError}
      />
```

9. Ganti `<ReaderToolbar …>` dengan:

```tsx
      <ReaderToolbar
        title={data.book.title}
        hidden={chromeHidden}
        syncStatus={syncStatus}
        bookmarked={pageBookmarks.length > 0}
        onBookmark={toggleBookmark}
        onToc={() => setPanel("toc")}
        onSettings={() => setPanel("settings")}
      />
      {pageBookmarks.length > 0 && (
        <div aria-hidden="true" className="reader-ribbon" />
      )}
```

10. Tepat di bawah `<VocabularyNotice />`, tambahkan:

```tsx
      <AnnotationNotice />
      <SelectionMenu
        key={selection?.cfi ?? "none"}
        selection={selection}
        onHighlight={() => highlightSelection(false)}
        onNote={() => highlightSelection(true)}
        onCopy={copySelection}
        onClose={dropSelection}
      />
      <AnnotationPopup
        key={marked ? `${marked.cfi} ${marked.rect.left} ${marked.rect.top}` : "none"}
        tap={marked}
        annotation={markedHighlight}
        onColor={recolor}
        onNote={editNote}
        onDelete={removeMarked}
        onMeaning={meaningOfMarked}
        onClose={() => setMarked(null)}
        finalFocus={bookFocus}
      />
      <NoteEditor
        key={noteFor?.id ?? "none"}
        annotation={noteFor}
        onClose={saveNote}
        finalFocus={bookFocus}
      />
```

11. Ganti prop sementara di `<TocPanel …>` (Task 9) dengan:

```tsx
        annotations={annotations}
        chaptersOf={controls?.chaptersOf ?? null}
        onSelectPlace={(cfi) => {
          setPanel(null)
          // A place gone from the book (another edition): say so (spec 2 §8).
          go(async (current) => {
            if (await current.canOpen(cfi)) await current.goTo(cfi)
            else setTargetMissing(true)
          })
        }}
        onDeleteAnnotation={(annotation) => putAnnotation(deleted(annotation))}
```

- [ ] **Step 4: Typecheck, lint, format, unit test**

Run: `npm run typecheck && npm run lint && npm run check && npx vitest run`
Expected: tanpa error, semua PASS.

- [ ] **Step 5: Jalankan E2E 2B, pastikan lulus**

Run: `npx playwright test e2e/annotations.spec.ts --project=desktop --project=mobile --workers=2`
Expected: PASS di kedua proyek. Kalau ketukan pada highlight di HP gagal karena foliate membalik halaman setelah seleksi dibuat lewat skrip, ambil ulang koordinat lewat `selectWords` sebelum mengetuk (atau ketuk dengan `page.mouse.click` di proyek mobile) dan jelaskan pilihannya di laporan.

- [ ] **Step 6: E2E reader dan kosakata tetap lulus**

Run: `npx playwright test e2e/reader.spec.ts e2e/vocabulary.spec.ts --project=desktop --project=mobile --workers=2`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/_member/read.\$bookId.tsx e2e/helpers/reading.ts e2e/helpers/annotations.ts e2e/vocabulary.spec.ts e2e/annotations.spec.ts
git commit -m "feat(reader): highlights, notes and bookmarks in the reader

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Privasi, dokumen, spec, dan verifikasi penuh

**Files:**
- Modify: `src/routes/privacy.tsx`
- Modify: `docs/ops/deploy.md`
- Modify: `docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md`

**Interfaces:**
- Consumes: semua task sebelumnya.
- Produces: dokumen yang cocok dengan kode, dan bukti seluruh test lulus.

- [ ] **Step 1: Kebijakan Privasi**

Di `src/routes/privacy.tsx`, ganti butir "Data membaca" dengan:

```tsx
        <li>
          Data membaca: posisi baca, pengaturan tampilan, dan aktivitas belajar,
          termasuk kata yang kamu simpan di Kosakata beserta artinya, kalimat
          asalnya, dan judul bukunya, serta highlight, catatan, dan bookmark di
          bukumu beserta kutipan teksnya.
        </li>
```

Kalau ada bagian lain di halaman itu yang menyebut apa yang terhapus saat buku dihapus, tambahkan bahwa highlight, catatan, dan bookmark buku itu ikut terhapus (spec §2 keputusan 8).

- [ ] **Step 2: Panduan operasi**

Di `docs/ops/deploy.md`, cari bagian yang menjelaskan container `sweep` (baris yang menyebut "sapuan Storage tiap jam") dan tambahkan satu kalimat di penjelasannya: sapuan juga menghapus anotasi yang dihapus member lebih dari 30 hari lalu (tombstone), dan di dry run hanya menghitungnya; baris log JSON-nya kini memuat `"tombstones": <jumlah>`.

- [ ] **Step 3: Perbarui spec**

Di `docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md`:

- §4.3 tabel `annotations`: kolom `note` menjadi "Maksimal 2.000 karakter, hanya untuk highlight; kosong (`''`) berarti tanpa catatan".
- §4.3 `save_annotations`: tambahkan bahwa fungsi mengembalikan satu jawaban per entri (`ok`, `limit_reached`, `invalid`); entri untuk buku yang sudah tidak ada dijawab `ok` dan dilewati; nilai yang ditolak tabel hanya menolak entri itu; `kind`, `book_id`, dan `cfi` tidak berubah setelah dibuat.
- §4.3 paragraf sapuan: "Sapuan per jam yang sudah ada menjalankan `purgeTombstones` (`src/server/sweep/tombstones.ts`) setelah `runSweep`, tanpa batas jumlah hapus sapuan; di dry run hanya menghitung."
- §6.1 langkah 2: "Klik dibaca lewat `overlayer.hitTest` di handler klik reader (listener overlay foliate terpasang sesudahnya)".
- §6.1 langkah 3: "Ada seleksi teks: klik diabaikan, menu menyusul. Saat menu seleksi terbuka, ketukan apa pun hanya menutup menu dan seleksinya."
- §6.6 **Seleksi**: "Menu muncul saat jari/mouse diangkat, atau 300 ms setelah seleksi berhenti berubah (gagang seleksi di HP tidak mengirim `touchend`)."
- §6.6 **Highlight**: "ikon kecil di pinggir teks" menjadi "kotak kecil berwarna sama tepat setelah baris terakhir highlight".
- §6.6 **Popup anotasi**: "*Arti "kata"* untuk kata yang diketuk di dalam highlight (untuk highlight satu kata, kata itu sendiri)".
- §6.6 **Bookmark**: tambahkan "Halaman berisi bookmark bila CFI bookmark ada di antara awal (termasuk) dan akhir (tidak termasuk) halaman. Kutipannya 200 karakter pertama halaman."
- §6.6 **Panel**: tambahkan "Tiap anotasi punya tombol hapus. Nama bab dihitung saat panel dibuka, tidak disimpan. Panel bernama *Daftar isi dan anotasi*."

- [ ] **Step 4: Verifikasi penuh**

Run, berurutan:

```bash
npx vitest run
npm run typecheck
npm run lint
npm run check
npx vitest run --config vitest.db.config.ts
npx playwright test --project=desktop --project=mobile --workers=2
```

Expected: semuanya lulus. Untuk E2E, cek dulu port 3000 (Global Constraints). Kegagalan tunggal dijalankan ulang sendirian; laporkan yang tetap gagal beserta output-nya.

- [ ] **Step 5: Commit**

```bash
git add src/routes/privacy.tsx docs/ops/deploy.md docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md
git commit -m "docs: annotations in the privacy policy, sweep notes and spec

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Cek manual pemilik di situs dev (setelah push)**

Untuk pemilik proyek, setelah `main` di-push dan situs dev ter-deploy:
- Desktop: seret untuk memilih teks → menu *Highlight · Catatan · Salin* muncul di bawah seleksi; highlight terlihat di tema terang, sepia, dan gelap.
- Android: tekan lama lalu geser gagang seleksi → menu muncul setelah seleksi berhenti; menu tidak bertabrakan dengan toolbar bawaan Chrome.
- Ketuk highlight → ganti warna, tambah catatan (kotak kecil muncul di ujung highlight), *Arti "kata"* membuka arti.
- Bookmark: pita muncul di pojok kanan atas; buka panel → tab Anotasi → ketuk bookmark untuk melompat.
- Dua perangkat: highlight di satu perangkat muncul di perangkat lain setelah buku dibuka ulang; hapus di satu perangkat ikut hilang di perangkat lain.
- Offline: buat highlight saat offline, online lagi → tersimpan di server.
