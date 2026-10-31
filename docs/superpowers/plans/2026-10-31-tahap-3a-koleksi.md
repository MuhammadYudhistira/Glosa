# Glosa Tahap 3A — Koleksi dan buku selesai: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Member membuat koleksi sendiri ("Bacaan santai", "Untuk tahun depan", …) dan memasukkan buku ke dalamnya; Glosa menyusun koleksi otomatis **Sedang dibaca** dan **Sudah dibaca**; reader bertanya "Sudah selesai membaca buku ini?" di akhir buku; lobi 3D mendapat **lemari pajang** berisi sampul buku yang sudah selesai.

**Architecture:**
- **Server.** Tabel `collections` dan `collection_books` (banyak-ke-banyak), plus `books.finished_at` dan `books.finish_declined`. Semua penulisan lewat fungsi `security definer`; browser memanggilnya lewat server function di `src/server/collections.ts`. `listBooksFn` ikut membaca koleksi dan keanggotaan, jadi snapshot offline rak juga memuatnya.
- **Rak Saya.** Chip koleksi (`CollectionBar`) menjadi navigasi utama; genre pindah ke pilihan `GenreSelect` di toolbar. Filter koleksi × genre dan urutan bawaan per koleksi ada di `src/lib/shelf.ts` (murni). Detail buku mendapat daftar centang koleksi (`BookCollections`) dan tombol selesai (`FinishToggle`).
- **Reader.** `ReaderLocation.atBookEnd` dari renderer foliate (`atEnd`); `shouldAskFinish` (murni) menentukan kapan `FinishPrompt` muncul.
- **Lobi.** Hotspot `lemari` dan perabot lemari pajang; sampul buku selesai dimuat sebagai tekstur three.js lewat `stage.setShowcase`.

**Tech Stack:** TanStack Start + Router, React 19, TypeScript, Tailwind CSS 4, Base UI (Dialog), Supabase (Postgres, RLS, PostgREST RPC), zod 4, three.js, foliate-js, Vitest + Testing Library (jsdom), Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md`](../specs/2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md) §3–§8.

## Global Constraints

- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris (mengikuti kode yang ada). Array ditulis `Array<T>`.
- **Dependensi:** tidak ada dependensi baru.
- **Batas (persis dari spec):** nama koleksi 1–40 karakter setelah dipangkas; maksimal 50 koleksi per member; nama tidak boleh kembar tanpa membedakan huruf besar/kecil; lemari memajang 12 buku; ajakan selesai pada posisi ≥ 95% atau di akhir bagian linear terakhir.
- **Teks dari spec, persis:** "+ Koleksi baru", "Sedang dibaca", "Sudah dibaca", "Semua", "Koleksi", "Sudah selesai membaca buku ini?", "Ya, selesai", "Belum", "Masuk ke koleksi Sudah dibaca", "Tandai selesai", "Tandai belum selesai".
- **SQL:** RLS "baca milik sendiri"; penulisan lewat fungsi `security definer` dengan `set search_path = ''`; error otentikasi `raise exception 'not_authenticated' using errcode = 'P0001'`; `revoke execute … from public, anon` lalu `grant` ke `authenticated` (pola `save_word`).
- **Migrasi:** di-push ke proyek Supabase dev (`npm run db:push`), lalu tipe dibuat ulang (`npm run db:types` + `npx prettier --write src/server/database.types.ts`). Hanya tambahan, sesuai aturan migrasi prod di [`docs/ops/deploy.md`](../../ops/deploy.md) §7.
- **Proyek dev dipakai bersama** oleh situs dev, CI, dan test. Test hanya menulis baris milik member test-nya sendiri.
- **Line ending:** LF. Di Windows, jangan menulis file lewat Python tanpa `newline=''`.
- **E2E:** jalankan dengan `--workers=2`. Kalau port 3000 dipegang aplikasi lain (cek `curl -sL localhost:3000/login | grep -o "<title>[^<]*"`), jalankan dengan config sementara di port 3100, jangan matikan server lain. Server preview (`offline` project) tidak perlu untuk task ini: config sementara yang hanya memuat project `desktop` dan `mobile` serta `webServer[0]` cukup, lalu dihapus. Satu kegagalan dijalankan ulang sendirian sebelum disebut regresi.

## Keputusan dan penyimpangan dari spec

1. **Fungsi DB menjawab dengan kode teks**, bukan exception: `'ok'`, `'not_found'`, `'invalid'`, `'duplicate'`, `'limit_reached'`; `create_collection` menjawab id baru (teks uuid) bila berhasil. Hanya sesi yang hilang menjadi exception, seperti `save_word`.
2. **Kode pesan baru** untuk `bookMessage`: `collections_full`, `collection_duplicate`, `collection_invalid`. Server function menerjemahkan jawaban DB ke kode ini.
3. **Daftar centang koleksi menyimpan setiap kali dicentang** (tanpa tombol Simpan), seperti pilihan genre di detail buku. Gagal → centang kembali seperti semula dan pesan error tampil.
4. **"Sedang dibaca" memakai `progress` dari server** (`> 0`), bukan persentase lokal perangkat, supaya isi koleksi sama di semua perangkat.
5. **Urutan `finished` ("Terakhir selesai") menjadi pilihan urutan baru** untuk semua koleksi. Urutan bawaan: `finished` di Sudah dibaca, `opened` di tempat lain. `?sort=` hanya masuk URL bila berbeda dari bawaan koleksinya, jadi `parseShelfSearch` kini menerima `opened` juga.
6. **Label pilihan genre "Tampilkan genre"**, bukan "Genre": label "Genre" sudah dipakai pilihan genre di detail buku, dan dua label sama di satu halaman membingungkan pembaca layar dan E2E.
7. **Lemari di `[0.9, 28.5]`**, di dinding kiri dekat sudut depan, dengan hotspot terakhir dalam urutan tab (setelah katalog Kosakata). Letaknya diperiksa dengan screenshot harness di Task 7; bila tertutup, geser `SHOWCASE` sepanjang dinding kiri (z 26–31) dan catat di progres.
8. **Tekstur sampul dimuat ulang hanya bila daftar buku berubah** (urutan id), bukan bila signed URL diperbarui tiap muat ulang rak.
9. **Ajakan selesai dan penanda bab (mode Gulir) tidak tampil bersamaan:** penanda disembunyikan selama ajakan tampil.

## Struktur file

| File | Status | Tanggung jawab |
|---|---|---|
| `supabase/migrations/20261031000300_collections.sql` | Baru | Tabel, kolom buku, fungsi |
| `tests/db/collections.test.ts` | Baru | Uji DB |
| `src/server/database.types.ts` | Dibuat ulang | `npm run db:types` |
| `src/lib/book-types.ts` | Ubah | `Collection`, field baru `ShelfBook`, `ShelfData.collections` |
| `src/lib/reader-types.ts` | Ubah | `ReaderBook.finished`, `.finishDeclined` |
| `src/server/books.ts` | Ubah | `listBooksFn` membaca koleksi |
| `src/server/reading.ts` | Ubah | `readingStateFn` membaca status selesai |
| `src/server/collections.ts` | Baru | Server function koleksi dan selesai |
| `src/lib/book-messages.ts` | Ubah | Kode pesan baru |
| `src/lib/local/shelf-snapshot.ts` | Ubah | Snapshot lama tanpa koleksi tetap terbaca |
| `src/components/shelf/useShelfSnapshot.ts`, `src/routes/_member/_lobi.tsx` | Ubah | Snapshot menyimpan koleksi; koleksi ke lobi |
| `src/components/reader/load-reader.ts` | Ubah | Buku offline membawa status selesai |
| `src/lib/shelf.ts` | Ubah | Koleksi di pencarian, filter, urutan, jumlah |
| `src/lib/finish.ts` | Baru | `shouldAskFinish` |
| `src/components/shelf/CollectionBar.tsx` | Baru | Chip koleksi |
| `src/components/shelf/CollectionDialog.tsx` | Baru | Buat, ganti nama, hapus |
| `src/components/shelf/GenreSelect.tsx` | Baru | Pengganti `GenreFilter` |
| `src/components/shelf/GenreFilter.tsx` (+ test) | Hapus | Digantikan `GenreSelect` |
| `src/components/shelf/ShelfToolbar.tsx` | Ubah | `children`, `defaultSort` |
| `src/components/shelf/BookCollections.tsx` | Baru | Daftar centang koleksi |
| `src/components/shelf/FinishToggle.tsx` | Baru | Tandai (belum) selesai |
| `src/components/shelf/BookActions.tsx` | Ubah | Memuat dua komponen di atas |
| `src/routes/_member/_lobi/shelf.tsx` | Ubah | Menyatukan Rak Saya |
| `src/components/lobby/BookDetailPanel.tsx`, `ContinueSheet.tsx`, `LobbyStage.tsx` | Ubah | Meneruskan koleksi; hotspot lemari |
| `src/components/reader/ReaderView.tsx` | Ubah | `atBookEnd` |
| `src/components/reader/FinishPrompt.tsx` | Baru | Ajakan selesai |
| `src/routes/_member/read.$bookId.tsx` | Ubah | Ajakan selesai di reader |
| `src/components/lobby/scene/layout.ts` | Ubah | `SHOWCASE`, slot, hotspot `lemari`, `ShowcaseBook` |
| `src/components/lobby/scene/showcase.ts` | Baru | Lemari dan tekstur sampul |
| `src/components/lobby/scene/stage.ts` | Ubah | `setShowcase` |
| `src/components/lobby/LobbyCanvas.tsx`, `LobbyScene.tsx` | Ubah | Meneruskan `showcase` |
| `src/components/lobby/lobby-data.ts`, `LibraryMap.tsx` | Ubah | Buku selesai, hotspot dan peta |
| `src/styles.css` | Ubah | Chip koleksi, tanda peta lemari |
| `public/lobby/lobby-still*.{avif,webp}` | Dibuat ulang | `node scripts/lobby-harness.mjs still` |
| `e2e/collections.spec.ts` | Baru | E2E 3A |
| `e2e/shelf.spec.ts`, `e2e/helpers/books.ts` | Ubah | Genre lewat pilihan; `markFinished` |

---

### Task 1: Tabel koleksi, kolom selesai, dan fungsinya

**Files:**
- Create: `supabase/migrations/20261031000300_collections.sql`
- Create: `tests/db/collections.test.ts`
- Regenerate: `src/server/database.types.ts`

**Interfaces:**
- Produces (dipakai Task 2 lewat `supabase.rpc`):
  - `create_collection(p_name text) returns text` — id baru, atau `'invalid' | 'duplicate' | 'limit_reached'`
  - `rename_collection(p_id uuid, p_name text) returns text` — `'ok' | 'invalid' | 'duplicate' | 'not_found'`
  - `delete_collection(p_id uuid) returns text` — `'ok' | 'not_found'`
  - `set_book_collections(p_book_id uuid, p_collection_ids uuid[]) returns text` — `'ok' | 'not_found' | 'invalid'`
  - `set_book_finished(p_book_id uuid, p_finished boolean) returns text` — `'ok' | 'not_found'`
  - `decline_finish(p_book_id uuid) returns text` — `'ok' | 'not_found'`
  - tabel `collections (id, user_id, name, created_at)`, `collection_books (collection_id, book_id, added_at)`, kolom `books.finished_at timestamptz null`, `books.finish_declined boolean not null default false`

- [ ] **Step 1: Tulis test DB yang gagal**

Buat `tests/db/collections.test.ts`:

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
  ani: `db-coll-ani-${run}@glosa.test`,
  budi: `db-coll-budi-${run}@glosa.test`,
  cita: `db-coll-cita-${run}@glosa.test`,
}
type Client = Awaited<ReturnType<typeof signedInClient>>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

async function create(client: Client, name: string): Promise<string> {
  const { data, error } = await client.rpc("create_collection", {
    p_name: name,
  })
  if (error) throw error
  return data
}

async function membersOf(bookId: string): Promise<Array<string>> {
  const { data, error } = await adminClient()
    .from("collection_books")
    .select("collection_id")
    .eq("book_id", bookId)
  if (error) throw error
  return data.map((row) => row.collection_id).sort()
}

async function finishOf(bookId: string) {
  const { data, error } = await adminClient()
    .from("books")
    .select("finished_at, finish_declined")
    .eq("id", bookId)
    .single()
  if (error) throw error
  return data
}

describe("collections", () => {
  const ids = { ani: "", budi: "", cita: "" }
  const books = { ani: "", ani2: "", budi: "" }
  let ani: Client
  let budi: Client
  let cita: Client

  beforeAll(async () => {
    ids.ani = (await createTestMember({ email: emails.ani })).id
    ids.budi = (await createTestMember({ email: emails.budi })).id
    ids.cita = (await createTestMember({ email: emails.cita })).id
    books.ani = await newTestBook(ids.ani)
    books.ani2 = await newTestBook(ids.ani)
    books.budi = await newTestBook(ids.budi)
    ani = await signedInClient(emails.ani)
    budi = await signedInClient(emails.budi)
    cita = await signedInClient(emails.cita)
  })

  afterAll(async () => {
    await deleteTestMembers()
  })

  it("makes a collection with a trimmed name, once per name in any case", async () => {
    const id = await create(ani, "  Bacaan santai  ")
    expect(id).toMatch(UUID)
    expect(await create(ani, "BACAAN SANTAI")).toBe("duplicate")
    // Another member may use the same name.
    expect(await create(budi, "Bacaan santai")).toMatch(UUID)
    const { data } = await ani.from("collections").select("id, name")
    expect(data).toEqual([{ id, name: "Bacaan santai" }])
  })

  it("refuses an empty name and one over 40 characters", async () => {
    expect(await create(ani, "   ")).toBe("invalid")
    expect(await create(ani, "a".repeat(41))).toBe("invalid")
    expect(await create(ani, "a".repeat(40))).toMatch(UUID)
  })

  it("stops at 50 collections, also for two calls at once", async () => {
    for (let i = 0; i < 49; i++) {
      expect(await create(cita, `Koleksi ${i}`)).toMatch(UUID)
    }
    const both = await Promise.all([
      create(cita, "Terakhir A"),
      create(cita, "Terakhir B"),
    ])
    expect(both.filter((answer) => UUID.test(answer))).toHaveLength(1)
    expect(both).toContain("limit_reached")
    expect(await create(cita, "Satu lagi")).toBe("limit_reached")
  })

  it("renames and deletes only the member's own collections", async () => {
    const id = await create(ani, "Untuk tahun depan")
    await create(ani, "Klasik")
    const rename = (client: Client, name: string) =>
      client.rpc("rename_collection", { p_id: id, p_name: name })
    expect((await rename(ani, " Tahun depan ")).data).toBe("ok")
    expect((await rename(ani, "klasik")).data).toBe("duplicate")
    expect((await rename(ani, "")).data).toBe("invalid")
    expect((await rename(budi, "Punya Budi")).data).toBe("not_found")
    expect(
      (await budi.rpc("delete_collection", { p_id: id })).data
    ).toBe("not_found")
    // Budi does not see Ani's collections at all.
    const { data: seen } = await budi
      .from("collections")
      .select("id")
      .eq("id", id)
    expect(seen).toEqual([])
    expect((await ani.rpc("delete_collection", { p_id: id })).data).toBe("ok")
  })

  it("puts a book in exactly the collections asked for", async () => {
    const a = await create(ani, "Satu")
    const b = await create(ani, "Dua")
    const set = (client: Client, bookId: string, list: Array<string>) =>
      client.rpc("set_book_collections", {
        p_book_id: bookId,
        p_collection_ids: list,
      })
    expect((await set(ani, books.ani, [a, b])).data).toBe("ok")
    expect(await membersOf(books.ani)).toEqual([a, b].sort())
    expect((await set(ani, books.ani, [b])).data).toBe("ok")
    expect(await membersOf(books.ani)).toEqual([b])
    // Not Ani's book, or not Ani's collection.
    expect((await set(ani, books.budi, [b])).data).toBe("not_found")
    const theirs = await create(budi, "Milik Budi")
    expect((await set(ani, books.ani, [theirs])).data).toBe("invalid")
    expect((await set(budi, books.budi, [b])).data).toBe("invalid")
    // Members read the rows of their own collections only.
    const { data: rows } = await budi
      .from("collection_books")
      .select("book_id")
    expect(rows).toEqual([])
  })

  it("drops the rows with their collection or their book", async () => {
    const c = await create(ani, "Sementara")
    await ani.rpc("set_book_collections", {
      p_book_id: books.ani2,
      p_collection_ids: [c],
    })
    expect(await membersOf(books.ani2)).toEqual([c])
    await ani.rpc("delete_collection", { p_id: c })
    expect(await membersOf(books.ani2)).toEqual([])

    const d = await create(ani, "Sementara lagi")
    await ani.rpc("set_book_collections", {
      p_book_id: books.ani2,
      p_collection_ids: [d],
    })
    await adminClient().from("books").delete().eq("id", books.ani2)
    const { data } = await adminClient()
      .from("collection_books")
      .select("book_id")
      .eq("collection_id", d)
    expect(data).toEqual([])
  })

  it("marks a book finished once, and not finished again", async () => {
    const finish = (finished: boolean) =>
      ani.rpc("set_book_finished", {
        p_book_id: books.ani,
        p_finished: finished,
      })
    expect((await ani.rpc("decline_finish", { p_book_id: books.ani })).data).toBe(
      "ok"
    )
    expect(await finishOf(books.ani)).toMatchObject({
      finished_at: null,
      finish_declined: true,
    })
    expect((await finish(true)).data).toBe("ok")
    const first = (await finishOf(books.ani)).finished_at
    expect(first).not.toBeNull()
    expect((await finish(true)).data).toBe("ok")
    expect((await finishOf(books.ani)).finished_at).toBe(first)
    expect((await finish(false)).data).toBe("ok")
    expect(await finishOf(books.ani)).toEqual({
      finished_at: null,
      finish_declined: false,
    })
    expect(
      (
        await budi.rpc("set_book_finished", {
          p_book_id: books.ani,
          p_finished: true,
        })
      ).data
    ).toBe("not_found")
    expect(
      (await budi.rpc("decline_finish", { p_book_id: books.ani })).data
    ).toBe("not_found")
  })

  it("lets no member write the tables or the finish columns directly", async () => {
    const insert = await ani
      .from("collections")
      .insert({ user_id: ids.ani, name: "Langsung" })
    expect(insert.error).not.toBeNull()
    const update = await ani
      .from("books")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", books.ani)
    expect(update.error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm run test:db -- tests/db/collections.test.ts`
Expected: FAIL — `Could not find the function public.create_collection` (atau error tabel `collections` tidak ada).

- [ ] **Step 3: Tulis migrasi**

Buat `supabase/migrations/20261031000300_collections.sql`:

```sql
-- Collections (spec Tahap 3 §4.1, §5): lists the member makes and names, a
-- book in as many as they like. Members read their own rows; every write
-- goes through the functions below.
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

-- One name once per member, whatever its case.
create unique index collections_user_name_idx
  on public.collections (user_id, lower(name));

create table public.collection_books (
  collection_id uuid not null references public.collections (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, book_id)
);

create index collection_books_book_id_idx on public.collection_books (book_id);

alter table public.collections enable row level security;
alter table public.collection_books enable row level security;

create policy collections_select_own on public.collections
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy collection_books_select_own on public.collection_books
  for select to authenticated
  using (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = (select auth.uid())
  ));

revoke all on table public.collections from anon, authenticated;
revoke all on table public.collection_books from anon, authenticated;
grant select on table public.collections to authenticated;
grant select on table public.collection_books to authenticated;

-- Finished books (spec Tahap 3 §4.4). Outside the books update grant: only
-- set_book_finished and decline_finish write them.
alter table public.books
  add column finished_at timestamptz,
  add column finish_declined boolean not null default false;

-- Makes a collection and answers its id, or 'invalid' (empty or over 40
-- characters once trimmed), 'duplicate' (the name in any case) or
-- 'limit_reached' (50 already). The profile row is locked so two calls
-- cannot both pass the limit.
create function public.create_collection(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  perform 1 from public.profiles pr where pr.id = v_user_id for update;
  if not found then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if char_length(v_name) not between 1 and 40 then
    return 'invalid';
  end if;
  if (select count(*) from public.collections c where c.user_id = v_user_id) >= 50 then
    return 'limit_reached';
  end if;
  begin
    insert into public.collections (user_id, name)
    values (v_user_id, v_name)
    returning id into v_id;
  exception when unique_violation then
    return 'duplicate';
  end;
  return v_id::text;
end;
$$;

create function public.rename_collection(p_id uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if char_length(v_name) not between 1 and 40 then
    return 'invalid';
  end if;
  begin
    update public.collections c set name = v_name
    where c.id = p_id and c.user_id = v_user_id;
    get diagnostics v_count = row_count;
  exception when unique_violation then
    return 'duplicate';
  end;
  if v_count = 0 then
    return 'not_found';
  end if;
  return 'ok';
end;
$$;

-- The books stay; only their place in this collection goes (cascade).
create function public.delete_collection(p_id uuid)
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
  delete from public.collections c
  where c.id = p_id and c.user_id = v_user_id;
  if not found then
    return 'not_found';
  end if;
  return 'ok';
end;
$$;

-- Puts a book in exactly these collections (the checklist in its details).
-- 'not_found' for anything but the member's own ready book, 'invalid' when
-- any collection is not theirs. Memberships that stay keep their added_at.
create function public.set_book_collections(
  p_book_id uuid,
  p_collection_ids uuid[]
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_ids uuid[] := coalesce(p_collection_ids, '{}');
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  perform 1 from public.books b
  where b.id = p_book_id and b.user_id = v_user_id and b.status = 'ready';
  if not found then
    return 'not_found';
  end if;
  if exists (
    select 1 from unnest(v_ids) as wanted(id)
    where not exists (
      select 1 from public.collections c
      where c.id = wanted.id and c.user_id = v_user_id
    )
  ) then
    return 'invalid';
  end if;
  delete from public.collection_books cb
  where cb.book_id = p_book_id and not (cb.collection_id = any (v_ids));
  insert into public.collection_books (collection_id, book_id)
  select distinct wanted.id, p_book_id from unnest(v_ids) as wanted(id)
  on conflict do nothing;
  return 'ok';
end;
$$;

-- Finished keeps the first time; not finished clears it and the "Belum"
-- answer, so the reader may ask again.
create function public.set_book_finished(p_book_id uuid, p_finished boolean)
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
  update public.books b
  set
    finished_at = case when p_finished then coalesce(b.finished_at, now()) end,
    finish_declined = case when p_finished then b.finish_declined else false end
  where b.id = p_book_id and b.user_id = v_user_id and b.status = 'ready';
  if not found then
    return 'not_found';
  end if;
  return 'ok';
end;
$$;

-- "Belum" to "Sudah selesai membaca buku ini?": the reader asks no more.
create function public.decline_finish(p_book_id uuid)
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
  update public.books b set finish_declined = true
  where b.id = p_book_id and b.user_id = v_user_id and b.status = 'ready';
  if not found then
    return 'not_found';
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.create_collection(text) from public, anon;
grant execute on function public.create_collection(text) to authenticated;
revoke execute on function public.rename_collection(uuid, text) from public, anon;
grant execute on function public.rename_collection(uuid, text) to authenticated;
revoke execute on function public.delete_collection(uuid) from public, anon;
grant execute on function public.delete_collection(uuid) to authenticated;
revoke execute on function public.set_book_collections(uuid, uuid[]) from public, anon;
grant execute on function public.set_book_collections(uuid, uuid[]) to authenticated;
revoke execute on function public.set_book_finished(uuid, boolean) from public, anon;
grant execute on function public.set_book_finished(uuid, boolean) to authenticated;
revoke execute on function public.decline_finish(uuid) from public, anon;
grant execute on function public.decline_finish(uuid) to authenticated;
```

- [ ] **Step 4: Push migrasi dan buat ulang tipe**

```bash
npm run db:push
npm run db:types
npx prettier --write src/server/database.types.ts
```

Expected: `Applying migration 20261031000300_collections.sql...` lalu `Finished supabase db push.` `database.types.ts` kini memuat tabel `collections`, `collection_books`, kolom `finished_at`/`finish_declined` di `books`, dan keenam fungsi (`create_collection: { Args: { p_name: string }; Returns: string }`, …).

Kalau migrasi harus diubah setelah di-push: buang objeknya lewat CLI (`npx supabase db query --linked "drop function if exists public.create_collection(text), public.rename_collection(uuid, text), public.delete_collection(uuid), public.set_book_collections(uuid, uuid[]), public.set_book_finished(uuid, boolean), public.decline_finish(uuid); drop table if exists public.collection_books, public.collections; alter table public.books drop column if exists finished_at, drop column if exists finish_declined;"`), lalu `npx supabase migration repair --status reverted 20261031000300 --linked`, edit, dan push lagi. Kalau itu tidak berhasil, berhenti dan laporkan.

- [ ] **Step 5: Jalankan test, pastikan lolos**

Run: `npm run test:db -- tests/db/collections.test.ts`
Expected: PASS, 8 test.

- [ ] **Step 6: Typecheck dan commit**

Run: `npx tsc --noEmit` — Expected: tanpa error.

```bash
git add supabase/migrations/20261031000300_collections.sql tests/db/collections.test.ts src/server/database.types.ts
git commit -m "feat(db): collections, their books, and finished books"
```

---

### Task 2: Tipe, server function, dan data rak

**Files:**
- Modify: `src/lib/book-types.ts`, `src/lib/reader-types.ts`, `src/lib/book-messages.ts`
- Modify: `src/server/books.ts` (`listBooksFn`), `src/server/reading.ts` (`readingStateFn`)
- Create: `src/server/collections.ts`
- Modify: `src/lib/local/shelf-snapshot.ts`, `src/components/shelf/useShelfSnapshot.ts`, `src/routes/_member/_lobi.tsx`, `src/components/reader/load-reader.ts`
- Modify (fixtures/tests): `src/components/shelf/fixtures.ts`, `src/lib/shelf.test.ts`, `src/lib/local/local.test.ts`, `src/lib/shelf-loader.test.ts`, `src/components/reader/QuoteCardDialog.test.tsx`
- Test: `src/lib/local/local.test.ts`

**Interfaces:**
- Consumes: fungsi DB dari Task 1.
- Produces:
  - `type Collection = { id: string; name: string; createdAt: string }` (`@/lib/book-types`)
  - `ShelfBook` + `finishedAt: string | null`, `finishDeclined: boolean`, `collectionIds: Array<string>`
  - `ShelfData = { books; usage; collections: Array<Collection> }`
  - `ReaderBook = { id; title; author; finished: boolean; finishDeclined: boolean }`
  - `MAX_COLLECTIONS = 50`, `MAX_COLLECTION_NAME = 40` (`@/lib/book-types`)
  - Server function di `@/server/collections`:
    - `createCollectionFn({ data: { name } }) → Promise<{ ok: true; id: string } | { ok: false; code: string }>`
    - `renameCollectionFn({ data: { id, name } }) → Promise<ActionResult>`
    - `deleteCollectionFn({ data: { id } }) → Promise<ActionResult>`
    - `setBookCollectionsFn({ data: { bookId, collectionIds } }) → Promise<ActionResult>`
    - `setBookFinishedFn({ data: { bookId, finished } }) → Promise<ActionResult>`
    - `declineFinishFn({ data: { bookId } }) → Promise<ActionResult>`
  - Kode pesan `collections_full`, `collection_duplicate`, `collection_invalid`.

- [ ] **Step 1: Tulis test snapshot yang gagal**

Di `src/lib/local/local.test.ts`, ubah fixture `shelf` dan tambahkan test di dalam `describe("shelf snapshot and device owner", …)`:

```ts
const shelf: ShelfData = {
  books: [],
  usage: { usedBytes: 0, limitBytes: 104857600, plan: "free" },
  collections: [],
}
```

```ts
  it("reads a snapshot saved before collections came", async () => {
    const old = {
      books: [
        {
          id: "a",
          title: "Lama",
          author: "",
          description: null,
          language: null,
          genre: null,
          genreSource: null,
          sizeBytes: 1,
          createdAt: "2026-10-01T00:00:00+00:00",
          lastOpenedAt: null,
          coverUrl: null,
          progress: null,
        },
      ],
      usage: shelf.usage,
    } as unknown as ShelfData
    await saveShelfSnapshot("u1", old)
    const loaded = await loadShelfSnapshot("u1")
    expect(loaded?.collections).toEqual([])
    expect(loaded?.books[0]).toMatchObject({
      finishedAt: null,
      finishDeclined: false,
      collectionIds: [],
    })
  })
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/local/local.test.ts`
Expected: FAIL — `expected undefined to deeply equal []`.

- [ ] **Step 3: Tipe**

Di `src/lib/book-types.ts`, tambahkan ke `ShelfBook` (setelah `progress`):

```ts
  /** When the member said they finished it (spec Tahap 3 §4.4), or null. */
  finishedAt: string | null
  /** The member answered "Belum" when the reader asked: it asks no more. */
  finishDeclined: boolean
  /** The member's collections this book is in. */
  collectionIds: Array<string>
```

dan ganti `ShelfData`, lalu tambahkan `Collection` dan batasnya:

```ts
/** A collection the member made (spec Tahap 3 §4.1). */
export type Collection = { id: string; name: string; createdAt: string }

/** Collections per member, and the length of a name once trimmed (spec Tahap 3 §4.1). */
export const MAX_COLLECTIONS = 50
export const MAX_COLLECTION_NAME = 40

export type ShelfData = {
  books: Array<ShelfBook>
  usage: StorageUsage
  collections: Array<Collection>
}
```

Di `src/lib/reader-types.ts`, ganti `ReaderBook`:

```ts
export type ReaderBook = {
  id: string
  title: string
  author: string
  /** Finished, or answered "Belum": either way the reader does not ask (spec Tahap 3 §4.4). */
  finished: boolean
  finishDeclined: boolean
}
```

- [ ] **Step 4: Snapshot lama tetap terbaca**

Ganti `loadShelfSnapshot` di `src/lib/local/shelf-snapshot.ts`:

```ts
/**
 * The last shelf this member saw online; another member's snapshot is never
 * returned. One saved before collections came (Tahap 3A) reads as having none.
 */
export async function loadShelfSnapshot(
  userId: string
): Promise<ShelfData | null> {
  const row = await localDb().meta.get(SNAPSHOT_KEY)
  const snapshot = row?.value as Snapshot | undefined
  if (snapshot?.userId !== userId) return null
  const { data } = snapshot
  return {
    ...data,
    books: data.books.map((book) => ({
      ...book,
      finishedAt: book.finishedAt ?? null,
      finishDeclined: book.finishDeclined ?? false,
      collectionIds: book.collectionIds ?? [],
    })),
    collections: data.collections ?? [],
  }
}
```

Ganti `src/components/shelf/useShelfSnapshot.ts` seluruhnya:

```ts
import { useEffect } from "react"
import type {
  Collection,
  ShelfBook,
  StorageUsage,
} from "@/lib/book-types"
import { saveShelfSnapshot } from "@/lib/local/shelf-snapshot"

/** What the shelf looked like online is what offline visits show (plan 1C, decision 2). */
export function useShelfSnapshot(
  userId: string,
  books: Array<ShelfBook>,
  usage: StorageUsage,
  collections: Array<Collection>,
  offline: boolean
): void {
  useEffect(() => {
    if (offline) return
    saveShelfSnapshot(userId, { books, usage, collections }).catch(
      (error: unknown) =>
        console.error("saving the shelf snapshot failed", error)
    )
  }, [books, usage, collections, offline, userId])
}
```

Di `src/routes/_member/_lobi.tsx`, ganti dua baris di `LobiLayout`:

```tsx
  const { books, usage, collections, offline } = Route.useLoaderData()
```

```tsx
  useShelfSnapshot(user.id, books, usage, collections, offline)
```

dan teruskan ke `LobbyStage` (prop baru diterima di Task 5):

```tsx
      <LobbyStage
        user={user}
        books={books}
        usage={usage}
        collections={collections}
        offline={offline}
        popup={popup}
      />
```

Sampai Task 5, TypeScript akan menolak prop `collections` di `LobbyStage`. Supaya Task 2 tetap hijau, tambahkan sekarang prop itu di tanda tangan `LobbyStage` (`src/components/lobby/LobbyStage.tsx`), tanpa dipakai dulu:

```tsx
export function LobbyStage({
  user,
  books,
  usage,
  collections,
  offline,
  popup,
}: {
  user: SessionUser
  books: Array<ShelfBook>
  usage: StorageUsage
  /** The member's collections, for the book details' checklist. */
  collections: Array<Collection>
  offline: boolean
  /** Rak Saya or Pengaturan is open over the lobby. */
  popup: boolean
}) {
```

dengan import `import type { Collection, ShelfBook, StorageUsage } from "@/lib/book-types"` (menggantikan import `ShelfBook, StorageUsage` yang ada). Di `src/components/lobby/LobbyStage.test.tsx`, tambahkan `collections={[]}` di setiap `<LobbyStage …>`.

- [ ] **Step 5: Server — rak dan reader**

Di `src/server/books.ts` (`listBooksFn`), ganti `Promise.all` dan bentuk hasilnya:

```ts
    const [booksResult, profileResult, collectionsResult] = await Promise.all([
      supabase
        .from("books")
        .select(
          "id, title, author, description, language, genre, genre_source, size_bytes, status, created_at, last_opened_at, cover_path, finished_at, finish_declined, reading_progress(percentage), collection_books(collection_id)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("plan, storage_limit_bytes")
        .eq("id", user.id)
        .single(),
      supabase
        .from("collections")
        .select("id, name, created_at")
        .order("created_at", { ascending: true }),
    ])
    if (booksResult.error) throw booksResult.error
    if (profileResult.error) throw profileResult.error
    if (collectionsResult.error) throw collectionsResult.error
```

Di peta `ready.map((row) => ({ … }))`, tambahkan setelah `progress`:

```ts
        finishedAt: row.finished_at,
        finishDeclined: row.finish_declined,
        // RLS returns only the rows of this member's collections.
        collectionIds: row.collection_books.map(
          (membership) => membership.collection_id
        ),
```

dan tambahkan ke objek hasil, setelah `usage: { … }`:

```ts
      collections: collectionsResult.data.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
      })),
```

Di `src/server/reading.ts` (`readingStateFn`), ubah select buku menjadi `.select("id, title, author, finished_at, finish_declined")` dan ganti `book: bookResult.data,` dengan:

```ts
      book: {
        id: bookResult.data.id,
        title: bookResult.data.title,
        author: bookResult.data.author,
        finished: bookResult.data.finished_at !== null,
        finishDeclined: bookResult.data.finish_declined,
      },
```

Di `src/components/reader/load-reader.ts`, ganti `offlineBook`:

```ts
async function offlineBook(
  bookId: string,
  userId: string
): Promise<ReaderBook> {
  const shelf = await loadShelfSnapshot(userId)
  const entry = shelf?.books.find((candidate) => candidate.id === bookId)
  return entry
    ? {
        id: entry.id,
        title: entry.title,
        author: entry.author,
        finished: entry.finishedAt !== null,
        finishDeclined: entry.finishDeclined,
      }
    : {
        id: bookId,
        title: "Buku",
        author: "",
        finished: false,
        finishDeclined: false,
      }
}
```

- [ ] **Step 6: Server function koleksi**

Buat `src/server/collections.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { ActionResult } from "@/lib/action-result"
import { MAX_COLLECTIONS, MAX_COLLECTION_NAME } from "@/lib/book-types"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The database's answers (spec Tahap 3 §5), as codes bookMessage knows. */
const CODES: Record<string, string> = {
  limit_reached: "collections_full",
  duplicate: "collection_duplicate",
  invalid: "collection_invalid",
  not_found: "not_found",
}

const NameSchema = z.string().trim().min(1).max(MAX_COLLECTION_NAME)
const BookIdSchema = z.object({ bookId: z.uuid() })

/** The member's client, or null when the session is gone. */
async function memberClient() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? supabase : null
}

function answerOf(
  answer: string | null,
  error: unknown,
  what: string
): ActionResult {
  if (error) {
    logServerError(`${what} failed`, error)
    return fail("unknown")
  }
  if (answer === "ok") return { ok: true }
  return fail(CODES[answer ?? ""] ?? "unknown")
}

export const createCollectionFn = createServerFn({ method: "POST" })
  .validator((data: { name: string }) =>
    z.object({ name: NameSchema }).parse(data)
  )
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; id: string } | { ok: false; code: string }> => {
      const supabase = await memberClient()
      if (!supabase) return fail("not_authenticated")
      const { data: answer, error } = await supabase.rpc("create_collection", {
        p_name: data.name,
      })
      if (!error && UUID.test(answer ?? "")) return { ok: true, id: answer }
      const result = answerOf(answer, error, "creating a collection")
      return result.ok ? fail("unknown") : result
    }
  )

export const renameCollectionFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; name: string }) =>
    z.object({ id: z.uuid(), name: NameSchema }).parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("rename_collection", {
      p_id: data.id,
      p_name: data.name,
    })
    return answerOf(answer, error, "renaming a collection")
  })

export const deleteCollectionFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) =>
    z.object({ id: z.uuid() }).parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("delete_collection", {
      p_id: data.id,
    })
    return answerOf(answer, error, "deleting a collection")
  })

export const setBookCollectionsFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string; collectionIds: Array<string> }) =>
    z
      .object({
        bookId: z.uuid(),
        collectionIds: z.array(z.uuid()).max(MAX_COLLECTIONS),
      })
      .parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc(
      "set_book_collections",
      { p_book_id: data.bookId, p_collection_ids: data.collectionIds }
    )
    return answerOf(answer, error, "saving a book's collections")
  })

export const setBookFinishedFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string; finished: boolean }) =>
    z.object({ bookId: z.uuid(), finished: z.boolean() }).parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("set_book_finished", {
      p_book_id: data.bookId,
      p_finished: data.finished,
    })
    return answerOf(answer, error, "marking a book finished")
  })

export const declineFinishFn = createServerFn({ method: "POST" })
  .validator((data: { bookId: string }) => BookIdSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = await memberClient()
    if (!supabase) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("decline_finish", {
      p_book_id: data.bookId,
    })
    return answerOf(answer, error, "declining to finish a book")
  })
```

Di `src/lib/book-messages.ts`, tambahkan ke `MESSAGES` (sebelum `position_missing`):

```ts
  collections_full:
    "Koleksi sudah penuh (50). Hapus koleksi lain dulu untuk membuat yang baru.",
  collection_duplicate: "Sudah ada koleksi dengan nama itu.",
  collection_invalid: "Nama koleksi harus 1–40 karakter.",
```

- [ ] **Step 7: Fixture dan literal di test**

Tambahkan field baru ke setiap `ShelfBook` buatan tangan:
- `src/components/shelf/fixtures.ts` (`sherlock`): `finishedAt: null, finishDeclined: false, collectionIds: [],`
- `src/lib/shelf.test.ts` (fungsi `book`): `finishedAt: null, finishDeclined: false, collectionIds: [],` sebelum `...overrides`

Tambahkan `collections: []` ke `ShelfData` buatan tangan di `src/lib/shelf-loader.test.ts` (objek dengan `usage: { usedBytes: 0, … }`).

Di `src/components/reader/QuoteCardDialog.test.tsx`, tambahkan `finished: false, finishDeclined: false,` ke objek `book` (baris `const book = { id: …, title: "A Scandal in Bohemia", author: … }`).

- [ ] **Step 8: Jalankan test dan typecheck**

Run: `npx vitest run src/lib src/components/shelf src/components/reader src/components/lobby`
Expected: PASS, termasuk "reads a snapshot saved before collections came".

Run: `npx tsc --noEmit`
Expected: tanpa error. Kalau TypeScript masih menunjuk literal `ShelfBook`, `ShelfData`, atau `ReaderBook` lain yang tidak disebut di Step 7, tambahkan field yang sama di sana.

- [ ] **Step 9: Commit**

```bash
git add src/lib src/server src/components src/routes
git commit -m "feat(shelf): collections and finished books come with the shelf and the reader"
```

---

### Task 3: Logika rak — koleksi, urutan, dan ajakan selesai

**Files:**
- Modify: `src/lib/shelf.ts`
- Create: `src/lib/finish.ts`
- Test: `src/lib/shelf.test.ts`, `src/lib/finish.test.ts`

**Interfaces:**
- Consumes: `ShelfBook`, `Collection` (Task 2).
- Produces (`@/lib/shelf`):
  - `type ShelfSort = "opened" | "title" | "added" | "finished"`
  - `ShelfSearch` + `koleksi?: string`; `sort?: ShelfSort`
  - `COLLECTION_LABELS: Record<"sedang" | "selesai", string>`
  - `isShelfSort(value: unknown): value is ShelfSort`
  - `activeCollection(koleksi: string | undefined, collections: ReadonlyArray<Collection>): string | undefined`
  - `defaultSort(koleksi: string | undefined): ShelfSort`
  - `countCollections(books: ReadonlyArray<ShelfBook>, collections: ReadonlyArray<Collection>): Record<string, number>` — kunci `semua`, `sedang`, `selesai`, dan id setiap koleksi
  - `shelfBooks(books, search)` kini juga memfilter `search.koleksi` (yang sudah lewat `activeCollection`)
- Produces (`@/lib/finish`): `FINISH_FRACTION = 0.95`; `shouldAskFinish(book: { finished: boolean; finishDeclined: boolean }, place: { fraction: number; atBookEnd: boolean }): boolean`

- [ ] **Step 1: Tulis test yang gagal**

Di `src/lib/shelf.test.ts`, ubah import:

```ts
import type { Collection, ShelfBook } from "./book-types"
import {
  activeCollection,
  countBooks,
  countCollections,
  defaultSort,
  parseShelfSearch,
  shelfBooks,
} from "./shelf"
```

Ganti ekspektasi ketiga di "keeps valid values and drops the rest" (urutan `opened` kini sah, keputusan 5):

```ts
    expect(
      parseShelfSearch({ genre: "horor", q: "   ", sort: "opened" })
    ).toEqual({ sort: "opened" })
```

Tambahkan di akhir file:

```ts
const santai: Collection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Bacaan santai",
  createdAt: "2026-10-20T00:00:00+00:00",
}

const shelved = [
  book({
    title: "Sedang",
    progress: 40,
    lastOpenedAt: "2026-10-12T00:00:00+00:00",
  }),
  book({ title: "Belum dibuka" }),
  book({
    title: "Selesai lama",
    progress: 100,
    finishedAt: "2026-10-05T00:00:00+00:00",
    lastOpenedAt: "2026-10-20T00:00:00+00:00",
    collectionIds: [santai.id],
  }),
  book({
    title: "Selesai baru",
    progress: 90,
    genre: "misteri_thriller",
    finishedAt: "2026-10-15T00:00:00+00:00",
    collectionIds: [santai.id],
  }),
]

describe("collections on the shelf", () => {
  it("keeps the automatic collections and ids, and drops anything else", () => {
    expect(parseShelfSearch({ koleksi: "selesai" })).toEqual({
      koleksi: "selesai",
    })
    expect(parseShelfSearch({ koleksi: santai.id })).toEqual({
      koleksi: santai.id,
    })
    expect(parseShelfSearch({ koleksi: "favorit" })).toEqual({})
    expect(parseShelfSearch({ sort: "finished" })).toEqual({
      sort: "finished",
    })
  })

  it("falls back to Semua for a collection that is gone", () => {
    expect(activeCollection(santai.id, [santai])).toBe(santai.id)
    expect(activeCollection(santai.id, [])).toBeUndefined()
    expect(activeCollection("sedang", [])).toBe("sedang")
    expect(activeCollection(undefined, [santai])).toBeUndefined()
  })

  it("lists what is being read: started and not finished", () => {
    expect(titles(shelfBooks(shelved, { koleksi: "sedang" }))).toEqual([
      "Sedang",
    ])
  })

  it("lists finished books, last finished first by default", () => {
    expect(defaultSort("selesai")).toBe("finished")
    expect(defaultSort(undefined)).toBe("opened")
    expect(
      titles(
        shelfBooks(shelved, {
          koleksi: "selesai",
          sort: defaultSort("selesai"),
        })
      )
    ).toEqual(["Selesai baru", "Selesai lama"])
    // The member's own choice wins.
    expect(
      titles(shelfBooks(shelved, { koleksi: "selesai", sort: "opened" }))
    ).toEqual(["Selesai lama", "Selesai baru"])
  })

  it("filters a member's collection, together with a genre", () => {
    expect(titles(shelfBooks(shelved, { koleksi: santai.id }))).toEqual([
      "Selesai lama",
      "Selesai baru",
    ])
    expect(
      titles(
        shelfBooks(shelved, { koleksi: santai.id, genre: "misteri_thriller" })
      )
    ).toEqual(["Selesai baru"])
  })

  it("counts every collection, the empty ones too", () => {
    const empty: Collection = { ...santai, id: "kosong", name: "Kosong" }
    expect(countCollections(shelved, [santai, empty])).toEqual({
      semua: 4,
      sedang: 1,
      selesai: 2,
      [santai.id]: 2,
      kosong: 0,
    })
  })
})
```

Buat `src/lib/finish.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { shouldAskFinish } from "./finish"

const open = { finished: false, finishDeclined: false }

describe("shouldAskFinish", () => {
  it("asks at the end of the book or from 95%", () => {
    expect(shouldAskFinish(open, { fraction: 0.5, atBookEnd: true })).toBe(
      true
    )
    expect(shouldAskFinish(open, { fraction: 0.95, atBookEnd: false })).toBe(
      true
    )
    expect(shouldAskFinish(open, { fraction: 0.94, atBookEnd: false })).toBe(
      false
    )
  })

  it("does not ask about a finished book, or after Belum", () => {
    const end = { fraction: 1, atBookEnd: true }
    expect(shouldAskFinish({ ...open, finished: true }, end)).toBe(false)
    expect(shouldAskFinish({ ...open, finishDeclined: true }, end)).toBe(false)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/shelf.test.ts src/lib/finish.test.ts`
Expected: FAIL — `activeCollection is not a function` dan `Cannot find module './finish'`.

- [ ] **Step 3: Implementasi `shelf.ts`**

Di `src/lib/shelf.ts`, ganti import `ShelfBook` menjadi `import type { Collection, ShelfBook } from "./book-types"`, lalu ganti tipe dan konstanta di bagian atas:

```ts
export type ShelfFilter = "semua" | Genre | "troli"
export type ShelfSort = "opened" | "title" | "added" | "finished"
/** /shelf search params. Defaults ("semua", the collection's own order) stay out of the URL. */
export type ShelfSearch = {
  genre?: Genre | "troli"
  /** "sedang", "selesai" or the id of one of the member's collections (spec Tahap 3 §4.3). */
  koleksi?: string
  q?: string
  sort?: ShelfSort
}

export const MAX_QUERY_LENGTH = 100

/** The automatic collections (spec Tahap 3 §4.2). */
export const COLLECTION_LABELS = {
  sedang: "Sedang dibaca",
  selesai: "Sudah dibaca",
} as const

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
```

Tambahkan opsi urutan baru di akhir `SHELF_SORTS`:

```ts
  { value: "finished", label: "Terakhir selesai" },
```

Ganti `parseShelfSearch`:

```ts
export function isShelfSort(value: unknown): value is ShelfSort {
  return SHELF_SORTS.some((sort) => sort.value === value)
}

export function parseShelfSearch(search: Record<string, unknown>): ShelfSearch {
  const result: ShelfSearch = {}
  const { genre, koleksi, q, sort } = search
  if (genre === "troli" || isGenre(genre)) result.genre = genre
  if (
    koleksi === "sedang" ||
    koleksi === "selesai" ||
    (typeof koleksi === "string" && UUID.test(koleksi))
  )
    result.koleksi = koleksi
  if (typeof q === "string" && q.trim())
    result.q = q.trim().slice(0, MAX_QUERY_LENGTH)
  if (isShelfSort(sort)) result.sort = sort
  return result
}

/** The collection asked for while it still exists; anything else is Semua (spec Tahap 3 §4.3). */
export function activeCollection(
  koleksi: string | undefined,
  collections: ReadonlyArray<Collection>
): string | undefined {
  if (koleksi === "sedang" || koleksi === "selesai") return koleksi
  return collections.some((collection) => collection.id === koleksi)
    ? koleksi
    : undefined
}

/** Sudah dibaca lists the last finished first; everything else, the last opened. */
export function defaultSort(koleksi: string | undefined): ShelfSort {
  return koleksi === "selesai" ? "finished" : "opened"
}
```

Tambahkan setelah `matches`:

```ts
/** "Sedang dibaca" goes by the server's progress, the same on every device (plan 3A, decision 4). */
function inCollection(book: ShelfBook, koleksi: string | undefined): boolean {
  if (!koleksi) return true
  if (koleksi === "sedang")
    return (book.progress ?? 0) > 0 && book.finishedAt === null
  if (koleksi === "selesai") return book.finishedAt !== null
  return book.collectionIds.includes(koleksi)
}
```

Ganti `comparator` dan `shelfBooks`:

```ts
const byOpened = (a: ShelfBook, b: ShelfBook) =>
  (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? "") ||
  b.createdAt.localeCompare(a.createdAt)

function comparator(sort: ShelfSort): (a: ShelfBook, b: ShelfBook) => number {
  if (sort === "title") return (a, b) => titleOrder.compare(a.title, b.title)
  if (sort === "added") return (a, b) => b.createdAt.localeCompare(a.createdAt)
  if (sort === "finished")
    return (a, b) =>
      (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "") || byOpened(a, b)
  // Last opened first; books never opened follow, newest first.
  return byOpened
}

/** `search.koleksi` must have been through activeCollection. */
export function shelfBooks(
  books: ReadonlyArray<ShelfBook>,
  search: ShelfSearch
): Array<ShelfBook> {
  const filter = search.genre ?? "semua"
  const query = fold(search.q ?? "")
  return books
    .filter(
      (book) =>
        matches(book, filter) &&
        inCollection(book, search.koleksi) &&
        (!query || fold(`${book.title} ${book.author}`).includes(query))
    )
    .sort(comparator(search.sort ?? defaultSort(search.koleksi)))
}
```

Tambahkan di akhir file:

```ts
export function countCollections(
  books: ReadonlyArray<ShelfBook>,
  collections: ReadonlyArray<Collection>
): Record<string, number> {
  const counts: Record<string, number> = { semua: 0, sedang: 0, selesai: 0 }
  for (const collection of collections) counts[collection.id] = 0
  for (const book of books) {
    counts.semua += 1
    if (inCollection(book, "sedang")) counts.sedang += 1
    if (inCollection(book, "selesai")) counts.selesai += 1
    for (const id of book.collectionIds) {
      if (id in counts) counts[id] += 1
    }
  }
  return counts
}
```

- [ ] **Step 4: Implementasi `finish.ts`**

Buat `src/lib/finish.ts`:

```ts
/** From here on the reader asks whether the book is finished (spec Tahap 3 §4.4). */
export const FINISH_FRACTION = 0.95

/**
 * Whether the reader asks "Sudah selesai membaca buku ini?": once the member
 * reaches the end of the last section in the reading order, or 95% of the
 * book, unless the book is finished or the member already said "Belum".
 */
export function shouldAskFinish(
  book: { finished: boolean; finishDeclined: boolean },
  place: { fraction: number; atBookEnd: boolean }
): boolean {
  if (book.finished || book.finishDeclined) return false
  return place.atBookEnd || place.fraction >= FINISH_FRACTION
}
```

- [ ] **Step 5: Jalankan test, pastikan lolos**

Run: `npx vitest run src/lib/shelf.test.ts src/lib/finish.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shelf.ts src/lib/shelf.test.ts src/lib/finish.ts src/lib/finish.test.ts
git commit -m "feat(shelf): filter and order by collection, and know when to ask about finishing"
```

---

### Task 4: Rak Saya — chip koleksi, dialog koleksi, dan pilihan genre

**Files:**
- Create: `src/components/shelf/CollectionBar.tsx` (+ `CollectionBar.test.tsx`)
- Create: `src/components/shelf/CollectionDialog.tsx` (+ `CollectionDialog.test.tsx`)
- Create: `src/components/shelf/GenreSelect.tsx` (+ `GenreSelect.test.tsx`)
- Delete: `src/components/shelf/GenreFilter.tsx`, `src/components/shelf/GenreFilter.test.tsx`
- Modify: `src/components/shelf/ShelfToolbar.tsx` (+ test), `src/routes/_member/_lobi/shelf.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `COLLECTION_LABELS`, `activeCollection`, `countCollections`, `defaultSort`, `isShelfSort`, `SHELF_FILTERS`, `countBooks` (Task 3); `createCollectionFn`, `renameCollectionFn`, `deleteCollectionFn` (Task 2); `Collection`, `MAX_COLLECTION_NAME` (Task 2).
- Produces:
  - `CollectionBar({ active: string | undefined; collections: ReadonlyArray<Collection>; counts: Record<string, number>; canEdit: boolean; onCreate: () => void; onEdit: (collection: Collection) => void })`
  - `CollectionDialog({ open: boolean; editing: Collection | null; onOpenChange: (open: boolean) => void; onDone: (done: { notice: string; koleksi?: string | null }) => void })` — `koleksi: string` membuka koleksi itu, `null` kembali ke Semua, `undefined` tetap di tempat
  - `GenreSelect({ value: ShelfFilter; counts: Record<ShelfFilter, number> })`
  - `ShelfToolbar({ q, sort, defaultSort, children })`

- [ ] **Step 1: Tulis test komponen yang gagal**

Buat `src/components/shelf/CollectionBar.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { describe, expect, it, vi } from "vitest"
import type { Collection } from "@/lib/book-types"
import { CollectionBar } from "./CollectionBar"

const santai: Collection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Bacaan santai",
  createdAt: "2026-10-20T00:00:00+00:00",
}
const counts = { semua: 3, sedang: 1, selesai: 0, [santai.id]: 2 }

async function renderBar(
  active: string | undefined,
  canEdit = true,
  handlers = { onCreate: vi.fn(), onEdit: vi.fn() }
) {
  const rootRoute = createRootRoute()
  const shelfRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/shelf",
    validateSearch: (s: Record<string, unknown>) => ({
      koleksi: typeof s.koleksi === "string" ? s.koleksi : undefined,
    }),
    component: () => (
      <CollectionBar
        active={active}
        collections={[santai]}
        counts={counts}
        canEdit={canEdit}
        {...handlers}
      />
    ),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([shelfRoute]),
    history: createMemoryHistory({ initialEntries: ["/shelf"] }),
  })
  render(<RouterProvider router={router} />)
  await screen.findByRole("navigation", { name: "Koleksi" })
  return handlers
}

describe("CollectionBar", () => {
  it("lists Semua, the automatic collections and the member's, with counts", async () => {
    await renderBar(undefined)
    const links = screen.getAllByRole("link")
    expect(links.map((link) => link.textContent)).toEqual([
      "Semua · 3",
      "Sedang dibaca · 1",
      "Sudah dibaca · 0",
      "Bacaan santai · 2",
    ])
    expect(links[0]).toHaveAttribute("aria-current", "page")
    expect(links[3]).toHaveAttribute(
      "href",
      `/shelf?koleksi=${santai.id}`
    )
  })

  it("offers to edit the member's collection that is open", async () => {
    const { onEdit } = await renderBar(santai.id)
    fireEvent.click(
      screen.getByRole("button", { name: "Ubah koleksi Bacaan santai" })
    )
    expect(onEdit).toHaveBeenCalledWith(santai)
  })

  it("has no edit button on an automatic collection", async () => {
    await renderBar("selesai")
    expect(screen.queryByRole("button", { name: /Ubah koleksi/ })).toBeNull()
  })

  it("makes a new collection only online", async () => {
    const { onCreate } = await renderBar(undefined)
    fireEvent.click(screen.getByRole("button", { name: "+ Koleksi baru" }))
    expect(onCreate).toHaveBeenCalledOnce()
  })

  it("turns making off offline", async () => {
    await renderBar(undefined, false)
    expect(
      screen.getByRole("button", { name: "+ Koleksi baru" })
    ).toBeDisabled()
  })
})
```

Buat `src/components/shelf/CollectionDialog.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Collection } from "@/lib/book-types"
import { CollectionDialog } from "./CollectionDialog"

const mocks = vi.hoisted(() => ({
  createCollectionFn: vi.fn(),
  renameCollectionFn: vi.fn(),
  deleteCollectionFn: vi.fn(),
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/collections", () => mocks)

const santai: Collection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Bacaan santai",
  createdAt: "2026-10-20T00:00:00+00:00",
}

afterEach(() => {
  vi.clearAllMocks()
})

function renderDialog(editing: Collection | null) {
  const onDone = vi.fn()
  render(
    <CollectionDialog
      open
      editing={editing}
      onOpenChange={vi.fn()}
      onDone={onDone}
    />
  )
  return onDone
}

describe("CollectionDialog", () => {
  it("makes a collection and opens it", async () => {
    mocks.createCollectionFn.mockResolvedValueOnce({ ok: true, id: santai.id })
    const onDone = renderDialog(null)
    fireEvent.change(screen.getByLabelText("Nama koleksi"), {
      target: { value: "  Bacaan santai " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Buat" }))
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({
        notice: "Koleksi “Bacaan santai” dibuat.",
        koleksi: santai.id,
      })
    )
    expect(mocks.createCollectionFn).toHaveBeenCalledWith({
      data: { name: "Bacaan santai" },
    })
  })

  it("says why a name is refused", async () => {
    mocks.createCollectionFn.mockResolvedValueOnce({
      ok: false,
      code: "collection_duplicate",
    })
    const onDone = renderDialog(null)
    fireEvent.change(screen.getByLabelText("Nama koleksi"), {
      target: { value: "Bacaan santai" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Buat" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sudah ada koleksi dengan nama itu."
    )
    expect(onDone).not.toHaveBeenCalled()
  })

  it("does not send an empty name", () => {
    renderDialog(null)
    fireEvent.click(screen.getByRole("button", { name: "Buat" }))
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nama koleksi harus 1–40 karakter."
    )
    expect(mocks.createCollectionFn).not.toHaveBeenCalled()
  })

  it("renames a collection", async () => {
    mocks.renameCollectionFn.mockResolvedValueOnce({ ok: true })
    const onDone = renderDialog(santai)
    const input = screen.getByLabelText("Nama koleksi")
    expect(input).toHaveValue("Bacaan santai")
    fireEvent.change(input, { target: { value: "Santai" } })
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }))
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({ notice: "Nama koleksi diganti." })
    )
  })

  it("deletes a collection after asking, and goes back to Semua", async () => {
    mocks.deleteCollectionFn.mockResolvedValueOnce({ ok: true })
    const onDone = renderDialog(santai)
    fireEvent.click(screen.getByRole("button", { name: "Hapus koleksi" }))
    expect(
      screen.getByText("Hapus koleksi “Bacaan santai”? Bukunya tetap di rak.")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ya, hapus" }))
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({
        notice: "Koleksi “Bacaan santai” dihapus.",
        koleksi: null,
      })
    )
  })
})
```

Buat `src/components/shelf/GenreSelect.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SHELF_FILTERS, type ShelfFilter } from "@/lib/shelf"
import { GenreSelect } from "./GenreSelect"

const navigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))

const counts = Object.fromEntries(
  SHELF_FILTERS.map(({ value }) => [value, 2])
) as Record<ShelfFilter, number>

describe("GenreSelect", () => {
  beforeEach(() => navigate.mockReset())

  it("lists every genre and the trolley with their counts", () => {
    render(<GenreSelect value="semua" counts={counts} />)
    const select = screen.getByLabelText("Tampilkan genre")
    expect(select).toHaveValue("semua")
    expect(
      screen.getByRole("option", { name: "Misteri & Thriller · 2" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Troli Buku Baru · 2" })
    ).toBeInTheDocument()
  })

  it("puts the genre in the URL, and takes Semua out of it", () => {
    render(<GenreSelect value="semua" counts={counts} />)
    const select = screen.getByLabelText("Tampilkan genre")
    fireEvent.change(select, { target: { value: "troli" } })
    const first = navigate.mock.calls[0][0] as {
      search: (prev: object) => object
    }
    expect(first.search({ q: "a" })).toEqual({ q: "a", genre: "troli" })
    fireEvent.change(select, { target: { value: "semua" } })
    const second = navigate.mock.calls[1][0] as {
      search: (prev: object) => object
    }
    expect(second.search({ genre: "troli" })).toEqual({ genre: undefined })
  })
})
```

Di `src/components/shelf/ShelfToolbar.test.tsx`, ganti dua `render(<ShelfToolbar … />)` dan satu `rerender(...)` sehingga ikut mengirim `defaultSort="opened"`, lalu tambahkan test urutan:

```tsx
    const { rerender } = render(
      <ShelfToolbar q="alice" sort="opened" defaultSort="opened" />
    )
```

```tsx
    rerender(<ShelfToolbar q="bob" sort="opened" defaultSort="opened" />)
```

```tsx
    render(<ShelfToolbar q="" sort="opened" defaultSort="opened" />)
```

```tsx
  it("keeps the collection's own order out of the URL", () => {
    render(<ShelfToolbar q="" sort="finished" defaultSort="finished" />)
    const select = screen.getByLabelText("Urutkan")
    fireEvent.change(select, { target: { value: "opened" } })
    const first = navigate.mock.calls[0][0] as {
      search: (prev: object) => object
    }
    expect(first.search({})).toEqual({ sort: "opened" })
    fireEvent.change(select, { target: { value: "finished" } })
    const second = navigate.mock.calls[1][0] as {
      search: (prev: object) => object
    }
    expect(second.search({ sort: "opened" })).toEqual({ sort: undefined })
  })
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/shelf`
Expected: FAIL — modul `./CollectionBar`, `./CollectionDialog`, `./GenreSelect` tidak ada; test ShelfToolbar baru gagal.

- [ ] **Step 3: `CollectionBar`**

Buat `src/components/shelf/CollectionBar.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { PencilIcon } from "lucide-react"
import type { Collection } from "@/lib/book-types"
import { COLLECTION_LABELS } from "@/lib/shelf"
import { cn } from "@/lib/utils"

/**
 * Rak Saya's main row (spec Tahap 3 §4.3): Semua, the automatic collections,
 * the member's own in the order they were made, and the way to make one.
 */
export function CollectionBar({
  active,
  collections,
  counts,
  canEdit,
  onCreate,
  onEdit,
}: {
  /** The collection shown, after activeCollection; undefined is Semua. */
  active: string | undefined
  collections: ReadonlyArray<Collection>
  counts: Record<string, number>
  /** Online: collections can be made and changed. */
  canEdit: boolean
  onCreate: () => void
  onEdit: (collection: Collection) => void
}) {
  const chips: Array<{ value: string | undefined; label: string }> = [
    { value: undefined, label: "Semua" },
    { value: "sedang", label: COLLECTION_LABELS.sedang },
    { value: "selesai", label: COLLECTION_LABELS.selesai },
    ...collections.map(({ id, name }) => ({ value: id, label: name })),
  ]
  const editable = collections.find((collection) => collection.id === active)
  return (
    <nav aria-label="Koleksi" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex items-center gap-2 pb-1">
        {chips.map(({ value, label }) => {
          const count = counts[value ?? "semua"] ?? 0
          return (
            <li key={value ?? "semua"} className="shrink-0">
              <Link
                to="/shelf"
                search={(prev) => ({ ...prev, koleksi: value })}
                activeOptions={{ explicitUndefined: true }}
                aria-current={active === value ? "page" : undefined}
                className={cn(
                  "genre-chip",
                  count === 0 && active !== value && "opacity-60"
                )}
              >
                {label} <span className="tabular-nums">· {count}</span>
              </Link>
            </li>
          )
        })}
        {editable && (
          <li className="shrink-0">
            <button
              type="button"
              className="collection-edit"
              aria-label={`Ubah koleksi ${editable.name}`}
              disabled={!canEdit}
              onClick={() => onEdit(editable)}
            >
              <PencilIcon aria-hidden="true" />
            </button>
          </li>
        )}
        <li className="shrink-0">
          <button
            type="button"
            className="genre-chip collection-new"
            disabled={!canEdit}
            onClick={onCreate}
          >
            + Koleksi baru
          </button>
        </li>
      </ul>
    </nav>
  )
}
```

- [ ] **Step 4: `CollectionDialog`**

Buat `src/components/shelf/CollectionDialog.tsx`:

```tsx
import { useServerFn } from "@tanstack/react-start"
import { type FormEvent, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { bookMessage } from "@/lib/book-messages"
import { type Collection, MAX_COLLECTION_NAME } from "@/lib/book-types"
import {
  createCollectionFn,
  deleteCollectionFn,
  renameCollectionFn,
} from "@/server/collections"

export type CollectionDone = {
  notice: string
  /** A collection to open; null goes back to Semua; undefined stays. */
  koleksi?: string | null
}

/** Makes a collection, or renames or deletes one (spec Tahap 3 §4.1). */
export function CollectionDialog({
  open,
  editing,
  onOpenChange,
  onDone,
}: {
  open: boolean
  /** null makes a new collection. */
  editing: Collection | null
  onOpenChange: (open: boolean) => void
  onDone: (done: CollectionDone) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent className="sm:max-w-md">
          <CollectionForm
            key={editing?.id ?? "new"}
            editing={editing}
            onDone={onDone}
          />
        </DialogContent>
      )}
    </Dialog>
  )
}

function CollectionForm({
  editing,
  onDone,
}: {
  editing: Collection | null
  onDone: (done: CollectionDone) => void
}) {
  const nameId = useId()
  const create = useServerFn(createCollectionFn)
  const rename = useServerFn(renameCollectionFn)
  const remove = useServerFn(deleteCollectionFn)
  const [name, setName] = useState(editing?.name ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch {
      setError("unknown")
    }
    setBusy(false)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > MAX_COLLECTION_NAME) {
      setError("collection_invalid")
      return
    }
    void run(async () => {
      if (!editing) {
        const result = await create({ data: { name: trimmed } })
        if (!result.ok) return setError(result.code)
        onDone({
          notice: `Koleksi “${trimmed}” dibuat.`,
          koleksi: result.id,
        })
        return
      }
      const result = await rename({ data: { id: editing.id, name: trimmed } })
      if (!result.ok) return setError(result.code)
      onDone({ notice: "Nama koleksi diganti." })
    })
  }

  function onDelete() {
    if (!editing) return
    void run(async () => {
      const result = await remove({ data: { id: editing.id } })
      if (!result.ok) return setError(result.code)
      onDone({ notice: `Koleksi “${editing.name}” dihapus.`, koleksi: null })
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-xl">
          {editing ? "Ubah koleksi" : "Koleksi baru"}
        </DialogTitle>
      </DialogHeader>
      <form className="space-y-3" onSubmit={onSubmit} noValidate>
        <div className="space-y-1">
          <label htmlFor={nameId} className="block text-sm font-bold">
            Nama koleksi
          </label>
          <Input
            id={nameId}
            value={name}
            maxLength={MAX_COLLECTION_NAME}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-stamp">
            {bookMessage(error)}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {editing ? "Simpan" : "Buat"}
        </Button>
      </form>
      {editing && (
        <div className="space-y-2 border-t pt-4">
          {!confirming ? (
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              Hapus koleksi
            </Button>
          ) : (
            <>
              <p className="text-sm">
                Hapus koleksi “{editing.name}”? Bukunya tetap di rak.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={onDelete}
                >
                  Ya, hapus
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                >
                  Batal
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 5: `GenreSelect` dan toolbar**

Buat `src/components/shelf/GenreSelect.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router"
import { useId } from "react"
import { SHELF_FILTERS, type ShelfFilter } from "@/lib/shelf"

/** The genres and the trolley, as a choice beside the search (spec Tahap 3 §4.3). */
export function GenreSelect({
  value,
  counts,
}: {
  value: ShelfFilter
  counts: Record<ShelfFilter, number>
}) {
  const navigate = useNavigate({ from: "/shelf" })
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted-foreground">
        Tampilkan genre
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const next = SHELF_FILTERS.find(
            (filter) => filter.value === event.target.value
          )?.value
          void navigate({
            search: (prev) => ({
              ...prev,
              genre: next === undefined || next === "semua" ? undefined : next,
            }),
            replace: true,
          })
        }}
        className="native-select"
      >
        {SHELF_FILTERS.map((filter) => (
          <option key={filter.value} value={filter.value}>
            {filter.label} · {counts[filter.value]}
          </option>
        ))}
      </select>
    </div>
  )
}
```

Di `src/components/shelf/ShelfToolbar.tsx`:
- ganti import menjadi `import { type ReactNode, useEffect, useId, useRef, useState } from "react"` dan `import { SHELF_SORTS, type ShelfSort, isShelfSort } from "@/lib/shelf"`;
- ganti tanda tangan:

```tsx
export function ShelfToolbar({
  q,
  sort,
  defaultSort,
  children,
}: {
  q: string
  sort: ShelfSort
  /** The collection's own order, which stays out of the URL. */
  defaultSort: ShelfSort
  /** More choices between the search and the order (the genre). */
  children?: ReactNode
}) {
```

- render `{children}` tepat setelah `</div>` penutup blok pencarian (`min-w-48 flex-1`);
- ganti `onChange` pilihan urutan:

```tsx
          onChange={(event) => {
            const value = event.target.value
            void navigate({
              search: (prev) => ({
                ...prev,
                sort:
                  isShelfSort(value) && value !== defaultSort
                    ? value
                    : undefined,
              }),
              replace: true,
            })
          }}
```

Hapus `src/components/shelf/GenreFilter.tsx` dan `src/components/shelf/GenreFilter.test.tsx`.

- [ ] **Step 6: CSS**

Di `src/styles.css`, tepat setelah aturan `.genre-chip[aria-current="page"] { … }`:

```css
  /* Collections (spec Tahap 3 §4.3): the new-collection chip and the edit button. */
  .collection-new {
    border-style: dashed;
  }
  .collection-new:disabled,
  .collection-edit:disabled {
    opacity: 0.5;
  }
  .collection-edit {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--border);
    border-radius: 9999px;
  }
  .collection-edit svg {
    width: 0.9rem;
    height: 0.9rem;
  }
```

- [ ] **Step 7: Halaman Rak Saya**

Ganti `src/routes/_member/_lobi/shelf.tsx` seluruhnya:

```tsx
import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
import { useMemo, useState } from "react"
import { BookActions } from "@/components/shelf/BookActions"
import { BookDetail } from "@/components/shelf/BookDetail"
import { BookGrid } from "@/components/shelf/BookGrid"
import { CollectionBar } from "@/components/shelf/CollectionBar"
import {
  CollectionDialog,
  type CollectionDone,
} from "@/components/shelf/CollectionDialog"
import { EmptyShelf } from "@/components/shelf/EmptyShelf"
import { GenreSelect } from "@/components/shelf/GenreSelect"
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
import type { Collection } from "@/lib/book-types"
import { genreLabel } from "@/lib/genre"
import {
  activeCollection,
  countBooks,
  countCollections,
  defaultSort,
  parseShelfSearch,
  shelfBooks,
} from "@/lib/shelf"
import { useOnline } from "@/lib/use-online"

const lobi = getRouteApi("/_member/_lobi")

export const Route = createFileRoute("/_member/_lobi/shelf")({
  validateSearch: parseShelfSearch,
  head: () => ({ meta: [{ title: "Rak Saya — Glosa" }] }),
  component: ShelfPage,
})

function ShelfPage() {
  const { books, usage, collections, offline } = lobi.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const online = useOnline()
  const local = useLocalShelf()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState("")
  // The collection dialog: closed, a new collection, or one to edit.
  const [editing, setEditing] = useState<Collection | "new" | null>(null)
  const koleksi = activeCollection(search.koleksi, collections)
  const ordering = defaultSort(koleksi)
  const visible = useMemo(
    () => shelfBooks(books, { ...search, koleksi }),
    [books, search, koleksi]
  )
  const counts = useMemo(() => countBooks(books), [books])
  const collectionCounts = useMemo(
    () => countCollections(books, collections),
    [books, collections]
  )
  const selected = books.find((book) => book.id === selectedId) ?? null
  const inTrolley = search.genre === "troli"
  const refresh = () => void router.invalidate()
  const bringButton = (
    <Button onClick={() => setUploading(true)}>Bawa buku</Button>
  )

  const onCollectionDone = ({ notice: text, koleksi: next }: CollectionDone) => {
    setEditing(null)
    setNotice(text)
    refresh()
    if (next !== undefined) {
      void navigate({
        search: (prev) => ({ ...prev, koleksi: next ?? undefined }),
      })
    }
  }

  return (
    <LobbyPopup label="Rak Saya" className="max-w-5xl" bodyClassName="gap-5">
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
          <CollectionBar
            active={koleksi}
            collections={collections}
            counts={collectionCounts}
            canEdit={online && !offline}
            onCreate={() => setEditing("new")}
            onEdit={setEditing}
          />
          <ShelfToolbar
            q={search.q ?? ""}
            sort={search.sort ?? ordering}
            defaultSort={ordering}
          >
            <GenreSelect value={search.genre ?? "semua"} counts={counts} />
          </ShelfToolbar>
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
                          refresh()
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
              collections={collections}
              onGenreSaved={refresh}
              onShelved={refresh}
              onDeleted={(book) => {
                setSelectedId(null)
                setNotice(`“${book.title}” dihapus dari rak.`)
                refresh()
              }}
            />
          </>
        )}
      </BookDetail>
      <CollectionDialog
        open={editing !== null}
        editing={editing === "new" ? null : editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onDone={onCollectionDone}
      />
      <UploadPanel open={uploading} onOpenChange={setUploading} usage={usage} />
    </LobbyPopup>
  )
}
```

`BookActions` menerima `collections` dan `onShelved` di Task 5. Supaya task ini tetap lolos typecheck, tambahkan sekarang dua prop itu ke tanda tangan `BookActions` (`src/components/shelf/BookActions.tsx`) tanpa dipakai dulu:

```tsx
export function BookActions({
  book,
  saved,
  collections,
  onGenreSaved,
  onShelved,
  onDeleted,
}: {
  book: ShelfBook
  /** Whether this device holds the EPUB for offline reading. */
  saved: boolean
  /** The member's collections, for the checklist (spec Tahap 3 §4.1). */
  collections: ReadonlyArray<Collection>
  onGenreSaved: (genre: Genre) => void
  /** A collection or the finished mark changed: the shelf loads again. */
  onShelved: () => void
  onDeleted: (book: ShelfBook) => void
}) {
```

dengan `import type { Collection, ShelfBook } from "@/lib/book-types"`, lalu kirim `collections={[]}` dan `onShelved={…}` dari pemanggil lain: di `src/components/lobby/BookDetailPanel.tsx` dan `src/components/lobby/ContinueSheet.tsx` tambahkan `collections={[]}` dan `onShelved={onChanged}` pada `<BookActions …>` (Task 5 mengganti `[]` dengan koleksi sungguhan). Di `src/components/shelf/BookActions.test.tsx`, tambahkan `collections={[]}` dan `onShelved={vi.fn()}` ke setiap `<BookActions …>`.

- [ ] **Step 8: Jalankan test dan typecheck**

Run: `npx vitest run src/components/shelf src/components/lobby src/lib`
Expected: PASS.

Run: `npx tsc --noEmit && npx eslint src/components/shelf src/routes`
Expected: tanpa error.

- [ ] **Step 9: Commit**

```bash
git add -A src/components/shelf src/routes/_member/_lobi/shelf.tsx src/components/lobby src/styles.css
git commit -m "feat(shelf): collection chips lead Rak Saya; the genre moves to a choice"
```

---

### Task 5: Detail buku — daftar centang koleksi dan tombol selesai

**Files:**
- Create: `src/components/shelf/BookCollections.tsx` (+ test)
- Create: `src/components/shelf/FinishToggle.tsx` (+ test)
- Modify: `src/components/shelf/BookActions.tsx` (+ test)
- Modify: `src/components/lobby/BookDetailPanel.tsx`, `src/components/lobby/ContinueSheet.tsx`, `src/components/lobby/LobbyStage.tsx`

**Interfaces:**
- Consumes: `setBookCollectionsFn`, `setBookFinishedFn` (Task 2); `Collection`, `ShelfBook` (Task 2); prop `collections`/`onShelved` dari Task 4.
- Produces:
  - `BookCollections({ book: ShelfBook; collections: ReadonlyArray<Collection>; onSaved: () => void })`
  - `FinishToggle({ book: ShelfBook; onSaved: () => void })`
  - `BookDetailPanel` dan `ContinueSheet` + prop `collections: ReadonlyArray<Collection>`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/components/shelf/BookCollections.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Collection } from "@/lib/book-types"
import { BookCollections } from "./BookCollections"
import { sherlock } from "./fixtures"

const mocks = vi.hoisted(() => ({ setBookCollectionsFn: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/collections", () => mocks)

const santai: Collection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Bacaan santai",
  createdAt: "2026-10-20T00:00:00+00:00",
}
const klasik: Collection = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Klasik",
  createdAt: "2026-10-21T00:00:00+00:00",
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("BookCollections", () => {
  it("ticks the collections the book is in, and saves a new tick", async () => {
    mocks.setBookCollectionsFn.mockResolvedValueOnce({ ok: true })
    const onSaved = vi.fn()
    render(
      <BookCollections
        book={{ ...sherlock, collectionIds: [santai.id] }}
        collections={[santai, klasik]}
        onSaved={onSaved}
      />
    )
    expect(screen.getByLabelText("Bacaan santai")).toBeChecked()
    expect(screen.getByLabelText("Klasik")).not.toBeChecked()
    fireEvent.click(screen.getByLabelText("Klasik"))
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(mocks.setBookCollectionsFn).toHaveBeenCalledWith({
      data: { bookId: sherlock.id, collectionIds: [santai.id, klasik.id] },
    })
    expect(screen.getByText("Koleksi disimpan.")).toBeInTheDocument()
  })

  it("puts the tick back when saving fails", async () => {
    mocks.setBookCollectionsFn.mockResolvedValueOnce({
      ok: false,
      code: "not_found",
    })
    render(
      <BookCollections
        book={sherlock}
        collections={[santai]}
        onSaved={vi.fn()}
      />
    )
    fireEvent.click(screen.getByLabelText("Bacaan santai"))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Buku ini tidak ada di rakmu."
    )
    expect(screen.getByLabelText("Bacaan santai")).not.toBeChecked()
  })

  it("says where collections are made when there are none", () => {
    render(
      <BookCollections book={sherlock} collections={[]} onSaved={vi.fn()} />
    )
    expect(
      screen.getByText("Belum ada koleksi. Buat koleksi dari Rak Saya.")
    ).toBeInTheDocument()
  })
})
```

Buat `src/components/shelf/FinishToggle.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FinishToggle } from "./FinishToggle"
import { sherlock } from "./fixtures"

const mocks = vi.hoisted(() => ({ setBookFinishedFn: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/collections", () => mocks)

afterEach(() => {
  vi.clearAllMocks()
})

describe("FinishToggle", () => {
  it("marks a book finished", async () => {
    mocks.setBookFinishedFn.mockResolvedValueOnce({ ok: true })
    const onSaved = vi.fn()
    render(<FinishToggle book={sherlock} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole("button", { name: "Tandai selesai" }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(mocks.setBookFinishedFn).toHaveBeenCalledWith({
      data: { bookId: sherlock.id, finished: true },
    })
  })

  it("shows when a finished book was finished, and takes the mark off", async () => {
    mocks.setBookFinishedFn.mockResolvedValueOnce({ ok: true })
    render(
      <FinishToggle
        book={{ ...sherlock, finishedAt: "2026-10-20T03:00:00+00:00" }}
        onSaved={vi.fn()}
      />
    )
    expect(screen.getByText(/^Selesai dibaca 20 Oktober 2026$/)).toBeVisible()
    fireEvent.click(
      screen.getByRole("button", { name: "Tandai belum selesai" })
    )
    await waitFor(() =>
      expect(mocks.setBookFinishedFn).toHaveBeenCalledWith({
        data: { bookId: sherlock.id, finished: false },
      })
    )
  })

  it("says why the mark did not change", async () => {
    mocks.setBookFinishedFn.mockResolvedValueOnce({
      ok: false,
      code: "unknown",
    })
    render(<FinishToggle book={sherlock} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Tandai selesai" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ada yang tidak beres."
    )
  })
})
```

Di `src/components/shelf/BookActions.test.tsx`, tambahkan mock server koleksi di samping mock yang ada:

```ts
vi.mock("@/server/collections", () => ({
  setBookCollectionsFn: vi.fn(),
  setBookFinishedFn: vi.fn(),
}))
```

dan test:

```tsx
  it("holds the collections and the finished mark", () => {
    render(
      <BookActions
        book={sherlock}
        saved={false}
        collections={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Bacaan santai",
            createdAt: "2026-10-20T00:00:00+00:00",
          },
        ]}
        onGenreSaved={vi.fn()}
        onShelved={vi.fn()}
        onDeleted={vi.fn()}
      />
    )
    expect(screen.getByLabelText("Bacaan santai")).not.toBeChecked()
    expect(
      screen.getByRole("button", { name: "Tandai selesai" })
    ).toBeInTheDocument()
  })
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/shelf`
Expected: FAIL — modul `./BookCollections` dan `./FinishToggle` tidak ada; test BookActions baru gagal.

- [ ] **Step 3: `BookCollections`**

Buat `src/components/shelf/BookCollections.tsx`:

```tsx
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { bookMessage } from "@/lib/book-messages"
import type { Collection, ShelfBook } from "@/lib/book-types"
import { useOnline } from "@/lib/use-online"
import { setBookCollectionsFn } from "@/server/collections"

/**
 * The book's collections as a checklist (spec Tahap 3 §4.1). Every tick is
 * saved at once, like the genre beside it (plan 3A, decision 3).
 */
export function BookCollections({
  book,
  collections,
  onSaved,
}: {
  book: ShelfBook
  collections: ReadonlyArray<Collection>
  onSaved: () => void
}) {
  const save = useServerFn(setBookCollectionsFn)
  const online = useOnline()
  const [chosen, setChosen] = useState<ReadonlyArray<string>>(
    book.collectionIds
  )
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<"idle" | "saved" | { code: string }>(
    "idle"
  )

  async function toggle(id: string) {
    const previous = chosen
    const next = chosen.includes(id)
      ? chosen.filter((other) => other !== id)
      : [...chosen, id]
    setChosen(next)
    setBusy(true)
    setState("idle")
    try {
      const result = await save({
        data: { bookId: book.id, collectionIds: [...next] },
      })
      if (result.ok) {
        setState("saved")
        onSaved()
      } else {
        setChosen(previous)
        setState({ code: result.code })
      }
    } catch {
      setChosen(previous)
      setState({ code: "unknown" })
    }
    setBusy(false)
  }

  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-bold">Koleksi</legend>
      {collections.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Belum ada koleksi. Buat koleksi dari Rak Saya.
        </p>
      ) : (
        <ul className="space-y-1">
          {collections.map((collection) => (
            <li key={collection.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-mint"
                  checked={chosen.includes(collection.id)}
                  disabled={busy || !online}
                  onChange={() => void toggle(collection.id)}
                />
                {collection.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <output className="block min-h-4 text-xs text-muted-foreground">
        {state === "saved" ? "Koleksi disimpan." : ""}
      </output>
      {typeof state === "object" && (
        <p role="alert" className="text-xs text-stamp">
          {bookMessage(state.code)}
        </p>
      )}
    </fieldset>
  )
}
```

- [ ] **Step 4: `FinishToggle`**

Buat `src/components/shelf/FinishToggle.tsx`:

```tsx
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { bookMessage } from "@/lib/book-messages"
import type { ShelfBook } from "@/lib/book-types"
import { formatLongDate } from "@/lib/dates"
import { useOnline } from "@/lib/use-online"
import { setBookFinishedFn } from "@/server/collections"

/** "Tandai selesai" / "Tandai belum selesai" in the book's details (spec Tahap 3 §4.4). */
export function FinishToggle({
  book,
  onSaved,
}: {
  book: ShelfBook
  onSaved: () => void
}) {
  const save = useServerFn(setBookFinishedFn)
  const online = useOnline()
  const [finishedAt, setFinishedAt] = useState(book.finishedAt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const finished = finishedAt !== null

  async function onToggle() {
    setBusy(true)
    setError(null)
    try {
      const result = await save({
        data: { bookId: book.id, finished: !finished },
      })
      if (result.ok) {
        setFinishedAt(finished ? null : new Date().toISOString())
        onSaved()
      } else {
        setError(result.code)
      }
    } catch {
      setError("unknown")
    }
    setBusy(false)
  }

  return (
    <div className="space-y-1">
      {finishedAt && (
        <p className="text-sm">
          Selesai dibaca {formatLongDate(new Date(finishedAt))}
        </p>
      )}
      <Button
        variant="outline"
        disabled={busy || !online}
        onClick={() => void onToggle()}
      >
        {finished ? "Tandai belum selesai" : "Tandai selesai"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-stamp">
          {bookMessage(error)}
        </p>
      )}
    </div>
  )
}
```

Catatan: periksa format `formatLongDate` di `src/lib/dates.ts`; bila keluarannya bukan "20 Oktober 2026" untuk `2026-10-20T03:00:00+00:00`, sesuaikan regex di test dengan keluaran fungsi itu (jangan mengubah `formatLongDate`).

- [ ] **Step 5: Masukkan ke `BookActions`**

Di `src/components/shelf/BookActions.tsx`, import kedua komponen:

```tsx
import { BookCollections } from "./BookCollections"
import { FinishToggle } from "./FinishToggle"
```

dan sisipkan tepat setelah `</div>` penutup blok Genre (blok dengan `<label htmlFor={genreId}`):

```tsx
      <BookCollections
        book={book}
        collections={collections}
        onSaved={onShelved}
      />

      <FinishToggle book={book} onSaved={onShelved} />
```

- [ ] **Step 6: Koleksi sampai ke lobi**

Di `src/components/lobby/BookDetailPanel.tsx`: tambahkan prop `collections: ReadonlyArray<Collection>` (import `type Collection` dari `@/lib/book-types` bersama `ShelfBook`) dan ganti `collections={[]}` pada `<BookActions>` dengan `collections={collections}`.

Di `src/components/lobby/ContinueSheet.tsx`: sama — prop `collections: ReadonlyArray<Collection>`, diteruskan ke `<BookActions collections={collections} …>`.

Di `src/components/lobby/LobbyStage.tsx`: kirim `collections={collections}` ke `<BookDetailPanel …>` dan `<ContinueSheet …>`.

Perbarui test yang me-render keduanya: di `src/components/lobby/BookDetailPanel.test.tsx` dan (bila ada) `src/components/lobby/ContinueSheet.test.tsx`, tambahkan `collections={[]}` ke setiap `<BookDetailPanel …>` / `<ContinueSheet …>`.

- [ ] **Step 7: Jalankan test dan typecheck**

Run: `npx vitest run src/components/shelf src/components/lobby`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: tanpa error.

- [ ] **Step 8: Commit**

```bash
git add src/components/shelf src/components/lobby
git commit -m "feat(shelf): a book's details put it in collections and mark it finished"
```

---

### Task 6: Reader bertanya apakah buku sudah selesai

**Files:**
- Modify: `src/types/foliate-js.d.ts`, `src/components/reader/ReaderView.tsx`
- Create: `src/components/reader/FinishPrompt.tsx` (+ test)
- Modify: `src/routes/_member/read.$bookId.tsx`, `src/components/reader/ReaderFooter.test.tsx`

**Interfaces:**
- Consumes: `shouldAskFinish` (Task 3); `setBookFinishedFn`, `declineFinishFn` (Task 2); `ReaderBook.finished`/`.finishDeclined` (Task 2).
- Produces:
  - `ReaderLocation.atBookEnd: boolean`
  - `FinishPrompt({ busy: boolean; error: string | null; onAnswer: (finished: boolean) => void })`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/components/reader/FinishPrompt.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FinishPrompt } from "./FinishPrompt"

describe("FinishPrompt", () => {
  it("asks once with two answers", () => {
    const onAnswer = vi.fn()
    render(<FinishPrompt busy={false} error={null} onAnswer={onAnswer} />)
    expect(
      screen.getByText("Sudah selesai membaca buku ini?")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ya, selesai" }))
    expect(onAnswer).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole("button", { name: "Belum" }))
    expect(onAnswer).toHaveBeenLastCalledWith(false)
  })

  it("waits while the answer is saved, and says when it failed", () => {
    render(<FinishPrompt busy error="unknown" onAnswer={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Ya, selesai" })).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ada yang tidak beres."
    )
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/reader/FinishPrompt.test.tsx`
Expected: FAIL — `Cannot find module './FinishPrompt'`.

- [ ] **Step 3: `FinishPrompt`**

Buat `src/components/reader/FinishPrompt.tsx`:

```tsx
import { Button } from "@/components/ui/button"
import { bookMessage } from "@/lib/book-messages"

/** "Sudah selesai membaca buku ini?" at the end of the book (spec Tahap 3 §4.4). */
export function FinishPrompt({
  busy,
  error,
  onAnswer,
}: {
  busy: boolean
  error: string | null
  onAnswer: (finished: boolean) => void
}) {
  return (
    <aside aria-label="Buku selesai" className="reader-toast">
      <output className="text-sm">Sudah selesai membaca buku ini?</output>
      <div className="flex gap-2">
        <Button size="lg" disabled={busy} onClick={() => onAnswer(true)}>
          Ya, selesai
        </Button>
        <Button
          size="lg"
          variant="ghost"
          disabled={busy}
          onClick={() => onAnswer(false)}
        >
          Belum
        </Button>
      </div>
      {error && (
        <p role="alert" className="w-full text-xs text-stamp">
          {bookMessage(error)}
        </p>
      )}
    </aside>
  )
}
```

- [ ] **Step 4: `atBookEnd` dari renderer**

Di `src/types/foliate-js.d.ts`, tambahkan ke `FoliateRenderer` (setelah `sideProp`):

```ts
    /** At the last page of the last section in the reading order (the paginator only). */
    atEnd?: boolean
```

Di `src/components/reader/ReaderView.tsx`:
- tambahkan ke `ReaderLocation` (setelah `turned`):

```ts
  /** At the end of the last section in the reading order (spec Tahap 3 §4.4). */
  atBookEnd: boolean
```

- ganti tanda tangan dan isi `toLocation`:

```ts
function toLocation(
  detail: RelocateDetail,
  reason: string | null | undefined,
  readerTurning: boolean,
  atBookEnd: boolean
): ReaderLocation {
```

dengan `atBookEnd,` ditambahkan ke objek hasil setelah `turned: isTurn(reason, readerTurning),`;
- di `onRendererRelocate`, ganti pemanggilan `toLocation(...)`:

```ts
      call().onRelocate(
        toLocation(
          place,
          reason,
          // Paged turns always relocate once on their own (the padding page);
          // only the scrolled flow can cross a section by navigation alone.
          turning && settingsRef.current.flow === "scrolled",
          view?.renderer.atEnd === true
        )
      )
```

Di `src/components/reader/ReaderFooter.test.tsx`, tambahkan `atBookEnd: false,` ke objek `location` (setelah `turned: false,`).

- [ ] **Step 5: Ajakan di halaman reader**

Di `src/routes/_member/read.$bookId.tsx`:
- tambahkan import:

```tsx
import { FinishPrompt } from "@/components/reader/FinishPrompt"
import { shouldAskFinish } from "@/lib/finish"
import { declineFinishFn, setBookFinishedFn } from "@/server/collections"
```

- di `ReaderPage`, setelah baris `const markOpened = useServerFn(markBookOpenedFn)`:

```tsx
  const markFinished = useServerFn(setBookFinishedFn)
  const declineFinish = useServerFn(declineFinishFn)
```

- setelah state `edge`:

```tsx
  // The finished question (spec Tahap 3 §4.4): what the server knew when the
  // book opened, then the member's answer.
  const [finish, setFinish] = useState(() => ({
    finished: data.book.finished,
    finishDeclined: data.book.finishDeclined,
  }))
  const [finishBusy, setFinishBusy] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [finishedNote, setFinishedNote] = useState(false)
```

- setelah definisi `popupOpen` dan state `panel`/`offer` (yaitu setelah `const [offer, setOffer] = …`):

```tsx
  // Online only, and never over anything open (spec Tahap 3 §4.4).
  const askFinish =
    data.online &&
    location !== null &&
    shouldAskFinish(finish, location) &&
    !popupOpen &&
    panel === null &&
    noteFor === null &&
    sharing === null &&
    offer === null
```

Catatan: `noteFor` dan `sharing` dideklarasikan sebelum `popupOpen`; `panel` dan `offer` sesudahnya. Letakkan `askFinish` setelah keempatnya.

- tambahkan efek dan handler (setelah efek `targetMissing` yang ada):

```tsx
  useEffect(() => {
    if (!finishedNote) return
    const timer = setTimeout(() => setFinishedNote(false), NOTE_MS)
    return () => clearTimeout(timer)
  }, [finishedNote])

  const answerFinish = async (finished: boolean) => {
    setFinishBusy(true)
    setFinishError(null)
    try {
      const result = finished
        ? await markFinished({ data: { bookId, finished: true } })
        : await declineFinish({ data: { bookId } })
      if (!result.ok) {
        setFinishError(result.code)
      } else if (finished) {
        setFinish((current) => ({ ...current, finished: true }))
        setFinishedNote(true)
      } else {
        setFinish((current) => ({ ...current, finishDeclined: true }))
      }
    } catch {
      setFinishError("unknown")
    }
    setFinishBusy(false)
  }
```

- di JSX, tambahkan `!askFinish &&` ke syarat `edge` milik `<ChapterEdge>` (keputusan 9):

```tsx
        edge={
          settings.flow === "scrolled" &&
          !askFinish &&
          !popupOpen &&
          panel === null &&
          noteFor === null &&
          sharing === null &&
          offer === null
            ? edge
            : null
        }
```

- dan tepat sebelum `<ChapterEdge`:

```tsx
      {askFinish && (
        <FinishPrompt
          busy={finishBusy}
          error={finishError}
          onAnswer={(finished) => void answerFinish(finished)}
        />
      )}
      {finishedNote && (
        <output className="reader-note">Masuk ke koleksi Sudah dibaca</output>
      )}
```

- [ ] **Step 6: Jalankan test dan typecheck**

Run: `npx vitest run src/components/reader`
Expected: PASS.

Run: `npx tsc --noEmit && npx eslint src/components/reader "src/routes/_member/read.\$bookId.tsx"`
Expected: tanpa error.

- [ ] **Step 7: Commit**

```bash
git add src/types/foliate-js.d.ts src/components/reader "src/routes/_member/read.\$bookId.tsx"
git commit -m "feat(reader): ask at the end whether the book is finished"
```

---

### Task 7: Lemari pajang di lobi 3D

**Files:**
- Modify: `src/components/lobby/scene/layout.ts` (+ `layout.test.ts`)
- Create: `src/components/lobby/scene/showcase.ts`
- Modify: `src/components/lobby/scene/stage.ts`, `src/components/lobby/LobbyCanvas.tsx` (+ test), `src/components/lobby/LobbyScene.tsx`
- Modify: `src/components/lobby/lobby-data.ts` (+ test), `src/components/lobby/LibraryMap.tsx` (+ test), `src/components/lobby/HotspotLayer.test.tsx`, `src/components/lobby/LobbyStage.tsx`, `src/styles.css`
- Regenerate: `public/lobby/lobby-still*.{avif,webp}`

**Interfaces:**
- Consumes: `ShelfBook.finishedAt` (Task 2); `coverHue` (`@/components/shelf/BookCover`).
- Produces:
  - `layout.ts`: `SHOWCASE: Point2`, `SHOWCASE_SIZE`, `SHOWCASE_SHELVES`, `SHOWCASE_SLOTS = 12`, `showcaseSlots(): Array<Point3>`, `type ShowcaseBook = { id: string; coverUrl: string | null; hue: number }`, `HotspotId` + `"lemari"`
  - `showcase.ts`: `buildShowcase(kit: Kit, onChange: () => void): { set: (books: ReadonlyArray<ShowcaseBook>) => void; dispose: () => void }`
  - `Stage.setShowcase(books: ReadonlyArray<ShowcaseBook>): void`
  - `LobbySummary` + `finished: Array<ShelfBook>` (≤ 12, terakhir selesai dulu), `finishedCount: number`
  - `lobbyHotspots(counts, finishedCount = 0)`

- [ ] **Step 1: Tulis test yang gagal**

Di `src/components/lobby/scene/layout.test.ts`, impor `SHOWCASE`, `SHOWCASE_SIZE`, `SHOWCASE_SLOTS`, `showcaseSlots` dari `./layout`, tambahkan `"lemari"` di akhir daftar "lists unique hotspots in tab order", lalu tambahkan:

```ts
  it("stands twelve covers inside the display cabinet", () => {
    const slots = showcaseSlots()
    expect(slots).toHaveLength(SHOWCASE_SLOTS)
    const [cx, cz] = SHOWCASE
    for (const [x, y, z] of slots) {
      expect(Math.abs(x - cx)).toBeLessThan(SHOWCASE_SIZE.depth / 2)
      expect(Math.abs(z - cz)).toBeLessThan(SHOWCASE_SIZE.width / 2)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(SHOWCASE_SIZE.height)
    }
    // The newest book first: top shelf, then down.
    expect(slots[0][1]).toBeGreaterThan(slots[11][1])
  })
```

Di `src/components/lobby/lobby-data.test.ts`, tambahkan:

```ts
describe("finished books", () => {
  it("shows the last twelve finished, newest first, and counts them all", () => {
    const finished = Array.from({ length: 14 }, (_, i) =>
      book(`f${i}`, {
        finishedAt: `2026-10-${String(i + 10).padStart(2, "0")}T08:00:00+00:00`,
      })
    )
    const summary = summarizeLobby([...finished, book("open")])
    expect(summary.finishedCount).toBe(14)
    expect(summary.finished).toHaveLength(12)
    expect(summary.finished[0].id).toBe("f13")
    expect(summary.finished.at(-1)?.id).toBe("f2")
  })

  it("names the cabinet Sudah dibaca with its count, dim when empty", () => {
    const { counts } = summarizeLobby([book("a")])
    expect(
      lobbyHotspots(counts, 3).find(({ id }) => id === "lemari")
    ).toMatchObject({ label: "Sudah dibaca", count: 3, dim: false })
    expect(
      lobbyHotspots(counts).find(({ id }) => id === "lemari")
    ).toMatchObject({ count: 0, dim: true })
  })
})
```

Di `src/components/lobby/LibraryMap.test.tsx`: ganti `toHaveLength(12)` menjadi `toHaveLength(13)`, tambahkan `expect(kindOf("Sudah dibaca di peta")).toBe("lemari")`, dan ganti teks legenda menjadi `"Rak bukuMeja BacaMeja AdminTroli Buku BaruKosakataSudah dibacaPosisi Anda"`.

Di `src/components/lobby/HotspotLayer.test.tsx`, ganti test urutan:

```tsx
  it("starts at the reading table and ends at the display cabinet", () => {
    renderLayer([sherlock])
    const buttons = screen.getAllByRole("button")
    expect(buttons[0]).toHaveAccessibleName("Meja Baca")
    expect(buttons.at(-1)).toHaveAccessibleName("Sudah dibaca · 0 buku")
  })
```

Di `src/components/lobby/LobbyCanvas.test.tsx`: tambahkan `setShowcase: vi.fn(),` ke objek `stage` palsu dan `showcase={[]}` ke `<LobbyCanvas …>` di `canvasWith`, lalu tambahkan:

```tsx
  it("hands the finished books to the stage, now and when they change", async () => {
    const books = [{ id: "a", coverUrl: null, hue: 120 }]
    const { rerender } = render(
      <LobbyCanvas
        quality="tinggi"
        test={false}
        anda={ANDA_START}
        paused={false}
        showcase={books}
        onReady={vi.fn()}
        onView={vi.fn()}
        onQuality={vi.fn()}
        onFail={vi.fn()}
      />
    )
    await vi.waitFor(() =>
      expect(stage.setShowcase).toHaveBeenCalledWith(books)
    )
    const more = [...books, { id: "b", coverUrl: null, hue: 40 }]
    rerender(
      <LobbyCanvas
        quality="tinggi"
        test={false}
        anda={ANDA_START}
        paused={false}
        showcase={more}
        onReady={vi.fn()}
        onView={vi.fn()}
        onQuality={vi.fn()}
        onFail={vi.fn()}
      />
    )
    expect(stage.setShowcase).toHaveBeenLastCalledWith(more)
  })
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/lobby`
Expected: FAIL — `showcaseSlots is not a function`, `finishedCount` undefined, jumlah tombol peta 12, `setShowcase` tidak dipanggil.

- [ ] **Step 3: `layout.ts`**

Di `src/components/lobby/scene/layout.ts`, setelah `CARD_CATALOG`:

```ts
/**
 * The display cabinet of finished books (spec Tahap 3 §4.5), against the
 * left wall by the front corner: nothing tall stands between it and the
 * camera. It faces +X, into the room.
 */
export const SHOWCASE: Point2 = [0.9, 28.5]
export const SHOWCASE_SIZE = { width: 2.6, height: 2.3, depth: 0.6 } as const
/** The top of each shelf a cover stands on, from the floor up. */
export const SHOWCASE_SHELVES = [0.12, 0.86, 1.6] as const
export const SHOWCASE_SLOTS = 12
/** A finished book on display: its cover, or a coloured face without one. */
export type ShowcaseBook = { id: string; coverUrl: string | null; hue: number }

/** Where each cover stands, the newest first: top shelf, left to right. Pure. */
export function showcaseSlots(): Array<Point3> {
  const [cx, cz] = SHOWCASE
  return [...SHOWCASE_SHELVES]
    .reverse()
    .flatMap((y) =>
      [-0.9, -0.3, 0.3, 0.9].map((dz): Point3 => [cx + 0.05, y, cz + dz])
    )
}
```

Ganti `HotspotId` dan tambahkan spot lemari di akhir `HOTSPOT_SPOTS`, serta perbarui komentarnya:

```ts
export type HotspotId =
  | Genre
  | "meja-baca"
  | "meja-admin"
  | "troli"
  | "katalog"
  | "lemari"
```

```ts
/** In tab order (spec 1D §6): reading table, zones, trolley, admin desk, card catalogue, display cabinet. */
```

```ts
  { id: "lemari", label: [0.9, 2.9, 28.5], stand: [2.6, 28.5] },
```

- [ ] **Step 4: Lemari dan tekstur sampul**

Buat `src/components/lobby/scene/showcase.ts`:

```ts
import * as THREE from "three"
import type { Kit } from "./kit"
import {
  SHOWCASE,
  SHOWCASE_SHELVES,
  SHOWCASE_SIZE,
  type ShowcaseBook,
  showcaseSlots,
} from "./layout"

const BODY = "#5a3820"
const TRIM = "#c98d55"
const COVER = { width: 0.42, height: 0.6, depth: 0.05 } as const

export type Showcase = {
  /** Shows these books, the newest first; the same list again does nothing. */
  set: (books: ReadonlyArray<ShowcaseBook>) => void
  dispose: () => void
}

/**
 * The display cabinet of finished books (spec Tahap 3 §4.5). Covers load as
 * textures from their signed URLs, which Storage sends with CORS headers; a
 * book without one, a cover that fails and every cover offline keep a
 * coloured face. onChange asks the stage to draw again.
 */
export function buildShowcase(kit: Kit, onChange: () => void): Showcase {
  const [cx, cz] = SHOWCASE
  const { width, height, depth } = SHOWCASE_SIZE
  const back = cx - depth / 2 + 0.03
  kit.block(0.06, height, width, BODY, back, 0, cz, { r: 0.02 })
  for (const side of [-1, 1]) {
    kit.block(depth, height, 0.06, BODY, cx, 0, cz + side * (width / 2 - 0.03), {
      r: 0.02,
    })
  }
  kit.block(depth, SHOWCASE_SHELVES[0], width, BODY, cx, 0, cz, { r: 0.02 })
  for (const shelf of SHOWCASE_SHELVES.slice(1)) {
    kit.block(depth - 0.04, 0.05, width - 0.12, TRIM, cx, shelf - 0.05, cz, {
      r: 0.01,
      cast: false,
    })
  }
  kit.block(depth + 0.08, 0.06, width + 0.08, TRIM, cx, height, cz, {
    r: 0.02,
  })

  const covers = new THREE.Group()
  kit.scene.add(covers)
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin("anonymous")
  const slots = showcaseSlots()
  let shownIds = ""
  let disposed = false

  const clear = () => {
    for (const child of [...covers.children]) {
      if (!(child instanceof THREE.Mesh)) continue
      child.geometry.dispose()
      for (const material of child.material as Array<THREE.MeshStandardMaterial>) {
        material.map?.dispose()
        material.dispose()
      }
      child.removeFromParent()
    }
  }

  return {
    set(books) {
      const ids = books.map((book) => book.id).join(" ")
      if (disposed || ids === shownIds) return
      shownIds = ids
      clear()
      books.slice(0, slots.length).forEach((book, i) => {
        const [x, y, z] = slots[i]
        const face = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(book.hue / 360, 0.45, 0.42),
          roughness: 0.7,
        })
        const edge = new THREE.MeshStandardMaterial({ color: "#efe6d4" })
        // BoxGeometry faces: +X first, which looks into the room.
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(COVER.depth, COVER.height, COVER.width),
          [face, edge, edge, edge, edge, edge]
        )
        mesh.position.set(x, y + COVER.height / 2, z)
        mesh.castShadow = true
        covers.add(mesh)
        if (!book.coverUrl) return
        loader.load(
          book.coverUrl,
          (texture) => {
            // Replaced or disposed while it loaded.
            if (disposed || mesh.parent !== covers) {
              texture.dispose()
              return
            }
            texture.colorSpace = THREE.SRGBColorSpace
            face.map = texture
            face.color.set("#ffffff")
            face.needsUpdate = true
            onChange()
          },
          undefined,
          () => {
            // Offline or refused: the coloured face stays.
          }
        )
      })
      onChange()
    },
    dispose() {
      disposed = true
      clear()
    },
  }
}
```

Pastikan `kit.scene` tersedia (`createKit` mengembalikan `scene`); bila tidak, tambahkan `covers` dengan `kit.mesh`-style parent lain — tetapi `createKit` sudah mengembalikan `{ scene, … }`.

Di `src/components/lobby/scene/stage.ts`:
- import: `import { buildShowcase } from "./showcase"` dan `import type { ShowcaseBook } from "./layout"` (gabungkan dengan import `./layout` yang ada bila sudah ada);
- tambahkan ke tipe `Stage`:

```ts
  /** The finished books in the display cabinet (spec Tahap 3 §4.5). */
  setShowcase: (books: ReadonlyArray<ShowcaseBook>) => void
```

- di `buildStage`, setelah `const furniture = buildFurniture(kit)`:

```ts
  const showcase = buildShowcase(kit, () => requestRender())
```

- di objek yang dikembalikan, setelah `walkTo(spot) { … },`:

```ts
    setShowcase(books) {
      showcase.set(books)
    },
```

- di `dispose()`, tepat sebelum `disposeTree(scene)`:

```ts
      showcase.dispose()
```

- [ ] **Step 5: Meneruskan buku ke stage**

Di `src/components/lobby/LobbyCanvas.tsx`:
- import `import type { Point2, ShowcaseBook } from "./scene/layout"` (ganti import `Point2`);
- tambahkan prop `showcase` (setelah `paused`):

```tsx
  /** The finished books for the display cabinet. */
  showcase: ReadonlyArray<ShowcaseBook>
```

- tambahkan `const showcaseRef = useRef(showcase)` di samping `pausedRef`;
- di `.then(...)` setelah `stage.setPaused(pausedRef.current)`: `stage.setShowcase(showcaseRef.current)`;
- tambahkan efek:

```tsx
  useEffect(() => {
    showcaseRef.current = showcase
    stageRef.current?.setShowcase(showcase)
  }, [showcase])
```

Di `src/components/lobby/LobbyScene.tsx`: import `type ShowcaseBook` dari `./scene/layout`; tambahkan prop `showcase = []` (`showcase?: ReadonlyArray<ShowcaseBook>` dengan komentar `/** The finished books for the display cabinet. */`) dan kirim `showcase={showcase}` ke `<LobbyCanvas …>`.

Catatan: `showcase = []` sebagai default membuat array baru tiap render dan memicu efek di `LobbyCanvas`; itu aman karena `Showcase.set` mengabaikan daftar id yang sama.

- [ ] **Step 6: Data lobi, hotspot, peta, dan navigasi**

Di `src/components/lobby/lobby-data.ts`:
- import `SHOWCASE_SLOTS` dari `./scene/layout` (gabungkan dengan import `HOTSPOT_SPOTS, type HotspotId`);
- tambahkan ke `LobbySummary`:

```ts
  /** Finished books for the display cabinet, the last finished first. */
  finished: Array<ShelfBook>
  finishedCount: number
```

- di `summarizeLobby`, sebelum `return`:

```ts
  const finished = books
    .filter((book) => book.finishedAt !== null)
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))
```

dan tambahkan ke objek hasil `finished: finished.slice(0, SHOWCASE_SLOTS), finishedCount: finished.length,`;
- ganti tanda tangan `lobbyHotspots` dan tambahkan cabang lemari:

```ts
export function lobbyHotspots(
  counts: Record<ShelfFilter, number>,
  finishedCount = 0
): Array<HotspotModel> {
  return HOTSPOT_SPOTS.map(({ id }): HotspotModel => {
    const plain = { id, count: null, badge: null, dim: false }
    if (id === "meja-baca") return { ...plain, label: "Meja Baca" }
    if (id === "meja-admin") return { ...plain, label: "Meja Admin" }
    if (id === "katalog") return { ...plain, label: "Kosakata" }
    if (id === "lemari") {
      return {
        ...plain,
        label: "Sudah dibaca",
        count: finishedCount,
        dim: finishedCount === 0,
      }
    }
```

(sisa fungsi tetap).

Di `src/components/lobby/LibraryMap.tsx`:

```tsx
type MapKind =
  | "zone"
  | "meja-baca"
  | "meja-admin"
  | "troli"
  | "katalog"
  | "lemari"
const kindOf = (id: HotspotId, count: number | null): MapKind =>
  id === "lemari"
    ? "lemari"
    : count !== null
      ? "zone"
      : (id as Exclude<MapKind, "zone">)
```

dan tambahkan `["lemari", "Sudah dibaca"],` ke `LEGEND` sebelum `["anda", "Posisi Anda"]`.

Di `src/styles.css`, setelah aturan `[data-kind="katalog"]` peta:

```css
  .lobby-map-spot[data-kind="lemari"],
  .lobby-map-mark[data-kind="lemari"] {
    background: #ffd166;
  }
```

Di `src/components/lobby/LobbyStage.tsx`:
- import `coverHue` dari `@/components/shelf/BookCover`;
- ganti `hotspots` dan tambahkan `showcase`:

```tsx
  const hotspots = useMemo(
    () => lobbyHotspots(summary.counts, summary.finishedCount),
    [summary]
  )
  const showcase = useMemo(
    () =>
      summary.finished.map((book) => ({
        id: book.id,
        coverUrl: book.coverUrl,
        hue: coverHue(book.title),
      })),
    [summary]
  )
```

- kirim `showcase={showcase}` ke `<LobbyScene …>`;
- di `activate`, sebelum cabang `else` terakhir:

```tsx
    } else if (id === "lemari") {
      void navigate({ to: "/shelf", search: { koleksi: "selesai" } })
```

- [ ] **Step 7: Jalankan test dan typecheck**

Run: `npx vitest run src/components/lobby`
Expected: PASS.

Run: `npx tsc --noEmit && npx eslint src/components/lobby`
Expected: tanpa error.

- [ ] **Step 8: Periksa letak lemari dan buat ulang gambar diam**

```bash
node scripts/lobby-harness.mjs shot test-results/lobby-lemari.png
```

Buka `test-results/lobby-lemari.png` (Read tool). Lemari harus terlihat utuh di dinding kiri dekat sudut depan, tidak tertutup menara, meja admin, atau tanaman. Kalau tertutup, geser `SHOWCASE` (dan `label`/`stand` hotspot `lemari`) sepanjang dinding kiri di rentang z 26–31, jalankan ulang Step 7 dan shot ini, dan catat letak akhirnya di `.superpowers/sdd/progress.md`.

Lalu:

```bash
node scripts/lobby-harness.mjs still
```

Expected: menulis `public/lobby/lobby-still.avif`, `lobby-still.webp`, `lobby-still-1280.avif`, `lobby-still-1280.webp`, masing-masing di bawah 250 KB (skrip memeriksanya). Harness tidak punya buku selesai, jadi lemari di gambar diam kosong — sesuai spec §4.5.

- [ ] **Step 9: Commit**

```bash
git add src/components/lobby src/styles.css public/lobby
git commit -m "feat(lobby): a display cabinet shows the books the member finished"
```

---

### Task 8: E2E 3A dan verifikasi penuh

**Files:**
- Create: `e2e/collections.spec.ts`
- Modify: `e2e/shelf.spec.ts`, `e2e/helpers/books.ts`

**Interfaces:**
- Consumes: semua task sebelumnya; `makeEpub({ chapters })` (`e2e/helpers/epub.ts`), `seedBook`, `SHERLOCK`.
- Produces: `markFinished(bookId: string): Promise<void>` (`e2e/helpers/books.ts`).

- [ ] **Step 1: Helper**

Tambahkan ke `e2e/helpers/books.ts`:

```ts
/** Marks the book finished just now, as "Ya, selesai" does. */
export async function markFinished(bookId: string): Promise<void> {
  const { error } = await admin()
    .from("books")
    .update({ finished_at: new Date().toISOString() })
    .eq("id", bookId)
  if (error) throw error
}
```

- [ ] **Step 2: Genre lewat pilihan di `shelf.spec.ts`**

Di test "a Standard Ebooks EPUB lands in its guessed genre …", ganti blok `filters`:

```ts
  const genre = page.getByLabel("Tampilkan genre")
  const book = page.getByRole("button", {
    name: /The Adventures of Sherlock Holmes/,
  })
  await genre.selectOption("misteri_thriller")
  await expect(book).toBeVisible()
  await genre.selectOption("fiksi_sastra")
  await expect(book).toHaveCount(0)
  await expect(page.getByText(/^0\.[78] MB \/ 100 MB$/)).toBeVisible()

  await genre.selectOption("semua")
  await book.click()
```

Di test "a book without subjects waits in the trolley …", ganti:

```ts
  const genre = page.getByLabel("Tampilkan genre")
  await genre.selectOption("troli")
```

dan di akhirnya:

```ts
  await genre.selectOption("sejarah_budaya")
```

- [ ] **Step 3: Tulis E2E 3A**

Buat `e2e/collections.spec.ts`:

```ts
import { type Page, expect, test } from "@playwright/test"
import { SHERLOCK, markFinished, seedBook } from "./helpers/books"
import { makeEpub } from "./helpers/epub"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

const SHORT = { title: "Buku Pendek", author: "Penguji" }

/** A member with Sherlock and a short book of three chapters. */
async function memberWithBooks(page: Page) {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const sherlock = await seedBook(userId)
  const short = await seedBook(userId, {
    ...SHORT,
    file: await makeEpub({
      ...SHORT,
      subjects: [],
      cover: false,
      chapters: ["Bab 1", "Bab 2", "Bab 3"].map((title) => ({
        title,
        body: `<h1>${title}</h1><p>Isi ${title}.</p>`,
      })),
    }),
  })
  return { sherlock, short }
}

async function openShelf(page: Page, query = "") {
  await page.goto(`/shelf${query}`)
  await hydrated(page)
  await expect(page.getByRole("navigation", { name: "Koleksi" })).toBeVisible({
    timeout: 30_000,
  })
}

async function openAtTheEnd(page: Page, bookId: string) {
  await page.goto(`/read/${bookId}`)
  const place = page.getByRole("status", {
    name: "Posisi baca",
    includeHidden: true,
  })
  await expect(place).toHaveText(/^\d+%$/, { timeout: 30_000 })
  await page.getByRole("slider", { name: "Posisi dalam buku" }).fill("1")
}

test("a collection gathers the books put in it", async ({ page }) => {
  await memberWithBooks(page)
  await openShelf(page)
  const chips = page.getByRole("navigation", { name: "Koleksi" })

  await chips.getByRole("button", { name: "+ Koleksi baru" }).click()
  const dialog = page.getByRole("dialog", { name: "Koleksi baru" })
  await dialog.getByLabel("Nama koleksi").fill("Bacaan santai")
  await dialog.getByRole("button", { name: "Buat" }).click()
  await expect(page.getByText("Koleksi “Bacaan santai” dibuat.")).toBeVisible()
  await expect(
    chips.getByRole("link", { name: "Bacaan santai · 0" })
  ).toHaveAttribute("aria-current", "page")
  await expect(page.getByText("Belum ada buku di bagian ini.")).toBeVisible()

  await chips.getByRole("link", { name: /^Semua/ }).click()
  await page.getByRole("button", { name: new RegExp(SHERLOCK.title) }).click()
  const detail = page.getByRole("dialog", { name: SHERLOCK.title })
  await detail.getByLabel("Bacaan santai").check()
  await expect(detail.getByText("Koleksi disimpan.")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(detail).toBeHidden()

  await chips.getByRole("link", { name: "Bacaan santai · 1" }).click()
  await expect(
    page.getByRole("button", { name: new RegExp(SHERLOCK.title) })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: new RegExp(SHORT.title) })
  ).toHaveCount(0)
})

test("finishing a book puts it on Sudah dibaca", async ({ page }) => {
  test.setTimeout(90_000)
  const { short } = await memberWithBooks(page)
  await openAtTheEnd(page, short)
  const prompt = page.getByRole("complementary", { name: "Buku selesai" })
  await expect(prompt).toBeVisible()
  await prompt.getByRole("button", { name: "Ya, selesai" }).click()
  await expect(page.getByText("Masuk ke koleksi Sudah dibaca")).toBeVisible()
  await expect(prompt).toHaveCount(0)

  await openShelf(page, "?koleksi=selesai")
  await expect(
    page.getByRole("button", { name: new RegExp(SHORT.title) })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: new RegExp(SHERLOCK.title) })
  ).toHaveCount(0)
})

test("Belum is remembered: the reader does not ask again", async ({ page }) => {
  test.setTimeout(90_000)
  const { short } = await memberWithBooks(page)
  await openAtTheEnd(page, short)
  const prompt = page.getByRole("complementary", { name: "Buku selesai" })
  await prompt.getByRole("button", { name: "Belum" }).click()
  await expect(prompt).toHaveCount(0)

  // Opened afresh: the server now says "Belum".
  await openAtTheEnd(page, short)
  // Give the prompt every chance to come back before saying it did not.
  await page.waitForTimeout(1500)
  await expect(prompt).toHaveCount(0)
})

test("the display cabinet opens Sudah dibaca", async ({ page }) => {
  const { short } = await memberWithBooks(page)
  await markFinished(short)
  await page.goto("/lobby")
  await hydrated(page)
  const scene = page.getByRole("region", { name: "Adegan lobi" })
  await scene
    .getByRole("button", { name: "Sudah dibaca · 1 buku" })
    .press("Enter")
  await expect(page).toHaveURL(/\/shelf\?koleksi=selesai$/)
  await expect(
    page.getByRole("button", { name: new RegExp(SHORT.title) })
  ).toBeVisible()
})
```

- [ ] **Step 4: Jalankan E2E 3A dan rak**

Siapkan config sementara (Global Constraints, bagian E2E), lalu:

Run: `npx playwright test -c playwright.tmp.config.ts e2e/collections.spec.ts e2e/shelf.spec.ts e2e/lobby.spec.ts e2e/lobby-popup.spec.ts --workers=2`
Expected: semua lolos di `desktop` dan `mobile`.

Kalau "the display cabinet opens Sudah dibaca" gagal di `mobile` karena hotspot di luar layar gambar diam: tombol tetap bisa ditekan lewat keyboard (`press("Enter")`), jadi periksa dulu apakah tombolnya ada (`toBeAttached`). Jangan melewatkan test di mobile tanpa melaporkannya.

- [ ] **Step 5: Verifikasi penuh**

```bash
npx tsc --noEmit
npx eslint .
npx prettier --check "**/*.{ts,tsx,js,jsx}"
npx vitest run
npm run test:db -- tests/db/collections.test.ts tests/db/books.test.ts
npx playwright test -c playwright.tmp.config.ts --workers=2
```

Expected: semua bersih dan lolos. Hapus `playwright.tmp.config.ts` setelahnya.

- [ ] **Step 6: Spec dan progres**

Di spec (`docs/superpowers/specs/2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md`), tambahkan subbagian **§9 Penyimpangan saat implementasi** yang menyalin keputusan 1–9 plan ini dalam satu baris masing-masing, plus letak akhir lemari bila berubah di Task 7.

Catat di `.superpowers/sdd/progress.md` bagian "Tahap 3A": task selesai, commit, dan tindak lanjut minor yang ditemukan reviewer.

- [ ] **Step 7: Commit**

```bash
git add e2e docs .superpowers/sdd/progress.md
git commit -m "test(e2e): collections, finishing a book, and the display cabinet"
```

Pemeriksaan manual pemilik setelah push ke dev (HP dan desktop):
1. Buat dua koleksi, masukkan satu buku ke keduanya, ganti nama satu, hapus satu.
2. Filter koleksi + genre bersamaan; urutan di Sudah dibaca.
3. Buka buku pendek, lompat ke akhir → "Ya, selesai" → buku di Sudah dibaca dan di lemari lobi (sampul tampil sebagai tekstur).
4. Buku lain → "Belum" → buka lagi di perangkat lain: tidak ditanya lagi.
5. Mode Gulir di akhir buku: ajakan tampil, penanda bab tidak.
6. Offline: koleksi tetap terlihat, tombol ubah nonaktif; lemari menampilkan punggung berwarna.
