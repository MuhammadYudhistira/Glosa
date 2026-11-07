# Glosa Tahap 3E — Kartu buku selesai, ulasan pribadi, dan kilas balik: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saat anggota menyelesaikan buku, Glosa menampilkan kartu berisi angka dari bacaannya dan mengajak menulis ulasan pribadi; tiap bulan dan tahun ada kilas balik (satu halaman, satu gambar). Kartu buku selesai dan kilas balik bisa dibagikan sebagai gambar.

**Architecture:**
- **Server.** Tabel `book_reviews` (ulasan pribadi, RLS baca milik sendiri) dan kolom `word_meetings.met_at`. Fungsi `save_review`, `delete_review`, `book_finish_summary`, `reading_recap`; semua bacaan menjawab satu objek jsonb. Server function di `src/server/reviews.ts` dan `src/server/recap.ts`.
- **Perangkat.** Ulasan ikut daftar rak (`ShelfBook.review`) dan snapshot offline, jadi terlihat offline; urutan rak baru "Rating tertinggi". Kartu dan kilas balik dimuat dari server dan tidak disimpan. Logika murni di `src/lib/recap/` (periode, streak terpanjang, gelembung, format waktu).
- **Gambar.** Dua layout baru di `src/lib/quote-card/` (kartu buku selesai, kartu kilas balik) memakai mesin, tema, kaki, dan `share.ts` kartu kutipan; komponen `ShareImage` dipakai bersama oleh kartu dan kilas balik.
- **UI.** `FinishCardDialog` (kartu + formulir `ReviewForm` dalam satu popup) dipakai di reader dan di detail buku lewat `MyReview`; halaman `/recap` di lobi; pintu masuk di `HabitPanel`, `LibraryMap`, dan satu gelembung lobi.

**Tech Stack:** TanStack Start + Router, React 19, TypeScript, Tailwind CSS 4, Supabase (Postgres, RLS, PostgREST RPC), zod 4, Dexie, Vitest + Testing Library (jsdom), Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-07-tahap-3e-kartu-ulasan-kilas-balik-design.md`](../specs/2026-11-07-tahap-3e-kartu-ulasan-kilas-balik-design.md)

## Global Constraints

- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris. Array ditulis `Array<T>`. Tidak ada kata "gagal" di teks UI baru.
- **Dependensi:** tidak ada dependensi baru.
- **Teks dari spec, persis:** "Selesai: ‹judul›", "Ringkasan belum bisa dimuat", "Tulis ulasan", "Ubah ulasan", "Bagikan", "Nanti", "Lihat kartu", "Ulasan saya", "Ubah", "Hapus ulasan", "Simpan", "Kata dari buku ini", "Lihat semua", "Perlu koneksi internet", "Selesai dibaca", "Rating tertinggi", "Kilas balik", "sejauh ini", "Belum ada bacaan di ‹Bulan Tahun›.", "‹Bulan Tahun› di Glosa", "Kilas balik ‹Bulan› sudah siap" (Januari: "Kilas balik ‹Tahun lalu› sudah siap"), "+50 koin".
- **Angka (persis dari spec):**
  - bintang 1–5 (wajib untuk menyimpan); kesulitan Mudah / Sedang / Sulit (`easy`/`medium`/`hard`), opsional; catatan opsional, paling panjang **2.000** karakter, kosong disimpan null;
  - **12** kata di formulir (yang tersimpan paling awal), lalu "Lihat semua" ke Kosakata `?buku=`;
  - kilas balik: paling banyak **12** sampul di halaman dan **6** di gambar; rentang `p_to − p_from` ≤ **366** hari; gelembung pada tanggal **1–7**;
  - ukuran gambar sama dengan kartu kutipan: Story 1080×1920, Persegi 1080×1080; tema Sampul, Kertas, Malam.
- **Aturan:**
  - ulasan hanya untuk buku selesai (`finished_at` terisi); "Tandai belum selesai" menyembunyikan ulasan tanpa menghapusnya; menghapus buku atau akun menghapus ulasannya;
  - **% paham tidak tampil** di kartu, gambarnya, maupun ulasan; gambar tidak memuat catatan, kesulitan, atau kata;
  - ulasan terlihat offline, tetapi simpan dan hapus butuh online;
  - angka kartu dan kilas balik dihitung di server saat dibuka dan tidak disimpan di perangkat;
  - "Tandai selesai" dari detail buku tidak membuka kartu otomatis.
- **SQL:** RLS "baca milik sendiri"; penulisan lewat fungsi `security definer` dengan `set search_path = ''`; error otentikasi `raise exception 'not_authenticated' using errcode = 'P0001'`; `revoke execute … from public, anon` lalu `grant` ke `authenticated`; bacaan menjawab satu objek jsonb (batas 1.000 baris PostgREST).
- **Migrasi:** `supabase/migrations/20261107000200_finish_review_recap.sql`, hanya tambahan (docs/ops/deploy.md §7); di-push ke Supabase dev (`npm run db:push`); tipe dibuat ulang (`npm run db:types` + `npx prettier --write src/server/database.types.ts`, tanpa baris CLI). **Proyek dev dipakai bersama**: test hanya menulis baris member test-nya sendiri.
- **Line ending dan encoding:** LF, UTF-8. Jangan menulis file lewat PowerShell `Set-Content` atau Python tanpa `encoding='utf-8', newline=''`.
- **Route tree:** jangan pakai `npm run generate-routes` (menghapus blok `Register`). Route baru `/recap` ditambahkan ke `src/routeTree.gen.ts` dengan menyalin setiap kemunculan `shop` (`MemberLobiShopRouteImport`, `MemberLobiShopRoute`, `'/shop'`, `'/_member/_lobi/shop'`) lalu mengganti namanya menjadi `Recap` / `/recap` — atau biarkan `npm run dev` membuat ulang file itu, lalu pastikan `interface Register { router: ... }` masih ada di akhir file (`git diff` harus hanya menambah baris `recap`).
- **CI** menjalankan `npm run check` (prettier): setiap task menjalankan `npx prettier --write` pada file yang disentuh sebelum commit.
- **E2E:** `--workers=2`; cek port 3000 dulu (`curl -sL localhost:3000/login | grep -o "<title>[^<]*"`), bila dipegang aplikasi lain pakai config sementara di port 3100 lalu hapus; satu kegagalan dijalankan ulang sendirian dulu.
- **Tidak ada push ke GitHub** sampai seluruh Tahap 3 selesai (keputusan pemilik). Commit lokal saja. Pesan commit diakhiri `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Keputusan dan penyimpangan dari spec

1. **Durasi "6 jam 20 menit"**: `formatDuration` yang ada menulis "±1 j 20 mnt" (untuk sisa waktu baca), jadi kartu memakai pemformat baru `formatReadTime(seconds)` di `src/lib/recap/format.ts` ("6 jam 20 menit", "45 menit", "Kurang dari 1 menit").
2. **`book_finish_summary` menambah `review`** (`{rating, difficulty, note, updated_at} | null`) ke bentuk spec, supaya kartu di reader tahu ulasan yang sudah ada (buku yang ditandai belum selesai lalu selesai lagi) tanpa membawa rak. Fungsi ini juga memanggil `award_book_coins(auth.uid())` lebih dulu (idempoten), supaya "+50 koin" benar tepat setelah buku selesai; karena menulis, fungsinya tidak `stable`.
3. **Urutan pemeriksaan `save_review`**: `not_found`, lalu `not_finished`, lalu `invalid`. Catatan dipangkas (`btrim`) sebelum dihitung; kosong menjadi null.
4. **Satu popup untuk kartu dan formulir** (`FinishCardDialog`, tampilan `card` / `form` / `share`) dengan prop `start`. Dari reader `start="card"`; dari "Ubah"/"Tulis ulasan" di detail buku `start="form"` dan popup tertutup setelah simpan atau hapus (spec §4.1: kembali ke detail buku); dari kartu, formulir kembali ke kartu. Tombol tambahan **Batal** di formulir.
5. **Sampul kartu** dimuat lewat `loadCover: () => Promise<Blob | null>`: di reader `controls.cover()` (seperti kartu kutipan), di rak/kilas balik `fetchCoverBlob(coverUrl)` (fetch URL bertanda tangan). Bila fetch ditolak browser (CORS), kartu dan gambar tampil tanpa sampul; ini masuk daftar cek manual.
6. **Ringkasan tak termuat di reader** menulis "Ringkasan belum bisa dimuat" dengan judul dan pengarang buku (reader tidak membawa rak, jadi sampul kecil hanya bila `loadCover` memberi gambar); dari rak, judul/sampul diambil dari `ShelfBook`.
7. **Tujuan "Kilas balik" di peta HP** adalah tombol di bawah legenda peta (prop opsional `onRecap` di `LibraryMap`), bukan titik 3D: adegan tidak punya benda untuk kilas balik dan titik baru berarti model, posisi kamera, dan teks sorotan baru.
8. **Gelembung kilas balik** muncul di titik `tanaman` (tanaman kebiasaan). Data bulan lalu dibaca dari `useReadingHabit()` (cache 3B); tanpa cache (`loading`/`failed`) tidak tampil. Dicatat di `localStorage` (`glosa:recap-bubble`, daftar kunci periode) begitu tampil, dan tetap tampil selama kunjungan itu.
9. **Daftar periode** memakai `first_day` dari jawaban `reading_recap` terakhir (disimpan di state halaman supaya pemilih tidak berkedip); sebelum jawaban pertama hanya periode berjalan. Periode di masa depan atau tak dikenal → bulan berjalan.
10. **Streak terpanjang** = `habitSummary(...).record` dari hari-hari di dalam periode saja; hari terakhir periode yang sudah lewat dijadikan "hari ini" semu (hari setelah akhir periode, tanpa data), periode berjalan memakai hari ini sungguhan dan target yang tersimpan di baris hari itu.
11. **Urutan Rating tertinggi** memakai urutan bawaan koleksi (`defaultSort`) untuk buku tanpa bintang.
12. **Rapi-rapi kecil:** `shrunk`/`paletteOf` dari `QuoteCardDialog` dipindah ke `src/lib/quote-card/cover-art.ts` (dipakai bersama); `fitText`, konstanta tata letak, dan `footer` di `layout.ts` diekspor; `CardItem` jenis `cover` mendapat `slot?` dan `CardArt` mendapat `covers?` untuk beberapa sampul di gambar kilas balik.
13. **Peringatan lama:** `QuoteCardDialog` masih memuat kata "Gagal membagikan"; tidak diubah di 3E (di luar cakupan), teks baru tidak memakainya.

## Struktur file

| File | Tanggung jawab |
|---|---|
| `supabase/migrations/20261107000200_finish_review_recap.sql` | Tabel, kolom, fungsi (Task 1) |
| `tests/db/review-recap.test.ts` | Tes DB (Task 1) |
| `src/lib/review.ts` (+ `.test.ts`) | Tipe ulasan, ringkasan, zod, label (Task 2) |
| `src/lib/book-types.ts`, `src/lib/shelf.ts`, `src/lib/local/shelf-snapshot.ts`, `src/server/books.ts` | `review` di rak, urutan Rating tertinggi (Task 2) |
| `src/lib/recap/types.ts`, `period.ts`, `recap.ts`, `bubble.ts`, `format.ts` (+ tes) | Logika murni kilas balik (Task 3) |
| `src/server/reviews.ts`, `src/server/recap.ts` | Server function (Task 3) |
| `src/lib/quote-card/cover-art.ts`, `wrap.ts`, `finish-layout.ts`, `recap-layout.ts` (+ tes), `layout.ts`, `draw.ts` | Gambar bagikan (Task 4) |
| `src/components/share/ShareImage.tsx`, `ShareDialog.tsx` | Pratinjau + tema + ukuran + bagikan/simpan/salin (Task 4) |
| `src/components/review/ReviewForm.tsx`, `FinishCardDialog.tsx` (+ tes), `src/routes/_member/read.$bookId.tsx` | Kartu dan formulir di reader (Task 5) |
| `src/components/review/MyReview.tsx`, `src/components/shelf/BookActions.tsx` | Detail buku (Task 6) |
| `src/routes/_member/_lobi/recap.tsx`, `src/components/lobby/RecapPanel.tsx`, `src/lib/recap/recap-client.ts`, `HabitPanel.tsx`, `LibraryMap.tsx`, `LobbyBubbles.tsx`, `LobbyStage.tsx`, `LobbyPopup.tsx`, `src/routes/privacy.tsx`, `src/routeTree.gen.ts` | Kilas balik dan pintu masuk (Task 7) |
| `e2e/finish-review.spec.ts`, `e2e/recap.spec.ts`, `e2e/collections.spec.ts` | E2E (Task 8) |

---

### Task 1: Database — ulasan, `met_at`, ringkasan, kilas balik

**Files:**
- Create: `supabase/migrations/20261107000200_finish_review_recap.sql`
- Create: `tests/db/review-recap.test.ts`
- Modify: `src/server/database.types.ts` (dibuat ulang)

**Interfaces:**
- Produces: tabel `book_reviews`; kolom `word_meetings.met_at`; RPC `save_review(p_book_id uuid, p_rating int, p_difficulty text, p_note text) → text` (`ok | not_found | not_finished | invalid`), `delete_review(p_book_id uuid) → text` (`ok | not_found`), `book_finish_summary(p_book_id uuid) → jsonb | null` (`{seconds, days, looked_up, saved, words: string[], coins, finished_at, review}`), `reading_recap(p_from date, p_to date, p_tz text) → jsonb` (`{days: [{day, seconds, goal_minutes}], books: [{id, finished_at}], looked_up, saved, top_meeting: {headword, meetings} | null, first_day}`).

- [ ] **Step 1: Tulis tes DB yang gagal**

`tests/db/review-recap.test.ts`:

```ts
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  adminClient,
  createTestMember,
  deleteTestMembers,
  forgetTestMember,
  newTestBook,
  signedInClient,
} from "./helpers"

const run = Date.now().toString(36)
const emails = {
  ani: `db-review-ani-${run}@glosa.test`,
  budi: `db-review-budi-${run}@glosa.test`,
  cici: `db-review-cici-${run}@glosa.test`,
}
type Client = Awaited<ReturnType<typeof signedInClient>>

async function rpc(client: Client, name: string, args: object) {
  const { data, error } = await client.rpc(name as never, args as never)
  if (error) throw error
  return data as unknown
}
const admin = adminClient()
const fail = (error: unknown) => {
  if (error) throw error
}

async function finish(bookId: string, at = new Date().toISOString()) {
  fail((await admin.from("books").update({ finished_at: at }).eq("id", bookId)).error)
}
async function readTime(userId: string, bookId: string, day: string, seconds: number) {
  fail(
    (
      await admin.from("reading_time").insert({
        user_id: userId,
        day,
        device_id: randomUUID(),
        book_id: bookId,
        seconds,
        goal_minutes: null,
      })
    ).error
  )
}

describe("finish card, review and recap", () => {
  const ids = { ani: "", budi: "", cici: "" }
  const books = { done: "", open: "", other: "", second: "" }
  let ani: Client
  let budi: Client

  beforeAll(async () => {
    ids.ani = (await createTestMember({ email: emails.ani })).id
    ids.budi = (await createTestMember({ email: emails.budi })).id
    ids.cici = (await createTestMember({ email: emails.cici })).id
    books.done = await newTestBook(ids.ani)
    books.second = await newTestBook(ids.ani)
    books.open = await newTestBook(ids.ani)
    books.other = await newTestBook(ids.budi)
    await finish(books.done, "2026-10-20T10:00:00Z")
    await finish(books.other)
    ani = await signedInClient(emails.ani)
    budi = await signedInClient(emails.budi)
  })

  afterAll(async () => {
    await deleteTestMembers()
  })

  describe("reviews", () => {
    const save = (client: Client, book: string, rating: number, difficulty: string | null = null, note: string | null = null) =>
      rpc(client, "save_review", {
        p_book_id: book,
        p_rating: rating,
        p_difficulty: difficulty,
        p_note: note,
      })

    it("saves, changes and reads back a review of a finished book", async () => {
      expect(await save(ani, books.done, 4, "hard", "  Bagus.  ")).toBe("ok")
      expect(await save(ani, books.done, 5, null, "")).toBe("ok")
      const { data } = await ani.from("book_reviews").select("rating, difficulty, note").eq("book_id", books.done)
      expect(data).toEqual([{ rating: 5, difficulty: null, note: null }])
    })

    it("keeps a trimmed note and refuses what breaks the rules", async () => {
      expect(await save(ani, books.done, 3, "easy", "  Bagus.  ")).toBe("ok")
      const { data } = await ani.from("book_reviews").select("note").eq("book_id", books.done).single()
      expect(data?.note).toBe("Bagus.")
      expect(await save(ani, books.done, 0)).toBe("invalid")
      expect(await save(ani, books.done, 6)).toBe("invalid")
      expect(await save(ani, books.done, 3, "tough")).toBe("invalid")
      expect(await save(ani, books.done, 3, null, "x".repeat(2001))).toBe("invalid")
      expect(await save(ani, books.done, 3, null, "x".repeat(2000))).toBe("ok")
    })

    it("answers not_finished and not_found, and never lets one member touch another's", async () => {
      expect(await save(ani, books.open, 4)).toBe("not_finished")
      expect(await save(ani, books.other, 4)).toBe("not_found")
      expect(await save(ani, randomUUID(), 4)).toBe("not_found")
      expect(await rpc(ani, "delete_review", { p_book_id: books.other })).toBe("not_found")
      expect(await save(budi, books.other, 2)).toBe("ok")
      const { data } = await ani.from("book_reviews").select("book_id")
      expect(data?.map((row) => row.book_id)).toEqual([books.done])
      const direct = await ani.from("book_reviews").insert({ book_id: books.second, user_id: ids.ani, rating: 1 })
      expect(direct.error).not.toBeNull()
    })

    it("deletes a review, also when there is none", async () => {
      expect(await rpc(ani, "delete_review", { p_book_id: books.done })).toBe("ok")
      expect(await rpc(ani, "delete_review", { p_book_id: books.done })).toBe("ok")
      const { data } = await ani.from("book_reviews").select("book_id")
      expect(data).toEqual([])
    })

    it("goes with the book and with the account", async () => {
      const mine = await newTestBook(ids.ani)
      await finish(mine)
      expect(await save(ani, mine, 4)).toBe("ok")
      fail((await admin.from("books").delete().eq("id", mine)).error)
      const gone = await admin.from("book_reviews").select("book_id").eq("book_id", mine)
      expect(gone.data).toEqual([])

      const cici = (await createTestMember({ email: `db-review-gone-${run}@glosa.test` })).id
      const theirs = await newTestBook(cici)
      await finish(theirs)
      const client = await signedInClient(`db-review-gone-${run}@glosa.test`)
      expect(await save(client, theirs, 3)).toBe("ok")
      fail((await admin.auth.admin.deleteUser(cici)).error)
      forgetTestMember(cici)
      const after = await admin.from("book_reviews").select("book_id").eq("book_id", theirs)
      expect(after.data).toEqual([])
    })

    it("refuses the other functions without a session", async () => {
      const anon = (await import("./helpers")).anonClient()
      const { error } = await anon.rpc("save_review", {
        p_book_id: books.done,
        p_rating: 3,
        p_difficulty: null as never,
        p_note: null as never,
      })
      expect(error).not.toBeNull()
    })
  })

  describe("book_finish_summary", () => {
    it("adds up one book's reading, taps, saved words and coins", async () => {
      await readTime(ids.ani, books.done, "2026-10-19", 2400)
      await readTime(ids.ani, books.done, "2026-10-20", 1500)
      await readTime(ids.ani, books.done, "2026-10-20", 0)
      await readTime(ids.ani, books.open, "2026-10-20", 999)
      fail(
        (
          await admin.from("word_lookups").insert([
            { user_id: ids.ani, book_id: books.done, word: "alpha", taps: 2 },
            { user_id: ids.ani, book_id: books.done, word: "beta", taps: 1 },
            { user_id: ids.ani, book_id: books.open, word: "gamma", taps: 1 },
          ])
        ).error
      )
      const saved = Array.from({ length: 14 }, (_, i) => ({
        user_id: ids.ani,
        headword: `kata${String(i).padStart(2, "0")}`,
        meanings: ["arti"],
        sentence: "",
        book_id: books.done,
        created_at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
      }))
      fail((await admin.from("saved_words").insert(saved)).error)

      const summary = (await rpc(ani, "book_finish_summary", { p_book_id: books.done })) as {
        seconds: number
        days: number
        looked_up: number
        saved: number
        words: Array<string>
        coins: number
        finished_at: string
        review: unknown
      }
      expect(summary.seconds).toBe(3900)
      expect(summary.days).toBe(2)
      expect(summary.looked_up).toBe(2)
      expect(summary.saved).toBe(14)
      expect(summary.words).toEqual(saved.slice(0, 12).map((word) => word.headword))
      // 3,900 s is over the hour that earns the bonus (3C).
      expect(summary.coins).toBe(50)
      expect(Date.parse(summary.finished_at)).toBe(Date.parse("2026-10-20T10:00:00Z"))
      expect(summary.review).toBeNull()
    })

    it("has no coins under an hour, carries the review, and is null for another member's book", async () => {
      expect(await rpc(ani, "save_review", { p_book_id: books.done, p_rating: 4, p_difficulty: "easy", p_note: "ok" })).toBe("ok")
      const again = (await rpc(ani, "book_finish_summary", { p_book_id: books.done })) as { review: { rating: number; difficulty: string } }
      expect(again.review).toMatchObject({ rating: 4, difficulty: "easy" })
      const second = (await rpc(ani, "book_finish_summary", { p_book_id: books.second })) as { coins: number; seconds: number }
      expect(second).toMatchObject({ coins: 0, seconds: 0 })
      expect(await rpc(ani, "book_finish_summary", { p_book_id: books.other })).toBeNull()
    })
  })

  describe("reading_recap", () => {
    const recap = (client: Client, from: string, to: string, tz = "Asia/Jakarta") =>
      rpc(client, "reading_recap", { p_from: from, p_to: to, p_tz: tz }) as Promise<{
        days: Array<{ day: string; seconds: number; goal_minutes: number | null }>
        books: Array<{ id: string; finished_at: string }>
        looked_up: number
        saved: number
        top_meeting: { headword: string; meetings: number } | null
        first_day: string | null
      }>

    it("answers the days, books and counts of a period, cut at the member's own midnight", async () => {
      // 17:30 UTC on 31 Oct is 00:30 on 1 Nov in Jakarta, and still 31 Oct in UTC.
      await finish(books.second, "2026-10-31T17:30:00Z")
      const november = await recap(ani, "2026-11-01", "2026-11-30")
      expect(november.books.map((book) => book.id)).toEqual([books.second])
      const october = await recap(ani, "2026-10-01", "2026-10-31")
      expect(october.books.map((book) => book.id)).toEqual([books.done])
      const utc = await recap(ani, "2026-10-01", "2026-10-31", "UTC")
      expect(utc.books.map((book) => book.id)).toEqual([books.second, books.done])
      expect(october.days).toEqual([
        { day: "2026-10-19", seconds: 2400, goal_minutes: null },
        { day: "2026-10-20", seconds: 2499, goal_minutes: null },
      ])
      expect(october.first_day).toBe("2026-10-19")
      expect(november.days).toEqual([])
    })

    it("counts words first tapped and saved in the period, per word over all books", async () => {
      fail(
        (
          await admin.from("word_lookups").insert([
            { user_id: ids.ani, book_id: books.second, word: "alpha", taps: 1, first_at: "2026-12-05T00:00:00Z" },
            { user_id: ids.ani, book_id: books.second, word: "delta", taps: 1, first_at: "2026-12-05T00:00:00Z" },
          ])
        ).error
      )
      fail(
        (
          await admin.from("word_lookups").update({ first_at: "2026-10-20T03:00:00Z" }).eq("user_id", ids.ani).eq("book_id", books.done)
        ).error
      )
      const december = await recap(ani, "2026-12-01", "2026-12-31", "UTC")
      // alpha was first tapped in October, so only delta is new in December.
      expect(december.looked_up).toBe(1)
      const october = await recap(ani, "2026-10-01", "2026-10-31", "UTC")
      expect(october.looked_up).toBe(2)
      expect(october.saved).toBe(14)
      expect((await recap(ani, "2026-11-01", "2026-11-30", "UTC")).saved).toBe(0)
    })

    it("finds the word met most in the period, ties by alphabet, met_at kept when the count grows", async () => {
      fail(
        (
          await admin.from("saved_words").insert([
            { user_id: ids.ani, headword: "berry", meanings: ["a"], sentence: "" },
            { user_id: ids.ani, headword: "apple", meanings: ["a"], sentence: "" },
          ])
        ).error
      )
      const meet = (headword: string, section: number, count: number, met_at: string) => ({
        user_id: ids.ani,
        headword,
        book_id: books.open,
        section,
        count,
        met_at,
      })
      fail(
        (
          await admin.from("word_meetings").insert([
            meet("berry", 1, 2, "2026-09-10T00:00:00Z"),
            meet("berry", 2, 1, "2026-09-11T00:00:00Z"),
            meet("apple", 1, 3, "2026-09-12T00:00:00Z"),
            meet("apple", 2, 9, "2026-08-01T00:00:00Z"),
          ])
        ).error
      )
      const september = await recap(ani, "2026-09-01", "2026-09-30", "UTC")
      expect(september.top_meeting).toEqual({ headword: "apple", meetings: 3 })
      fail((await admin.from("word_meetings").update({ count: 4 }).eq("user_id", ids.ani).eq("headword", "berry").eq("section", 1)).error)
      expect((await recap(ani, "2026-09-01", "2026-09-30", "UTC")).top_meeting).toEqual({ headword: "berry", meetings: 5 })
      fail((await admin.from("word_meetings").update({ count: 2 }).eq("user_id", ids.ani).eq("headword", "berry").eq("section", 1)).error)
      // Back to 2 + 1 = 3 for berry: a tie with apple, and the alphabet decides.
      expect((await recap(ani, "2026-09-01", "2026-09-30", "UTC")).top_meeting).toEqual({ headword: "apple", meetings: 3 })
      expect((await recap(ani, "2026-07-01", "2026-07-31", "UTC")).top_meeting).toBeNull()

      // record_meetings raises a count without touching met_at.
      const before = await admin.from("word_meetings").select("met_at").eq("user_id", ids.ani).eq("headword", "berry").eq("section", 1).single()
      await rpc(ani, "record_meetings", { p_entries: [{ headword: "berry", book_id: books.open, section: 1, count: 6 }] })
      const after = await admin.from("word_meetings").select("met_at, count").eq("user_id", ids.ani).eq("headword", "berry").eq("section", 1).single()
      expect(after.data?.met_at).toBe(before.data?.met_at)
    })

    it("refuses a long range, a backwards range and an unknown zone, and only reads the member's own", async () => {
      await expect(recap(ani, "2025-01-01", "2026-12-31")).rejects.toMatchObject({ message: "invalid" })
      await expect(recap(ani, "2026-10-31", "2026-10-01")).rejects.toMatchObject({ message: "invalid" })
      await expect(recap(ani, "2026-10-01", "2026-10-31", "Mars/Olympus")).rejects.toMatchObject({ message: "invalid" })
      await expect(recap(ani, "2026-01-01", "2027-01-01")).resolves.toBeDefined()
      const other = await recap(budi, "2026-01-01", "2026-12-31")
      expect(other.books.map((book) => book.id)).toEqual([books.other])
      expect(other.days).toEqual([])
      expect(other.first_day).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run --config vitest.db.config.ts tests/db/review-recap.test.ts`
Expected: FAIL (tabel/fungsi belum ada, "Could not find the function public.save_review").

- [ ] **Step 3: Tulis migrasi**

`supabase/migrations/20261107000200_finish_review_recap.sql`:

```sql
-- Finished-book card, private review and recap (spec 3E §6). Additive only.

-- A member's private review of a finished book (spec 3E §4, §6.1). One per
-- book. No public column: Tahap 4 adds it. Written only by save_review.
create table public.book_reviews (
  book_id uuid primary key references public.books (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index book_reviews_user_id_idx on public.book_reviews (user_id);

alter table public.book_reviews enable row level security;

create policy book_reviews_select_own on public.book_reviews
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.book_reviews from anon, authenticated;
grant select on table public.book_reviews to authenticated;

-- When a meeting row was first written; the recap counts meetings by it.
-- record_meetings never sets it, so a larger count leaves it alone.
alter table public.word_meetings
  add column met_at timestamptz not null default now();

-- Saves or changes the review of one of the member's finished books.
-- 'ok', 'not_found' (not the member's book), 'not_finished' or 'invalid'
-- (rating, difficulty or note outside the rules). A blank note is null.
create function public.save_review(
  p_book_id uuid,
  p_rating integer,
  p_difficulty text,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_finished timestamptz;
  v_note text := nullif(btrim(p_note), '');
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select b.finished_at into v_finished
  from public.books b
  where b.id = p_book_id and b.user_id = v_user_id;
  if not found then
    return 'not_found';
  end if;
  if v_finished is null then
    return 'not_finished';
  end if;
  if p_rating is null or p_rating not between 1 and 5
    or (p_difficulty is not null
      and p_difficulty not in ('easy', 'medium', 'hard'))
    or (v_note is not null and char_length(v_note) > 2000) then
    return 'invalid';
  end if;

  insert into public.book_reviews as r
    (book_id, user_id, rating, difficulty, note)
  values (p_book_id, v_user_id, p_rating, p_difficulty, v_note)
  on conflict (book_id) do update
    set rating = excluded.rating,
        difficulty = excluded.difficulty,
        note = excluded.note,
        updated_at = now();
  return 'ok';
end;
$$;

-- Removes the review; 'ok' also when there was none, 'not_found' when the
-- book is not the member's.
create function public.delete_review(p_book_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.books b
    where b.id = p_book_id and b.user_id = v_user_id
  ) then
    return 'not_found';
  end if;
  delete from public.book_reviews r
  where r.book_id = p_book_id and r.user_id = v_user_id;
  return 'ok';
end;
$$;

-- The numbers of the finished-book card (spec 3E §3.2) in one answer, or
-- null for a book that is not the member's. The coin bonus is awarded first
-- (idempotent), so "+50 koin" is right the moment a book is finished. The
-- member's review comes along, and the first 12 saved words of the book.
create function public.book_finish_summary(p_book_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_finished timestamptz;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select b.finished_at into v_finished
  from public.books b
  where b.id = p_book_id and b.user_id = v_user_id;
  if not found then
    return null;
  end if;
  perform public.award_book_coins(v_user_id);

  return jsonb_build_object(
    'seconds', (
      select coalesce(sum(rt.seconds), 0)::integer
      from public.reading_time rt
      where rt.user_id = v_user_id and rt.book_id = p_book_id
    ),
    'days', (
      select count(distinct rt.day)::integer
      from public.reading_time rt
      where rt.user_id = v_user_id and rt.book_id = p_book_id
        and rt.seconds > 0
    ),
    'looked_up', (
      select count(*)::integer
      from public.word_lookups l
      where l.user_id = v_user_id and l.book_id = p_book_id
    ),
    'saved', (
      select count(*)::integer
      from public.saved_words s
      where s.user_id = v_user_id and s.book_id = p_book_id
    ),
    'words', coalesce((
      select jsonb_agg(w.headword order by w.created_at, w.headword)
      from (
        select s.headword, s.created_at
        from public.saved_words s
        where s.user_id = v_user_id and s.book_id = p_book_id
        order by s.created_at, s.headword
        limit 12
      ) w
    ), '[]'::jsonb),
    'coins', coalesce((
      select a.coins from public.coin_awards a
      where a.user_id = v_user_id and a.book_id = p_book_id
    ), 0),
    'finished_at', v_finished,
    'review', (
      select jsonb_build_object(
        'rating', r.rating,
        'difficulty', r.difficulty,
        'note', r.note,
        'updated_at', r.updated_at
      )
      from public.book_reviews r
      where r.book_id = p_book_id and r.user_id = v_user_id
    )
  );
end;
$$;

-- The recap of local days p_from..p_to (both included) in zone p_tz
-- (spec 3E §5, §6.2): one object. Days come from reading_time as the habit
-- reads them; every other time is cut at the zone's midnight. A range over
-- 366 days, a backwards range or an unknown zone is 'invalid'.
create function public.reading_recap(p_from date, p_to date, p_tz text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_start timestamptz;
  v_end timestamptz;
  v_top jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_from is null or p_to is null or p_tz is null
    or p_to < p_from or p_to - p_from > 366
    or not exists (
      select 1 from pg_catalog.pg_timezone_names n where n.name = p_tz
    ) then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  v_start := p_from::timestamp at time zone p_tz;
  v_end := (p_to + 1)::timestamp at time zone p_tz;

  select jsonb_build_object('headword', m.headword, 'meetings', m.total)
  into v_top
  from (
    select wm.headword, sum(wm.count)::integer as total
    from public.word_meetings wm
    where wm.user_id = v_user_id
      and wm.met_at >= v_start and wm.met_at < v_end
    group by wm.headword
    order by total desc, wm.headword asc
    limit 1
  ) m;

  return jsonb_build_object(
    'days', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day', d.day,
          'seconds', d.seconds,
          'goal_minutes', d.goal_minutes
        ) order by d.day
      )
      from (
        select
          rt.day,
          least(sum(rt.seconds), 86400)::integer as seconds,
          (array_agg(rt.goal_minutes
            order by rt.updated_at desc, rt.goal_minutes desc nulls last))[1]
            as goal_minutes
        from public.reading_time rt
        where rt.user_id = v_user_id and rt.day between p_from and p_to
        group by rt.day
      ) d
    ), '[]'::jsonb),
    'books', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', b.id, 'finished_at', b.finished_at)
        order by b.finished_at desc
      )
      from public.books b
      where b.user_id = v_user_id
        and b.finished_at >= v_start and b.finished_at < v_end
    ), '[]'::jsonb),
    'looked_up', (
      select count(*)::integer
      from (
        select l.word, min(l.first_at) as first_at
        from public.word_lookups l
        where l.user_id = v_user_id
        group by l.word
      ) f
      where f.first_at >= v_start and f.first_at < v_end
    ),
    'saved', (
      select count(*)::integer
      from public.saved_words s
      where s.user_id = v_user_id
        and s.created_at >= v_start and s.created_at < v_end
    ),
    'top_meeting', v_top,
    'first_day', (
      select min(rt.day)
      from public.reading_time rt
      where rt.user_id = v_user_id
    )
  );
end;
$$;

revoke execute on function public.save_review(uuid, integer, text, text) from public, anon;
grant execute on function public.save_review(uuid, integer, text, text) to authenticated;
revoke execute on function public.delete_review(uuid) from public, anon;
grant execute on function public.delete_review(uuid) to authenticated;
revoke execute on function public.book_finish_summary(uuid) from public, anon;
grant execute on function public.book_finish_summary(uuid) to authenticated;
revoke execute on function public.reading_recap(date, date, text) from public, anon;
grant execute on function public.reading_recap(date, date, text) to authenticated;
```

- [ ] **Step 4: Push ke dev dan buat ulang tipe**

Run: `npm run db:push`, lalu `npm run db:types`, lalu `npx prettier --write src/server/database.types.ts` (hapus baris keluaran CLI di awal file bila ada).
Expected: migrasi `20261107000200` terpasang; `database.types.ts` memuat `book_reviews` dan fungsi baru.

- [ ] **Step 5: Jalankan tes DB**

Run: `npx vitest run --config vitest.db.config.ts tests/db/review-recap.test.ts`
Expected: PASS. Bila "ties by alphabet" gagal karena angka, hitung ulang jumlah per kata di tes (berry = jumlah dua baris September, apple = 3).

- [ ] **Step 6: Format dan commit**

```bash
npx prettier --write tests/db/review-recap.test.ts
npx tsc --noEmit
git add supabase/migrations/20261107000200_finish_review_recap.sql tests/db/review-recap.test.ts src/server/database.types.ts
git commit -m "feat(3e): reviews, finish summary and recap in the database

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Model ulasan, `review` di rak, urutan Rating tertinggi

**Files:**
- Create: `src/lib/review.ts`, `src/lib/review.test.ts`
- Modify: `src/lib/book-types.ts`, `src/lib/shelf.ts`, `src/lib/shelf.test.ts`, `src/lib/local/shelf-snapshot.ts` (+ tesnya), `src/server/books.ts`
- Modify (mekanis): setiap literal `ShelfBook` di tes dan fixture mendapat `review: null`

**Interfaces:**
- Produces (`src/lib/review.ts`):
  - `DIFFICULTIES = ["easy","medium","hard"] as const`, `type Difficulty`, `DIFFICULTY_LABELS: Record<Difficulty, string>` (Mudah/Sedang/Sulit), `MAX_NOTE = 2000`, `NOTE_COUNTER_FROM = 1800`, `RATINGS = [1,2,3,4,5] as const`
  - `type BookReview = { rating: number; difficulty: Difficulty | null; note: string | null; updatedAt: string }`
  - `type FinishSummary = { seconds: number; days: number; lookedUp: number; saved: number; words: Array<string>; coins: number; finishedAt: string | null; review: BookReview | null }`
  - `reviewOf(raw: unknown): BookReview | null` (menerima objek `{rating, difficulty, note, updated_at}`, atau larik berisi satu, atau null)
  - `parseFinishSummary(raw: unknown): FinishSummary | null`
- Produces: `ShelfBook.review: BookReview | null`; `ShelfSort` mendapat `"rating"` (label "Rating tertinggi").

- [ ] **Step 1: Tulis tes yang gagal**

`src/lib/review.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { parseFinishSummary, reviewOf } from "./review"

const row = {
  rating: 4,
  difficulty: "hard",
  note: "Bagus",
  updated_at: "2026-11-07T01:00:00Z",
}

describe("reviewOf", () => {
  it("reads the row, or the row inside a one-item array", () => {
    const review = {
      rating: 4,
      difficulty: "hard",
      note: "Bagus",
      updatedAt: "2026-11-07T01:00:00Z",
    }
    expect(reviewOf(row)).toEqual(review)
    expect(reviewOf([row])).toEqual(review)
  })

  it("is null for nothing and for a broken row", () => {
    expect(reviewOf(null)).toBeNull()
    expect(reviewOf([])).toBeNull()
    expect(reviewOf({ ...row, rating: 6 })).toBeNull()
    expect(reviewOf({ ...row, difficulty: "tough" })).toBeNull()
  })
})

describe("parseFinishSummary", () => {
  const raw = {
    seconds: 22800,
    days: 14,
    looked_up: 30,
    saved: 9,
    words: ["alpha", "beta"],
    coins: 50,
    finished_at: "2026-11-07T01:00:00Z",
    review: null,
  }

  it("turns the server's answer into the card's numbers", () => {
    expect(parseFinishSummary(raw)).toEqual({
      seconds: 22800,
      days: 14,
      lookedUp: 30,
      saved: 9,
      words: ["alpha", "beta"],
      coins: 50,
      finishedAt: "2026-11-07T01:00:00Z",
      review: null,
    })
    expect(parseFinishSummary({ ...raw, review: row })?.review?.rating).toBe(4)
  })

  it("refuses anything else", () => {
    expect(parseFinishSummary(null)).toBeNull()
    expect(parseFinishSummary({ ...raw, seconds: "x" })).toBeNull()
  })
})
```

Tambahkan di `src/lib/shelf.test.ts` (ikuti helper pembuat buku yang sudah ada di file itu; sesuaikan namanya):

```ts
describe("Rating tertinggi", () => {
  const rated = (id: string, rating: number | null, finishedAt: string | null) => ({
    ...book({ id }),
    finishedAt,
    review: rating === null ? null : { rating, difficulty: null, note: null, updatedAt: "2026-11-01T00:00:00Z" },
  })

  it("puts the most stars first, the later finish first on a tie, unrated below in the default order", () => {
    const books = [
      rated("none-old", null, null),
      rated("three", 3, "2026-10-01T00:00:00Z"),
      rated("five-old", 5, "2026-09-01T00:00:00Z"),
      rated("five-new", 5, "2026-10-15T00:00:00Z"),
    ]
    books[0] = { ...books[0], lastOpenedAt: "2026-08-01T00:00:00Z" }
    const ids = shelfBooks(books, { sort: "rating" }).map((b) => b.id)
    expect(ids).toEqual(["five-new", "five-old", "three", "none-old"])
  })

  it("is a sort the URL may carry, labelled Rating tertinggi", () => {
    expect(isShelfSort("rating")).toBe(true)
    expect(SHELF_SORTS.find((s) => s.value === "rating")?.label).toBe("Rating tertinggi")
  })
})
```

Di tes snapshot (`shelf-snapshot.test.ts`), tambahkan: snapshot lama tanpa `review` dibaca sebagai `review: null`, dan snapshot dengan `review` tetap utuh.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/review.test.ts src/lib/shelf.test.ts src/lib/local/shelf-snapshot.test.ts`
Expected: FAIL (modul `./review` tidak ada).

- [ ] **Step 3: Tulis `src/lib/review.ts`**

```ts
import { z } from "zod"

export const DIFFICULTIES = ["easy", "medium", "hard"] as const
export type Difficulty = (typeof DIFFICULTIES)[number]
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Mudah",
  medium: "Sedang",
  hard: "Sulit",
}
export const RATINGS = [1, 2, 3, 4, 5] as const
/** The longest note, and where the counter starts to show (spec 3E §4.1). */
export const MAX_NOTE = 2000
export const NOTE_COUNTER_FROM = 1800

/** A member's private review of a finished book (spec 3E §4). */
export type BookReview = {
  rating: number
  difficulty: Difficulty | null
  note: string | null
  updatedAt: string
}

/** The numbers of the finished-book card (spec 3E §3.2). */
export type FinishSummary = {
  seconds: number
  days: number
  lookedUp: number
  saved: number
  /** The first saved words of the book, at most 12. */
  words: Array<string>
  coins: number
  finishedAt: string | null
  review: BookReview | null
}

const ReviewRow = z.object({
  rating: z.number().int().min(1).max(5),
  difficulty: z.enum(DIFFICULTIES).nullable(),
  note: z.string().nullable(),
  updated_at: z.string(),
})

/** The review in a database row; PostgREST may nest it as one object or a one-item array. */
export function reviewOf(raw: unknown): BookReview | null {
  const parsed = ReviewRow.safeParse(Array.isArray(raw) ? raw[0] : raw)
  if (!parsed.success) return null
  const { rating, difficulty, note, updated_at } = parsed.data
  return { rating, difficulty, note, updatedAt: updated_at }
}

const SummaryRow = z.object({
  seconds: z.number(),
  days: z.number(),
  looked_up: z.number(),
  saved: z.number(),
  words: z.array(z.string()),
  coins: z.number(),
  finished_at: z.string().nullable(),
  review: z.unknown(),
})

export function parseFinishSummary(raw: unknown): FinishSummary | null {
  const parsed = SummaryRow.safeParse(raw)
  if (!parsed.success) return null
  const row = parsed.data
  return {
    seconds: row.seconds,
    days: row.days,
    lookedUp: row.looked_up,
    saved: row.saved,
    words: row.words,
    coins: row.coins,
    finishedAt: row.finished_at,
    review: reviewOf(row.review),
  }
}
```

- [ ] **Step 4: Ubah rak**

- `src/lib/book-types.ts`: impor `BookReview` dari `./review`; tambahkan ke `ShelfBook`: `/** The member's private review, only while the book is finished (spec 3E §4.3). */ review: BookReview | null`.
- `src/server/books.ts` (`listBooksFn`): tambahkan `book_reviews(rating, difficulty, note, updated_at)` ke string `select` setelah `collection_books(collection_id)`; di pemetaan, setelah `collectionIds`, tambahkan `review: row.finished_at ? reviewOf(row.book_reviews) : null` (impor `reviewOf`). Ulasan buku yang ditandai belum selesai tersembunyi di sini, bukan dihapus.
- `src/lib/local/shelf-snapshot.ts`: tambahkan `"review"` ke `Omit<…>` dan `Partial<Pick<…>>` di `StoredShelf`, dan di pemetaan `review: book.review ?? null`.
- `src/lib/shelf.ts`: `ShelfSort` menjadi `"opened" | "title" | "added" | "finished" | "rating"`; `SHELF_SORTS` mendapat `{ value: "rating", label: "Rating tertinggi" }` di akhir. Ubah `comparator` menjadi `comparator(sort, koleksi)`; untuk `"rating"`:

```ts
if (sort === "rating") {
  const fallback = comparator(defaultSort(koleksi), koleksi)
  return (a, b) => {
    const ra = a.review?.rating ?? 0
    const rb = b.review?.rating ?? 0
    if (ra === 0 || rb === 0) return rb - ra || fallback(a, b)
    return (
      rb - ra ||
      (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "") ||
      fallback(a, b)
    )
  }
}
```

  dan di `shelfBooks` ganti `.sort(comparator(search.sort ?? defaultSort(search.koleksi)))` dengan `.sort(comparator(search.sort ?? defaultSort(search.koleksi), search.koleksi))`. Buku tanpa bintang (termasuk yang belum selesai, yang `review`-nya null) otomatis di bawah.
- Jalankan `npx tsc --noEmit`; setiap literal `ShelfBook` yang dikeluhkan (tes, fixture, e2e helper) mendapat `review: null`.

- [ ] **Step 5: Jalankan tes**

Run: `npx vitest run src/lib src/components/shelf src/components/lobby`
Expected: PASS.

- [ ] **Step 6: Format dan commit**

```bash
npx prettier --write src/lib/review.ts src/lib/review.test.ts src/lib/book-types.ts src/lib/shelf.ts src/lib/shelf.test.ts src/lib/local/shelf-snapshot.ts src/server/books.ts
npx tsc --noEmit
git add -A src
git commit -m "feat(3e): review on the shelf list and the Rating tertinggi sort

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Gunakan `git add` pada file yang benar-benar berubah, bukan `-A`, bila ada berkas lain yang belum terkait; `inspiration.md` tidak boleh ikut.)

---

### Task 3: Logika murni kilas balik dan server function

**Files:**
- Create: `src/lib/recap/types.ts`, `period.ts`, `recap.ts`, `bubble.ts`, `format.ts` dan tesnya (`period.test.ts`, `recap.test.ts`, `bubble.test.ts`, `format.test.ts`)
- Create: `src/server/reviews.ts`, `src/server/recap.ts`
- Modify: `src/lib/local/keys.ts` (kunci baru), `src/lib/book-messages.ts` (kode baru)

**Interfaces:**
- Consumes: `HabitDay` (`src/lib/habit/types.ts`), `habitSummary` (`src/lib/reading-habit.ts`), `addDays` (`src/lib/dates.ts`), `BookReview`, `FinishSummary`, `parseFinishSummary`, `DIFFICULTIES`, `MAX_NOTE` (Task 2).
- Produces:
  - `src/lib/recap/types.ts`: `RecapData = { days: Array<HabitDay>; books: Array<{ id: string; finishedAt: string }>; lookedUp: number; saved: number; topMeeting: { headword: string; meetings: number } | null; firstDay: string | null }`; `parseRecap(raw: unknown): RecapData | null`.
  - `period.ts`: `MONTH_NAMES: ReadonlyArray<string>`, `type Period = { kind: "month"; year: number; month: number } | { kind: "year"; year: number }`, `periodKey(p)`, `currentPeriod(today)`, `parsePeriod(raw: unknown, today: string): Period`, `periodRange(p): { from: string; to: string }`, `isOngoing(p, today): boolean`, `periodLabel(p): string`, `periodList(kind: "month" | "year", firstDay: string | null, today: string): Array<Period>` (terbaru dulu).
  - `recap.ts`: `longestStreak(days, range, today): number`, `type RecapView`, `recapView(recap, range, today): RecapView`.
  - `bubble.ts`: `type RecapBubble = { key: string; label: string }`, `recapBubbleFor(today, days | null, shown): RecapBubble | null`, `readShownBubbles(): Array<string>`, `rememberBubble(key: string): void`.
  - `format.ts`: `formatReadTime(seconds: number): string`.
  - `src/server/reviews.ts`: `saveReviewFn({ bookId, rating, difficulty, note }) → ActionResult`, `deleteReviewFn({ bookId }) → ActionResult`, `finishSummaryFn({ bookId }) → { ok: true; summary: FinishSummary } | { ok: false; code: string }`.
  - `src/server/recap.ts`: `loadRecapFn({ from, to, timeZone }) → { ok: true; recap: RecapData } | { ok: false; code: string }`.

- [ ] **Step 1: Tulis tes yang gagal**

`src/lib/recap/format.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { formatReadTime } from "./format"

describe("formatReadTime", () => {
  it("writes hours and minutes, dropping what is zero", () => {
    expect(formatReadTime(6 * 3600 + 20 * 60)).toBe("6 jam 20 menit")
    expect(formatReadTime(2 * 3600)).toBe("2 jam")
    expect(formatReadTime(45 * 60 + 29)).toBe("45 menit")
  })

  it("never says zero", () => {
    expect(formatReadTime(0)).toBe("Kurang dari 1 menit")
    expect(formatReadTime(59)).toBe("Kurang dari 1 menit")
  })
})
```

`src/lib/recap/period.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  currentPeriod,
  isOngoing,
  parsePeriod,
  periodKey,
  periodLabel,
  periodList,
  periodRange,
} from "./period"

const TODAY = "2026-11-07"

describe("parsePeriod", () => {
  it("reads a month and a year", () => {
    expect(parsePeriod("2026-10", TODAY)).toEqual({ kind: "month", year: 2026, month: 10 })
    expect(parsePeriod("2025", TODAY)).toEqual({ kind: "year", year: 2025 })
  })

  it("falls back to this month for anything else, also for the future", () => {
    const now = currentPeriod(TODAY)
    expect(now).toEqual({ kind: "month", year: 2026, month: 11 })
    for (const raw of [undefined, null, 5, "", "abc", "2026-13", "2026-00", "2026-1", "2027", "2026-12", "1999"]) {
      expect(parsePeriod(raw, TODAY)).toEqual(now)
    }
  })
})

describe("period helpers", () => {
  it("gives the key, the label and the days of a period", () => {
    const october = parsePeriod("2026-10", TODAY)
    expect(periodKey(october)).toBe("2026-10")
    expect(periodLabel(october)).toBe("Oktober 2026")
    expect(periodRange(october)).toEqual({ from: "2026-10-01", to: "2026-10-31" })
    expect(periodRange(parsePeriod("2024-02", TODAY))).toEqual({ from: "2024-02-01", to: "2024-02-29" })
    const year = parsePeriod("2025", TODAY)
    expect(periodKey(year)).toBe("2025")
    expect(periodLabel(year)).toBe("2025")
    expect(periodRange(year)).toEqual({ from: "2025-01-01", to: "2025-12-31" })
  })

  it("knows a period that is not over", () => {
    expect(isOngoing(currentPeriod(TODAY), TODAY)).toBe(true)
    expect(isOngoing(parsePeriod("2026-10", TODAY), TODAY)).toBe(false)
    expect(isOngoing(parsePeriod("2026", TODAY), TODAY)).toBe(true)
    expect(isOngoing(parsePeriod("2025", TODAY), TODAY)).toBe(false)
  })
})

describe("periodList", () => {
  it("runs from the first month with reading to now, newest first", () => {
    const keys = periodList("month", "2026-09-14", TODAY).map(periodKey)
    expect(keys).toEqual(["2026-11", "2026-10", "2026-09"])
    expect(periodList("year", "2024-03-02", TODAY).map(periodKey)).toEqual(["2026", "2025", "2024"])
  })

  it("is only the current period without any reading", () => {
    expect(periodList("month", null, TODAY).map(periodKey)).toEqual(["2026-11"])
    expect(periodList("year", null, TODAY).map(periodKey)).toEqual(["2026"])
    expect(periodList("month", "2030-01-01", TODAY).map(periodKey)).toEqual(["2026-11"])
  })
})
```

`src/lib/recap/recap.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { HabitDay } from "@/lib/habit/types"
import { longestStreak, parseRecap, recapView } from "./recap"

const day = (d: string, seconds = 600): HabitDay => ({ day: d, seconds, goalMinutes: null })
const OCTOBER = { from: "2026-10-01", to: "2026-10-31" }

describe("longestStreak", () => {
  it("counts reading days with the free days of the habit, the longest run", () => {
    // 5, 6, 9 Oct: two free days in between keep it going (3); then 20-23 is 4.
    const days = ["2026-10-05", "2026-10-06", "2026-10-09", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"].map((d) => day(d))
    expect(longestStreak(days, OCTOBER, "2026-11-07")).toBe(4)
  })

  it("counts only days inside the period", () => {
    const days = [day("2026-09-29"), day("2026-09-30"), day("2026-10-01")]
    expect(longestStreak(days, OCTOBER, "2026-11-07")).toBe(1)
  })

  it("counts today in a period that is not over", () => {
    const days = [day("2026-10-19"), day("2026-10-20"), day("2026-10-21")]
    expect(longestStreak(days, OCTOBER, "2026-10-21")).toBe(3)
    expect(longestStreak([day("2026-10-21", 100)], OCTOBER, "2026-10-21")).toBe(0)
  })

  it("is 0 without reading", () => {
    expect(longestStreak([], OCTOBER, "2026-11-07")).toBe(0)
  })
})

describe("recapView", () => {
  const recap = {
    days: [day("2026-10-05", 3600), day("2026-10-06", 1800), day("2026-10-07", 0)],
    books: [{ id: "a", finishedAt: "2026-10-20T00:00:00Z" }],
    lookedUp: 12,
    saved: 3,
    topMeeting: { headword: "ominous", meetings: 5 },
    firstDay: "2026-10-05",
  }

  it("adds the period up", () => {
    const view = recapView(recap, OCTOBER, "2026-11-07")
    expect(view).toMatchObject({ seconds: 5400, readingDays: 2, streak: 2, lookedUp: 12, saved: 3, empty: false })
    expect(view.finished).toEqual(recap.books)
    expect(view.topMeeting).toEqual({ headword: "ominous", meetings: 5 })
  })

  it("is empty with no time, books or words", () => {
    const empty = { ...recap, days: [], books: [], lookedUp: 0, saved: 0, topMeeting: null, firstDay: null }
    expect(recapView(empty, OCTOBER, "2026-11-07").empty).toBe(true)
    expect(recapView({ ...empty, saved: 1 }, OCTOBER, "2026-11-07").empty).toBe(false)
  })
})

describe("parseRecap", () => {
  it("reads the server's answer", () => {
    expect(
      parseRecap({
        days: [{ day: "2026-10-05", seconds: 60, goal_minutes: 10 }],
        books: [{ id: "a", finished_at: "2026-10-20T00:00:00Z" }],
        looked_up: 1,
        saved: 2,
        top_meeting: null,
        first_day: "2026-10-05",
      })
    ).toEqual({
      days: [{ day: "2026-10-05", seconds: 60, goalMinutes: 10 }],
      books: [{ id: "a", finishedAt: "2026-10-20T00:00:00Z" }],
      lookedUp: 1,
      saved: 2,
      topMeeting: null,
      firstDay: "2026-10-05",
    })
    expect(parseRecap({ days: "x" })).toBeNull()
  })
})
```

`src/lib/recap/bubble.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest"
import type { HabitDay } from "@/lib/habit/types"
import { recapBubbleFor, readShownBubbles, rememberBubble } from "./bubble"

const read = (day: string): HabitDay => ({ day, seconds: 600, goalMinutes: null })

describe("recapBubbleFor", () => {
  const october = [read("2026-10-12")]

  it("shows on days 1-7 when last month has reading", () => {
    expect(recapBubbleFor("2026-11-01", october, [])).toEqual({
      key: "2026-10",
      label: "Kilas balik Oktober sudah siap",
    })
    expect(recapBubbleFor("2026-11-07", october, [])?.key).toBe("2026-10")
    expect(recapBubbleFor("2026-11-08", october, [])).toBeNull()
  })

  it("shows once per period", () => {
    expect(recapBubbleFor("2026-11-02", october, ["2026-10"])).toBeNull()
  })

  it("needs the cache and reading last month", () => {
    expect(recapBubbleFor("2026-11-02", null, [])).toBeNull()
    expect(recapBubbleFor("2026-11-02", [read("2026-09-12")], [])).toBeNull()
    expect(recapBubbleFor("2026-11-02", [{ day: "2026-10-12", seconds: 0, goalMinutes: null }], [])).toBeNull()
  })

  it("becomes the year's in January", () => {
    expect(recapBubbleFor("2027-01-03", [read("2026-12-30")], [])).toEqual({
      key: "2026",
      label: "Kilas balik 2026 sudah siap",
    })
    expect(recapBubbleFor("2027-01-03", [read("2026-03-01")], [])?.key).toBe("2026")
  })
})

describe("remembered bubbles", () => {
  beforeEach(() => localStorage.clear())

  it("keeps the periods shown on this device", () => {
    expect(readShownBubbles()).toEqual([])
    rememberBubble("2026-10")
    rememberBubble("2026-10")
    rememberBubble("2026")
    expect(readShownBubbles()).toEqual(["2026-10", "2026"])
  })

  it("survives broken storage", () => {
    localStorage.setItem("glosa:recap-bubble", "{")
    expect(readShownBubbles()).toEqual([])
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/recap`
Expected: FAIL (modul belum ada).

- [ ] **Step 3: Tulis kode**

`src/lib/local/keys.ts`: tambahkan `export const RECAP_BUBBLE_KEY = "glosa:recap-bubble"` setelah `HABIT_TOAST_KEY`.

`src/lib/recap/format.ts`:

```ts
/** "6 jam 20 menit", "45 menit", "Kurang dari 1 menit" (spec 3E §3.2). */
export function formatReadTime(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  if (minutes < 1) return "Kurang dari 1 menit"
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const parts: Array<string> = []
  if (hours > 0) parts.push(`${hours} jam`)
  if (rest > 0) parts.push(`${rest} menit`)
  return parts.join(" ")
}
```

`src/lib/recap/period.ts`:

```ts
export const MONTH_NAMES: ReadonlyArray<string> = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

/** A month or a year of the recap (spec 3E §5.1). */
export type Period =
  | { kind: "month"; year: number; month: number }
  | { kind: "year"; year: number }

const pad = (value: number) => String(value).padStart(2, "0")

/** The `?periode=` value: "2026-10" or "2026". */
export const periodKey = (period: Period): string =>
  period.kind === "year"
    ? String(period.year)
    : `${period.year}-${pad(period.month)}`

export function currentPeriod(today: string): Period {
  return {
    kind: "month",
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }
}

/** The period asked for; anything unknown or in the future is this month. */
export function parsePeriod(raw: unknown, today: string): Period {
  const now = currentPeriod(today)
  if (typeof raw !== "string") return now
  const year = Number(today.slice(0, 4))
  const month = /^(\d{4})-(\d{2})$/.exec(raw)
  if (month) {
    const found: Period = {
      kind: "month",
      year: Number(month[1]),
      month: Number(month[2]),
    }
    const ok =
      found.month >= 1 &&
      found.month <= 12 &&
      found.year >= 2000 &&
      periodKey(found) <= periodKey(now)
    return ok ? found : now
  }
  if (/^\d{4}$/.test(raw)) {
    const found = Number(raw)
    return found >= 2000 && found <= year ? { kind: "year", year: found } : now
  }
  return now
}

/** The first and last local day of the period. */
export function periodRange(period: Period): { from: string; to: string } {
  if (period.kind === "year") {
    return { from: `${period.year}-01-01`, to: `${period.year}-12-31` }
  }
  const last = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate()
  const head = `${period.year}-${pad(period.month)}`
  return { from: `${head}-01`, to: `${head}-${pad(last)}` }
}

/** The period is not over yet: "sejauh ini". */
export function isOngoing(period: Period, today: string): boolean {
  return periodRange(period).to >= today
}

export function periodLabel(period: Period): string {
  return period.kind === "year"
    ? String(period.year)
    : `${MONTH_NAMES[period.month - 1]} ${period.year}`
}

/** Periods from the one of `firstDay` to now, newest first; only now without a first day. */
export function periodList(
  kind: "month" | "year",
  firstDay: string | null,
  today: string
): Array<Period> {
  const nowYear = Number(today.slice(0, 4))
  const nowMonth = Number(today.slice(5, 7))
  const startYear = firstDay ? Number(firstDay.slice(0, 4)) : nowYear
  const startMonth = firstDay ? Number(firstDay.slice(5, 7)) : nowMonth
  const list: Array<Period> = []
  if (kind === "year") {
    for (let year = nowYear; year >= Math.min(startYear, nowYear); year -= 1) {
      list.push({ kind: "year", year })
    }
    return list
  }
  let year = nowYear
  let month = nowMonth
  const first = startYear * 12 + startMonth
  while (year * 12 + month >= Math.min(first, nowYear * 12 + nowMonth)) {
    list.push({ kind: "month", year, month })
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  return list
}
```

`src/lib/recap/types.ts` (zod tetap di `recap.ts` agar `types.ts` murni tipe — atau gabungkan; di sini tipe saja):

```ts
import type { HabitDay } from "@/lib/habit/types"

/** What the server answers for a period (spec 3E §6.2). */
export type RecapData = {
  days: Array<HabitDay>
  books: Array<{ id: string; finishedAt: string }>
  lookedUp: number
  saved: number
  topMeeting: { headword: string; meetings: number } | null
  firstDay: string | null
}
```

`src/lib/recap/recap.ts`:

```ts
import { z } from "zod"
import { addDays } from "@/lib/dates"
import type { HabitDay } from "@/lib/habit/types"
import { habitSummary } from "@/lib/reading-habit"
import type { RecapData } from "./types"

export type { RecapData }

const RecapRow = z.object({
  days: z.array(
    z.object({
      day: z.string(),
      seconds: z.number(),
      goal_minutes: z.number().nullable(),
    })
  ),
  books: z.array(z.object({ id: z.string(), finished_at: z.string() })),
  looked_up: z.number(),
  saved: z.number(),
  top_meeting: z
    .object({ headword: z.string(), meetings: z.number() })
    .nullable(),
  first_day: z.string().nullable(),
})

export function parseRecap(raw: unknown): RecapData | null {
  const parsed = RecapRow.safeParse(raw)
  if (!parsed.success) return null
  const row = parsed.data
  return {
    days: row.days.map((d) => ({
      day: d.day,
      seconds: d.seconds,
      goalMinutes: d.goal_minutes,
    })),
    books: row.books.map((b) => ({ id: b.id, finishedAt: b.finished_at })),
    lookedUp: row.looked_up,
    saved: row.saved,
    topMeeting: row.top_meeting,
    firstDay: row.first_day,
  }
}

/**
 * The longest streak of reading days inside the period (spec 3E §5.2), by the
 * habit's rules (3B). Days outside the period do not count. A period that is
 * over is read as if "today" were the day after it, with nothing read.
 */
export function longestStreak(
  days: ReadonlyArray<HabitDay>,
  range: { from: string; to: string },
  today: string
): number {
  const inside = days.filter(
    (entry) => entry.day >= range.from && entry.day <= range.to
  )
  if (inside.length === 0) return 0
  const last = range.to < today ? addDays(range.to, 1) : today
  const goal = inside.find((entry) => entry.day === last)?.goalMinutes ?? null
  return habitSummary(inside, last, goal).record
}

export type RecapView = {
  seconds: number
  readingDays: number
  streak: number
  /** Newest finished first, as the server sends them. */
  finished: RecapData["books"]
  lookedUp: number
  saved: number
  topMeeting: RecapData["topMeeting"]
  /** No time, no finished book and no word: "Belum ada bacaan di …". */
  empty: boolean
}

export function recapView(
  recap: RecapData,
  range: { from: string; to: string },
  today: string
): RecapView {
  const seconds = recap.days.reduce((sum, entry) => sum + entry.seconds, 0)
  const empty =
    seconds === 0 &&
    recap.books.length === 0 &&
    recap.lookedUp === 0 &&
    recap.saved === 0
  return {
    seconds,
    readingDays: recap.days.filter((entry) => entry.seconds > 0).length,
    streak: longestStreak(recap.days, range, today),
    finished: recap.books,
    lookedUp: recap.lookedUp,
    saved: recap.saved,
    topMeeting: recap.topMeeting,
    empty,
  }
}
```

`src/lib/recap/bubble.ts`:

```ts
import type { HabitDay } from "@/lib/habit/types"
import { RECAP_BUBBLE_KEY } from "@/lib/local/keys"
import {
  MONTH_NAMES,
  type Period,
  periodKey,
  periodRange,
} from "./period"

export type RecapBubble = { key: string; label: string }

/**
 * "Kilas balik … sudah siap" on days 1-7 of a month (spec 3E §5.4): last
 * month's, or last year's in January. Not when it was shown before, when the
 * habit cache is missing, or when nothing was read in that period.
 */
export function recapBubbleFor(
  today: string,
  days: ReadonlyArray<HabitDay> | null,
  shown: ReadonlyArray<string>
): RecapBubble | null {
  if (!days || Number(today.slice(8, 10)) > 7) return null
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const yearly = month === 1
  const period: Period = yearly
    ? { kind: "year", year: year - 1 }
    : { kind: "month", year, month: month - 1 }
  const key = periodKey(period)
  if (shown.includes(key)) return null
  const { from, to } = periodRange(period)
  if (!days.some((d) => d.day >= from && d.day <= to && d.seconds > 0)) {
    return null
  }
  return {
    key,
    label: yearly
      ? `Kilas balik ${year - 1} sudah siap`
      : `Kilas balik ${MONTH_NAMES[month - 2]} sudah siap`,
  }
}

export function readShownBubbles(): Array<string> {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(RECAP_BUBBLE_KEY) ?? "[]"
    )
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

export function rememberBubble(key: string): void {
  try {
    const shown = readShownBubbles()
    if (shown.includes(key)) return
    localStorage.setItem(RECAP_BUBBLE_KEY, JSON.stringify([...shown, key]))
  } catch {
    // No storage: the bubble may show again on another visit.
  }
}
```

- [ ] **Step 4: Jalankan tes pure**

Run: `npx vitest run src/lib/recap`
Expected: PASS. (Bila `periodList` tes "2030-01-01" gagal, pastikan `Math.min` memotong awal ke periode berjalan.)

- [ ] **Step 5: Server function dan pesan**

`src/lib/book-messages.ts`: tambahkan (bila belum ada) ke tabel kode: `review_not_finished: "Tandai buku ini selesai dulu untuk menulis ulasan."`, `review_invalid: "Ulasan belum sesuai. Pilih bintang dan periksa catatannya."`, `recap_invalid: "Kilas balik belum bisa dimuat."`. (`not_found` sudah ada.)

`src/server/reviews.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { ActionResult } from "@/lib/action-result"
import {
  DIFFICULTIES,
  type FinishSummary,
  MAX_NOTE,
  parseFinishSummary,
} from "@/lib/review"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })

/** The database's answers (spec 3E §6.2), as codes bookMessage knows. */
const CODES: Record<string, string> = {
  not_found: "not_found",
  not_finished: "review_not_finished",
  invalid: "review_invalid",
}

async function memberClient() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? supabase : null
}

const SaveSchema = z.object({
  bookId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  difficulty: z.enum(DIFFICULTIES).nullable(),
  note: z.string().max(MAX_NOTE).nullable(),
})
const BookIdSchema = z.object({ bookId: z.uuid() })

function answerOf(
  answer: string | null,
  error: unknown,
  what: string
): ActionResult {
  if (error) {
    logServerError(`${what} failed`, error)
    return fail("unknown")
  }
  return answer === "ok" ? { ok: true } : fail(CODES[answer ?? ""] ?? "unknown")
}

export const saveReviewFn = createServerFn({ method: "POST" })
  .validator((data: z.input<typeof SaveSchema>) => SaveSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("save_review", {
      p_book_id: data.bookId,
      p_rating: data.rating,
      p_difficulty: data.difficulty as string,
      p_note: data.note as string,
    })
    return answerOf(answer, error, "saving a review")
  })

export const deleteReviewFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("delete_review", {
      p_book_id: data.bookId,
    })
    return answerOf(answer, error, "deleting a review")
  })

export const finishSummaryFn = createServerFn({ method: "GET" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; summary: FinishSummary } | { ok: false; code: string }
    > => {
      const supabase = await memberClient()
      if (!supabase) return fail("not_authenticated")
      const { data: answer, error } = await supabase.rpc(
        "book_finish_summary",
        { p_book_id: data.bookId }
      )
      if (error) {
        logServerError("book_finish_summary failed", error)
        return fail("unknown")
      }
      if (answer === null) return fail("not_found")
      const summary = parseFinishSummary(answer)
      return summary ? { ok: true, summary } : fail("unknown")
    }
  )
```

`src/server/recap.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { parseRecap } from "@/lib/recap/recap"
import type { RecapData } from "@/lib/recap/types"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })
const DAY = /^\d{4}-\d{2}-\d{2}$/
const RecapInput = z.object({
  from: z.string().regex(DAY),
  to: z.string().regex(DAY),
  timeZone: z.string().min(1).max(64),
})

/** The recap of local days from..to in the device's zone (spec 3E §5, §6.2). */
export const loadRecapFn = createServerFn({ method: "GET" })
  .validator((data: z.input<typeof RecapInput>) => RecapInput.parse(data))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; recap: RecapData } | { ok: false; code: string }
    > => {
      const supabase = getSupabaseServerClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return fail("not_authenticated")
      const { data: answer, error } = await supabase.rpc("reading_recap", {
        p_from: data.from,
        p_to: data.to,
        p_tz: data.timeZone,
      })
      if (error) {
        if (error.message === "invalid") return fail("recap_invalid")
        logServerError("reading_recap failed", error)
        return fail("unknown")
      }
      const recap = parseRecap(answer)
      return recap ? { ok: true, recap } : fail("unknown")
    }
  )
```

- [ ] **Step 6: Jalankan semua tes unit dan tipe**

Run: `npx vitest run src/lib && npx tsc --noEmit`
Expected: PASS, tanpa galat tipe.

- [ ] **Step 7: Format dan commit**

```bash
npx prettier --write "src/lib/recap/*.ts" src/server/reviews.ts src/server/recap.ts src/lib/local/keys.ts src/lib/book-messages.ts
git add src/lib/recap src/server/reviews.ts src/server/recap.ts src/lib/local/keys.ts src/lib/book-messages.ts
git commit -m "feat(3e): recap logic, bubble rule and review/recap server functions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Gambar bagikan — layout, gambar sampul, `ShareImage`

**Files:**
- Create: `src/lib/quote-card/cover-art.ts`, `wrap.ts`, `finish-layout.ts`, `recap-layout.ts` dan tes (`wrap.test.ts`, `finish-layout.test.ts`, `recap-layout.test.ts`)
- Create: `src/components/share/ShareImage.tsx`, `src/components/share/ShareImage.test.tsx`, `src/components/share/ShareDialog.tsx`
- Modify: `src/lib/quote-card/layout.ts`, `src/lib/quote-card/draw.ts` (+ `draw.test.ts`), `src/components/reader/QuoteCardDialog.tsx`

**Interfaces:**
- Consumes: `fakeContext`/`fakeMeasure`/`stubCanvas` (`@/test/canvas`), `CardLayout`, `CardItem`, `Measure`, `CARD_DIMENSIONS`, `font`, `SERIF`/`SANS`, `loadCardPrefs`/`saveCardPrefs`, `cardFontsReady`, `drawCard`, `canShareFiles`/`canCopyImage`/`shareCard`/`saveCard`/`copyCard`/`cardFileName`/`shareText`, `CARD_THEMES`/`THEMES`.
- Produces:
  - `layout.ts`: export `fitText`, `PAD`, `TOP`, `BOTTOM`, `footer`; `footer` menerima `Pick<CardInput, "layout" | "size" | "host">`; `CardItem` jenis `cover` mendapat `slot?: number`.
  - `draw.ts`: `CardArt` mendapat `covers?: ReadonlyArray<CanvasImageSource>`; item `cover` dengan `slot` memakai `art.covers[slot]`, tanpa `slot` memakai `art.cover`.
  - `cover-art.ts`: `decodeCover(blob: Blob): Promise<{ image: CanvasImageSource; palette: Array<string> | null } | null>`, `fetchCoverBlob(url: string | null): Promise<Blob | null>`.
  - `wrap.ts`: `wrapText(text: string, fontName: string, maxWidth: number, measure: Measure, maxLines: number): Array<string>`.
  - `finish-layout.ts`: `FinishCardInput = { size: CardSize; title: string; author: string; hasCover: boolean; readTime: string; rating: number | null; host: string }`, `layoutFinishCard(input, measure): CardLayout`.
  - `recap-layout.ts`: `RecapCardInput = { size: CardSize; title: string; ongoing: boolean; books: number; coverCount: number; readTime: string; days: number; streak: number; saved: number; topWord: { headword: string; meetings: number } | null; host: string }`, `layoutRecapCard(input, measure): CardLayout`. `coverCount` ≤ 6; sampul memakai `slot` 0…coverCount−1.
  - `ShareImage` props: `{ label: string; description: string; fileTitle: string; seed: string; covers: ReadonlyArray<() => Promise<Blob | null>>; build: (size: CardSize, measure: Measure, coverCount: number) => CardLayout }`. `coverCount` = jumlah sampul yang berhasil didekode (dipadatkan, urutan tetap).
  - `ShareDialog` props: `{ title: string; onClose: () => void; finalFocus?: () => HTMLElement | null; children: ReactNode }`.

- [ ] **Step 1: Tulis tes yang gagal**

`src/lib/quote-card/wrap.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { fakeMeasure } from "@/test/canvas"
import { wrapText } from "./wrap"

const FONT = "10px sans" // the fake measures 5 px a character

describe("wrapText", () => {
  it("breaks at spaces within the width", () => {
    expect(wrapText("aaa bbb ccc ddd", FONT, 40, fakeMeasure, 5)).toEqual(["aaa bbb", "ccc ddd"])
  })

  it("ends the last line with an ellipsis when there are too many lines", () => {
    const lines = wrapText("aaa bbb ccc ddd eee fff", FONT, 40, fakeMeasure, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith("…")).toBe(true)
    for (const line of lines) expect(fakeMeasure(line, FONT)).toBeLessThanOrEqual(40)
  })

  it("cuts a word longer than the line", () => {
    const [line] = wrapText("supercalifragilistic", FONT, 40, fakeMeasure, 2)
    expect(line.endsWith("…")).toBe(true)
    expect(fakeMeasure(line, FONT)).toBeLessThanOrEqual(40)
  })

  it("gives no lines for blank text", () => {
    expect(wrapText("   ", FONT, 40, fakeMeasure, 2)).toEqual([])
  })
})
```

`src/lib/quote-card/finish-layout.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { fakeMeasure } from "@/test/canvas"
import { CARD_DIMENSIONS } from "./layout"
import { type FinishCardInput, layoutFinishCard } from "./finish-layout"

const base: FinishCardInput = {
  size: "story",
  title: "A Scandal in Bohemia",
  author: "Arthur Conan Doyle",
  hasCover: true,
  readTime: "6 jam 20 menit",
  rating: 4,
  host: "glos-a.tech",
}
const textsOf = (layout: ReturnType<typeof layoutFinishCard>) =>
  layout.items.flatMap((item) => (item.kind === "text" ? [item] : []))

describe("layoutFinishCard", () => {
  it("is the size asked for, with the label, the time and the footer", () => {
    for (const size of ["story", "square"] as const) {
      const layout = layoutFinishCard({ ...base, size }, fakeMeasure)
      expect(layout).toMatchObject(CARD_DIMENSIONS[size])
      expect(layout.fits).toBe(true)
      const texts = textsOf(layout).map((item) => item.text)
      expect(texts).toContain("Selesai dibaca")
      expect(texts).toContain("6 jam 20 menit")
      expect(texts).toContain("Glosa")
      expect(texts).toContain("glos-a.tech")
    }
  })

  it("keeps every text inside the card, however long the title", () => {
    const long = "The Extraordinarily Long Title of a Book ".repeat(8)
    const layout = layoutFinishCard({ ...base, title: long, author: long }, fakeMeasure)
    for (const item of textsOf(layout)) {
      expect(item.x).toBeGreaterThanOrEqual(0)
      expect(item.x + fakeMeasure(item.text, item.font)).toBeLessThanOrEqual(layout.width)
    }
  })

  it("has no cover item without a cover, and no stars without a rating", () => {
    const bare = layoutFinishCard({ ...base, hasCover: false, rating: null }, fakeMeasure)
    expect(bare.items.some((item) => item.kind === "cover")).toBe(false)
    expect(textsOf(bare).some((item) => item.text.includes("★"))).toBe(false)
    const full = layoutFinishCard(base, fakeMeasure)
    expect(full.items.some((item) => item.kind === "cover")).toBe(true)
    expect(textsOf(full).filter((item) => item.text.includes("★")).map((item) => item.text)).toEqual(["★★★★", "★"])
  })

  it("never writes the comprehension, a note or a word", () => {
    const text = textsOf(layoutFinishCard(base, fakeMeasure)).map((item) => item.text).join(" ")
    expect(text).not.toMatch(/paham|catatan|kata/i)
  })
})
```

`src/lib/quote-card/recap-layout.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { fakeMeasure } from "@/test/canvas"
import { CARD_DIMENSIONS } from "./layout"
import { type RecapCardInput, layoutRecapCard } from "./recap-layout"

const base: RecapCardInput = {
  size: "story",
  title: "Oktober 2026 di Glosa",
  ongoing: false,
  books: 8,
  coverCount: 6,
  readTime: "12 jam 5 menit",
  days: 19,
  streak: 7,
  saved: 31,
  topWord: { headword: "ominous", meetings: 5 },
  host: "glos-a.tech",
}
const texts = (layout: ReturnType<typeof layoutRecapCard>) =>
  layout.items.flatMap((item) => (item.kind === "text" ? [item] : []))

describe("layoutRecapCard", () => {
  it("fits in both sizes with its numbers", () => {
    for (const size of ["story", "square"] as const) {
      const layout = layoutRecapCard({ ...base, size }, fakeMeasure)
      expect(layout).toMatchObject(CARD_DIMENSIONS[size])
      expect(layout.fits).toBe(true)
      const written = texts(layout).map((item) => item.text)
      expect(written).toContain("Oktober 2026 di Glosa")
      expect(written).toContain("8 buku selesai")
      expect(written).toContain("12 jam 5 menit")
      expect(written).toContain("19 hari")
      expect(written).toContain("7 hari")
      expect(written).toContain("31 kata")
      expect(written.some((text) => text.includes("ominous"))).toBe(true)
    }
  })

  it("puts one cover item per slot, at most six", () => {
    const covers = layoutRecapCard(base, fakeMeasure).items.filter((item) => item.kind === "cover")
    expect(covers.map((item) => (item.kind === "cover" ? item.slot : -1))).toEqual([0, 1, 2, 3, 4, 5])
    const three = layoutRecapCard({ ...base, coverCount: 3 }, fakeMeasure).items.filter((item) => item.kind === "cover")
    expect(three).toHaveLength(3)
    expect(layoutRecapCard({ ...base, coverCount: 9 }, fakeMeasure).items.filter((item) => item.kind === "cover")).toHaveLength(6)
  })

  it("says sejauh ini for a period that is not over, and skips the top word without one", () => {
    const written = texts(layoutRecapCard({ ...base, ongoing: true, topWord: null }, fakeMeasure)).map((item) => item.text)
    expect(written).toContain("sejauh ini")
    expect(written.some((text) => text.includes("Paling sering bertemu"))).toBe(false)
    expect(texts(layoutRecapCard(base, fakeMeasure)).map((item) => item.text)).not.toContain("sejauh ini")
  })

  it("does not carry the looked-up words", () => {
    const written = texts(layoutRecapCard(base, fakeMeasure)).map((item) => item.text).join(" ")
    expect(written).not.toMatch(/dicari/i)
  })

  it("keeps long text inside the card", () => {
    const layout = layoutRecapCard(
      { ...base, title: "Oktober 2026 di Glosa ".repeat(6), topWord: { headword: "x".repeat(60), meetings: 12 } },
      fakeMeasure
    )
    for (const item of texts(layout)) {
      expect(item.x + fakeMeasure(item.text, item.font)).toBeLessThanOrEqual(layout.width)
    }
  })
})
```

Tambahkan di `src/lib/quote-card/draw.test.ts` (memakai `fakeContext`, `drawCard`; buat layout tangan):

```ts
it("draws a cover with a slot from covers[slot] and ignores a missing one", () => {
  const picture = { tag: "second" } as unknown as CanvasImageSource
  const layout = {
    width: 1080, height: 1080, fontSize: 0, fits: true, hits: [],
    items: [
      { kind: "cover" as const, x: 0, y: 0, width: 10, height: 10, slot: 1 },
      { kind: "cover" as const, x: 20, y: 0, width: 10, height: 10, slot: 2 },
    ],
  }
  const fake = fakeContext()
  drawCard(fake.context, layout, "kertas", { cover: null, palette: null, seed: "a", covers: [{} as CanvasImageSource, picture] })
  const drawn = fake.calls.filter((call) => call.name === "drawImage")
  expect(drawn).toHaveLength(1)
  expect(drawn[0].args[0]).toBe(picture)
})
```

`src/components/share/ShareImage.test.tsx` — ikuti `QuoteCardDialog.test.tsx` (impor `stubCanvas`, stub font dengan `vi.mock("@/lib/quote-card/fonts", …)` seperti yang dilakukan tes itu). Kasus:

```tsx
// Setup: stubCanvas(); mock cardFontsReady -> resolved; vi.mock "@/lib/quote-card/cover-art" decodeCover -> resolved null (or an image).
it("draws the built layout on a canvas named by the description", async () => {
  const build = vi.fn((size, measure, count) => layoutFinishCard({ ...input, size, hasCover: count > 0 }, measure))
  render(<ShareImage label="Kartu" description="Kartu buku selesai: Judul" fileTitle="Judul" seed="b" covers={[]} build={build} />)
  expect(await screen.findByRole("img", { name: "Kartu buku selesai: Judul" })).toBeInTheDocument()
  await waitFor(() => expect(build).toHaveBeenCalledWith("story", expect.any(Function), 0))
})

it("remembers the theme and size with the quote card's choice, keeping its layout", async () => {
  localStorage.setItem(QUOTE_CARD_KEY, JSON.stringify({ layout: "kutipan", theme: "sampul", size: "story" }))
  // render, click group "Ukuran" -> "Persegi", click "Tema Malam"
  expect(JSON.parse(localStorage.getItem(QUOTE_CARD_KEY)!)).toEqual({ layout: "kutipan", theme: "malam", size: "square" })
})

it("enables Simpan gambar once the PNG is ready, and saves it", async () => {
  // spy on saveCard from "@/lib/quote-card/share" (vi.mock partial); click "Simpan gambar"; expect called with a Blob and a name starting "glosa-"
})

it("counts only the covers that decoded, in order", async () => {
  // covers=[() => blob, () => null, () => blob], decodeCover mocked to return image for blobs
  // expect build called with count 2
})
```

(Tulis kasus-kasus itu sebagai kode penuh mengikuti pola `QuoteCardDialog.test.tsx`; semua selector memakai nama accessible di atas.)

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/quote-card src/components/share`
Expected: FAIL (modul baru belum ada).

- [ ] **Step 3: Ubah `layout.ts` dan `draw.ts`**

`layout.ts` (mekanis): beri `export` pada `fitText`, `PAD`, `TOP`, `BOTTOM`, `footer`; ubah tipe parameter `footer` menjadi `input: Pick<CardInput, "layout" | "size" | "host">`; ubah anggota `cover` di `CardItem` menjadi `{ kind: "cover"; x: number; y: number; width: number; height: number; /** Which of the card's covers (kartu kilas balik); none: the book's own. */ slot?: number }`.

`draw.ts`: `CardArt` mendapat `covers?: ReadonlyArray<CanvasImageSource>`; pada `case "cover"`:

```ts
case "cover": {
  const image =
    item.slot === undefined ? art.cover : (art.covers?.[item.slot] ?? null)
  if (image) {
    rounded(context, item.x, item.y, item.width, item.height, COVER_RADIUS)
    context.clip()
    context.drawImage(image, item.x, item.y, item.width, item.height)
  }
  break
}
```

- [ ] **Step 4: `cover-art.ts` (pindahan + baru)**

Pindahkan `PALETTE_SIZE`, `COVER_WIDTH`, `shrunk`, `paletteOf` dari `QuoteCardDialog.tsx` ke `src/lib/quote-card/cover-art.ts` (ekspor tidak perlu kecuali `decodeCover`), dan tambahkan:

```ts
/** The cover as a small canvas plus its palette; null when it cannot be decoded. */
export async function decodeCover(
  blob: Blob
): Promise<{ image: CanvasImageSource; palette: Array<string> | null } | null> {
  if (!("createImageBitmap" in globalThis)) return null
  const bitmap = await createImageBitmap(blob)
  let small: HTMLCanvasElement | null = null
  try {
    small = shrunk(bitmap)
  } finally {
    bitmap.close()
  }
  return small ? { image: small, palette: paletteOf(small) } : null
}

/** A cover from its signed URL; null when the browser refuses it or there is none. */
export async function fetchCoverBlob(url: string | null): Promise<Blob | null> {
  if (!url) return null
  try {
    const response = await fetch(url)
    return response.ok ? await response.blob() : null
  } catch {
    return null
  }
}
```

Di `QuoteCardDialog.tsx`: hapus fungsi/konstanta yang dipindah, dan efek pemuat sampul menjadi

```ts
loadCover()
  .then(async (blob) => {
    const decoded = blob ? await decodeCover(blob) : null
    if (decoded && live) setArt({ cover: decoded.image, palette: decoded.palette })
  })
  .catch(() => undefined)
```

Ekspor juga `Segments` dari `QuoteCardDialog.tsx` (`export function Segments`) untuk dipakai `ShareImage`.

- [ ] **Step 5: `wrap.ts`**

```ts
import { type Measure, fitText } from "./layout"

/**
 * `text` broken at spaces into lines no wider than `maxWidth`; more than
 * `maxLines` lines end the last one with an ellipsis, and a word wider than a
 * line is cut with one.
 */
export function wrapText(
  text: string,
  fontName: string,
  maxWidth: number,
  measure: Measure,
  maxLines: number
): Array<string> {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: Array<string> = []
  let line = ""
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (!line || measure(next, fontName) <= maxWidth) {
      line = next
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`
    return kept.map((item) => fitText(item, fontName, maxWidth, measure))
  }
  return lines.map((item) => fitText(item, fontName, maxWidth, measure))
}
```

(Pada kasus "lebih dari maxLines", baris terakhir digabung dengan sisanya sehingga selalu melebihi lebar dan `fitText` memberi elipsis.)

- [ ] **Step 6: `finish-layout.ts`**

```ts
import { SANS, SERIF, font } from "./fonts"
import {
  BOTTOM,
  CARD_DIMENSIONS,
  type CardItem,
  type CardLayout,
  type CardSize,
  type Measure,
  PAD,
  TOP,
  fitText,
  footer,
} from "./layout"
import { wrapText } from "./wrap"

export type FinishCardInput = {
  size: CardSize
  title: string
  author: string
  hasCover: boolean
  /** e.g. "6 jam 20 menit". */
  readTime: string
  /** 1-5, or null while the book has no review. */
  rating: number | null
  host: string
}

const COVER: Record<CardSize, { width: number; height: number }> = {
  story: { width: 400, height: 600 },
  square: { width: 250, height: 375 },
}
const TITLE_SIZE: Record<CardSize, number> = { story: 66, square: 50 }
const TITLE_LINES: Record<CardSize, number> = { story: 3, square: 2 }
const GAP: Record<CardSize, number> = { story: 56, square: 32 }

/**
 * The card of a finished book (spec 3E §3.3): cover, "Selesai dibaca", title,
 * author, reading time and stars, centred, with Glosa's footer. Nothing about
 * the member's notes, difficulty, words or comprehension.
 */
export function layoutFinishCard(
  input: FinishCardInput,
  measure: Measure
): CardLayout {
  const { width, height } = CARD_DIMENSIONS[input.size]
  const gap = GAP[input.size]
  const middle = (text: string, fontName: string) =>
    (width - measure(text, fontName)) / 2
  const frame: Array<CardItem> = []
  const footerTop = footer(
    { layout: "glosa", size: input.size, host: input.host },
    width,
    height,
    measure,
    frame
  )
  const room = footerTop - gap - TOP

  const build = (y0: number) => {
    const items: Array<CardItem> = []
    let y = y0
    const text = (
      value: string,
      fontName: string,
      color: "text" | "soft" | "accent",
      baseline: number,
      x = middle(value, fontName)
    ) => items.push({ kind: "text", text: value, x, y: baseline, font: fontName, color })

    if (input.hasCover) {
      const cover = COVER[input.size]
      items.push({
        kind: "cover",
        x: (width - cover.width) / 2,
        y,
        width: cover.width,
        height: cover.height,
        slot: 0,
      })
      y += cover.height + gap
    }
    const label = font(36, SANS, { bold: true })
    y += 36
    text("Selesai dibaca", label, "accent", y)
    y += gap * 0.9

    const titleSize = TITLE_SIZE[input.size]
    const titleFont = font(titleSize, SERIF, { bold: true })
    const lines = wrapText(
      input.title,
      titleFont,
      width - 2 * PAD,
      measure,
      TITLE_LINES[input.size]
    )
    lines.forEach((line, i) => {
      y += titleSize * (i === 0 ? 0.9 : 1.2)
      text(line, titleFont, "text", y)
    })
    if (input.author) {
      const authorFont = font(34, SANS)
      y += 56
      text(fitText(input.author, authorFont, width - 2 * PAD, measure), authorFont, "soft", y)
    }
    y += gap
    const caption = font(30, SANS)
    y += 30
    text("Waktu baca", caption, "soft", y)
    const timeFont = font(58, SERIF, { bold: true })
    y += 74
    text(fitText(input.readTime, timeFont, width - 2 * PAD, measure), timeFont, "text", y)
    if (input.rating !== null) {
      const starFont = font(64, SANS)
      const all = "★★★★★"
      const start = middle(all, starFont)
      const filled = "★".repeat(input.rating)
      y += 96
      text(filled, starFont, "accent", y, start)
      if (input.rating < 5) {
        text("★".repeat(5 - input.rating), starFont, "soft", y, start + measure(filled, starFont))
      }
    }
    return { items, bottom: y }
  }

  const measured = build(0)
  const used = measured.bottom
  const top = TOP + Math.max(0, (room - used) / 2)
  const placed = build(top)
  return {
    width,
    height,
    fontSize: TITLE_SIZE[input.size],
    fits: used <= room && BOTTOM > 0,
    items: [...frame, ...placed.items],
    hits: [],
  }
}
```

(Bila `fits` untuk ukuran square tidak true dengan `fakeMeasure`, kecilkan `COVER.square`/`GAP.square` sampai tes lolos; angka di atas adalah titik awal. Hapus `&& BOTTOM > 0` dan impor `BOTTOM` bila lint mengeluh — kondisi itu tidak perlu.)

- [ ] **Step 7: `recap-layout.ts`**

```ts
import { SANS, SERIF, font } from "./fonts"
import {
  CARD_DIMENSIONS,
  type CardItem,
  type CardLayout,
  type CardSize,
  type Measure,
  PAD,
  TOP,
  fitText,
  footer,
} from "./layout"
import { wrapText } from "./wrap"

export type RecapCardInput = {
  size: CardSize
  /** "Oktober 2026 di Glosa". */
  title: string
  /** The period is not over: "sejauh ini". */
  ongoing: boolean
  books: number
  /** Covers to draw, slots 0..coverCount-1; at most 6. */
  coverCount: number
  readTime: string
  days: number
  streak: number
  saved: number
  topWord: { headword: string; meetings: number } | null
  host: string
}

export const MAX_RECAP_COVERS = 6
const TITLE_SIZE: Record<CardSize, number> = { story: 84, square: 64 }
const COVER: Record<CardSize, { width: number; height: number; perRow: number; gap: number }> = {
  story: { width: 260, height: 390, perRow: 3, gap: 54 },
  square: { width: 130, height: 195, perRow: 6, gap: 21.6 },
}
const ROW: Record<CardSize, number> = { story: 78, square: 60 }
const SECTION: Record<CardSize, number> = { story: 64, square: 36 }

/**
 * The recap card (spec 3E §5.3): the period, the finished books with up to six
 * covers, then reading time, reading days, longest streak, saved words and the
 * word met most. Looked-up words are not on it.
 */
export function layoutRecapCard(
  input: RecapCardInput,
  measure: Measure
): CardLayout {
  const { width, height } = CARD_DIMENSIONS[input.size]
  const inner = width - 2 * PAD
  const frame: Array<CardItem> = []
  const footerTop = footer(
    { layout: "glosa", size: input.size, host: input.host },
    width,
    height,
    measure,
    frame
  )
  const items: Array<CardItem> = []
  let y = TOP

  const titleSize = TITLE_SIZE[input.size]
  const titleFont = font(titleSize, SERIF, { bold: true })
  const lines = wrapText(input.title, titleFont, inner, measure, 2)
  lines.forEach((line, i) => {
    y += titleSize * (i === 0 ? 0.9 : 1.2)
    items.push({ kind: "text", text: line, x: PAD, y, font: titleFont, color: "text" })
  })
  if (input.ongoing) {
    const soft = font(36, SANS)
    y += 56
    items.push({ kind: "text", text: "sejauh ini", x: PAD, y, font: soft, color: "soft" })
  }
  y += SECTION[input.size]
  const booksFont = font(46, SANS, { bold: true })
  y += 46
  items.push({
    kind: "text",
    text: `${input.books} buku selesai`,
    x: PAD,
    y,
    font: booksFont,
    color: "accent",
  })

  const covers = Math.min(MAX_RECAP_COVERS, Math.max(0, input.coverCount))
  if (covers > 0) {
    const cover = COVER[input.size]
    y += 28
    for (let slot = 0; slot < covers; slot += 1) {
      const row = Math.floor(slot / cover.perRow)
      const column = slot % cover.perRow
      items.push({
        kind: "cover",
        x: PAD + column * (cover.width + cover.gap),
        y: y + row * (cover.height + 28),
        width: cover.width,
        height: cover.height,
        slot,
      })
    }
    y += Math.ceil(covers / cover.perRow) * (cover.height + 28) - 28
  }
  y += SECTION[input.size]

  const labelFont = font(34, SANS)
  const valueFont = font(40, SANS, { bold: true })
  const row = (label: string, value: string) => {
    y += ROW[input.size]
    items.push({ kind: "text", text: label, x: PAD, y, font: labelFont, color: "soft" })
    const room = inner - measure(label, labelFont) - 32
    const shown = fitText(value, valueFont, room, measure)
    items.push({
      kind: "text",
      text: shown,
      x: width - PAD - measure(shown, valueFont),
      y,
      font: valueFont,
      color: "text",
    })
  }
  row("Waktu baca", input.readTime)
  row("Hari membaca", `${input.days} hari`)
  row("Streak terpanjang", `${input.streak} hari`)
  row("Kata disimpan", `${input.saved} kata`)
  if (input.topWord) {
    row("Paling sering bertemu", `${input.topWord.headword} · ${input.topWord.meetings}×`)
  }

  return {
    width,
    height,
    fontSize: titleSize,
    fits: y <= footerTop - 24,
    items: [...frame, ...items],
    hits: [],
  }
}
```

(Tes meminta teks `"19 hari"` dan `"7 hari"` ada; `row` menulis nilai utuh, jadi cocok. Bila `fits` square tidak true pada input tes, kurangi `SECTION`/`ROW` square.)

- [ ] **Step 8: `ShareImage` dan `ShareDialog`**

`src/components/share/ShareImage.tsx` — pratinjau kanvas, pilihan ukuran dan tema, dan tombol; logikanya sama dengan `QuoteCardDialog` (font siap → gambar → PNG tertunda 250 ms) tanpa kata/kutipan:

```tsx
import { useEffect, useRef, useState } from "react"
import { Segments } from "@/components/reader/QuoteCardDialog"
import { Button } from "@/components/ui/button"
import { decodeCover } from "@/lib/quote-card/cover-art"
import { drawCard } from "@/lib/quote-card/draw"
import { cardFontsReady } from "@/lib/quote-card/fonts"
import {
  CARD_DIMENSIONS,
  type CardLayout,
  type CardSize,
  type Measure,
} from "@/lib/quote-card/layout"
import { loadCardPrefs, saveCardPrefs } from "@/lib/quote-card/prefs"
import {
  canCopyImage,
  canShareFiles,
  cardFileName,
  copyCard,
  saveCard,
  shareCard,
  shareText,
} from "@/lib/quote-card/share"
import { CARD_THEMES, THEMES } from "@/lib/quote-card/themes"

const PNG_DELAY_MS = 250
const IMAGE_UNAVAILABLE = "Gambar belum bisa dibuat. Coba lagi."
const LINK_COPIED = "Link Glosa sudah disalin, tempel di stiker Link Instagram."
const SIZE_OPTIONS: ReadonlyArray<[CardSize, string]> = [
  ["story", "Story"],
  ["square", "Persegi"],
]

type Decoded = { images: Array<CanvasImageSource>; palette: Array<string> | null }

/**
 * A share image of the finished-book card or the recap (spec 3E §3.3, §5.3):
 * the quote card's engine, themes, sizes and sharing, for a layout the caller
 * builds. Theme and size are the choices of the quote card (same storage).
 */
export function ShareImage({
  label,
  description,
  fileTitle,
  seed,
  covers,
  build,
}: {
  label: string
  description: string
  fileTitle: string
  seed: string
  covers: ReadonlyArray<() => Promise<Blob | null>>
  build: (size: CardSize, measure: Measure, coverCount: number) => CardLayout
}) {
  const [prefs, setPrefs] = useState(loadCardPrefs)
  const [fontsReady, setFontsReady] = useState(false)
  const [art, setArt] = useState<Decoded>({ images: [], palette: null })
  const [png, setPng] = useState<Blob | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [shareable] = useState(() => canShareFiles())
  const [copyable] = useState(() => canCopyImage())

  useEffect(() => {
    let live = true
    void cardFontsReady().then(() => live && setFontsReady(true))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    let live = true
    void Promise.all(
      covers.map((load) =>
        load()
          .then((blob) => (blob ? decodeCover(blob) : null))
          .catch(() => null)
      )
    ).then((decoded) => {
      if (!live) return
      const found = decoded.flatMap((item) => (item ? [item] : []))
      setArt({
        images: found.map((item) => item.image),
        palette: found[0]?.palette ?? null,
      })
    })
    return () => {
      live = false
    }
    // The loaders are made once per dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !fontsReady) return
    const context = canvas.getContext("2d")
    if (!context) return
    const { width, height } = CARD_DIMENSIONS[prefs.size]
    canvas.width = width
    canvas.height = height
    const measure: Measure = (text, name) => {
      context.font = name
      return context.measureText(text).width
    }
    drawCard(context, build(prefs.size, measure, art.images.length), prefs.theme, {
      cover: art.images[0] ?? null,
      covers: art.images,
      palette: art.palette,
      seed,
    })
    setPng(null)
    let live = true
    const timer = setTimeout(() => {
      canvas.toBlob((blob) => {
        if (!live) return
        setPng(blob)
        setNotice((current) =>
          blob ? (current === IMAGE_UNAVAILABLE ? null : current) : IMAGE_UNAVAILABLE
        )
      }, "image/png")
    }, PNG_DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [build, prefs.size, prefs.theme, art, fontsReady, seed])

  const change = (next: Partial<typeof prefs>) => {
    const merged = { ...prefs, ...next }
    saveCardPrefs(merged)
    setPrefs(merged)
  }
  const fileName = cardFileName(fileTitle)
  const share = () => {
    if (!png || pending) return
    setPending(true)
    void shareCard(
      new File([png], fileName, { type: "image/png" }),
      shareText(fileTitle, location.origin),
      location.origin,
      navigator,
      () => setNotice(LINK_COPIED)
    ).then((result) => {
      setPending(false)
      if (result === "failed") setNotice("Belum bisa dibagikan. Coba Simpan gambar.")
    })
  }

  return (
    <div className="quote-body" aria-label={label}>
      <div className="quote-preview">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={description}
          className={`quote-canvas quote-canvas-${prefs.size}`}
        />
      </div>
      <div className="quote-controls">
        <Segments
          label="Ukuran"
          options={SIZE_OPTIONS}
          value={prefs.size}
          onChange={(size) => change({ size })}
        />
        <div>
          <p className="quote-label">Tema</p>
          <div role="group" aria-label="Tema" className="quote-themes">
            {CARD_THEMES.map((id) => (
              <button
                key={id}
                type="button"
                aria-label={`Tema ${THEMES[id].label}`}
                aria-pressed={prefs.theme === id}
                className={`quote-swatch quote-swatch-${id}`}
                onClick={() => change({ theme: id })}
              />
            ))}
          </div>
        </div>
        <p role="status" className="quote-note">
          {notice}
        </p>
        <div className="quote-actions">
          {copyable && (
            <Button
              size="lg"
              variant="outline"
              disabled={!png}
              onClick={() =>
                png &&
                void copyCard(png).then((copied) =>
                  setNotice(
                    copied
                      ? "Gambar sudah disalin."
                      : "Gambar belum bisa disalin. Coba Simpan gambar."
                  )
                )
              }
            >
              Salin gambar
            </Button>
          )}
          <Button
            size="lg"
            variant="outline"
            disabled={!png}
            onClick={() => png && saveCard(png, fileName)}
          >
            Simpan gambar
          </Button>
          {shareable && (
            <Button size="lg" disabled={!png || pending} onClick={share}>
              Bagikan
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
```

Catatan: `build` harus stabil (di-`useCallback` oleh pemanggil) supaya gambar tidak digambar ulang tiap render. Pesan "Belum bisa …" menggantikan "Gagal …" (tanpa kata "gagal").

`src/components/share/ShareDialog.tsx`:

```tsx
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { useWideScreen } from "@/lib/use-wide-screen"

/** The popup that holds a share image, like the quote card's (spec 3E §5.3). */
export function ShareDialog({
  title,
  onClose,
  finalFocus,
  children,
}: {
  title: string
  onClose: () => void
  finalFocus?: () => HTMLElement | null
  children: ReactNode
}) {
  const wide = useWideScreen()
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="word-sheet-backdrop" />
        <DialogPrimitive.Popup
          aria-label={title}
          className={wide ? "quote-dialog" : "quote-sheet"}
          finalFocus={finalFocus}
        >
          <div className="quote-head">
            <DialogPrimitive.Title className="font-heading text-lg">
              {title}
            </DialogPrimitive.Title>
            <Button variant="ghost" size="icon-lg" aria-label="Tutup" onClick={onClose}>
              <XIcon aria-hidden="true" />
            </Button>
          </div>
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
```

- [ ] **Step 9: Jalankan tes**

Run: `npx vitest run src/lib/quote-card src/components/share src/components/reader/QuoteCardDialog.test.tsx && npx tsc --noEmit`
Expected: PASS (tes kartu kutipan lama tetap hijau setelah pemindahan `cover-art`).

- [ ] **Step 10: Format dan commit**

```bash
npx prettier --write "src/lib/quote-card/*.ts" "src/components/share/*.tsx" src/components/reader/QuoteCardDialog.tsx
git add src/lib/quote-card src/components/share src/components/reader/QuoteCardDialog.tsx
git commit -m "feat(3e): finished-book and recap share images on the quote card engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Kartu buku selesai dan formulir ulasan di reader

**Files:**
- Create: `src/components/review/ReviewForm.tsx`, `ReviewForm.test.tsx`, `FinishCardDialog.tsx`, `FinishCardDialog.test.tsx`
- Modify: `src/routes/_member/read.$bookId.tsx`

**Interfaces:**
- Consumes: `saveReviewFn`, `deleteReviewFn`, `finishSummaryFn` (Task 3); `BookReview`, `FinishSummary`, `DIFFICULTIES`, `DIFFICULTY_LABELS`, `MAX_NOTE`, `NOTE_COUNTER_FROM`, `RATINGS` (Task 2); `formatReadTime`; `layoutFinishCard`, `ShareImage`; `useOnline`; `bookMessage`.
- Produces:
  - `ReviewForm({ bookId: string; initial: BookReview | null; words: Array<string>; offline: boolean; onSaved: (review: BookReview | null) => void; onCancel: () => void }): JSX` — `onSaved(review)` setelah simpan, `onSaved(null)` setelah hapus.
  - `FinishCardDialog({ book: { id: string; title: string; author: string }; loadCover: () => Promise<Blob | null>; fallbackReview: BookReview | null; start?: "card" | "form"; offline?: boolean; onChanged: () => void; onClose: () => void; finalFocus?: () => HTMLElement | null }): JSX`.

- [ ] **Step 1: Tulis tes `ReviewForm` yang gagal**

`src/components/review/ReviewForm.test.tsx` (salin mock dari `src/components/shelf/FinishToggle.test.tsx`: `vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn) => fn }))` dan `vi.mock("@/server/reviews", () => mocks)`; mock `Link` seperti `BookVocabLine.test.tsx`):

```tsx
const BOOK = "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e"
const base = { bookId: BOOK, initial: null, words: [], offline: false, onSaved: vi.fn(), onCancel: vi.fn() }

it("needs a star before Simpan", async () => {
  render(<ReviewForm {...base} />)
  const save = screen.getByRole("button", { name: "Simpan" })
  expect(save).toBeDisabled()
  await userEvent.click(screen.getByRole("button", { name: "4 bintang" }))
  expect(save).toBeEnabled()
})

it("sends the stars, the difficulty and the trimmed note, then reports the review", async () => {
  mocks.saveReviewFn.mockResolvedValue({ ok: true })
  const onSaved = vi.fn()
  render(<ReviewForm {...base} onSaved={onSaved} />)
  await userEvent.click(screen.getByRole("button", { name: "5 bintang" }))
  await userEvent.click(screen.getByRole("button", { name: "Sulit" }))
  await userEvent.type(screen.getByLabelText("Catatan"), "  Seru.  ")
  await userEvent.click(screen.getByRole("button", { name: "Simpan" }))
  expect(mocks.saveReviewFn).toHaveBeenCalledWith({
    data: { bookId: BOOK, rating: 5, difficulty: "hard", note: "Seru." },
  })
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ rating: 5, difficulty: "hard", note: "Seru." })))
})

it("lets the difficulty be cleared again and sends a blank note as null", async () => {
  mocks.saveReviewFn.mockResolvedValue({ ok: true })
  render(<ReviewForm {...base} />)
  await userEvent.click(screen.getByRole("button", { name: "2 bintang" }))
  await userEvent.click(screen.getByRole("button", { name: "Mudah" }))
  await userEvent.click(screen.getByRole("button", { name: "Mudah" }))
  await userEvent.click(screen.getByRole("button", { name: "Simpan" }))
  expect(mocks.saveReviewFn).toHaveBeenCalledWith({ data: { bookId: BOOK, rating: 2, difficulty: null, note: null } })
})

it("starts from the review that exists and deletes it", async () => {
  mocks.deleteReviewFn.mockResolvedValue({ ok: true })
  const onSaved = vi.fn()
  const initial = { rating: 3, difficulty: "medium" as const, note: "Cukup", updatedAt: "2026-11-01T00:00:00Z" }
  render(<ReviewForm {...base} initial={initial} onSaved={onSaved} />)
  expect(screen.getByRole("button", { name: "3 bintang" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByLabelText("Catatan")).toHaveValue("Cukup")
  await userEvent.click(screen.getByRole("button", { name: "Hapus ulasan" }))
  expect(mocks.deleteReviewFn).toHaveBeenCalledWith({ data: { bookId: BOOK } })
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(null))
})

it("has no Hapus ulasan without a review", () => {
  render(<ReviewForm {...base} />)
  expect(screen.queryByRole("button", { name: "Hapus ulasan" })).toBeNull()
})

it("blocks saving and deleting offline, and says why", () => {
  render(<ReviewForm {...base} offline initial={{ rating: 3, difficulty: null, note: null, updatedAt: "x" }} />)
  expect(screen.getByRole("button", { name: "Simpan" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Hapus ulasan" })).toBeDisabled()
  expect(screen.getByText("Perlu koneksi internet")).toBeInTheDocument()
})

it("shows a counter near the limit and stops at 2,000 characters", async () => {
  render(<ReviewForm {...base} />)
  const note = screen.getByLabelText("Catatan")
  expect(screen.queryByText(/\/ 2\.000/)).toBeNull()
  fireEvent.change(note, { target: { value: "a".repeat(1850) } })
  expect(screen.getByText("1.850 / 2.000")).toBeInTheDocument()
  expect(note).toHaveAttribute("maxlength", "2000")
})

it("lists the words of the book with a link to all of them", () => {
  render(<ReviewForm {...base} words={["alpha", "beta"]} />)
  expect(screen.getByText("Kata dari buku ini")).toBeInTheDocument()
  expect(screen.getByText("alpha")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Lihat semua" })).toBeInTheDocument()
})

it("leaves the words out when there are none", () => {
  render(<ReviewForm {...base} />)
  expect(screen.queryByText("Kata dari buku ini")).toBeNull()
})

it("shows the server's refusal in words, without the word gagal", async () => {
  mocks.saveReviewFn.mockResolvedValue({ ok: false, code: "review_not_finished" })
  render(<ReviewForm {...base} />)
  await userEvent.click(screen.getByRole("button", { name: "1 bintang" }))
  await userEvent.click(screen.getByRole("button", { name: "Simpan" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Tandai buku ini selesai dulu")
})
```

`FinishCardDialog.test.tsx` (mock `@/server/reviews`, `useServerFn`, `@/lib/use-online` jika perlu, `@/components/share/ShareImage` menjadi stub `<div>ShareImage</div>`, dan Link):

```tsx
const summary = {
  seconds: 6 * 3600 + 20 * 60, days: 14, lookedUp: 30, saved: 9,
  words: ["alpha"], coins: 50, finishedAt: "2026-11-07T01:00:00Z", review: null,
}
const book = { id: BOOK, title: "Buku Pendek", author: "Penguji" }
const props = { book, loadCover: async () => null, fallbackReview: null, offline: false, onChanged: vi.fn(), onClose: vi.fn() }

it("shows a skeleton, then the numbers of the book", async () => {
  mocks.finishSummaryFn.mockResolvedValue({ ok: true, summary })
  render(<FinishCardDialog {...props} />)
  expect(screen.getByRole("dialog", { name: "Selesai: Buku Pendek" })).toBeInTheDocument()
  expect(await screen.findByText("6 jam 20 menit")).toBeInTheDocument()
  expect(screen.getByText("dalam 14 hari")).toBeInTheDocument()
  expect(screen.getByText("30")).toBeInTheDocument() // looked up
  expect(screen.getByText("9")).toBeInTheDocument() // saved
  expect(screen.getByText("+50 koin")).toBeInTheDocument()
  expect(screen.queryByText(/paham/i)).toBeNull()
})

it("keeps zeros but leaves the coin line out without coins", async () => {
  mocks.finishSummaryFn.mockResolvedValue({ ok: true, summary: { ...summary, coins: 0, lookedUp: 0, saved: 0 } })
  render(<FinishCardDialog {...props} />)
  await screen.findByText("6 jam 20 menit")
  expect(screen.queryByText(/koin/)).toBeNull()
  expect(screen.getAllByText("0")).toHaveLength(2)
})

it("says Ringkasan belum bisa dimuat with the title and still offers the review", async () => {
  mocks.finishSummaryFn.mockResolvedValue({ ok: false, code: "unknown" })
  render(<FinishCardDialog {...props} />)
  expect(await screen.findByText("Ringkasan belum bisa dimuat")).toBeInTheDocument()
  expect(screen.getByText("Buku Pendek")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Tulis ulasan" })).toBeInTheDocument()
})

it("offers Ubah ulasan when a review exists, from the summary or the fallback", async () => {
  mocks.finishSummaryFn.mockResolvedValue({ ok: true, summary: { ...summary, review: { rating: 4, difficulty: null, note: null, updatedAt: "x" } } })
  render(<FinishCardDialog {...props} />)
  expect(await screen.findByRole("button", { name: "Ubah ulasan" })).toBeInTheDocument()
})

it("opens the form from Tulis ulasan and goes back to the card after saving", async () => {
  mocks.finishSummaryFn.mockResolvedValue({ ok: true, summary })
  mocks.saveReviewFn.mockResolvedValue({ ok: true })
  const onChanged = vi.fn()
  render(<FinishCardDialog {...props} onChanged={onChanged} />)
  await userEvent.click(await screen.findByRole("button", { name: "Tulis ulasan" }))
  await userEvent.click(screen.getByRole("button", { name: "5 bintang" }))
  await userEvent.click(screen.getByRole("button", { name: "Simpan" }))
  expect(await screen.findByRole("button", { name: "Ubah ulasan" })).toBeInTheDocument()
  expect(onChanged).toHaveBeenCalled()
})

it("closes after saving when it started on the form", async () => {
  mocks.finishSummaryFn.mockResolvedValue({ ok: true, summary })
  mocks.saveReviewFn.mockResolvedValue({ ok: true })
  const onClose = vi.fn()
  render(<FinishCardDialog {...props} start="form" onClose={onClose} />)
  await userEvent.click(await screen.findByRole("button", { name: "3 bintang" }))
  await userEvent.click(screen.getByRole("button", { name: "Simpan" }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

it("closes with Nanti, and Bagikan shows the share image", async () => {
  mocks.finishSummaryFn.mockResolvedValue({ ok: true, summary })
  const onClose = vi.fn()
  render(<FinishCardDialog {...props} onClose={onClose} />)
  await userEvent.click(await screen.findByRole("button", { name: "Bagikan" }))
  expect(screen.getByText("ShareImage")).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Kembali" }))
  await userEvent.click(screen.getByRole("button", { name: "Nanti" }))
  expect(onClose).toHaveBeenCalled()
})

it("disables Bagikan until the summary is there", () => {
  mocks.finishSummaryFn.mockReturnValue(new Promise(() => undefined))
  render(<FinishCardDialog {...props} />)
  expect(screen.getByRole("button", { name: "Bagikan" })).toBeDisabled()
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/components/review`
Expected: FAIL (komponen belum ada).

- [ ] **Step 3: Tulis `ReviewForm.tsx`**

```tsx
import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { bookMessage } from "@/lib/book-messages"
import {
  type BookReview,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  type Difficulty,
  MAX_NOTE,
  NOTE_COUNTER_FROM,
  RATINGS,
} from "@/lib/review"
import { deleteReviewFn, saveReviewFn } from "@/server/reviews"

const count = new Intl.NumberFormat("id-ID")

/** Stars, difficulty and note of a finished book (spec 3E §4.1). Saving needs a connection. */
export function ReviewForm({
  bookId,
  initial,
  words,
  offline,
  onSaved,
  onCancel,
}: {
  bookId: string
  initial: BookReview | null
  /** The book's first saved words, at most 12; read only. */
  words: Array<string>
  offline: boolean
  /** The review as saved, or null after "Hapus ulasan". */
  onSaved: (review: BookReview | null) => void
  onCancel: () => void
}) {
  const save = useServerFn(saveReviewFn)
  const remove = useServerFn(deleteReviewFn)
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(
    initial?.difficulty ?? null
  )
  const [note, setNote] = useState(initial?.note ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<{ ok: boolean; code?: string }>, done: () => void) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      if (result.ok) done()
      else setError(result.code ?? "unknown")
    } catch {
      setError("unknown")
    }
    setBusy(false)
  }
  const onSave = () => {
    if (rating === null) return
    const trimmed = note.trim()
    void run(
      () =>
        save({
          data: {
            bookId,
            rating,
            difficulty,
            note: trimmed === "" ? null : trimmed,
          },
        }),
      () =>
        onSaved({
          rating,
          difficulty,
          note: trimmed === "" ? null : trimmed,
          updatedAt: new Date().toISOString(),
        })
    )
  }
  const onDelete = () =>
    void run(() => remove({ data: { bookId } }), () => onSaved(null))

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Bintang" className="flex gap-1">
        {RATINGS.map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} bintang`}
            aria-pressed={rating === value}
            className="text-3xl leading-none text-muted-foreground aria-pressed:text-primary"
            data-lit={rating !== null && value <= rating}
            onClick={() => setRating(value)}
          >
            <span aria-hidden="true">{rating !== null && value <= rating ? "★" : "☆"}</span>
          </button>
        ))}
      </div>
      <div role="group" aria-label="Kesulitan" className="flex gap-2">
        {DIFFICULTIES.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={difficulty === value}
            onClick={() => setDifficulty(difficulty === value ? null : value)}
          >
            {DIFFICULTY_LABELS[value]}
          </Button>
        ))}
      </div>
      <div className="space-y-1">
        <label htmlFor="review-note" className="text-sm font-medium">
          Catatan
        </label>
        <textarea
          id="review-note"
          value={note}
          maxLength={MAX_NOTE}
          rows={4}
          className="w-full rounded-md border bg-background p-2 text-sm"
          onChange={(event) => setNote(event.target.value)}
        />
        {note.length >= NOTE_COUNTER_FROM && (
          <p className="text-xs text-muted-foreground">
            {count.format(note.length)} / {count.format(MAX_NOTE)}
          </p>
        )}
      </div>
      {words.length > 0 && (
        <section aria-label="Kata dari buku ini" className="space-y-1">
          <h3 className="text-sm font-medium">Kata dari buku ini</h3>
          <ul className="flex flex-wrap gap-1 text-sm">
            {words.map((word) => (
              <li key={word} className="rounded bg-muted px-2 py-0.5">
                {word}
              </li>
            ))}
          </ul>
          <Link
            to="/vocabulary"
            search={{ buku: bookId }}
            className="text-sm underline underline-offset-2"
          >
            Lihat semua
          </Link>
        </section>
      )}
      {offline && <p className="text-xs text-muted-foreground">Perlu koneksi internet</p>}
      {error && (
        <p role="alert" className="text-xs text-stamp">
          {bookMessage(error)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="lg" disabled={offline || rating === null || busy} aria-busy={busy} onClick={onSave}>
          Simpan
        </Button>
        {initial && (
          <Button size="lg" variant="outline" disabled={offline || busy} onClick={onDelete}>
            Hapus ulasan
          </Button>
        )}
        <Button size="lg" variant="ghost" disabled={busy} onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  )
}
```

(`<section aria-label="Kata dari buku ini">` dan `<h3>` sama-sama memuat teks itu; tes memakai `getByText("Kata dari buku ini")` yang mengenai `h3` saja karena `aria-label` bukan teks.)

- [ ] **Step 4: Tulis `FinishCardDialog.tsx`**

Struktur (tulis lengkap):

```tsx
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useServerFn } from "@tanstack/react-start"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ReviewForm } from "@/components/review/ReviewForm"
import { ShareImage } from "@/components/share/ShareImage"
import { Button } from "@/components/ui/button"
import { useOnline } from "@/lib/use-online"
import { layoutFinishCard } from "@/lib/quote-card/finish-layout"
import { formatReadTime } from "@/lib/recap/format"
import {
  type BookReview,
  DIFFICULTY_LABELS,
  type FinishSummary,
} from "@/lib/review"
import { finishSummaryFn } from "@/server/reviews"

type View = "card" | "form" | "share"
type Loaded =
  | { status: "loading" }
  | { status: "ready"; summary: FinishSummary }
  | { status: "unavailable" }
```

Perilaku:
- State: `view` (awal `start ?? "card"`), `loaded` (`{status:"loading"}` → `finishSummaryFn({data:{bookId}})`; `ok` → ready, selainnya/throw → unavailable), `review` (awal `fallbackReview`; saat summary ready dan `summary.review` ada atau `status` ready, `review = summary.review` — ringkasan menang), `coverUrl` (object URL dari `loadCover()`, dicabut saat unmount).
- `online = useOnline()`; `blocked = offline || !online` diteruskan ke `ReviewForm.offline`.
- Judul `DialogPrimitive.Title`: `Selesai: ${book.title}`; `aria-label` popup sama. Kelas popup: `quote-dialog`/`quote-sheet` seperti `ShareDialog` (impor `useWideScreen`).
- **Tampilan `card`:**
  - sampul kecil `<img>` bila `coverUrl`, judul, pengarang;
  - `loading`: kerangka (`word-skeleton` seperti `QuoteCardDialog`) dengan `<p className="sr-only">Memuat ringkasan…</p>`;
  - `unavailable`: `<p>Ringkasan belum bisa dimuat</p>`;
  - `ready`: `<dl>` dengan "Waktu baca" → `formatReadTime(seconds)` + `<small>dalam {days} hari</small>`, "Kata dicari" → `lookedUp`, "Kata disimpan" → `saved`, dan `<p>+{coins} koin</p>` hanya bila `coins > 0` (teks tepat `+50 koin` untuk 50: tulis `` `+${coins} koin` `` dalam satu string, bukan potongan JSX);
  - bila `review`: satu baris ringkas `★★★★☆` + `DIFFICULTY_LABELS[difficulty]` (teks bintang `aria-hidden`, plus `<span className="sr-only">{n} dari 5 bintang</span>`);
  - tombol: **Tulis ulasan** / **Ubah ulasan** (→ `view = "form"`), **Bagikan** (→ `"share"`, `disabled` sampai `ready`), **Nanti** (→ `onClose`).
- **Tampilan `form`:** `<ReviewForm bookId initial={review} words={ready ? summary.words : []} offline={blocked} onCancel={back} onSaved={(next) => { setReview(next); onChanged(); if (start === "form") onClose(); else setView("card") }} />` dengan `back = start === "form" ? onClose : () => setView("card")`.
- **Tampilan `share`:** `<ShareImage label="Bagikan kartu" description={`Kartu buku selesai: ${book.title}`} fileTitle={book.title} seed={book.id} covers={covers} build={build} />` dan tombol **Kembali** (→ `"card"`). `covers = useMemo(() => [loadCover], [loadCover])`; `build = useCallback((size, measure, count) => layoutFinishCard({ size, title: book.title, author: book.author, hasCover: count > 0, readTime: formatReadTime(summary.seconds), rating: review?.rating ?? null, host: location.host }, measure), [...])`. Tampilan ini hanya bisa dicapai saat `ready`.
- `onOpenChange(false)` → `onClose` (Escape/klik latar = Nanti).

- [ ] **Step 5: Kabel reader**

`src/routes/_member/read.$bookId.tsx`:
- Hapus state `finishedNote`/`setFinishedNote`, efeknya (`useEffect` yang menghapus `finishedNote` setelah `NOTE_MS`), dan JSX `{finishedNote && (<output className="reader-note">Masuk ke koleksi Sudah dibaca</output>)}`.
- Tambah `const [finishCard, setFinishCard] = useState(false)`. Di `answerFinish`, pada cabang `finished`, ganti `setFinishedNote(true)` dengan `setFinishCard(true)`.
- Render, tepat setelah `QuoteCardDialog` (`sharing !== null`):

```tsx
{finishCard && (
  <FinishCardDialog
    book={data.book}
    loadCover={loadCover}
    fallbackReview={null}
    onChanged={() =>
      void router.invalidate({
        filter: (match) => match.routeId === "/_member/_lobi",
      })
    }
    onClose={() => setFinishCard(false)}
    finalFocus={bookFocus}
  />
)}
```

- `clockPaused` ditambah `|| finishCard`; kondisi `ChapterEdge` ditambah `&& !finishCard`.
- Impor `FinishCardDialog`.

- [ ] **Step 6: Jalankan tes**

Run: `npx vitest run src/components/review src/components/reader src/routes && npx tsc --noEmit`
Expected: PASS. Tes route reader yang bergantung pada `finishedNote` (cari `Masuk ke koleksi Sudah dibaca` di `src`) diperbarui ke dialog "Selesai: ‹judul›".

- [ ] **Step 7: Format dan commit**

```bash
npx prettier --write "src/components/review/*.tsx" "src/routes/_member/read.\$bookId.tsx"
git add src/components/review "src/routes/_member/read.\$bookId.tsx"
git commit -m "feat(3e): finished-book card and review form in the reader

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Detail buku — Ulasan saya dan Lihat kartu

**Files:**
- Create: `src/components/review/MyReview.tsx`, `MyReview.test.tsx`
- Modify: `src/components/shelf/BookActions.tsx` (+ tesnya)

**Interfaces:**
- Consumes: `FinishCardDialog` (Task 5), `fetchCoverBlob` (Task 4), `ShelfBook.review` (Task 2), `DIFFICULTY_LABELS`.
- Produces: `MyReview({ book: ShelfBook; offline?: boolean; onChanged: () => void }): JSX | null` — kosong untuk buku belum selesai. `BookActions` sudah dipakai di `BookDetailPanel`, `ContinueSheet`, dan dialog `BookDetail` rak, jadi satu penyisipan menjangkau ketiga tempat (spec §4.2).

- [ ] **Step 1: Tulis tes yang gagal**

`src/components/review/MyReview.test.tsx` (stub `FinishCardDialog` menjadi `<div role="dialog">{start}</div>` lewat `vi.mock("./FinishCardDialog")`; fixture buku dari helper tes rak yang ada, dengan `finishedAt` dan `review`):

```tsx
it("shows nothing for a book that is not finished", () => {
  const { container } = render(<MyReview book={book({ finishedAt: null })} onChanged={vi.fn()} />)
  expect(container).toBeEmptyDOMElement()
})

it("shows the review: stars, difficulty and the note, with Ubah", () => {
  render(<MyReview book={book({ finishedAt: DONE, review: { rating: 4, difficulty: "hard", note: "Seru sekali", updatedAt: DONE } })} onChanged={vi.fn()} />)
  const section = screen.getByRole("region", { name: "Ulasan saya" })
  expect(within(section).getByText("4 dari 5 bintang")).toBeInTheDocument()
  expect(within(section).getByText("Sulit")).toBeInTheDocument()
  expect(within(section).getByText("Seru sekali")).toBeInTheDocument()
  expect(within(section).getByRole("button", { name: "Ubah" })).toBeInTheDocument()
})

it("offers Tulis ulasan when there is none, and Lihat kartu always", () => {
  render(<MyReview book={book({ finishedAt: DONE, review: null })} onChanged={vi.fn()} />)
  expect(screen.getByRole("button", { name: "Tulis ulasan" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Lihat kartu" })).toBeInTheDocument()
})

it("opens the form from Ubah and the card from Lihat kartu", async () => {
  render(<MyReview book={book({ finishedAt: DONE, review: null })} onChanged={vi.fn()} />)
  await userEvent.click(screen.getByRole("button", { name: "Tulis ulasan" }))
  expect(screen.getByRole("dialog")).toHaveTextContent("form")
})

it("opens the card on Lihat kartu", async () => {
  render(<MyReview book={book({ finishedAt: DONE })} onChanged={vi.fn()} />)
  await userEvent.click(screen.getByRole("button", { name: "Lihat kartu" }))
  expect(screen.getByRole("dialog")).toHaveTextContent("card")
})

it("clamps a long note to three lines and opens it on request", async () => {
  render(<MyReview book={book({ finishedAt: DONE, review: { rating: 3, difficulty: null, note: "x ".repeat(300), updatedAt: DONE } })} onChanged={vi.fn()} />)
  const note = screen.getByTestId("review-note")
  expect(note).toHaveClass("line-clamp-3")
  await userEvent.click(screen.getByRole("button", { name: "Baca selengkapnya" }))
  expect(note).not.toHaveClass("line-clamp-3")
})
```

(`book({...})` adalah pembuat `ShelfBook` dari fixture tes terdekat; `DONE = "2026-11-01T00:00:00Z"`; stub dialog menampilkan prop `start ?? "card"`.)

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/components/review/MyReview.test.tsx`
Expected: FAIL (modul tidak ada).

- [ ] **Step 3: Tulis `MyReview.tsx`**

```tsx
import { useCallback, useState } from "react"
import { FinishCardDialog } from "@/components/review/FinishCardDialog"
import { Button } from "@/components/ui/button"
import type { ShelfBook } from "@/lib/book-types"
import { fetchCoverBlob } from "@/lib/quote-card/cover-art"
import { DIFFICULTY_LABELS } from "@/lib/review"

/**
 * "Ulasan saya" and "Lihat kartu" in a finished book's details (spec 3E §4.2).
 * The review comes with the shelf list, so it shows offline; changing it needs
 * a connection (the form says so).
 */
export function MyReview({
  book,
  offline = false,
  onChanged,
}: {
  book: ShelfBook
  offline?: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState<"card" | "form" | null>(null)
  const [expanded, setExpanded] = useState(false)
  const loadCover = useCallback(
    () => fetchCoverBlob(book.coverUrl),
    [book.coverUrl]
  )
  if (book.finishedAt === null) return null
  const { review } = book
  const longNote = (review?.note?.length ?? 0) > 140

  return (
    <section role="region" aria-label="Ulasan saya" className="space-y-2">
      <h3 className="text-sm font-medium">Ulasan saya</h3>
      {review ? (
        <div className="space-y-1 text-sm">
          <p>
            <span aria-hidden="true">
              {"★".repeat(review.rating)}
              {"☆".repeat(5 - review.rating)}
            </span>
            <span className="sr-only">{review.rating} dari 5 bintang</span>
            {review.difficulty && (
              <span className="ml-2 text-muted-foreground">
                {DIFFICULTY_LABELS[review.difficulty]}
              </span>
            )}
          </p>
          {review.note && (
            <p
              data-testid="review-note"
              className={expanded ? "whitespace-pre-line" : "line-clamp-3 whitespace-pre-line"}
            >
              {review.note}
            </p>
          )}
          {longNote && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Tutup" : "Baca selengkapnya"}
            </Button>
          )}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen("form")}>
          {review ? "Ubah" : "Tulis ulasan"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpen("card")}>
          Lihat kartu
        </Button>
      </div>
      {open && (
        <FinishCardDialog
          book={book}
          loadCover={loadCover}
          fallbackReview={review}
          start={open}
          offline={offline}
          onChanged={onChanged}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}
```

(`<section role="region">` berlebihan bila `aria-label` sudah memberi peran region; hapus `role` bila lint mengeluh. Panjang batas 140 karakter hanya untuk menampilkan tombol "Baca selengkapnya"; pemotongan 3 baris dilakukan CSS `line-clamp-3`.)

- [ ] **Step 4: Sisipkan di `BookActions`**

`src/components/shelf/BookActions.tsx`: tepat setelah `<FinishToggle book={book} offline={offline} onSaved={onShelved} />` (baris ~176) tambahkan `<MyReview book={book} offline={offline} onChanged={onShelved} />` dan impor dari `@/components/review/MyReview`. Perbarui tes `BookActions` bila ia mem-mock child (tambahkan stub), dan tambahkan satu tes: buku selesai menampilkan "Ulasan saya", buku belum selesai tidak.

- [ ] **Step 5: Jalankan tes**

Run: `npx vitest run src/components && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Format dan commit**

```bash
npx prettier --write "src/components/review/*.tsx" src/components/shelf/BookActions.tsx src/components/shelf/BookActions.test.tsx
git add src/components/review src/components/shelf/BookActions.tsx src/components/shelf/BookActions.test.tsx
git commit -m "feat(3e): Ulasan saya and Lihat kartu in the book details

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Halaman kilas balik, pintu masuk, gelembung, privasi

**Files:**
- Create: `src/lib/recap/recap-client.ts`, `src/components/lobby/RecapPanel.tsx`, `RecapPanel.test.tsx`, `src/routes/_member/_lobi/recap.tsx`
- Modify: `src/components/lobby/LobbyPopup.tsx`, `HabitPanel.tsx` (+ tes), `LibraryMap.tsx` (+ tes), `LobbyBubbles.tsx` (+ tes), `LobbyStage.tsx`, `src/routes/privacy.tsx`, `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: `loadRecapFn`, `RecapData`, `recapView`, `RecapView`, `Period` helpers, `formatReadTime`, `layoutRecapCard`, `MAX_RECAP_COVERS`, `ShareImage`, `ShareDialog`, `fetchCoverBlob`, `recapBubbleFor`/`readShownBubbles`/`rememberBubble`, `useReadingHabit` (`view.days`, `view.today`, `view.status`), `ShelfBook`.
- Produces:
  - `recap-client.ts`: `type RecapState = { status: "loading" } | { status: "ready"; recap: RecapData } | { status: "unavailable" }`; `useRecap(range: { from: string; to: string }, enabled: boolean): { state: RecapState; retry: () => void }`.
  - `RecapPanel({ period: Period; today: string; firstDay: string | null; state: RecapState; offline: boolean; books: ReadonlyArray<ShelfBook>; onPick: (key: string) => void; onRetry: () => void }): JSX`.
  - `RecapBubble` komponen di `LobbyBubbles.tsx`: `RecapBubbleNote({ bubble }: { bubble: RecapBubble })`.
  - `LibraryMap` prop opsional `onRecap?: () => void`.

- [ ] **Step 1: Tulis tes yang gagal**

`src/components/lobby/RecapPanel.test.tsx` (mock `@/components/share/ShareImage` jadi stub `<div>ShareImage</div>` dan `@/components/share/ShareDialog` dibiarkan nyata atau stub; mock `Link` bila dipakai):

```tsx
const TODAY = "2026-11-07"
const october = parsePeriod("2026-10", TODAY)
const recap = {
  days: [
    { day: "2026-10-05", seconds: 3600, goalMinutes: null },
    { day: "2026-10-06", seconds: 1800, goalMinutes: null },
  ],
  books: [{ id: "a", finishedAt: "2026-10-20T00:00:00Z" }, { id: "gone", finishedAt: "2026-10-10T00:00:00Z" }],
  lookedUp: 12, saved: 3, topMeeting: { headword: "ominous", meetings: 5 }, firstDay: "2026-09-02",
}
const shelf = [book({ id: "a", title: "Buku A", coverUrl: "https://x/a.jpg" })]
const base = { period: october, today: TODAY, firstDay: "2026-09-02", state: { status: "ready" as const, recap }, offline: false, books: shelf, onPick: vi.fn(), onRetry: vi.fn() }

it("shows the numbers of the period", () => {
  render(<RecapPanel {...base} />)
  expect(screen.getByRole("heading", { name: "Kilas balik" })).toBeInTheDocument()
  expect(screen.getByText("Oktober 2026")).toBeInTheDocument()
  expect(screen.getByText("1 jam 30 menit")).toBeInTheDocument()
  expect(screen.getByText("2 hari")).toBeInTheDocument() // reading days; streak is also 2 hari
  expect(screen.getByText("12")).toBeInTheDocument()
  expect(screen.getByText(/ominous/)).toHaveTextContent("5×")
  expect(screen.queryByText("sejauh ini")).toBeNull()
})

it("shows the covers of finished books that are on the shelf, each opening its details", () => {
  render(<RecapPanel {...base} />)
  expect(screen.getByRole("link", { name: "Buku A" })).toBeInTheDocument()
  expect(screen.getByText("2 buku selesai")).toBeInTheDocument()
})

it("says sejauh ini for a period that is not over", () => {
  render(<RecapPanel {...base} period={currentPeriod(TODAY)} />)
  expect(screen.getByText("sejauh ini")).toBeInTheDocument()
})

it("writes Belum ada bacaan and offers no Bagikan for an empty period", () => {
  const empty = { ...recap, days: [], books: [], lookedUp: 0, saved: 0, topMeeting: null, firstDay: null }
  render(<RecapPanel {...base} state={{ status: "ready", recap: empty }} />)
  expect(screen.getByText("Belum ada bacaan di Oktober 2026.")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Bagikan" })).toBeNull()
})

it("says Perlu koneksi internet offline, without asking the server", () => {
  render(<RecapPanel {...base} offline state={{ status: "loading" }} />)
  expect(screen.getByText("Perlu koneksi internet")).toBeInTheDocument()
})

it("shows a skeleton while loading and Coba lagi when it cannot load", async () => {
  const { rerender } = render(<RecapPanel {...base} state={{ status: "loading" }} />)
  expect(screen.getByText("Memuat kilas balik…")).toBeInTheDocument()
  const onRetry = vi.fn()
  rerender(<RecapPanel {...base} state={{ status: "unavailable" }} onRetry={onRetry} />)
  expect(screen.getByText("Kilas balik belum bisa dimuat.")).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Coba lagi" }))
  expect(onRetry).toHaveBeenCalled()
})

it("picks a period from the list and a kind from Bulan | Tahun", async () => {
  const onPick = vi.fn()
  render(<RecapPanel {...base} onPick={onPick} />)
  await userEvent.selectOptions(screen.getByLabelText("Periode"), "2026-09")
  expect(onPick).toHaveBeenCalledWith("2026-09")
  await userEvent.click(screen.getByRole("button", { name: "Tahun" }))
  expect(onPick).toHaveBeenCalledWith("2026")
})

it("opens the share image from Bagikan", async () => {
  render(<RecapPanel {...base} />)
  await userEvent.click(screen.getByRole("button", { name: "Bagikan" }))
  expect(screen.getByRole("dialog", { name: "Bagikan kilas balik" })).toBeInTheDocument()
})
```

Tambahkan di tes lain:
- `HabitPanel.test.tsx`: ada tautan "Kilas balik" ke `/recap`.
- `LibraryMap.test.tsx`: dengan `onRecap`, tombol "Kilas balik" ada dan memanggilnya; tanpa prop, tidak ada.
- `LobbyBubbles.test.tsx`: `RecapBubbleNote` menampilkan tautan dengan teks `label` yang menuju `/recap?periode=<key>`.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/components/lobby`
Expected: FAIL.

- [ ] **Step 3: `recap-client.ts`**

```ts
import { useServerFn } from "@tanstack/react-start"
import { useEffect, useState } from "react"
import { loadRecapFn } from "@/server/recap"
import type { RecapData } from "./types"

export type RecapState =
  | { status: "loading" }
  | { status: "ready"; recap: RecapData }
  | { status: "unavailable" }

/**
 * The recap of a period from the server (spec 3E §5), asked for again when the
 * period changes. Nothing is kept on the device. Not asked while `enabled` is false.
 */
export function useRecap(
  range: { from: string; to: string },
  enabled: boolean
): { state: RecapState; retry: () => void } {
  const load = useServerFn(loadRecapFn)
  const key = `${range.from} ${range.to}`
  const [attempt, setAttempt] = useState(0)
  const [answer, setAnswer] = useState<{ key: string; state: RecapState } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let live = true
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    load({ data: { from: range.from, to: range.to, timeZone } })
      .then((result) => {
        if (!live) return
        setAnswer({
          key,
          state: result.ok
            ? { status: "ready", recap: result.recap }
            : { status: "unavailable" },
        })
      })
      .catch(() => live && setAnswer({ key, state: { status: "unavailable" } }))
    return () => {
      live = false
    }
  }, [key, enabled, attempt, load, range.from, range.to])

  const state: RecapState =
    answer && answer.key === key ? answer.state : { status: "loading" }
  return {
    state,
    retry: () => {
      setAnswer(null)
      setAttempt((value) => value + 1)
    },
  }
}
```

- [ ] **Step 4: `RecapPanel.tsx`**

Tulis komponen dengan struktur:
- `<h1 className="font-heading text-2xl">Kilas balik</h1>`.
- Pemilih: dua `Button` `aria-pressed` "Bulan" / "Tahun" (klik → `onPick(periodKey(currentPeriod(today)))` / `onPick(String(Number(today.slice(0,4))))`) dan `<select aria-label="Periode" value={periodKey(period)}>` berisi `periodList(period.kind, firstDay, today)` (opsi `value=periodKey`, teks `periodLabel`); `onChange → onPick(value)`. Bila periode terpilih tidak ada dalam daftar (mis. dari URL sebelum `firstDay` dikenal), tambahkan sebagai opsi pertama.
- Label periode `<p>{periodLabel(period)}</p>` dan, bila `isOngoing(period, today)`, `<p>sejauh ini</p>`.
- `offline` → hanya `<p>Perlu koneksi internet</p>`.
- `state.status === "loading"` → kerangka dengan `<p className="sr-only">Memuat kilas balik…</p>` (`word-skeleton`); `unavailable` → `<p>Kilas balik belum bisa dimuat.</p>` + `Button` "Coba lagi".
- `ready`: `view = recapView(state.recap, periodRange(period), today)`; `view.empty` → `<p>Belum ada bacaan di {label}.</p>` (satu string template), tanpa Bagikan; selain itu:
  - `<section aria-label="Buku selesai">`: `<p>{n} buku selesai</p>` (template `${view.finished.length} buku selesai`), lalu sampul: dari `view.finished` ambil entri yang ada di `books` (rak) — paling banyak 12 — sebagai `<Link to="/shelf" search={{ koleksi: "selesai" }} aria-label={book.title}>` berisi `<BookCover book className="w-14" />`... **tautan membuka detail buku**: gunakan `Link to="/lobby"` bukan tepat; gunakan `Link to="/shelf" search={{ q: book.title }}` bila tidak ada rute detail langsung (periksa `BookDetail` di `shelf.tsx`: detail dibuka lewat state, bukan URL — maka tautkan ke `/shelf` dengan `search={{ koleksi: "selesai", q: book.title }}`); sisa di atas 12 → `<p>+{n}</p>` dengan `n = view.finished.length - 12`.
  - `<dl>`: "Waktu baca" → `formatReadTime(view.seconds)`; "Hari membaca" → `${view.readingDays} hari`; "Streak terpanjang" → `${view.streak} hari`; "Kata dicari" → `view.lookedUp`; "Kata disimpan" → `view.saved`; bila `topMeeting`: "Paling sering bertemu lagi" → `${headword} · ${meetings}×`.
  - `Button` "Bagikan" → `setSharing(true)`; `{sharing && <ShareDialog title="Bagikan kilas balik" onClose={() => setSharing(false)}><ShareImage label="Bagikan kilas balik" description={`Kartu kilas balik ${label}`} fileTitle={`${label} di Glosa`} seed={periodKey(period)} covers={coverLoaders} build={build} /></ShareDialog>}`.
  - `coverLoaders` = `useMemo` dari buku selesai di rak yang punya `coverUrl`, 6 pertama, `() => fetchCoverBlob(url)`.
  - `build` = `useCallback((size, measure, count) => layoutRecapCard({ size, title: `${label} di Glosa`, ongoing, books: view.finished.length, coverCount: count, readTime: formatReadTime(view.seconds), days: view.readingDays, streak: view.streak, saved: view.saved, topWord: view.topMeeting && { headword: view.topMeeting.headword, meetings: view.topMeeting.meetings }, host: location.host }, measure), [...])`.

(Tes memeriksa `getByRole("link", { name: "Buku A" })`; sesuaikan `aria-label`.)

- [ ] **Step 5: Route `/recap`**

`src/routes/_member/_lobi/recap.tsx`:

```tsx
import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
import { RecapPanel } from "@/components/lobby/RecapPanel"
import { useReadingHabit } from "@/lib/habit/habit-client"
import { parsePeriod, periodKey, periodRange } from "@/lib/recap/period"
import { useRecap } from "@/lib/recap/recap-client"
import { useOnline } from "@/lib/use-online"

const lobi = getRouteApi("/_member/_lobi")

export const Route = createFileRoute("/_member/_lobi/recap")({
  validateSearch: (search: Record<string, unknown>) => ({
    periode: typeof search.periode === "string" ? search.periode : undefined,
  }),
  head: () => ({ meta: [{ title: "Kilas balik — Glosa" }] }),
  component: RecapPage,
})

/** Kilas balik over the lobby: one month or year of reading (spec 3E §5). */
function RecapPage() {
  const { books, offline } = lobi.useLoaderData()
  const { periode } = Route.useSearch()
  const navigate = useNavigate()
  const online = useOnline()
  const { today } = useReadingHabit()
  const period = parsePeriod(periode, today)
  const { state, retry } = useRecap(periodRange(period), online && !offline)
  // The first reading day arrives with each answer; the list keeps the last one.
  const [firstDay, setFirstDay] = useState<string | null>(null)
  useEffect(() => {
    if (state.status === "ready" && state.recap.firstDay) {
      setFirstDay(state.recap.firstDay)
    }
  }, [state])
  return (
    <LobbyPopup label="Kilas balik" className="lg:max-w-2xl">
      <RecapPanel
        period={period}
        today={today}
        firstDay={firstDay}
        state={state}
        offline={offline || !online}
        books={books}
        onPick={(key) =>
          void navigate({ to: "/recap", search: { periode: key === periodKey(parsePeriod(undefined, today)) ? undefined : key } })
        }
        onRetry={retry}
      />
    </LobbyPopup>
  )
}
```

`LobbyPopup.tsx`: tambahkan `"/recap"` ke `POPUP_PATHS` (dan perbarui komentar JSDoc "spec 3E §5.1"); perbarui tes `LobbyPopup.test.tsx` bila ia memeriksa daftar jalur.

`src/routeTree.gen.ts`: tambahkan route `/recap` mengikuti aturan di Global Constraints (salin setiap kemunculan `shop`); jangan menjalankan `generate-routes`. Pastikan blok `interface Register` tetap ada.

- [ ] **Step 6: Pintu masuk**

- `HabitPanel.tsx`: di section "Tahun ini", setelah tautan "Lihat Sudah dibaca", tambahkan `<Link to="/recap" className="text-sm underline">Kilas balik</Link>`.
- `LibraryMap.tsx`: prop opsional `onRecap?: () => void`; setelah `<ul … lobby-legend>` render, bila `onRecap`: `<Button variant="outline" size="sm" className="mt-2" onClick={onRecap}>Kilas balik</Button>` (impor `Button`). `LobbyStage.tsx`: teruskan `onRecap={() => void navigate({ to: "/recap" })}` ke `LibraryMap`.
- `LobbyBubbles.tsx`: tambahkan

```tsx
/** "Kilas balik … sudah siap", once at the start of a month (spec 3E §5.4). */
export function RecapBubbleNote({ bubble }: { bubble: RecapBubble }) {
  return (
    <output className="lobby-bubble">
      <Link
        to="/recap"
        search={{ periode: bubble.key }}
        className="font-bold underline"
      >
        {bubble.label}
      </Link>
    </output>
  )
}
```

- `LobbyStage.tsx`: `const habit = useReadingHabit()`; state `recapBubble` (`RecapBubble | null`, awal null); efek:

```ts
useEffect(() => {
  if (recapBubble || habit.status === "loading" || habit.status === "failed") return
  const next = recapBubbleFor(habit.today, habit.days, readShownBubbles())
  if (next) {
    rememberBubble(next.key)
    setRecapBubble(next)
  }
}, [recapBubble, habit.status, habit.today, habit.days])
```

  dan di bagian `bubbles`: `if (!popup && recapBubble) bubbles.tanaman = <RecapBubbleNote bubble={recapBubble} />`. (`status "stale"` dan `"ready"` memakai cache.)
- `src/routes/privacy.tsx`: setelah butir "Kosakata dari bacaan", tambahkan butir: "Ulasan pribadi: bintang, tingkat kesulitan, dan catatan yang kamu tulis untuk buku yang sudah selesai. Ulasan ini hanya terlihat olehmu, tidak dibagikan, dan ikut terhapus bersama bukunya atau saat akunmu dihapus. Kilas balik dan kartu buku selesai dihitung dari data di atas dan tidak menyimpan data baru." Bila ada tes privasi, tambahkan satu pernyataan teksnya.

- [ ] **Step 7: Jalankan tes**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (seluruh suite unit).

- [ ] **Step 8: Format dan commit**

```bash
npx prettier --write src/lib/recap/recap-client.ts "src/components/lobby/*.tsx" "src/routes/_member/_lobi/recap.tsx" src/routes/privacy.tsx src/routeTree.gen.ts
git add src/lib/recap src/components/lobby src/routes src/routeTree.gen.ts
git commit -m "feat(3e): recap page, entry points, month-start bubble and privacy note

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: E2E, verifikasi akhir, daftar cek pemilik

**Files:**
- Create: `e2e/finish-review.spec.ts`, `e2e/recap.spec.ts`
- Modify: `e2e/collections.spec.ts` (tes "finishing a book puts it on Sudah dibaca", baris ~106)

**Interfaces:**
- Consumes: helper `seedBook`, `markFinished` (`e2e/helpers/books.ts`), `seedReadingTime`, `todayInZone`, `HABIT_ZONE` (`e2e/helpers/habit.ts`), `createConfirmedMember`, `signInAndOnboard`, `userIdOf`, `hydrated` (`e2e/helpers/members.ts`), `makeEpub`.

- [ ] **Step 1: Perbarui E2E yang ada**

`e2e/collections.spec.ts`: ganti `await expect(page.getByText("Masuk ke koleksi Sudah dibaca")).toBeVisible()` dengan

```ts
const card = page.getByRole("dialog", { name: `Selesai: ${SHORT.title}` })
await expect(card).toBeVisible()
await card.getByRole("button", { name: "Nanti" }).click()
await expect(card).toBeHidden()
```

(baris `await expect(prompt).toHaveCount(0)` tetap).

- [ ] **Step 2: Tulis `e2e/finish-review.spec.ts`**

Salin `SHORT`, `memberWithBooks`, `openShelf`, `toTheEnd` dari `e2e/collections.spec.ts` (atau ekstrak ke `e2e/helpers/` bila sudah ada pemakai kedua; menyalin cukup untuk dua berkas). Dua tes:

```ts
test("finishing a book shows the card, a review is written, and it shows in the details and the sort", async ({ page }) => {
  test.setTimeout(120_000)
  const { short, sherlock } = await memberWithBooks(page)
  // Another finished, 3-star book for the sort; the reader's book gets 5 stars below.
  await markFinished(sherlock)
  await openShelf(page)
  await page.getByRole("button", { name: new RegExp(SHORT.title) }).click()
  await page.getByRole("dialog", { name: SHORT.title }).getByRole("link", { name: "Mulai membaca" }).click()
  await toTheEnd(page)
  await page.getByRole("complementary", { name: "Buku selesai" }).getByRole("button", { name: "Ya, selesai" }).click()

  const card = page.getByRole("dialog", { name: `Selesai: ${SHORT.title}` })
  await expect(card.getByText("Waktu baca")).toBeVisible({ timeout: 30_000 })
  await card.getByRole("button", { name: "Tulis ulasan" }).click()
  await card.getByRole("button", { name: "5 bintang" }).click()
  await card.getByRole("button", { name: "Mudah" }).click()
  await card.getByLabel("Catatan").fill("Pendek tapi manis.")
  await card.getByRole("button", { name: "Simpan" }).click()
  await expect(card.getByRole("button", { name: "Ubah ulasan" })).toBeVisible()
  await card.getByRole("button", { name: "Nanti" }).click()

  await page.goBack()
  await hydrated(page)
  await openShelf(page)
  await page.getByRole("button", { name: new RegExp(SHORT.title) }).click()
  const detail = page.getByRole("dialog", { name: SHORT.title })
  const mine = detail.getByRole("region", { name: "Ulasan saya" })
  await expect(mine.getByText("5 dari 5 bintang")).toBeVisible()
  await expect(mine.getByText("Pendek tapi manis.")).toBeVisible()
  await mine.getByRole("button", { name: "Lihat kartu" }).click()
  await expect(page.getByRole("dialog", { name: `Selesai: ${SHORT.title}` })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")

  // Rating tertinggi: the 5-star book first, the unrated finished one after it.
  await openShelf(page, "?koleksi=selesai&sort=rating")
  const titles = await page.getByRole("button", { name: /Sherlock|Buku Pendek/ }).allTextContents()
  expect(titles[0]).toContain(SHORT.title)
})

test("a review can be changed and deleted from the book details", async ({ page }) => {
  test.setTimeout(90_000)
  const { sherlock } = await memberWithBooks(page)
  await markFinished(sherlock)
  await openShelf(page)
  await page.getByRole("button", { name: new RegExp(SHERLOCK.title) }).click()
  const detail = page.getByRole("dialog", { name: SHERLOCK.title })
  await detail.getByRole("button", { name: "Tulis ulasan" }).click()
  const form = page.getByRole("dialog", { name: `Selesai: ${SHERLOCK.title}` })
  await form.getByRole("button", { name: "3 bintang" }).click()
  await form.getByRole("button", { name: "Simpan" }).click()
  await expect(detail.getByText("3 dari 5 bintang")).toBeVisible()
  await detail.getByRole("button", { name: "Ubah" }).click()
  await form.getByRole("button", { name: "Hapus ulasan" }).click()
  await expect(detail.getByText("3 dari 5 bintang")).toHaveCount(0)
  await expect(detail.getByRole("button", { name: "Tulis ulasan" })).toBeVisible()
})
```

(Impor `SHERLOCK`, `markFinished`, `seedBook` dari `./helpers/books`. Bila daftar rak mengurutkan label tombol dengan teks tambahan, sesuaikan regex pengambil judul.)

- [ ] **Step 3: Tulis `e2e/recap.spec.ts`**

```ts
import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { markFinished, seedBook } from "./helpers/books"
import { HABIT_ZONE, seedReadingTime, todayInZone } from "./helpers/habit"
import { createConfirmedMember, hydrated, signInAndOnboard, userIdOf } from "./helpers/members"

test.use({ timezoneId: HABIT_ZONE })

test("the recap of this month shows the seeded numbers and shares a story image", async ({ page }) => {
  test.setTimeout(90_000)
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  await markFinished(bookId)
  await seedReadingTime(userId, bookId, todayInZone(), 5400)

  await page.goto("/recap")
  await hydrated(page)
  await expect(page.getByRole("heading", { name: "Kilas balik" })).toBeVisible()
  await expect(page.getByText("sejauh ini")).toBeVisible()
  await expect(page.getByText("1 buku selesai")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("1 jam 30 menit")).toBeVisible()
  await expect(page.getByRole("link", { name: /Sherlock/ })).toBeVisible()

  await page.getByRole("button", { name: "Bagikan" }).click()
  const dialog = page.getByRole("dialog", { name: "Bagikan kilas balik" })
  const save = dialog.getByRole("button", { name: "Simpan gambar" })
  await expect(save).toBeEnabled({ timeout: 30_000 })
  const [download] = await Promise.all([page.waitForEvent("download"), save.click()])
  const bytes = await readFile(await download.path())
  expect({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }).toEqual({ width: 1080, height: 1920 })
})

test("a month with no reading says so and has no Bagikan", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto("/recap")
  await hydrated(page)
  await expect(page.getByText(/^Belum ada bacaan di /)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole("button", { name: "Bagikan" })).toHaveCount(0)
})

test("the habit panel and the map open the recap", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto("/habits")
  await hydrated(page)
  await page.getByRole("link", { name: "Kilas balik" }).click()
  await expect(page).toHaveURL(/\/recap$/)
})
```

(Ukuran gambar bergantung pada ukuran tersimpan; anggota baru memakai bawaan `story`. Bila `Simpan gambar` tak aktif karena kanvas, tunggu fonts: batas 30 dtk sudah ada.)

- [ ] **Step 4: Jalankan E2E**

Cek port: `curl -sL localhost:3000/login | grep -o "<title>[^<]*"`. Jika bukan Glosa, buat config sementara di port 3100 (salin `playwright.config.ts` dengan `baseURL`/`webServer.port` 3100), jalankan, lalu hapus.
Run: `npx playwright test e2e/finish-review.spec.ts e2e/recap.spec.ts e2e/collections.spec.ts e2e/habit.spec.ts e2e/quote-card.spec.ts --workers=2`
Expected: PASS. Satu kegagalan dijalankan ulang sendirian dulu (`--workers=1 -g "<nama>"`).

- [ ] **Step 5: Verifikasi akhir**

Run, berurutan:
- `npm run check` — Expected: tanpa file yang perlu diformat.
- `npm run typecheck` — Expected: tanpa galat.
- `npm run lint` — Expected: tanpa galat baru.
- `npm test` — Expected: seluruh suite unit PASS.
- `npm run test:db` — Expected: PASS (termasuk `review-recap.test.ts`).
- `npm run build` — Expected: sukses.
- `npx playwright test --workers=2` (penuh) — Expected: PASS.
- `git status` — pastikan `inspiration.md` tidak ikut dan tidak ada config sementara tersisa.

- [ ] **Step 6: Commit E2E**

```bash
npx prettier --write e2e/finish-review.spec.ts e2e/recap.spec.ts e2e/collections.spec.ts
git add e2e/finish-review.spec.ts e2e/recap.spec.ts e2e/collections.spec.ts
git commit -m "test(e2e): finished-book card, review and recap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Daftar cek pemilik (sampaikan di laporan akhir, jangan commit)**

Setelah seluruh Tahap 3 dipush dan dideploy ke dev, cek di HP:
1. Selesaikan sebuah buku di reader: popup "Selesai: ‹judul›" muncul dengan angka yang masuk akal ("+50 koin" bila ≥ 1 jam dibaca); "Nanti" menutupnya.
2. Tulis ulasan (bintang, kesulitan, catatan), simpan; buka detail buku di rak, lobi (panel dan "Lanjutkan"): "Ulasan saya" tampil; matikan jaringan: ulasan tetap terlihat, Simpan/Hapus nonaktif dengan "Perlu koneksi internet".
3. "Bagikan" pada kartu buku selesai: gambar benar di tiga tema dan dua ukuran; sampul ikut (jika tidak, catat: fetch sampul ditolak CORS, lihat keputusan 5); tanpa % paham, catatan, kesulitan, kata.
4. "Tandai belum selesai" menyembunyikan ulasan; "Tandai selesai" memunculkannya lagi. Urutan rak "Rating tertinggi" benar.
5. Kilas balik (`/recap`) dari panel kebiasaan dan peta HP: bulan berjalan berlabel "sejauh ini", pindah ke bulan lain dan Tahun, angka sama di HP dan laptop; bulan kosong menulis "Belum ada bacaan di …".
6. Gambar kilas balik: Story, Persegi, tiga tema; enam sampul; kata paling sering bertemu muncul bila ada.
7. Gelembung "Kilas balik ‹Bulan› sudah siap" pada tanggal 1–7 (ubah tanggal perangkat untuk mencoba); muncul sekali; Januari menjadi tahunan.
8. Halaman Privasi memuat butir ulasan pribadi.

---

## Self-review

**Cakupan spec.**
- §3.1 kapan muncul: Task 5 (reader) dan Task 6 ("Lihat kartu", tanpa otomatis dari detail).
- §3.2 isi dan keadaan gagal-muat: Task 5 (`FinishCardDialog`), tes "Ringkasan belum bisa dimuat", nol tetap ditulis, koin hanya bila ada.
- §3.3 gambar: Task 4 (`finish-layout`, `ShareImage`, pilihan tema/ukuran bersama kartu kutipan).
- §4.1–4.3 formulir, detail buku, aturan: Task 5 (`ReviewForm`), Task 6 (`MyReview`), Task 1–2 (RLS, kaskade, disembunyikan saat belum selesai).
- §4.4 rak: Task 2.
- §5.1–5.3 halaman, isi, gambar: Task 3 (logika), Task 4 (`recap-layout`), Task 7 (`RecapPanel`, route).
- §5.4 pintu masuk: Task 7 (HabitPanel, peta, gelembung; penyimpangan 7 dan 8 dicatat).
- §5.5 zona waktu: Task 1 (`p_tz`), Task 7 (`Intl…timeZone` di `useRecap`).
- §6 data dan fungsi: Task 1; §6.3 di perangkat: Task 2.
- §7 kode dan privasi: Task 3–7. §8 pengujian: DB (Task 1), unit (Task 2–7), E2E (Task 8), manual (Task 8 Step 7).

**Pindai placeholder.** Tidak ada "TBD"/"TODO". Bagian UI yang dijelaskan sebagai struktur (isi `FinishCardDialog` dan `RecapPanel`) menyebut elemen, teks, dan perilaku persisnya; tes menjadi kontraknya.

**Konsistensi tipe.** `BookReview`/`FinishSummary`/`reviewOf`/`parseFinishSummary` (Task 2) dipakai Task 3, 5, 6. `RecapData`/`parseRecap`/`recapView`/`longestStreak`/`periodRange`/`periodKey` (Task 3) dipakai Task 7. `layoutFinishCard`/`layoutRecapCard`/`ShareImage` `build(size, measure, coverCount)` (Task 4) dipakai Task 5 dan 7. `FinishCardDialog` props (`book`, `loadCover`, `fallbackReview`, `start`, `offline`, `onChanged`, `onClose`, `finalFocus`) sama di Task 5 dan 6. Kunci `RECAP_BUBBLE_KEY` (Task 3) dipakai `bubble.ts`.
