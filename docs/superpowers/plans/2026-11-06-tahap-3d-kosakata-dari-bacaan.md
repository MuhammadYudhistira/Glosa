# Glosa Tahap 3D — Kosakata dari bacaan: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Untuk setiap buku Glosa menunjukkan % kata yang dipahami tanpa kamus dan kata yang dicari; untuk setiap kata di Kosakata, berapa kali kata itu bertemu lagi di bacaan.

**Architecture:**
- **Server.** Tiga tabel: `book_words_read` (himpunan kata unik yang sudah dibaca per buku, plus bab yang sudah tercatat), `word_lookups` (kata yang diketuk per buku), `word_meetings` (pertemuan kata tersimpan per bab). Fungsi antrean `record_words_read`, `record_lookups`, `record_meetings`; bacaan `book_vocab`, `book_vocab_summaries`, `word_meeting_counts`. Server function di `src/server/vocab.ts`.
- **Perangkat.** Logika murni di `src/lib/vocab/`. Waktu per bab dan antrean di Dexie (versi 5). `src/lib/vocab/vocab-client.ts` adalah store modul (pola `habit-client.ts`/`shop-client.ts`): tiga antrean `createQueueSync`, ringkasan per buku dan hitungan pertemuan dengan cache di `meta`.
- **Reader.** Potongan waktu dari jam baca 3B ditambahkan ke bab yang tampil; saat bab mencapai 60 detik, reader membaca teks bab itu (`ReaderControls.sectionText`) dan mengisi antrean kata dan pertemuan. Ketukan kata mengisi antrean ketukan.
- **UI.** `BookVocabLine` di tiga tempat detail buku; Kosakata mendapat `?buku=`, daftar "Dicari di buku ini", baris "Bertemu lagi", dan urutan "Paling sering bertemu".

**Tech Stack:** TanStack Start + Router, React 19, TypeScript, Tailwind CSS 4, Supabase (Postgres, RLS, PostgREST RPC), zod 4, Dexie, foliate-js, Vitest + Testing Library (jsdom), fake-indexeddb, Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-06-tahap-3d-kosakata-dari-bacaan-design.md`](../specs/2026-11-06-tahap-3d-kosakata-dari-bacaan-design.md)

## Global Constraints

- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris. Array ditulis `Array<T>`.
- **Dependensi:** tidak ada dependensi baru.
- **Angka (persis dari spec):**
  - bab sudah dibaca setelah **60 detik** waktu baca di bab itu (per perangkat, lintas kunjungan);
  - paling banyak **5.000 kata** per kiriman kata terbaca;
  - % pemahaman = 1 − dicari ÷ dibaca, **dibulatkan ke bawah** ke persen bulat; tidak ditampilkan bila dibaca < **200**;
  - kata: bentuk `normalizeWord`, lolos `isLookupWord`, panjang 1–64;
  - batch antrean ketukan dan pertemuan ≤ 50 entri.
- **Teks dari spec, persis:** "Paham N% kata tanpa kamus", "· N kata dicari", "Lihat kata", "Baca lebih banyak untuk melihat angkanya", "Kata di <judul buku>", "Dicari di buku ini", "diketuk N×", "Tersimpan", "Simpan", "Semua kata", "Bertemu lagi N× di M buku", "Paling sering bertemu". Tidak ada kata "gagal".
- **Aturan:** ketukan dicatat walaupun artinya tidak ditemukan; bab tempat sebuah kata disimpan tidak dihitung sebagai pertemuan; satu (kata, buku, bab) dihitung sekali (`greatest`); menghapus kata dari Kosakata menghapus pertemuannya; pertemuan tetap setelah buku dihapus, kata terbaca dan ketukan ikut terhapus bersama buku.
- **SQL:** RLS "baca milik sendiri"; penulisan lewat fungsi `security definer` dengan `set search_path = ''`; error otentikasi `raise exception 'not_authenticated' using errcode = 'P0001'`; `revoke execute … from public, anon` lalu `grant` ke `authenticated`.
- **Migrasi:** di-push ke Supabase dev (`npm run db:push`), tipe dibuat ulang (`npm run db:types` + `npx prettier --write src/server/database.types.ts`, tanpa baris CLI), hanya tambahan (docs/ops/deploy.md §7).
- **Proyek dev dipakai bersama**; test hanya menulis baris member test-nya sendiri.
- **Line ending dan encoding:** LF, UTF-8. Jangan menulis file lewat PowerShell `Set-Content` atau Python tanpa `encoding='utf-8', newline=''`.
- **Route tree:** jangan pakai `npm run generate-routes`; bila `routeTree.gen.ts` berubah, pastikan blok `Register` TanStack Start tetap ada.
- **E2E:** `--workers=2`; cek port 3000 dulu (`curl -sL localhost:3000/login | grep -o "<title>[^<]*"`), bila dipegang aplikasi lain pakai config sementara di port 3100 lalu hapus; satu kegagalan dijalankan ulang sendirian dulu.
- **Tidak ada push ke GitHub** sampai seluruh Tahap 3 selesai (keputusan pemilik). Commit lokal saja.

## Keputusan dan penyimpangan dari spec

1. **`add_words_read` menjadi antrean `record_words_read(p_entries jsonb) → text[]`** (pola 3B), dengan entri `{book_id, section, words, last}`; paling banyak 10 entri per batch dan 5.000 kata per entri. Perilakunya sama dengan spec §5.2: bab di `sections` diabaikan, bab masuk `sections` hanya pada kiriman `last`.
2. **Penghapusan pertemuan saat kata dihapus** lewat trigger `after delete on saved_words`, bukan mengubah `delete_word`. Hanya tambahan, dan juga berlaku untuk penghapusan lewat jalan lain.
3. **Hitungan pertemuan dibaca lewat `word_meeting_counts()` dan server function sendiri**, bukan ditambahkan ke `SavedWord`/`listSavedWordsFn`, supaya tipe kata tersimpan dan cache Kosakata di perangkat tidak berubah.
4. **Bab dari CFI:** `sectionOfCfi` membaca langkah spine `epubcfi(/6/N…)` → indeks `N / 2 − 1`, sama dengan indeks `section` foliate.
5. **Teks bab** dibaca lewat metode baru `ReaderControls.sectionText(index)` (memakai `createDocument` seperti `chaptersOf`); teks diambil dari node teks di luar `script`/`style`, digabung dengan spasi.
6. **Waktu per bab:** `useReadingClock` mendapat parameter ketiga `onCounted(ms)`, dipanggil dengan jumlah milidetik setiap kali potongan disimpan. Route menambahkannya ke `shownSection.current` saat itu: `show()` menyerahkan waktu halaman sebelumnya sebelum `shownSection` diganti, jadi bab yang benar menerima waktunya.
7. **Bila teks bab tidak bisa dibaca** (dokumen gagal dibuat), bab tetap ditandai selesai di perangkat ini dan tidak dikirim; perangkat lain atau kunjungan setelah data lokal dihapus bisa mengirimnya. Tidak ada percobaan ulang.
8. **Kosakata `?buku=<id>`** mengisi saringan buku yang sudah ada di `VocabularyList`; daftar "Dicari di buku ini" (`BookLookups`) tampil bila saringan adalah buku di rak. Data dimuat online lewat `loadBookVocabFn`; offline tampil "Perlu koneksi internet". Mengetuk baris membuka arti lewat `lookUp` (cache, lalu server) dan tombol **Simpan** menyimpan entri pertama dengan `sentence: ""` dan `cfi: null`.
9. **Detail buku** (`BookVocabLine`) membaca ringkasan dari cache store; tanpa data untuk buku itu (belum pernah dibaca atau diketuk) baris tidak tampil. Ringkasan dimuat ulang di layout `_lobi` lewat `useQueueFlush(user.id, refreshVocab)`, yang mengirim ketiga antrean dulu.

## Struktur file

| File | Tanggung jawab |
|---|---|
| `supabase/migrations/20261106000500_vocab_from_reading.sql` | Tabel, trigger, fungsi (Task 1) |
| `tests/db/vocab.test.ts` | Tes DB (Task 1) |
| `src/lib/vocab/words.ts` | Kata unik bab, potongan, teks dokumen (Task 2) |
| `src/lib/vocab/comprehension.ts` | % pemahaman dan ambangnya (Task 2) |
| `src/lib/vocab/meetings.ts` | Pertemuan per kata, bab dari CFI (Task 2) |
| `src/lib/vocab/types.ts`, `schemas.ts` | Tipe dan zod (Task 3) |
| `src/lib/local/db.ts` (versi 5), `src/lib/local/vocab-store.ts` | Waktu per bab, antrean (Task 3) |
| `src/server/vocab.ts` | Server function (Task 3) |
| `src/lib/vocab/vocab-client.ts` | Store modul (Task 3) |
| `src/components/reader/ReaderView.tsx`, `useReadingClock.ts`, `src/routes/_member/read.$bookId.tsx` | Kabel reader (Task 4) |
| `src/components/shelf/BookVocabLine.tsx`, `src/components/vocabulary/BookLookups.tsx`, `VocabularyList.tsx`, `src/lib/words/vocabulary.ts`, rute Kosakata, privasi | UI (Task 5) |
| `e2e/vocab.spec.ts`, `e2e/helpers/vocab.ts` | E2E (Task 6) |

---

### Task 1: Database — kata terbaca, ketukan, pertemuan

**Files:**
- Create: `supabase/migrations/20261106000500_vocab_from_reading.sql`
- Create: `tests/db/vocab.test.ts`
- Modify: `src/server/database.types.ts` (dibuat ulang)

**Interfaces:**
- Produces: RPC `record_words_read(p_entries jsonb) → text[]`, `record_lookups(p_entries jsonb) → text[]`, `record_meetings(p_entries jsonb) → text[]`, `book_vocab(p_book_id uuid) → jsonb | null` (`{read, looked_up, words: [{word, taps, last_at}]}`), `book_vocab_summaries() → table (book_id uuid, read integer, looked_up integer)`, `word_meeting_counts() → table (headword text, meetings integer, books integer)`.

- [ ] **Step 1: Tulis tes DB yang gagal**

`tests/db/vocab.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  adminClient,
  createTestMember,
  deleteTestMembers,
  newTestBook,
  signedInClient,
} from "./helpers"

const run = Date.now().toString(36)
const emails = {
  ani: `db-vocab-ani-${run}@glosa.test`,
  budi: `db-vocab-budi-${run}@glosa.test`,
}
type Client = Awaited<ReturnType<typeof signedInClient>>

async function rpc(client: Client, name: string, args: object) {
  const { data, error } = await client.rpc(name as never, args as never)
  if (error) throw error
  return data as unknown
}
const words = (n: number, prefix = "w") =>
  Array.from({ length: n }, (_, i) => `${prefix}${i.toString(36)}`)

describe("vocabulary from reading", () => {
  const ids = { ani: "", budi: "" }
  const books = { ani: "", ani2: "", budi: "" }
  let ani: Client
  let budi: Client

  beforeAll(async () => {
    ids.ani = (await createTestMember({ email: emails.ani })).id
    ids.budi = (await createTestMember({ email: emails.budi })).id
    books.ani = await newTestBook(ids.ani)
    books.ani2 = await newTestBook(ids.ani)
    books.budi = await newTestBook(ids.budi)
    ani = await signedInClient(emails.ani)
    budi = await signedInClient(emails.budi)
  })

  afterAll(async () => {
    await deleteTestMembers()
  })

  it("adds a section's words once, in parts, without duplicates", async () => {
    const entry = (section: number, list: Array<string>, last: boolean) => ({
      book_id: books.ani,
      section,
      words: list,
      last,
    })
    expect(
      await rpc(ani, "record_words_read", {
        p_entries: [entry(2, ["the", "cat", "sat"], false)],
      })
    ).toEqual(["ok"])
    // The part again (a retry) and the last part.
    expect(
      await rpc(ani, "record_words_read", {
        p_entries: [
          entry(2, ["the", "cat", "sat"], false),
          entry(2, ["on", "the", "mat"], true),
        ],
      })
    ).toEqual(["ok", "ok"])
    // The section is done: another device's copy is ignored.
    expect(
      await rpc(ani, "record_words_read", {
        p_entries: [entry(2, ["ignored"], true)],
      })
    ).toEqual(["ok"])
    const { data } = await adminClient()
      .from("book_words_read")
      .select("sections, words")
      .eq("user_id", ids.ani)
      .eq("book_id", books.ani)
      .single()
    expect(data?.sections).toEqual([2])
    expect([...(data?.words ?? [])].sort()).toEqual(
      ["cat", "mat", "on", "sat", "the"].sort()
    )
  })

  it("refuses broken entries one by one and skips other members' books", async () => {
    const answers = await rpc(ani, "record_words_read", {
      p_entries: [
        { book_id: books.ani, section: 3, words: words(5001), last: true },
        { book_id: books.ani, section: -1, words: ["a"], last: true },
        { book_id: books.ani, section: 4, words: [""], last: true },
        { book_id: books.ani, section: 5, words: ["x".repeat(65)], last: true },
        { book_id: books.budi, section: 1, words: ["stolen"], last: true },
        { book_id: books.ani, section: 6, words: words(5000), last: true },
      ],
    })
    expect(answers).toEqual(["invalid", "invalid", "invalid", "invalid", "ok", "ok"])
    const { data } = await adminClient()
      .from("book_words_read")
      .select("book_id")
      .eq("user_id", ids.ani)
      .eq("book_id", books.budi)
    expect(data).toEqual([])
  })

  it("adds taps to a word, per book", async () => {
    const tap = (word: string, taps: number, at: string) => ({
      book_id: books.ani,
      word,
      taps,
      at,
    })
    expect(
      await rpc(ani, "record_lookups", {
        p_entries: [
          tap("mat", 1, "2026-11-01T10:00:00Z"),
          tap("zebra", 2, "2026-11-01T11:00:00Z"),
        ],
      })
    ).toEqual(["ok", "ok"])
    expect(
      await rpc(ani, "record_lookups", {
        p_entries: [tap("mat", 2, "2026-11-02T09:00:00Z"), tap("", 1, "2026-11-02T09:00:00Z")],
      })
    ).toEqual(["ok", "invalid"])
    const { data } = await adminClient()
      .from("word_lookups")
      .select("word, taps, first_at, last_at")
      .eq("user_id", ids.ani)
      .order("word")
    expect(data?.map(({ word, taps }) => [word, taps])).toEqual([
      ["mat", 3],
      ["zebra", 2],
    ])
  })

  it("answers a book's numbers, counting only looked-up words it has read", async () => {
    const vocab = (await rpc(ani, "book_vocab", { p_book_id: books.ani })) as {
      read: number
      looked_up: number
      words: Array<{ word: string; taps: number }>
    }
    // 5 words of section 2 plus 5,000 of section 6; "zebra" was never read.
    expect(vocab.read).toBe(5005)
    expect(vocab.looked_up).toBe(1)
    expect(vocab.words.map(({ word, taps }) => [word, taps])).toEqual([
      ["mat", 3],
      ["zebra", 2],
    ])
    expect(await rpc(ani, "book_vocab", { p_book_id: books.budi })).toBeNull()
    const summaries = (await rpc(ani, "book_vocab_summaries", {})) as Array<{
      book_id: string
      read: number
      looked_up: number
    }>
    expect(summaries).toEqual([{ book_id: books.ani, read: 5005, looked_up: 1 }])
  })

  it("keeps the most meetings per word, book and section, for saved words only", async () => {
    const { error } = await adminClient().from("saved_words").insert({
      user_id: ids.ani,
      headword: "mat",
      meanings: ["tikar"],
      sentence: "",
    })
    if (error) throw error
    const meet = (headword: string, section: number, count: number) => ({
      headword,
      book_id: books.ani,
      section,
      count,
    })
    expect(
      await rpc(ani, "record_meetings", {
        p_entries: [meet("mat", 2, 3), meet("mat", 2, 1), meet("mat", 7, 2), meet("dog", 2, 5)],
      })
    ).toEqual(["ok", "ok", "ok", "ok"])
    await rpc(ani, "record_meetings", {
      p_entries: [{ headword: "mat", book_id: books.ani2, section: 1, count: 4 }],
    })
    expect(await rpc(ani, "word_meeting_counts", {})).toEqual([
      { headword: "mat", meetings: 3 + 2 + 4, books: 2 },
    ])
  })

  it("keeps meetings after the book is deleted, and drops them with the word", async () => {
    await adminClient().from("books").delete().eq("id", books.ani2)
    expect(await rpc(ani, "word_meeting_counts", {})).toEqual([
      { headword: "mat", meetings: 9, books: 2 },
    ])
    const { data: read } = await adminClient()
      .from("book_words_read")
      .select("book_id")
      .eq("book_id", books.ani2)
    expect(read).toEqual([])
    await adminClient()
      .from("saved_words")
      .delete()
      .eq("user_id", ids.ani)
      .eq("headword", "mat")
    expect(await rpc(ani, "word_meeting_counts", {})).toEqual([])
  })

  it("keeps every table private and read-only", async () => {
    for (const [table, row] of [
      ["book_words_read", { user_id: ids.ani, book_id: books.ani }],
      ["word_lookups", { user_id: ids.ani, book_id: books.ani, word: "x", taps: 1 }],
      ["word_meetings", { user_id: ids.ani, headword: "x", book_id: books.ani, section: 0, count: 1 }],
    ] as const) {
      const { error } = await ani.from(table).insert(row as never)
      expect(error, table).not.toBeNull()
    }
    const { data } = await budi.from("word_lookups").select("word")
    expect(data).toEqual([])
    expect(await rpc(budi, "book_vocab_summaries", {})).toEqual([])
  })

  it("drops a member's rows with the account", async () => {
    const dora = (
      await createTestMember({ email: `db-vocab-dora-${run}@glosa.test` })
    ).id
    const book = await newTestBook(dora)
    const admin = adminClient()
    await admin.from("book_words_read").insert({ user_id: dora, book_id: book, words: ["a"] })
    await admin.from("word_lookups").insert({ user_id: dora, book_id: book, word: "a", taps: 1 })
    await admin.from("word_meetings").insert({ user_id: dora, headword: "a", book_id: book, section: 0, count: 1 })
    const { error } = await admin.auth.admin.deleteUser(dora)
    if (error) throw error
    for (const table of ["book_words_read", "word_lookups", "word_meetings"] as const) {
      const { count } = await admin
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("user_id", dora)
      expect(count, table).toBe(0)
    }
  })
})
```

Catatan: ikuti cara `tests/db/shop.test.ts` menghapus member di tes terakhir (bila ada helper `forgetTestMember`, panggil setelah `deleteUser` supaya `afterAll` tidak menghapusnya lagi). Kolom wajib `saved_words` lain (mis. `pos`) ikuti migrasi `20261024000200_saved_words.sql`.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run --config vitest.db.config.ts tests/db/vocab.test.ts`
Expected: FAIL, fungsi `record_words_read` tidak ada.

- [ ] **Step 3: Tulis migrasi**

`supabase/migrations/20261106000500_vocab_from_reading.sql`:

```sql
-- Vocabulary from reading (spec 3D §5): the distinct words of the sections
-- a member read, the words they looked up, and how often saved words came
-- back. Written through functions only; each member reads their own rows.

create table public.book_words_read (
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  -- Sections whose last part arrived; a section here is never added again.
  sections integer[] not null default '{}',
  words text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table public.word_lookups (
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  word text not null check (char_length(word) between 1 and 64),
  taps integer not null check (taps > 0),
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, book_id, word)
);

-- book_id has no foreign key, like reading_time: "in N books" stays true
-- after a book is deleted (spec 3D §5.1).
create table public.word_meetings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  headword text not null,
  book_id uuid not null,
  section integer not null check (section >= 0),
  count integer not null check (count > 0),
  primary key (user_id, headword, book_id, section)
);

alter table public.book_words_read enable row level security;
alter table public.word_lookups enable row level security;
alter table public.word_meetings enable row level security;
create policy book_words_read_select_own on public.book_words_read
  for select to authenticated using (user_id = (select auth.uid()));
create policy word_lookups_select_own on public.word_lookups
  for select to authenticated using (user_id = (select auth.uid()));
create policy word_meetings_select_own on public.word_meetings
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on table public.book_words_read from anon, authenticated;
revoke all on table public.word_lookups from anon, authenticated;
revoke all on table public.word_meetings from anon, authenticated;
grant select on table public.book_words_read to authenticated;
grant select on table public.word_lookups to authenticated;
grant select on table public.word_meetings to authenticated;

-- A word leaving Kosakata takes its meetings along (spec 3D §3.4).
create function public.drop_word_meetings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.word_meetings m
  where m.user_id = old.user_id and m.headword = old.headword;
  return old;
end;
$$;
create trigger saved_words_drop_meetings
  after delete on public.saved_words
  for each row execute function public.drop_word_meetings();
revoke execute on function public.drop_word_meetings()
  from public, anon, authenticated;

-- One answer per entry, in order (the queue pattern of 3B). An entry for
-- another member's book has nothing to keep and is 'ok'. A section already
-- in `sections` is ignored; a section joins `sections` with its last part,
-- so parts sent again are harmless.
create function public.record_words_read(p_entries jsonb)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_results text[] := '{}';
  v_entry jsonb;
  v_book_id uuid;
  v_section integer;
  v_last boolean;
  v_words text[];
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array'
    or jsonb_array_length(p_entries) > 10 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;

  for v_entry in
    select e.value from jsonb_array_elements(p_entries) with ordinality as e (value, n)
    order by e.n
  loop
    begin
      v_book_id := (v_entry ->> 'book_id')::uuid;
      v_section := (v_entry ->> 'section')::integer;
      v_last := (v_entry ->> 'last')::boolean;
      if v_book_id is null or v_section is null or v_section < 0
        or v_last is null
        or jsonb_typeof(v_entry -> 'words') is distinct from 'array'
        or jsonb_array_length(v_entry -> 'words') > 5000 then
        raise exception 'invalid' using errcode = '22023';
      end if;
      select coalesce(array_agg(w.value), '{}') into v_words
      from jsonb_array_elements_text(v_entry -> 'words') as w (value);
      if exists (
        select 1 from unnest(v_words) as w (value)
        where w.value is null or char_length(w.value) not between 1 and 64
      ) then
        raise exception 'invalid' using errcode = '22023';
      end if;

      if exists (
        select 1 from public.books b
        where b.id = v_book_id and b.user_id = v_user_id
      ) then
        insert into public.book_words_read (user_id, book_id)
        values (v_user_id, v_book_id)
        on conflict (user_id, book_id) do nothing;
        update public.book_words_read r
        set
          words = (
            select coalesce(array_agg(distinct x.value), '{}')
            from unnest(r.words || v_words) as x (value)
          ),
          sections = case when v_last then r.sections || v_section else r.sections end,
          updated_at = now()
        where r.user_id = v_user_id
          and r.book_id = v_book_id
          and not (v_section = any (r.sections));
      end if;
      v_results := v_results || 'ok'::text;
    exception
      when invalid_text_representation
        or invalid_parameter_value
        or numeric_value_out_of_range then
        v_results := v_results || 'invalid'::text;
    end;
  end loop;
  return v_results;
end;
$$;

-- Taps add up; first_at and last_at widen (spec 3D §3.3).
create function public.record_lookups(p_entries jsonb)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_results text[] := '{}';
  v_entry jsonb;
  v_book_id uuid;
  v_word text;
  v_taps integer;
  v_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array'
    or jsonb_array_length(p_entries) > 50 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;

  for v_entry in
    select e.value from jsonb_array_elements(p_entries) with ordinality as e (value, n)
    order by e.n
  loop
    begin
      v_book_id := (v_entry ->> 'book_id')::uuid;
      v_word := v_entry ->> 'word';
      v_taps := (v_entry ->> 'taps')::integer;
      v_at := (v_entry ->> 'at')::timestamptz;
      if v_book_id is null or v_word is null
        or char_length(v_word) not between 1 and 64
        or v_taps is null or v_taps not between 1 and 1000
        or v_at is null then
        raise exception 'invalid' using errcode = '22023';
      end if;
      if exists (
        select 1 from public.books b
        where b.id = v_book_id and b.user_id = v_user_id
      ) then
        insert into public.word_lookups as l
          (user_id, book_id, word, taps, first_at, last_at)
        values (v_user_id, v_book_id, v_word, v_taps, v_at, v_at)
        on conflict (user_id, book_id, word) do update
          set taps = l.taps + excluded.taps,
              first_at = least(l.first_at, excluded.first_at),
              last_at = greatest(l.last_at, excluded.last_at);
      end if;
      v_results := v_results || 'ok'::text;
    exception
      when invalid_text_representation
        or invalid_datetime_format
        or datetime_field_overflow
        or invalid_parameter_value
        or numeric_value_out_of_range then
        v_results := v_results || 'invalid'::text;
    end;
  end loop;
  return v_results;
end;
$$;

-- The most meetings per (word, book, section); saved words of the member,
-- in their own books, only (spec 3D §3.4).
create function public.record_meetings(p_entries jsonb)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_results text[] := '{}';
  v_entry jsonb;
  v_headword text;
  v_book_id uuid;
  v_section integer;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array'
    or jsonb_array_length(p_entries) > 50 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;

  for v_entry in
    select e.value from jsonb_array_elements(p_entries) with ordinality as e (value, n)
    order by e.n
  loop
    begin
      v_headword := v_entry ->> 'headword';
      v_book_id := (v_entry ->> 'book_id')::uuid;
      v_section := (v_entry ->> 'section')::integer;
      v_count := (v_entry ->> 'count')::integer;
      if v_headword is null or v_book_id is null
        or v_section is null or v_section < 0
        or v_count is null or v_count not between 1 and 10000 then
        raise exception 'invalid' using errcode = '22023';
      end if;
      if exists (
          select 1 from public.saved_words s
          where s.user_id = v_user_id and s.headword = v_headword
        )
        and exists (
          select 1 from public.books b
          where b.id = v_book_id and b.user_id = v_user_id
        ) then
        insert into public.word_meetings as m
          (user_id, headword, book_id, section, count)
        values (v_user_id, v_headword, v_book_id, v_section, v_count)
        on conflict (user_id, headword, book_id, section) do update
          set count = greatest(m.count, excluded.count);
      end if;
      v_results := v_results || 'ok'::text;
    exception
      when invalid_text_representation
        or invalid_parameter_value
        or numeric_value_out_of_range then
        v_results := v_results || 'invalid'::text;
    end;
  end loop;
  return v_results;
end;
$$;

-- One book's numbers and its looked-up words, the last tapped first; null
-- for a book that is not the member's (spec 3D §5.2). looked_up counts only
-- words that are in the book's words read (spec 3D §3.5).
create function public.book_vocab(p_book_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_words text[];
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.books b where b.id = p_book_id and b.user_id = v_user_id
  ) then
    return null;
  end if;
  select r.words into v_words
  from public.book_words_read r
  where r.user_id = v_user_id and r.book_id = p_book_id;
  v_words := coalesce(v_words, '{}');
  return jsonb_build_object(
    'read', cardinality(v_words),
    'looked_up', (
      select count(*) from public.word_lookups l
      where l.user_id = v_user_id and l.book_id = p_book_id
        and l.word = any (v_words)
    ),
    'words', coalesce((
      select jsonb_agg(
        jsonb_build_object('word', l.word, 'taps', l.taps, 'last_at', l.last_at)
        order by l.last_at desc, l.word
      )
      from public.word_lookups l
      where l.user_id = v_user_id and l.book_id = p_book_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Every book of the member with words read or looked up.
create function public.book_vocab_summaries()
returns table (book_id uuid, read integer, looked_up integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  return query
  select
    b.id,
    coalesce(cardinality(r.words), 0)::integer,
    (
      select count(*)::integer from public.word_lookups l
      where l.user_id = v_user_id and l.book_id = b.id
        and r.words is not null and l.word = any (r.words)
    )
  from public.books b
  left join public.book_words_read r
    on r.user_id = v_user_id and r.book_id = b.id
  where b.user_id = v_user_id
    and (
      r.book_id is not null
      or exists (
        select 1 from public.word_lookups l
        where l.user_id = v_user_id and l.book_id = b.id
      )
    )
  order by b.id;
end;
$$;

-- Meetings per saved word: how many, in how many books (spec 3D §4.2).
create function public.word_meeting_counts()
returns table (headword text, meetings integer, books integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  return query
  select m.headword, sum(m.count)::integer, count(distinct m.book_id)::integer
  from public.word_meetings m
  where m.user_id = v_user_id
  group by m.headword
  order by m.headword;
end;
$$;

revoke execute on function public.record_words_read(jsonb) from public, anon;
grant execute on function public.record_words_read(jsonb) to authenticated;
revoke execute on function public.record_lookups(jsonb) from public, anon;
grant execute on function public.record_lookups(jsonb) to authenticated;
revoke execute on function public.record_meetings(jsonb) from public, anon;
grant execute on function public.record_meetings(jsonb) to authenticated;
revoke execute on function public.book_vocab(uuid) from public, anon;
grant execute on function public.book_vocab(uuid) to authenticated;
revoke execute on function public.book_vocab_summaries() from public, anon;
grant execute on function public.book_vocab_summaries() to authenticated;
revoke execute on function public.word_meeting_counts() from public, anon;
grant execute on function public.word_meeting_counts() to authenticated;
```

Bila sebuah exception di blok entri tidak tertangkap (mis. jenis error lain dari cast), tambahkan kelas error itu ke daftar `when`, dengan tes yang menunjukkannya; jangan menangkap `others`.

- [ ] **Step 4: Push migrasi dan buat ulang tipe**

Run: `npm run db:push && npm run db:types && npx prettier --write src/server/database.types.ts`
Expected: migrasi diterapkan; tipe memuat tiga tabel dan enam fungsi; tidak ada baris CLI di file.

- [ ] **Step 5: Jalankan tes DB**

Run: `npx vitest run --config vitest.db.config.ts tests/db/vocab.test.ts`
Expected: PASS, 8 tes. Lalu `npx vitest run --config vitest.db.config.ts tests/db/saved-words.test.ts tests/db/books.test.ts`: tetap PASS (trigger baru di `saved_words`, foreign key baru ke `books`).

- [ ] **Step 6: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint`

```bash
git add supabase/migrations/20261106000500_vocab_from_reading.sql tests/db/vocab.test.ts src/server/database.types.ts
git commit -m "feat(db): words read per book, words looked up, and saved words met again"
```

---

### Task 2: Logika murni — kata bab, % pemahaman, pertemuan

**Files:**
- Create: `src/lib/vocab/words.ts`, `src/lib/vocab/words.test.ts`
- Create: `src/lib/vocab/comprehension.ts`, `src/lib/vocab/comprehension.test.ts`
- Create: `src/lib/vocab/meetings.ts`, `src/lib/vocab/meetings.test.ts`

**Interfaces:**
- Consumes: `normalizeWord`, `isLookupWord` (`@/lib/words/normalize`); `savedFormsOf`, `findSavedSpans` (`@/lib/words/saved-marks`); `SavedWord` (`@/lib/words/types`).
- Produces:
  - `MAX_WORDS_PER_PART = 5000`, `sectionWords(text: string): Array<string>`, `wordParts(words: ReadonlyArray<string>, size?: number): Array<Array<string>>`, `textOfDocument(doc: Document): string`
  - `MIN_WORDS_READ = 200`, `type VocabSummary = { read: number; lookedUp: number }`, `comprehension(summary: VocabSummary): number | null`
  - `sectionOfCfi(cfi: string | null): number | null`, `countMeetings(text: string, forms: Record<string, Array<string>>): Record<string, number>`, `meetingCounts(counts: Record<string, number>, bookId: string, section: number, saved: ReadonlyArray<Pick<SavedWord, "headword" | "bookId" | "cfi">>): Array<{ headword: string; count: number }>`

- [ ] **Step 1: Tes yang gagal**

`src/lib/vocab/words.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { MAX_WORDS_PER_PART, sectionWords, textOfDocument, wordParts } from "./words"

describe("section words", () => {
  it("keeps each word once, as the reader looks it up", () => {
    expect(
      sectionWords("The cat's mat — the CAT sat. 42 well-known “words”!")
    ).toEqual(["cat's", "mat", "sat", "the", "well-known", "words"].sort())
  })

  it("splits a long list into parts of 5,000 and keeps one part for none", () => {
    const words = Array.from({ length: 12_001 }, (_, i) => `w${i}`)
    const parts = wordParts(words)
    expect(parts.map((part) => part.length)).toEqual([5000, 5000, 2001])
    expect(parts.flat()).toEqual(words)
    expect(wordParts([])).toEqual([[]])
    expect(MAX_WORDS_PER_PART).toBe(5000)
  })

  it("reads a document's text, without scripts and styles", () => {
    const doc = new DOMParser().parseFromString(
      "<html><head><style>p{}</style></head><body><p>One</p><script>var two</script><p>three</p></body></html>",
      "text/html"
    )
    expect(textOfDocument(doc).split(/\s+/).filter(Boolean)).toEqual(["One", "three"])
  })
})
```

Catatan: harapan `sectionWords` mengikuti `normalizeWord`/`isLookupWord` yang ada (huruf kecil, kutip lengkung diseragamkan, angka dibuang). Bila `normalizeWord` memperlakukan apostrof atau tanda hubung berbeda, sesuaikan daftar harapan dengan perilaku fungsi itu dan catat di laporan; jangan mengubah `normalizeWord`.

`src/lib/vocab/comprehension.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { MIN_WORDS_READ, comprehension } from "./comprehension"

describe("comprehension", () => {
  it("waits for 200 words read", () => {
    expect(MIN_WORDS_READ).toBe(200)
    expect(comprehension({ read: 199, lookedUp: 0 })).toBeNull()
    expect(comprehension({ read: 200, lookedUp: 0 })).toBe(100)
  })

  it("rounds down, so a word looked up never shows 100%", () => {
    expect(comprehension({ read: 1000, lookedUp: 1 })).toBe(99)
    expect(comprehension({ read: 850, lookedUp: 34 })).toBe(96)
    expect(comprehension({ read: 300, lookedUp: 300 })).toBe(0)
  })
})
```

`src/lib/vocab/meetings.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { countMeetings, meetingCounts, sectionOfCfi } from "./meetings"

describe("meetings", () => {
  it("finds the section of a CFI from its spine step", () => {
    expect(sectionOfCfi("epubcfi(/6/2!/4/2/1:0)")).toBe(0)
    expect(sectionOfCfi("epubcfi(/6/14!/4/10,/1:5,/1:9)")).toBe(6)
    expect(sectionOfCfi(null)).toBeNull()
    expect(sectionOfCfi("nonsense")).toBeNull()
  })

  it("counts every form of a saved word, phrases too", () => {
    const counts = countMeetings(
      "She ran. He runs and runs; they give up, then gave up again.",
      { run: ["run", "ran", "runs"], "give up": ["give up", "gave up"] }
    )
    expect(counts).toEqual({ run: 3, "give up": 2 })
  })

  it("leaves out the section where a word was saved, and words not met", () => {
    const saved = [
      { headword: "run", bookId: "b1", cfi: "epubcfi(/6/8!/4/2/1:0)" },
      { headword: "give up", bookId: "b2", cfi: "epubcfi(/6/8!/4/2/1:0)" },
      { headword: "mat", bookId: null, cfi: null },
    ]
    const counts = { run: 3, "give up": 2, mat: 0 }
    expect(meetingCounts(counts, "b1", 3, saved)).toEqual([
      { headword: "give up", count: 2 },
    ])
    expect(meetingCounts(counts, "b1", 4, saved)).toEqual([
      { headword: "run", count: 3 },
      { headword: "give up", count: 2 },
    ])
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/vocab`
Expected: FAIL, modul tidak ada.

- [ ] **Step 3: Tulis modul**

`src/lib/vocab/words.ts`:

```ts
import { isLookupWord, normalizeWord } from "@/lib/words/normalize"

/** The most words sent for one section at once (spec 3D §3.2). */
export const MAX_WORDS_PER_PART = 5000

/**
 * A section's distinct words, each spelled the way the reader looks it up
 * (spec 3D §3.2), sorted. Splits like measureCoverage does.
 */
export function sectionWords(text: string): Array<string> {
  const words = new Set<string>()
  for (const raw of text.split(/[^\p{L}\p{M}'’-]+/u)) {
    const word = normalizeWord(raw)
    if (isLookupWord(word)) words.add(word)
  }
  return [...words].sort()
}

/** The words in parts of at most `size`; a section without words is one empty part. */
export function wordParts(
  words: ReadonlyArray<string>,
  size: number = MAX_WORDS_PER_PART
): Array<Array<string>> {
  if (words.length === 0) return [[]]
  const parts: Array<Array<string>> = []
  for (let i = 0; i < words.length; i += size) parts.push(words.slice(i, i + size))
  return parts
}

/** A section document's text, outside scripts and styles, joined by spaces. */
export function textOfDocument(doc: Document): string {
  // An SVG page has no body.
  const root = (doc.body as HTMLElement | null) ?? doc.documentElement
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const pieces: Array<string> = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest("script, style")) continue
    pieces.push((node as Text).data)
  }
  return pieces.join(" ")
}
```

`src/lib/vocab/comprehension.ts`:

```ts
/** No figure before this many distinct words read (spec 3D §3.5). */
export const MIN_WORDS_READ = 200

export type VocabSummary = { read: number; lookedUp: number }

/**
 * The share of the words read that needed no dictionary, rounded down so a
 * looked-up word never shows 100% (spec 3D §3.5); null below 200 words.
 */
export function comprehension({ read, lookedUp }: VocabSummary): number | null {
  if (read < MIN_WORDS_READ) return null
  return Math.floor((1 - lookedUp / read) * 100)
}
```

`src/lib/vocab/meetings.ts`:

```ts
import { normalizeWord } from "@/lib/words/normalize"
import { findSavedSpans, savedFormsOf } from "@/lib/words/saved-marks"
import type { SavedWord } from "@/lib/words/types"

/** The spine index of a CFI, as foliate numbers sections (plan 3D, decision 4). */
export function sectionOfCfi(cfi: string | null): number | null {
  const step = cfi ? /^epubcfi\(\/6\/(\d+)/.exec(cfi) : null
  if (!step) return null
  const n = Number(step[1])
  return n >= 2 && n % 2 === 0 ? n / 2 - 1 : null
}

/** How often each saved word occurs in a text, by headword, through all its forms. */
export function countMeetings(
  text: string,
  forms: Record<string, Array<string>>
): Record<string, number> {
  const headwordsOf = new Map<string, Array<string>>()
  for (const [headword, list] of Object.entries(forms)) {
    for (const form of list) {
      const key = normalizeWord(form)
      headwordsOf.set(key, [...(headwordsOf.get(key) ?? []), headword])
    }
  }
  const counts: Record<string, number> = {}
  for (const { start, end } of findSavedSpans(text, savedFormsOf(forms))) {
    for (const headword of headwordsOf.get(normalizeWord(text.slice(start, end))) ?? []) {
      counts[headword] = (counts[headword] ?? 0) + 1
    }
  }
  return counts
}

/**
 * The meetings to send for one section: words met at least once, without
 * the section where a word was saved (spec 3D §3.4).
 */
export function meetingCounts(
  counts: Record<string, number>,
  bookId: string,
  section: number,
  saved: ReadonlyArray<Pick<SavedWord, "headword" | "bookId" | "cfi">>
): Array<{ headword: string; count: number }> {
  const savedHere = new Set(
    saved
      .filter((word) => word.bookId === bookId && sectionOfCfi(word.cfi) === section)
      .map((word) => word.headword)
  )
  return saved
    .filter((word) => (counts[word.headword] ?? 0) > 0 && !savedHere.has(word.headword))
    .map((word) => ({ headword: word.headword, count: counts[word.headword] }))
}
```

Bila `findSavedSpans` di atas teks satu baris tidak menemukan frasa karena tanda baca di antaranya, itu memang perilaku sorotan yang ada (frasa tidak melewati tanda baca) dan tes di atas sudah memperhitungkannya.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run src/lib/vocab`
Expected: PASS, 8 tes.

- [ ] **Step 5: Commit**

Run: `npm run typecheck && npm run lint`

```bash
git add src/lib/vocab
git commit -m "feat(vocab): a section's words, the share understood, and saved words met"
```

---

### Task 3: Data — Dexie, antrean, server function, store

**Files:**
- Create: `src/lib/vocab/types.ts`, `src/lib/vocab/schemas.ts`
- Modify: `src/lib/local/db.ts` (versi 5: `sectionTime`, `vocabQueue`), `src/lib/local/device.ts` (`wipeMemberData` mengosongkan dua tabel baru)
- Create: `src/lib/local/vocab-store.ts`, `src/lib/local/vocab-store.test.ts`
- Create: `src/server/vocab.ts`
- Create: `src/lib/vocab/vocab-client.ts`, `src/lib/vocab/vocab-client.test.ts`
- Modify: `src/routes/_member/_lobi.tsx` (`useQueueFlush(user.id, refreshVocab)`)

**Interfaces:**
- Consumes: Task 2; `createQueueSync`, `QueueStore`, `QueueAnswer` (`@/lib/sync/queue-sync`); `onMemberDataWiped` (`@/lib/local/device`); `listLocalWords` (`@/lib/local/saved-words`).
- Produces:
  - tipe: `WordsReadItem = { key: string; bookId: string; section: number; part: number; words: Array<string>; last: boolean }`, `TapItem = { key: string; bookId: string; word: string; taps: number; at: string }`, `MeetItem = { key: string; bookId: string; headword: string; section: number; count: number }`, `BookVocab = { read: number; lookedUp: number; words: Array<{ word: string; taps: number; lastAt: string }> }`, `WordMeetings = Record<string, { meetings: number; books: number }>`, `VocabCache = { books: Record<string, VocabSummary>; meetings: WordMeetings }`
  - Dexie: `addSectionTime(bookId, section, ms): Promise<boolean>` (benar sekali, saat mencapai 60.000 ms), `SECTION_READ_MS = 60_000`, store antrean `wordsReadStore`, `tapStore`, `meetStore`, `queueTap(bookId, word, at)`, `queueWordsRead(items)`, `queueMeetings(items)`, `loadVocabCache()`, `saveVocabCache(cache)`
  - server: `recordWordsReadFn`, `recordLookupsFn`, `recordMeetingsFn` (→ `QueueAnswer`), `loadVocabFn()` → `{ ok: true; cache: VocabCache } | { ok: false; code }`, `loadBookVocabFn({ data: { bookId } })` → `{ ok: true; vocab: BookVocab } | { ok: false; code }` (`not_found` untuk buku yang bukan milik anggota)
  - klien: `recordTap(bookId: string, word: string): Promise<void>`, `addSectionReading(bookId: string, section: number, ms: number): Promise<boolean>`, `queueSectionRead(bookId: string, section: number, text: string, forms: Record<string, Array<string>>): Promise<void>`, `flushVocab(): Promise<void>`, `refreshVocab(): Promise<void>`, `useBookVocab(bookId: string): VocabSummary | null`, `useWordMeetings(): WordMeetings`, `vocabStateForTests()`

- [ ] **Step 1: Tipe dan schema**

`src/lib/vocab/types.ts`:

```ts
import type { VocabSummary } from "./comprehension"

/** One part of a section's words, as it waits on the device (spec 3D §3.2). */
export type WordsReadItem = {
  key: string
  bookId: string
  section: number
  part: number
  words: Array<string>
  last: boolean
}
/** Taps on one word in one book not sent yet (spec 3D §3.3). */
export type TapItem = { key: string; bookId: string; word: string; taps: number; at: string }
/** A saved word's meetings in one section (spec 3D §3.4). */
export type MeetItem = {
  key: string
  bookId: string
  headword: string
  section: number
  count: number
}

export type BookVocab = {
  read: number
  lookedUp: number
  words: Array<{ word: string; taps: number; lastAt: string }>
}
export type WordMeetings = Record<string, { meetings: number; books: number }>
/** What the lobby and Kosakata show without a request per book. */
export type VocabCache = { books: Record<string, VocabSummary>; meetings: WordMeetings }

export type VocabAnswer = { ok: true; cache: VocabCache } | { ok: false; code: string }
export type BookVocabAnswer = { ok: true; vocab: BookVocab } | { ok: false; code: string }

export const MAX_TAP_BATCH = 50
export const MAX_MEET_BATCH = 50
export const MAX_WORDS_READ_BATCH = 10
```

`src/lib/vocab/schemas.ts`:

```ts
import { z } from "zod"
import { MAX_MEET_BATCH, MAX_TAP_BATCH, MAX_WORDS_READ_BATCH } from "./types"
import { MAX_WORDS_PER_PART } from "./words"

const Word = z.string().min(1).max(64)

export const WordsReadBatchSchema = z
  .array(
    z.object({
      bookId: z.uuid(),
      section: z.number().int().min(0),
      words: z.array(Word).max(MAX_WORDS_PER_PART),
      last: z.boolean(),
    })
  )
  .min(1)
  .max(MAX_WORDS_READ_BATCH)

export const TapBatchSchema = z
  .array(
    z.object({
      bookId: z.uuid(),
      word: Word,
      taps: z.number().int().min(1).max(1000),
      at: z.iso.datetime({ offset: true }),
    })
  )
  .min(1)
  .max(MAX_TAP_BATCH)

export const MeetBatchSchema = z
  .array(
    z.object({
      bookId: z.uuid(),
      headword: Word,
      section: z.number().int().min(0),
      count: z.number().int().min(1).max(10_000),
    })
  )
  .min(1)
  .max(MAX_MEET_BATCH)

export const VocabCacheSchema = z.object({
  books: z.record(
    z.string(),
    z.object({ read: z.number().int(), lookedUp: z.number().int() })
  ),
  meetings: z.record(
    z.string(),
    z.object({ meetings: z.number().int(), books: z.number().int() })
  ),
})
```

Bila `z.iso.datetime` tidak ada di zod yang terpasang, pakai `z.string().datetime({ offset: true })`.

- [ ] **Step 2: Dexie versi 5**

Di `src/lib/local/db.ts`:
- tipe baru:

```ts
/** Reading time in one section of a book on this device (spec 3D §3.1); done once read. */
export type LocalSectionTime = { key: string; bookId: string; section: number; ms: number; done: 0 | 1 }
/** A waiting change of 3D (spec 3D §5.3): one table, three kinds. */
export type LocalVocabOp = {
  key: string
  kind: "read" | "tap" | "meet"
  queuedAt: number
  item: WordsReadItem | TapItem | MeetItem
}
```

- kelas: `sectionTime!: EntityTable<LocalSectionTime, "key">`, `vocabQueue!: EntityTable<LocalVocabOp, "key">`;
- setelah `version(4)`:

```ts
    // Tahap 3D: time per section, and the vocabulary queues (spec 3D §5.3).
    this.version(5).stores({
      sectionTime: "key, bookId",
      vocabQueue: "key, kind, queuedAt",
    })
```

Di `src/lib/local/device.ts`, tambahkan `db.sectionTime` dan `db.vocabQueue` ke daftar `tables` di `wipeMemberData` dan perbarui komentarnya.

- [ ] **Step 3: Tes store yang gagal**

`src/lib/local/vocab-store.test.ts` (ikuti header `// @vitest-environment node` dan cara reset DB di `src/lib/local/reading-time.test.ts`):

```ts
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import { localDb } from "./db"
import {
  SECTION_READ_MS,
  addSectionTime,
  loadVocabCache,
  meetStore,
  queueMeetings,
  queueTap,
  queueWordsRead,
  saveVocabCache,
  tapStore,
  wordsReadStore,
} from "./vocab-store"

const BOOK = "00000000-0000-4000-8000-000000000001"

describe("vocab store", () => {
  beforeEach(async () => {
    const db = localDb()
    await Promise.all([db.sectionTime.clear(), db.vocabQueue.clear(), db.meta.clear()])
  })

  it("says a section is read once, when its time reaches 60 s across visits", async () => {
    expect(SECTION_READ_MS).toBe(60_000)
    expect(await addSectionTime(BOOK, 2, 40_000)).toBe(false)
    expect(await addSectionTime(BOOK, 2, 19_999)).toBe(false)
    expect(await addSectionTime(BOOK, 2, 1)).toBe(true)
    expect(await addSectionTime(BOOK, 2, 90_000)).toBe(false)
    expect(await addSectionTime(BOOK, 3, 60_000)).toBe(true)
  })

  it("adds taps on the same word and takes off only what was sent", async () => {
    await queueTap(BOOK, "mat", "2026-11-06T10:00:00.000Z")
    await queueTap(BOOK, "mat", "2026-11-06T10:01:00.000Z")
    const [sent] = await tapStore.pending()
    expect(sent).toMatchObject({ word: "mat", taps: 2, at: "2026-11-06T10:01:00.000Z" })
    await queueTap(BOOK, "mat", "2026-11-06T10:02:00.000Z") // while in flight
    await tapStore.confirm([sent])
    expect(await tapStore.pending()).toMatchObject([{ word: "mat", taps: 1 }])
    const [last] = await tapStore.pending()
    await tapStore.confirm([last])
    expect(await tapStore.pending()).toEqual([])
  })

  it("keeps the most meetings and drops them once sent unchanged", async () => {
    await queueMeetings(BOOK, 4, [{ headword: "run", count: 2 }])
    await queueMeetings(BOOK, 4, [{ headword: "run", count: 1 }])
    const pending = await meetStore.pending()
    expect(pending).toMatchObject([{ headword: "run", section: 4, count: 2 }])
    await queueMeetings(BOOK, 4, [{ headword: "run", count: 5 }])
    await meetStore.confirm(pending)
    expect(await meetStore.pending()).toMatchObject([{ count: 5 }])
  })

  it("queues a section's parts in order and drops them once sent", async () => {
    await queueWordsRead(BOOK, 1, [["a", "b"], ["c"]])
    const pending = await wordsReadStore.pending()
    expect(pending.map(({ part, last, words }) => [part, last, words])).toEqual([
      [0, false, ["a", "b"]],
      [1, true, ["c"]],
    ])
    await wordsReadStore.confirm(pending.slice(0, 1))
    expect(await wordsReadStore.pending()).toHaveLength(1)
    await wordsReadStore.revert(pending[1])
    expect(await wordsReadStore.pending()).toEqual([])
  })

  it("keeps the last summaries", async () => {
    expect(await loadVocabCache()).toBeNull()
    const cache = { books: { [BOOK]: { read: 300, lookedUp: 4 } }, meetings: {} }
    await saveVocabCache(cache)
    expect(await loadVocabCache()).toEqual(cache)
  })
})
```

- [ ] **Step 4: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/local/vocab-store.test.ts`
Expected: FAIL, modul tidak ada.

- [ ] **Step 5: Tulis store**

`src/lib/local/vocab-store.ts`:

```ts
import type { QueueStore } from "@/lib/sync/queue-sync"
import { VocabCacheSchema } from "@/lib/vocab/schemas"
import type { MeetItem, TapItem, VocabCache, WordsReadItem } from "@/lib/vocab/types"
import { type LocalVocabOp, localDb } from "./db"

/** A section counts as read after this much reading time in it (spec 3D §3.1). */
export const SECTION_READ_MS = 60_000
const CACHE_KEY = "vocab"

const sectionKey = (bookId: string, section: number) => `${bookId} ${section}`

/** Adds reading time to a section; true exactly once, when it reaches 60 s. */
export async function addSectionTime(
  bookId: string,
  section: number,
  ms: number
): Promise<boolean> {
  const db = localDb()
  return db.transaction("rw", db.sectionTime, async () => {
    const key = sectionKey(bookId, section)
    const row = await db.sectionTime.get(key)
    if (row?.done === 1) return false
    const total = (row?.ms ?? 0) + ms
    const done = total >= SECTION_READ_MS
    await db.sectionTime.put({ key, bookId, section, ms: total, done: done ? 1 : 0 })
    return done
  })
}

async function pendingOf<T>(kind: LocalVocabOp["kind"]): Promise<Array<T>> {
  const rows = await localDb().vocabQueue.where("kind").equals(kind).sortBy("queuedAt")
  return rows.map((row) => row.item as T)
}

const dropAll = async (items: ReadonlyArray<{ key: string }>) => {
  await localDb().vocabQueue.bulkDelete(items.map((item) => item.key))
}

export const wordsReadStore: QueueStore<WordsReadItem> = {
  pending: () => pendingOf<WordsReadItem>("read"),
  confirm: dropAll,
  // A part the server refused is broken; it is not sent again.
  revert: (item) => dropAll([item]),
}

export const tapStore: QueueStore<TapItem> = {
  pending: () => pendingOf<TapItem>("tap"),
  // Taps added while the batch was on its way stay for the next one.
  async confirm(sent) {
    const db = localDb()
    await db.transaction("rw", db.vocabQueue, async () => {
      for (const item of sent) {
        const row = await db.vocabQueue.get(item.key)
        if (!row) continue
        const left = (row.item as TapItem).taps - item.taps
        if (left <= 0) await db.vocabQueue.delete(item.key)
        else await db.vocabQueue.put({ ...row, item: { ...(row.item as TapItem), taps: left } })
      }
    })
  },
  revert: (item) => dropAll([item]),
}

export const meetStore: QueueStore<MeetItem> = {
  pending: () => pendingOf<MeetItem>("meet"),
  async confirm(sent) {
    const db = localDb()
    await db.transaction("rw", db.vocabQueue, async () => {
      for (const item of sent) {
        const row = await db.vocabQueue.get(item.key)
        if (row && (row.item as MeetItem).count <= item.count) {
          await db.vocabQueue.delete(item.key)
        }
      }
    })
  },
  revert: (item) => dropAll([item]),
}

export async function queueTap(bookId: string, word: string, at: string): Promise<void> {
  const db = localDb()
  const key = `tap ${bookId} ${word}`
  await db.transaction("rw", db.vocabQueue, async () => {
    const row = await db.vocabQueue.get(key)
    const taps = row ? (row.item as TapItem).taps + 1 : 1
    await db.vocabQueue.put({
      key,
      kind: "tap",
      queuedAt: row?.queuedAt ?? Date.now(),
      item: { key, bookId, word, taps, at },
    })
  })
}

export async function queueWordsRead(
  bookId: string,
  section: number,
  parts: ReadonlyArray<Array<string>>
): Promise<void> {
  const now = Date.now()
  await localDb().vocabQueue.bulkPut(
    parts.map((words, part) => {
      const key = `read ${bookId} ${section} ${part}`
      return {
        key,
        kind: "read" as const,
        queuedAt: now + part,
        item: { key, bookId, section, part, words, last: part === parts.length - 1 },
      }
    })
  )
}

export async function queueMeetings(
  bookId: string,
  section: number,
  counts: ReadonlyArray<{ headword: string; count: number }>
): Promise<void> {
  const db = localDb()
  await db.transaction("rw", db.vocabQueue, async () => {
    for (const { headword, count } of counts) {
      const key = `meet ${headword} ${bookId} ${section}`
      const row = await db.vocabQueue.get(key)
      if (row && (row.item as MeetItem).count >= count) continue
      await db.vocabQueue.put({
        key,
        kind: "meet",
        queuedAt: row?.queuedAt ?? Date.now(),
        item: { key, bookId, headword, section, count },
      })
    }
  })
}

export async function loadVocabCache(): Promise<VocabCache | null> {
  const stored = await localDb().meta.get(CACHE_KEY)
  const parsed = VocabCacheSchema.safeParse(stored?.value)
  return parsed.success ? parsed.data : null
}

export async function saveVocabCache(cache: VocabCache): Promise<void> {
  await localDb().meta.put({ key: CACHE_KEY, value: cache })
}
```

- [ ] **Step 6: Jalankan, pastikan lulus**

Run: `npx vitest run src/lib/local/vocab-store.test.ts`
Expected: PASS, 5 tes. Jalankan juga `npx vitest run src/lib/local` (tes `device`/wipe tetap lulus).

- [ ] **Step 7: Server function**

`src/server/vocab.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { QueueAnswer, QueueResult } from "@/lib/sync/queue-sync"
import { MeetBatchSchema, TapBatchSchema, WordsReadBatchSchema } from "@/lib/vocab/schemas"
import type {
  BookVocabAnswer,
  MeetItem,
  TapItem,
  VocabAnswer,
  WordMeetings,
  WordsReadItem,
} from "@/lib/vocab/types"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })

async function sendQueue(
  name: "record_words_read" | "record_lookups" | "record_meetings",
  entries: Array<Record<string, unknown>>
): Promise<QueueAnswer> {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("not_authenticated")
  const { data, error } = await supabase.rpc(name, { p_entries: entries as never })
  if (error) {
    if (error.message === "not_authenticated") return fail("not_authenticated")
    logServerError(`${name} failed`, error)
    return fail("unknown")
  }
  return { ok: true, results: data as Array<QueueResult> }
}

/** Parts of the words of sections read (spec 3D §3.2). */
export const recordWordsReadFn = createServerFn({ method: "POST" })
  .validator((items: Array<Omit<WordsReadItem, "key" | "part">>) =>
    WordsReadBatchSchema.parse(items)
  )
  .handler(({ data }) =>
    sendQueue(
      "record_words_read",
      data.map((item) => ({
        book_id: item.bookId,
        section: item.section,
        words: item.words,
        last: item.last,
      }))
    )
  )

/** Taps on words, per book (spec 3D §3.3). */
export const recordLookupsFn = createServerFn({ method: "POST" })
  .validator((items: Array<Omit<TapItem, "key">>) => TapBatchSchema.parse(items))
  .handler(({ data }) =>
    sendQueue(
      "record_lookups",
      data.map((item) => ({ book_id: item.bookId, word: item.word, taps: item.taps, at: item.at }))
    )
  )

/** Saved words met in a section (spec 3D §3.4). */
export const recordMeetingsFn = createServerFn({ method: "POST" })
  .validator((items: Array<Omit<MeetItem, "key">>) => MeetBatchSchema.parse(items))
  .handler(({ data }) =>
    sendQueue(
      "record_meetings",
      data.map((item) => ({
        headword: item.headword,
        book_id: item.bookId,
        section: item.section,
        count: item.count,
      }))
    )
  )

/** Every book's numbers and every saved word's meetings (spec 3D §4). */
export const loadVocabFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<VocabAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")
    const [summaries, meetings] = await Promise.all([
      supabase.rpc("book_vocab_summaries"),
      supabase.rpc("word_meeting_counts"),
    ])
    if (summaries.error || meetings.error) {
      logServerError("loading vocabulary numbers failed", summaries.error ?? meetings.error)
      return fail("unknown")
    }
    const books: Record<string, { read: number; lookedUp: number }> = {}
    for (const row of summaries.data) {
      books[row.book_id] = { read: row.read, lookedUp: row.looked_up }
    }
    const byWord: WordMeetings = {}
    for (const row of meetings.data) {
      byWord[row.headword] = { meetings: row.meetings, books: row.books }
    }
    return { ok: true, cache: { books, meetings: byWord } }
  }
)

const BookVocabSchema = z.object({
  read: z.number().int(),
  looked_up: z.number().int(),
  words: z.array(z.object({ word: z.string(), taps: z.number().int(), last_at: z.string() })),
})

/** One book's numbers and the words looked up in it (spec 3D §4.2). */
export const loadBookVocabFn = createServerFn({ method: "GET" })
  .validator((data: { bookId: string }) => z.object({ bookId: z.uuid() }).parse(data))
  .handler(async ({ data }): Promise<BookVocabAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("book_vocab", { p_book_id: data.bookId })
    if (error) {
      logServerError("book_vocab failed", error)
      return fail("unknown")
    }
    if (answer === null) return fail("not_found")
    const parsed = BookVocabSchema.safeParse(answer)
    if (!parsed.success) {
      logServerError("book_vocab answered something else", parsed.error)
      return fail("unknown")
    }
    return {
      ok: true,
      vocab: {
        read: parsed.data.read,
        lookedUp: parsed.data.looked_up,
        words: parsed.data.words.map((word) => ({
          word: word.word,
          taps: word.taps,
          lastAt: word.last_at,
        })),
      },
    }
  })
```

- [ ] **Step 8: Tes klien yang gagal**

`src/lib/vocab/vocab-client.test.ts`:

```ts
import "fake-indexeddb/auto"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearLocalData } from "@/lib/local/device"
import { localDb } from "@/lib/local/db"
import { loadVocabCache } from "@/lib/local/vocab-store"
import {
  queueSectionRead,
  recordTap,
  refreshVocab,
  useBookVocab,
  useWordMeetings,
  vocabStateForTests,
} from "./vocab-client"

const server = vi.hoisted(() => ({
  recordWordsReadFn: vi.fn(),
  recordLookupsFn: vi.fn(),
  recordMeetingsFn: vi.fn(),
  loadVocabFn: vi.fn(),
  loadBookVocabFn: vi.fn(),
}))
vi.mock("@/server/vocab", () => server)
const words = vi.hoisted(() => ({ listLocalWords: vi.fn() }))
vi.mock("@/lib/local/saved-words", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listLocalWords: words.listLocalWords,
}))

const BOOK = "00000000-0000-4000-8000-000000000001"
const ok = (n: number) => Promise.resolve({ ok: true, results: Array<"ok">(n).fill("ok") })

describe("vocab client", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true })
    server.recordWordsReadFn.mockImplementation(({ data }) => ok(data.length))
    server.recordLookupsFn.mockImplementation(({ data }) => ok(data.length))
    server.recordMeetingsFn.mockImplementation(({ data }) => ok(data.length))
    words.listLocalWords.mockResolvedValue([])
    await clearLocalData()
  })

  it("sends taps and section words before loading the numbers", async () => {
    await recordTap(BOOK, "Mat")
    await queueSectionRead(BOOK, 2, "The cat sat on the mat.", {})
    server.loadVocabFn.mockResolvedValue({
      ok: true,
      cache: { books: { [BOOK]: { read: 300, lookedUp: 1 } }, meetings: {} },
    })
    await refreshVocab()
    expect(server.recordLookupsFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ bookId: BOOK, word: "mat", taps: 1 })],
      })
    )
    expect(server.recordWordsReadFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ bookId: BOOK, section: 2, words: ["cat", "mat", "on", "sat", "the"], last: true }],
      })
    )
    expect(server.loadVocabFn.mock.invocationCallOrder[0]).toBeGreaterThan(
      server.recordWordsReadFn.mock.invocationCallOrder[0]
    )
    expect(await loadVocabCache()).toEqual({
      books: { [BOOK]: { read: 300, lookedUp: 1 } },
      meetings: {},
    })
    expect(await localDb().vocabQueue.count()).toBe(0)
  })

  it("queues meetings of saved words, not in the section they were saved", async () => {
    words.listLocalWords.mockResolvedValue([
      { headword: "run", bookId: BOOK, cfi: "epubcfi(/6/6!/4/2/1:0)" },
      { headword: "mat", bookId: null, cfi: null },
    ])
    const forms = { run: ["run", "ran"], mat: ["mat"] }
    await queueSectionRead(BOOK, 2, "He ran to the mat and ran back.", forms)
    await queueSectionRead(BOOK, 3, "A mat. They run.", forms)
    server.loadVocabFn.mockResolvedValue({ ok: true, cache: { books: {}, meetings: {} } })
    await refreshVocab()
    const sent = server.recordMeetingsFn.mock.calls.flatMap(([{ data }]) => data)
    expect(sent).toEqual(
      expect.arrayContaining([
        { bookId: BOOK, headword: "mat", section: 2, count: 1 },
        { bookId: BOOK, headword: "run", section: 3, count: 1 },
        { bookId: BOOK, headword: "mat", section: 3, count: 1 },
      ])
    )
    expect(sent).toHaveLength(3) // "run" in section 2 is where it was saved
  })

  it("shows a book's numbers and the meetings from the cache", async () => {
    server.loadVocabFn.mockResolvedValue({
      ok: true,
      cache: {
        books: { [BOOK]: { read: 850, lookedUp: 34 } },
        meetings: { run: { meetings: 7, books: 3 } },
      },
    })
    const book = renderHook(() => useBookVocab(BOOK))
    const meetings = renderHook(() => useWordMeetings())
    await act(() => refreshVocab())
    expect(book.result.current).toEqual({ read: 850, lookedUp: 34 })
    expect(meetings.result.current).toEqual({ run: { meetings: 7, books: 3 } })
  })

  it("keeps the last numbers when loading fails, and forgets them on a wipe", async () => {
    server.loadVocabFn.mockResolvedValueOnce({
      ok: true,
      cache: { books: { [BOOK]: { read: 300, lookedUp: 0 } }, meetings: {} },
    })
    await refreshVocab()
    server.loadVocabFn.mockResolvedValueOnce({ ok: false, code: "unknown" })
    await refreshVocab()
    expect(vocabStateForTests().cache?.books[BOOK]).toEqual({ read: 300, lookedUp: 0 })
    await clearLocalData()
    expect(vocabStateForTests().cache).toBeNull()
  })
})
```

- [ ] **Step 9: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/vocab/vocab-client.test.ts`
Expected: FAIL, modul `./vocab-client` tidak ada.

- [ ] **Step 10: Tulis klien**

`src/lib/vocab/vocab-client.ts`:

```ts
import { useEffect, useSyncExternalStore } from "react"
import { onMemberDataWiped } from "@/lib/local/device"
import { listLocalWords } from "@/lib/local/saved-words"
import {
  addSectionTime,
  loadVocabCache,
  meetStore,
  queueMeetings,
  queueTap,
  queueWordsRead,
  saveVocabCache,
  tapStore,
  wordsReadStore,
} from "@/lib/local/vocab-store"
import { type QueueSync, createQueueSync } from "@/lib/sync/queue-sync"
import { normalizeWord, isLookupWord } from "@/lib/words/normalize"
import {
  loadVocabFn,
  recordLookupsFn,
  recordMeetingsFn,
  recordWordsReadFn,
} from "@/server/vocab"
import type { VocabSummary } from "./comprehension"
import { countMeetings, meetingCounts } from "./meetings"
import {
  MAX_MEET_BATCH,
  MAX_TAP_BATCH,
  MAX_WORDS_READ_BATCH,
  type MeetItem,
  type TapItem,
  type VocabCache,
  type WordMeetings,
  type WordsReadItem,
} from "./types"
import { sectionWords, wordParts } from "./words"

type VocabState = { cache: VocabCache | null }
let state: VocabState = { cache: null }
const listeners = new Set<() => void>()
function setState(next: VocabState) {
  state = next
  for (const listener of listeners) listener()
}
/** For tests: the state the hooks read. */
export const vocabStateForTests = (): VocabState => state

const keepaliveFetch: typeof fetch = (input, init) => fetch(input, { ...init, keepalive: true })
const isOnline = () => navigator.onLine

let syncs: Array<QueueSync> | null = null
/** The three queues of this tab (browser only), sent in this order. */
function vocabSyncs(): Array<QueueSync> {
  syncs ??= [
    createQueueSync<WordsReadItem>({
      store: wordsReadStore,
      isOnline,
      keyOf: (item) => item.key,
      batchSize: MAX_WORDS_READ_BATCH,
      send: (batch) =>
        recordWordsReadFn({
          data: batch.map(({ bookId, section, words, last }) => ({ bookId, section, words, last })),
        }),
      onRefused: (refused) => console.error("the server refused words read", refused.length),
    }),
    createQueueSync<TapItem>({
      store: tapStore,
      isOnline,
      keyOf: (item) => item.key,
      batchSize: MAX_TAP_BATCH,
      // Often sent as the reader closes.
      send: (batch) =>
        recordLookupsFn({
          data: batch.map(({ bookId, word, taps, at }) => ({ bookId, word, taps, at })),
          fetch: keepaliveFetch,
        }),
      onRefused: (refused) => console.error("the server refused taps", refused.length),
      debounceMs: 10_000,
    }),
    createQueueSync<MeetItem>({
      store: meetStore,
      isOnline,
      keyOf: (item) => item.key,
      batchSize: MAX_MEET_BATCH,
      send: (batch) =>
        recordMeetingsFn({
          data: batch.map(({ bookId, headword, section, count }) => ({
            bookId,
            headword,
            section,
            count,
          })),
        }),
      onRefused: (refused) => console.error("the server refused meetings", refused.length),
    }),
  ]
  return syncs
}

let refreshSeq = 0
let wipeEpoch = 0
let cacheRead: Promise<void> | null = null

onMemberDataWiped(() => {
  refreshSeq++
  wipeEpoch++
  cacheRead = null
  setState({ cache: null })
})

function readCache(): Promise<void> {
  const epoch = wipeEpoch
  cacheRead ??= loadVocabCache()
    .then((cache) => {
      if (epoch === wipeEpoch) setState({ cache: state.cache ?? cache })
    })
    .catch((error: unknown) => {
      if (epoch === wipeEpoch) cacheRead = null
      console.error("reading the vocabulary numbers on this device failed", error)
    })
  return cacheRead
}

/** A tap that opened a meaning (spec 3D §3.3). */
export async function recordTap(bookId: string, word: string): Promise<void> {
  const normal = normalizeWord(word)
  if (!isLookupWord(normal)) return
  await queueTap(bookId, normal, new Date().toISOString())
  vocabSyncs()[1].later()
}

/** Reading time in a section; true once the section counts as read (spec 3D §3.1). */
export function addSectionReading(bookId: string, section: number, ms: number): Promise<boolean> {
  return addSectionTime(bookId, section, ms)
}

/** A section just read: its words, and the saved words met in it (spec 3D §3.2, §3.4). */
export async function queueSectionRead(
  bookId: string,
  section: number,
  text: string,
  forms: Record<string, Array<string>>
): Promise<void> {
  await queueWordsRead(bookId, section, wordParts(sectionWords(text)))
  const saved = await listLocalWords()
  const met = meetingCounts(countMeetings(text, forms), bookId, section, saved)
  if (met.length > 0) await queueMeetings(bookId, section, met)
  const [reads, , meets] = vocabSyncs()
  reads.later()
  meets.later()
}

/** Sends every waiting change. Never rejects. */
export async function flushVocab(): Promise<void> {
  for (const sync of vocabSyncs()) await sync.flush()
}

/** Sends the queues, then loads every book's numbers and the meetings. Never rejects. */
export async function refreshVocab(): Promise<void> {
  const seq = ++refreshSeq
  const epoch = wipeEpoch
  try {
    await readCache()
    await flushVocab()
    const answer = await loadVocabFn()
    if (seq !== refreshSeq || epoch !== wipeEpoch) return
    if (!answer.ok) {
      console.error("loading the vocabulary numbers was refused", answer.code)
      return
    }
    await saveVocabCache(answer.cache)
    if (seq !== refreshSeq || epoch !== wipeEpoch) return
    setState({ cache: answer.cache })
  } catch (error) {
    console.error("refreshing the vocabulary numbers failed", error)
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const SERVER_STATE: VocabState = { cache: null }

function useVocabState(): VocabState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE)
  useEffect(() => {
    void readCache()
  }, [])
  return snapshot
}

/** A book's numbers; null when nothing was read or looked up in it yet. */
export function useBookVocab(bookId: string): VocabSummary | null {
  return useVocabState().cache?.books[bookId] ?? null
}

const NO_MEETINGS: WordMeetings = {}
/** Every saved word's meetings, by headword. */
export function useWordMeetings(): WordMeetings {
  return useVocabState().cache?.meetings ?? NO_MEETINGS
}
```

Catatan untuk implementer:
- Mock `fetch` opsi `keepalive` di server function mengikuti `habit-client.ts` (server function TanStack menerima `fetch` di argumen; bila tipe menolak, ikuti cara `recordReadingTimeFn` dipanggil).
- Bila lint menolak urutan impor setelah `vi.mock`, jalankan `eslint --fix` (vi.mock di-hoist).

- [ ] **Step 11: Jalankan, pastikan lulus**

Run: `npx vitest run src/lib/vocab src/lib/local`
Expected: PASS.

- [ ] **Step 12: Muat ulang di layout lobi**

Di `src/routes/_member/_lobi.tsx`: impor `refreshVocab` dari `@/lib/vocab/vocab-client` dan tambahkan `useQueueFlush(user.id, refreshVocab)` setelah baris `refreshShop`, dengan komentar `// Words read and looked up, for the book details and Kosakata (plan 3D, decision 9).`

- [ ] **Step 13: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npx vitest run src/lib src/routes`

```bash
git add src/lib/vocab src/lib/local src/server/vocab.ts src/routes/_member/_lobi.tsx
git commit -m "feat(vocab): queue sections read, taps and meetings, and keep each book's numbers"
```

---

### Task 4: Reader — waktu per bab, teks bab, ketukan

**Files:**
- Modify: `src/components/reader/ReaderView.tsx` (`ReaderControls.sectionText`)
- Modify: `src/components/reader/useReadingClock.ts`, `useReadingClock.test.tsx` (`onCounted`)
- Modify: `src/routes/_member/read.$bookId.tsx`
- Test: `src/components/reader/useReadingClock.test.tsx`

**Interfaces:**
- Consumes: `addSectionReading`, `queueSectionRead`, `recordTap`, `flushVocab` (Task 3); `textOfDocument` (Task 2).
- Produces: `ReaderControls.sectionText(index: number): Promise<string | null>` (never rejects); `useReadingClock(bookId, paused, onCounted?: (ms: number) => void)`.

- [ ] **Step 1: Tes jam yang gagal**

Di `src/components/reader/useReadingClock.test.tsx`, ikuti cara file itu merender hook dengan jam palsu, dan tambahkan:

```tsx
  it("tells how much time each save counted", async () => {
    const onCounted = vi.fn()
    const { result } = renderHook(() => useReadingClock(BOOK, false, onCounted))
    act(() => result.current.onPage())
    await act(async () => {
      vi.advanceTimersByTime(12_000)
      result.current.onPage()
    })
    expect(onCounted).toHaveBeenCalledWith(12_000)
    expect(onCounted.mock.calls.every(([ms]) => ms > 0)).toBe(true)
  })
```

(Sesuaikan `BOOK`, cara memalsukan `Date.now`, dan mock `recordReadingTime` dengan tes lain di file itu.)

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/components/reader/useReadingClock.test.tsx`
Expected: FAIL, `onCounted` tidak dipanggil.

- [ ] **Step 3: `onCounted`**

Di `useReadingClock.ts`: tambahkan parameter ketiga `onCounted?: (ms: number) => void` (komentar: `/** Gets the milliseconds of every save, for the time per section (plan 3D, decision 6). */`), simpan di ref yang diperbarui tiap render, dan di `save` panggil `onCountedRef.current?.(total)` **secara sinkron sebelum** `recordReadingTime`, dengan `total = pieces.reduce((sum, piece) => sum + piece.ms, 0)` dan hanya bila `total > 0`.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run src/components/reader/useReadingClock.test.tsx`
Expected: PASS.

- [ ] **Step 5: `sectionText`**

Di `ReaderView.tsx`:
- tipe `ReaderControls`: `/** A section's text, for the words read (plan 3D, decision 5). Never rejects. */ sectionText: (index: number) => Promise<string | null>`;
- fungsi modul di dekat `chaptersOf`:

```ts
/** A section's text from its own document; null when it cannot be read. */
async function sectionText(view: View, index: number): Promise<string | null> {
  try {
    const doc = await view.book.sections[index]?.createDocument?.()
    return doc ? textOfDocument(doc) : null
  } catch {
    return null
  }
}
```

- di objek `controls` (sekitar baris 1047): `sectionText: (index) => sectionText(view, index),` mengikuti cara `chaptersOf` dipasang di sana. Impor `textOfDocument` dari `@/lib/vocab/words`. Tambahkan `sectionText: vi.fn()` ke setiap tiruan `ReaderControls` di tes yang membuatnya (cari `chaptersOf:` di `src/**/*.test.tsx`).

- [ ] **Step 6: Kabel di route reader**

Di `src/routes/_member/read.$bookId.tsx`:
- impor `addSectionReading`, `flushVocab`, `queueSectionRead`, `recordTap` dari `@/lib/vocab/vocab-client`;
- ref `formsRef` yang selalu memegang `formsByHeadword` terbaru;
- sebelum `useReadingClock`:

```tsx
  // Time goes to the section shown when the clock hands it over: show()
  // hands over the page before, while shownSection still names its section
  // (plan 3D, decision 6). A section read for 60 s gives its words (spec 3D §3.1).
  const onCounted = useCallback(
    (ms: number) => {
      const section = shownSection.current
      if (section === null) return
      void addSectionReading(bookId, section, ms)
        .then(async (read) => {
          if (!read) return
          const text = await controlsRef.current?.sectionText(section)
          if (text) await queueSectionRead(bookId, section, text, formsRef.current)
        })
        .catch((error: unknown) => console.error("counting the section read failed", error))
    },
    [bookId]
  )
```

  dan `useReadingClock(bookId, clockPaused, onCounted)`. Pastikan `shownSection` dan `controlsRef` dideklarasikan sebelum dipakai (pindahkan deklarasi `useRef`-nya ke atas bila perlu, tanpa mengubah perilakunya);
- di `openWord`: `void recordTap(bookId, next.word).catch((error: unknown) => console.error("recording the tap failed", error))`;
- kirim antrean saat tab disembunyikan dan saat reader ditutup:

```tsx
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushVocab()
    }
    document.addEventListener("visibilitychange", onHide)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      void flushVocab()
    }
  }, [])
```

- [ ] **Step 7: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npx vitest run src/components/reader src/routes`
Expected: bersih, PASS.

```bash
git add src/components/reader src/routes/_member/read.\$bookId.tsx
git commit -m "feat(reader): time per section gives its words and meetings, and taps are kept per book"
```

---

### Task 5: Tampilan — detail buku, Kosakata, privasi

**Files:**
- Create: `src/components/shelf/BookVocabLine.tsx`, `BookVocabLine.test.tsx`
- Modify: `src/components/lobby/BookDetailPanel.tsx`, `src/components/lobby/ContinueSheet.tsx`, `src/components/shelf/BookDetail.tsx` (baris setelah `<BookFacts …/>`)
- Create: `src/components/vocabulary/BookLookups.tsx`, `BookLookups.test.tsx`
- Modify: `src/components/vocabulary/VocabularyList.tsx`, `VocabularyList.test.tsx`
- Modify: `src/lib/words/vocabulary.ts`, `vocabulary.test.ts` (`sortWords`)
- Modify: `src/routes/_member/_lobi/vocabulary.tsx` (`?buku=`)
- Modify: `src/routes/privacy.tsx`

**Interfaces:**
- Consumes: `comprehension`, `VocabSummary` (Task 2); `useBookVocab`, `useWordMeetings` (Task 3); `loadBookVocabFn` (Task 3); `lookUp` (`@/lib/words/lookup`); `wordSync` (`@/lib/words/word-sync-client`); `MAX_MEANINGS`.
- Produces: `BookVocabLine({ bookId }: { bookId: string })`, `vocabLineText(summary: VocabSummary): string` (diekspor untuk tes), `BookLookups({ bookId, title, savedHeadwords, offline })`, `VOCAB_SORTS`, `sortWords(words, by, meetings)`.

- [ ] **Step 1: Tes yang gagal — baris detail buku**

`src/components/shelf/BookVocabLine.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BookVocabLine, vocabLineText } from "./BookVocabLine"

const vocab = vi.hoisted(() => ({ useBookVocab: vi.fn() }))
vi.mock("@/lib/vocab/vocab-client", () => vocab)
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, search }: { children: React.ReactNode; to: string; search: { buku: string } }) => (
    <a href={`${to}?buku=${search.buku}`}>{children}</a>
  ),
}))

describe("BookVocabLine", () => {
  it("says the share understood and the words looked up", () => {
    expect(vocabLineText({ read: 850, lookedUp: 34 })).toBe(
      "Paham 96% kata tanpa kamus · 34 kata dicari"
    )
    expect(vocabLineText({ read: 300, lookedUp: 0 })).toBe("Paham 100% kata tanpa kamus")
    expect(vocabLineText({ read: 120, lookedUp: 3 })).toBe(
      "Baca lebih banyak untuk melihat angkanya"
    )
  })

  it("links to the book's words in Kosakata", () => {
    vocab.useBookVocab.mockReturnValue({ read: 850, lookedUp: 34 })
    render(<BookVocabLine bookId="b1" />)
    expect(screen.getByText("Paham 96% kata tanpa kamus · 34 kata dicari")).toBeVisible()
    expect(screen.getByRole("link", { name: "Lihat kata" })).toHaveAttribute(
      "href",
      "/vocabulary?buku=b1"
    )
  })

  it("shows nothing for a book not read yet", () => {
    vocab.useBookVocab.mockReturnValue(null)
    const { container } = render(<BookVocabLine bookId="b1" />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal; tulis komponen; jalankan lagi**

Run: `npx vitest run src/components/shelf/BookVocabLine.test.tsx` → FAIL.

`src/components/shelf/BookVocabLine.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { type VocabSummary, comprehension } from "@/lib/vocab/comprehension"
import { useBookVocab } from "@/lib/vocab/vocab-client"

/** The line for a book's details (spec 3D §4.1). */
export function vocabLineText(summary: VocabSummary): string {
  const share = comprehension(summary)
  if (share === null) return "Baca lebih banyak untuk melihat angkanya"
  const base = `Paham ${share}% kata tanpa kamus`
  return summary.lookedUp > 0 ? `${base} · ${summary.lookedUp} kata dicari` : base
}

/** How much of a book was understood without the dictionary; nothing before it was read. */
export function BookVocabLine({ bookId }: { bookId: string }) {
  const summary = useBookVocab(bookId)
  if (!summary) return null
  return (
    <p className="text-sm text-muted-foreground">
      {vocabLineText(summary)}{" "}
      <Link
        to="/vocabulary"
        search={{ buku: bookId }}
        className="font-medium text-foreground underline underline-offset-2"
      >
        Lihat kata
      </Link>
    </p>
  )
}
```

Tambahkan `<BookVocabLine bookId={book.id} />` tepat setelah `<BookFacts …/>` di `BookDetailPanel.tsx`, `ContinueSheet.tsx` (di dalam cabang yang punya `book`), dan `BookDetail.tsx`. Bila tes komponen-komponen itu tidak me-mock router/`vocab-client`, tambahkan mock `useBookVocab: () => null` di sana supaya tes yang ada tetap lulus.

Run: `npx vitest run src/components/shelf src/components/lobby` → PASS.

- [ ] **Step 3: Tes yang gagal — urutan dan pertemuan di Kosakata**

Di `src/lib/words/vocabulary.test.ts`:

```ts
describe("sortWords", () => {
  const word = (headword: string, createdAt: string) =>
    ({ headword, createdAt }) as SavedWord
  const words = [word("a", "2026-11-01"), word("b", "2026-11-03"), word("c", "2026-11-02")]

  it("keeps the newest first, or puts the words met most first", () => {
    expect(sortWords(words, "terbaru", {}).map((w) => w.headword)).toEqual(["b", "c", "a"])
    expect(
      sortWords(words, "bertemu", {
        a: { meetings: 5, books: 1 },
        c: { meetings: 5, books: 2 },
      }).map((w) => w.headword)
    ).toEqual(["c", "a", "b"])
    expect(VOCAB_SORTS).toEqual([
      { value: "terbaru", label: "Terbaru" },
      { value: "bertemu", label: "Paling sering bertemu" },
    ])
  })
})
```

Di `src/components/vocabulary/VocabularyList.test.tsx`, ikuti cara file itu merender daftar dan tambahkan: (a) kata dengan `meetings={{ run: { meetings: 7, books: 3 } }}` menampilkan "Bertemu lagi 7× di 3 buku" dan kata lain tidak menampilkan "Bertemu lagi"; (b) memilih "Paling sering bertemu" di pilihan berlabel "Urutkan" mengubah urutan kartu; (c) `initialBook="<id>"` memulai saringan buku di buku itu.

- [ ] **Step 4: Jalankan, pastikan gagal; tulis; jalankan lagi**

Di `src/lib/words/vocabulary.ts`:

```ts
export type VocabSort = "terbaru" | "bertemu"
export const VOCAB_SORTS: ReadonlyArray<{ value: VocabSort; label: string }> = [
  { value: "terbaru", label: "Terbaru" },
  { value: "bertemu", label: "Paling sering bertemu" },
]

/** Newest first, or the words met most first, then the newest (spec 3D §4.2). */
export function sortWords(
  words: ReadonlyArray<SavedWord>,
  by: VocabSort,
  meetings: Record<string, { meetings: number; books: number }>
): Array<SavedWord> {
  const newest = (a: SavedWord, b: SavedWord) => b.createdAt.localeCompare(a.createdAt)
  if (by === "terbaru") return [...words].sort(newest)
  return [...words].sort(
    (a, b) =>
      (meetings[b.headword]?.meetings ?? 0) - (meetings[a.headword]?.meetings ?? 0) ||
      newest(a, b)
  )
}
```

Di `VocabularyList.tsx`:
- props baru: `meetings: Record<string, { meetings: number; books: number }>`, `initialBook?: string`, `bookTitle?: (key: string) => string | null` tidak perlu — gunakan `initialBook` sebagai nilai awal `useState(initialBook ?? ALL_BOOKS)`;
- pilihan "Urutkan" (`<Label htmlFor="vocab-sort" className="sr-only">Urutkan</Label>` + `<select id="vocab-sort">` dengan `VOCAB_SORTS`), di samping saringan buku, dengan pola markup `<select id="vocab-book">` yang ada; daftar yang ditampilkan = `sortWords(filterWords(...), sort, meetings)`;
- di kartu kata, bila `meetings[word.headword]` ada: `<p className="text-sm text-muted-foreground">Bertemu lagi {m.meetings}× di {m.books} buku</p>`;
- prop `children`/slot tidak perlu: `BookLookups` dirender oleh rute (Step 6).

Run: `npx vitest run src/lib/words src/components/vocabulary` → PASS.

- [ ] **Step 5: Tes yang gagal — "Dicari di buku ini"**

`src/components/vocabulary/BookLookups.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BookLookups } from "./BookLookups"

const server = vi.hoisted(() => ({ loadBookVocabFn: vi.fn() }))
vi.mock("@/server/vocab", () => server)
const lookup = vi.hoisted(() => ({ lookUp: vi.fn() }))
vi.mock("@/lib/words/lookup", () => lookup)
const sync = vi.hoisted(() => ({ save: vi.fn(() => Promise.resolve()) }))
vi.mock("@/lib/words/word-sync-client", () => ({ wordSync: () => sync }))

const BOOK = "00000000-0000-4000-8000-000000000001"
const answer = {
  ok: true,
  vocab: {
    read: 850,
    lookedUp: 2,
    words: [
      { word: "ubiquitous", taps: 3, lastAt: "2026-11-06T10:00:00Z" },
      { word: "mat", taps: 1, lastAt: "2026-11-05T10:00:00Z" },
    ],
  },
}

const show = (props: Partial<Parameters<typeof BookLookups>[0]> = {}) =>
  render(
    <BookLookups
      bookId={BOOK}
      title="Sherlock"
      savedHeadwords={new Set(["mat"])}
      offline={false}
      {...props}
    />
  )

describe("BookLookups", () => {
  it("lists the words looked up in the book, the saved ones marked", async () => {
    server.loadBookVocabFn.mockResolvedValue(answer)
    show()
    expect(await screen.findByRole("heading", { name: "Kata di Sherlock" })).toBeVisible()
    expect(screen.getByText("Paham 99% kata tanpa kamus · 2 kata dicari")).toBeVisible()
    const list = screen.getByRole("list", { name: "Dicari di buku ini" })
    const rows = within(list).getAllByRole("listitem")
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("ubiquitous"),
      expect.stringContaining("mat"),
    ])
    expect(within(rows[0]).getByText("diketuk 3×")).toBeVisible()
    expect(within(rows[1]).getByText("Tersimpan")).toBeVisible()
  })

  it("opens a meaning and saves the word", async () => {
    server.loadBookVocabFn.mockResolvedValue(answer)
    lookup.lookUp.mockResolvedValue({
      kind: "result",
      result: {
        word: "ubiquitous",
        entries: [{ headword: "ubiquitous", pos: "adj", meanings: ["ada di mana-mana"] }],
        phrases: [],
        version: null,
      },
    })
    show()
    fireEvent.click(await screen.findByRole("button", { name: /ubiquitous/ }))
    expect(await screen.findByText("ada di mana-mana")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }))
    await waitFor(() =>
      expect(sync.save).toHaveBeenCalledWith(
        expect.objectContaining({
          headword: "ubiquitous",
          pos: "adj",
          meanings: ["ada di mana-mana"],
          bookId: BOOK,
          bookTitle: "Sherlock",
          sentence: "",
          cfi: null,
        }),
        ["ubiquitous"]
      )
    )
  })

  it("needs a connection", () => {
    show({ offline: true })
    expect(screen.getByText("Perlu koneksi internet")).toBeVisible()
    expect(server.loadBookVocabFn).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Jalankan, pastikan gagal; tulis; jalankan lagi**

`src/components/vocabulary/BookLookups.tsx`:

```tsx
import { useEffect, useState } from "react"
import { vocabLineText } from "@/components/shelf/BookVocabLine"
import { Button } from "@/components/ui/button"
import type { BookVocab } from "@/lib/vocab/types"
import { type LookupOutcome, lookUp } from "@/lib/words/lookup"
import { MAX_MEANINGS } from "@/lib/words/types"
import { wordSync } from "@/lib/words/word-sync-client"
import { loadBookVocabFn } from "@/server/vocab"

/** The words looked up in one book, for Kosakata's book filter (spec 3D §4.2). */
export function BookLookups({
  bookId,
  title,
  savedHeadwords,
  offline,
}: {
  bookId: string
  title: string
  savedHeadwords: ReadonlySet<string>
  offline: boolean
}) {
  const [vocab, setVocab] = useState<BookVocab | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [meaning, setMeaning] = useState<LookupOutcome | null>(null)

  useEffect(() => {
    if (offline) return
    let live = true
    setVocab(null)
    setFailed(false)
    loadBookVocabFn({ data: { bookId } })
      .then((answer) => {
        if (!live) return
        if (answer.ok) setVocab(answer.vocab)
        else setFailed(true)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [bookId, offline])

  async function toggle(word: string) {
    if (open === word) {
      setOpen(null)
      return
    }
    setOpen(word)
    setMeaning(null)
    setMeaning(await lookUp(word, []))
  }

  function save(word: string) {
    if (meaning?.kind !== "result") return
    const entry = meaning.result.entries[0]
    void wordSync()
      .save(
        {
          headword: entry.headword,
          pos: entry.pos,
          meanings: entry.meanings.slice(0, MAX_MEANINGS),
          bookId,
          bookTitle: title,
          sentence: "",
          cfi: null,
          createdAt: new Date().toISOString(),
        },
        [word]
      )
      .catch((error: unknown) => console.error("saving the word failed", error))
  }

  return (
    <section aria-labelledby="book-lookups" className="flex flex-col gap-2">
      <h2 id="book-lookups" className="font-heading text-xl">
        Kata di {title}
      </h2>
      {offline ? (
        <p className="text-sm">Perlu koneksi internet</p>
      ) : failed ? (
        <p className="text-sm">Kata di buku ini belum bisa dimuat.</p>
      ) : !vocab ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {vocabLineText({ read: vocab.read, lookedUp: vocab.lookedUp })}
          </p>
          <h3 id="book-lookups-list" className="font-medium">
            Dicari di buku ini
          </h3>
          <ul aria-labelledby="book-lookups-list" className="flex flex-col gap-1">
            {vocab.words.map(({ word, taps }) => {
              const saved = savedHeadwords.has(word)
              return (
                <li key={word} className="rounded-lg border px-3 py-2">
                  <button
                    type="button"
                    className="flex w-full items-baseline justify-between gap-2 text-left"
                    aria-expanded={open === word}
                    onClick={() => void toggle(word)}
                  >
                    <span className="font-medium">{word}</span>
                    <span className="text-sm text-muted-foreground">diketuk {taps}×</span>
                  </button>
                  {saved && <span className="text-sm">Tersimpan</span>}
                  {open === word && meaning?.kind === "result" && (
                    <div className="mt-2 flex flex-col gap-1">
                      <ul className="list-disc pl-5 text-sm">
                        {meaning.result.entries.flatMap((entry) =>
                          entry.meanings.map((text) => <li key={`${entry.pos}${text}`}>{text}</li>)
                        )}
                      </ul>
                      {!saved && meaning.result.entries.length > 0 && (
                        <Button size="sm" className="self-start" onClick={() => save(word)}>
                          Simpan
                        </Button>
                      )}
                    </div>
                  )}
                  {open === word && meaning?.kind === "offline" && (
                    <p className="mt-2 text-sm">Arti butuh koneksi</p>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
```

Catatan: daftar arti di dalam `<li>` adalah `<ul>` bersarang tanpa nama; tes memakai daftar bernama "Dicari di buku ini" sehingga tidak tertukar. Bila `textContent` baris di tes pertama ikut memuat "Tersimpan", harapan `stringContaining` tetap lulus.

Run: `npx vitest run src/components/vocabulary` → PASS.

- [ ] **Step 7: Rute Kosakata `?buku=`**

Di `src/routes/_member/_lobi/vocabulary.tsx`:
- `validateSearch: (search: Record<string, unknown>) => ({ buku: typeof search.buku === "string" ? search.buku : undefined })`;
- `const { buku } = Route.useSearch()`; `const meetings = useWordMeetings()`;
- `const shelfBook = buku ? books.find((book) => book.id === buku) : undefined`;
- sebelum `<VocabularyList …>`, bila `shelfBook`: `<BookLookups key={shelfBook.id} bookId={shelfBook.id} title={shelfBook.title} savedHeadwords={new Set(words.map((w) => w.headword))} offline={loaded.offline} />` lalu tautan `<Link to="/vocabulary" search={{}}>Semua kata</Link>`;
- `<VocabularyList … meetings={meetings} initialBook={buku} key={buku ?? "semua"} />` (kunci supaya saringan awal ikut berubah saat `?buku=` berubah).

Pastikan tautan lain ke `/vocabulary` (mis. di `LobbyStage.activate`, menu) tetap lolos typecheck; TanStack Router mungkin butuh `search={{}}` atau `buku` opsional — `buku` dibuat opsional di `validateSearch` sehingga `search` tidak wajib. Bila typecheck tetap meminta, tambahkan `search: {}` di pemanggil itu.

- [ ] **Step 8: Privasi**

Di `src/routes/privacy.tsx`, setelah `<li>` "Toko lobi…":

```tsx
        <li>
          Kosakata dari bacaan: kata yang kamu ketuk di tiap buku, kata dari
          bab yang sudah kamu baca (untuk menghitung persen kata yang kamu
          pahami tanpa kamus), dan berapa kali kata tersimpan muncul lagi. Data
          ini tidak dibagikan dan ikut terhapus saat akunmu dihapus; data per
          buku ikut terhapus bersama bukunya, kecuali hitungan kata yang muncul
          lagi.
        </li>
```

- [ ] **Step 9: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npm run check && npm test`
Expected: bersih, semua PASS. Bila `routeTree.gen.ts` berubah karena `validateSearch`, pastikan blok `Register` tetap ada.

```bash
git add src/components src/lib/words src/routes
git commit -m "feat(vocab): the share understood in book details, the words of a book in Kosakata, and words met again"
```

---

### Task 6: E2E dan verifikasi akhir

**Files:**
- Create: `e2e/helpers/vocab.ts`, `e2e/vocab.spec.ts`

**Interfaces:**
- Consumes: helper `admin` (`e2e/helpers/members.ts`), `seedBook`, `createConfirmedMember`, `signInAndOnboard`, `userIdOf`, `hydrated` seperti `e2e/habit.spec.ts`; `startReading`, `tapWord` (`e2e/helpers/reading.ts`, `e2e/helpers/words.ts`).

- [ ] **Step 1: Helper**

`e2e/helpers/vocab.ts`:

```ts
import { admin } from "./members"

/** Words read in a book, straight into the table (another device's reading). */
export async function seedWordsRead(userId: string, bookId: string, count: number, also: Array<string> = []) {
  const words = [...Array.from({ length: count }, (_, i) => `seedword${i}`), ...also]
  const { error } = await admin()
    .from("book_words_read")
    .insert({ user_id: userId, book_id: bookId, sections: [0], words })
  if (error) throw error
}

export async function seedLookup(userId: string, bookId: string, word: string, taps: number) {
  const { error } = await admin()
    .from("word_lookups")
    .insert({ user_id: userId, book_id: bookId, word, taps })
  if (error) throw error
}

/** The sections of a book the server has as read, and its looked-up words. */
export async function vocabOf(userId: string, bookId: string) {
  const [read, lookups] = await Promise.all([
    admin().from("book_words_read").select("sections").eq("user_id", userId).eq("book_id", bookId),
    admin().from("word_lookups").select("word, taps").eq("user_id", userId).eq("book_id", bookId),
  ])
  if (read.error) throw read.error
  if (lookups.error) throw lookups.error
  return { sections: read.data[0]?.sections ?? [], lookups: lookups.data }
}
```

- [ ] **Step 2: Spec**

`e2e/vocab.spec.ts` (salin impor, `test.use`, dan `hydrated` dari bagian atas `e2e/habit.spec.ts`):

```ts
test("a book's details show the share understood and lead to its words", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  await seedWordsRead(userId, bookId, 997, ["ubiquitous", "mat", "lantern"])
  await seedLookup(userId, bookId, "ubiquitous", 3)
  await seedLookup(userId, bookId, "lantern", 1)
  await seedLookup(userId, bookId, "never-read", 1)

  await page.goto("/shelf")
  await hydrated(page)
  // Open the book's details the way shelf.spec.ts does.
  await page.getByRole("button", { name: /Sherlock/ }).first().click()
  await expect(page.getByText("Paham 99% kata tanpa kamus · 2 kata dicari")).toBeVisible()
  await page.getByRole("link", { name: "Lihat kata" }).click()
  await expect(page).toHaveURL(new RegExp(`/vocabulary\\?buku=${bookId}`))
  const list = page.getByRole("list", { name: "Dicari di buku ini" })
  await expect(list.getByRole("listitem")).toHaveCount(3)
  await expect(list.getByRole("listitem").first()).toContainText("diketuk")
})

test("reading a section for a minute and tapping a word are kept per book", async ({ page, isMobile }) => {
  test.setTimeout(180_000)
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)

  await page.goto(`/read/${bookId}`)
  await startReading(page)
  const word = await tapWord(page, isMobile)
  await page.keyboard.press("Escape")
  // A minute in the same section, then the reader closes.
  await page.waitForTimeout(65_000)
  await page.goto("/lobby")
  await expect
    .poll(async () => (await vocabOf(userId, bookId)).sections.length, { timeout: 30_000 })
    .toBeGreaterThan(0)
  await expect
    .poll(async () => (await vocabOf(userId, bookId)).lookups.map((row) => row.word), {
      timeout: 30_000,
    })
    .toContain(word.toLowerCase())
})
```

Catatan: buka detail buku dan pilih buku dengan cara yang sama seperti `e2e/shelf.spec.ts` atau `e2e/collections.spec.ts` (nama tombol mungkin berbeda; ikuti file itu). Bila `startReading` di halaman pertama berada di bagian sampul atau halaman judul yang pendek, tetap di bagian itu selama 65 detik sudah cukup: yang diuji adalah bab yang tampil. `tapWord` mengembalikan kata yang diketuk; samakan normalisasinya dengan `normalizeWord` bila kata itu ber-apostrof.

- [ ] **Step 3: Jalankan E2E 3D**

Run: `npx playwright test e2e/vocab.spec.ts --workers=2`
Expected: 4 passed (2 tes × desktop dan mobile).

- [ ] **Step 4: Verifikasi penuh**

Run:
- `npm run typecheck && npm run lint && npm run check`
- `npm test`
- `npx vitest run --config vitest.db.config.ts tests/db/vocab.test.ts tests/db/saved-words.test.ts tests/db/books.test.ts tests/db/shop.test.ts`
- `npx playwright test --workers=2`

Expected: bersih; unit dan DB PASS; E2E penuh tanpa kegagalan baru. Catat angkanya.

- [ ] **Step 5: Commit**

```bash
git add e2e/vocab.spec.ts e2e/helpers/vocab.ts
git commit -m "test(e2e): a book's share understood, its words in Kosakata, and a section read and a tap kept"
```

- [ ] **Step 6: Daftar periksa pemilik setelah deploy** (masuk laporan akhir)

1. Baca satu bab ±1 menit dan ketuk beberapa kata; buka detail buku: baris "Paham N% …" muncul setelah ±200 kata terbaca.
2. "Lihat kata" membuka Kosakata dengan daftar "Dicari di buku ini"; buka arti dan Simpan dari sana.
3. Simpan sebuah kata, baca bab lain yang memuatnya: Kosakata menampilkan "Bertemu lagi"; urutan "Paling sering bertemu".
4. Baca di HP lalu di laptop: angka sama di keduanya.
