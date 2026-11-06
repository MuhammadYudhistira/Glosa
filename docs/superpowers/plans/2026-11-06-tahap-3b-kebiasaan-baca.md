# Glosa Tahap 3B — Kebiasaan membaca: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reader mencatat waktu baca aktif. Glosa menghitung streak hari membaca dengan 2 hari jeda gratis per minggu, dan member bisa memasang target menit per hari serta buku per tahun. Hasilnya tampil di panel "Kebiasaan baca", sebagai tanaman yang tumbuh di lobi 3D, sebagai cincin kecil di reader, dan di kartu anggota.

**Architecture:**
- **Server.** Tabel `reading_time` menyimpan satu baris per (member, tanggal lokal, perangkat, buku), dengan `seconds = greatest(lama, baru)`. Dua kolom target ditambahkan ke `profiles`. Fungsi `record_reading_time` (antrean) dan `reading_days` (total per hari). Server function ada di `src/server/habit.ts`.
- **Perangkat.** Jam baca murni (`src/lib/reading-clock.ts`) mengubah peristiwa reader menjadi potongan waktu per tanggal. Potongan itu disimpan di Dexie (`readingTime`) dan dikirim lewat `createQueueSync`. Cache hasil server ada di `meta`.
- **Perhitungan.** `src/lib/reading-habit.ts` (murni) menghitung streak, rekor, sisa jeda, tahap tanaman, kalender, dan gabungan angka server dengan lokal. `src/lib/habit/habit-client.ts` menyatukan semuanya untuk React (`useReadingHabit`).
- **UI.** Popup `/habits` di atas lobi (`HabitPanel`, `HabitCalendar`), `HabitRing` dan `GoalToast` di reader, baris streak di `MembershipCard`, dan hotspot `tanaman` dengan `scene/plant.ts` di lobi 3D.

**Tech Stack:** TanStack Start + Router, React 19, TypeScript, Tailwind CSS 4, Supabase (Postgres, RLS, PostgREST RPC), zod 4, Dexie, three.js, foliate-js, Vitest + Testing Library (jsdom), fake-indexeddb, Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-06-tahap-3b-kebiasaan-baca-design.md`](../specs/2026-11-06-tahap-3b-kebiasaan-baca-design.md)

## Global Constraints

- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris (mengikuti kode yang ada). Array ditulis `Array<T>`.
- **Dependensi:** tidak ada dependensi baru.
- **Angka (persis dari spec):**
  - halaman dihitung bila tampil ≥ 5 detik, dengan plafon 10 menit per halaman;
  - hari membaca bila total ≥ target menit hari itu, atau ≥ 300 detik tanpa target;
  - 2 hari jeda gratis per minggu Senin–Minggu;
  - target menit: 5, 10, 15, 20, 30, 45, 60, atau mati; target buku: 1–365 atau mati;
  - `seconds` 0–86400;
  - jendela tanggal [UTC hari ini − 30, UTC hari ini + 1];
  - batch ≤ 50;
  - kalender 5 minggu;
  - simpan berkala setiap 30 detik.
- **Tahap tanaman:** 0 → biji, 1–2 → tunas, 3–6 → daun, 7–20 → rimbun, 21–49 → kuncup, ≥ 50 → berbunga. Tanaman tidak pernah layu.
- **Teks dari spec, persis:** "Kebiasaan baca", "hari membaca beruntun", "Mulai lagi hari ini", "Baca 5 menit hari ini untuk menanam tunas pertama" (angka 5 mengikuti target bila ada), "Jeda tersisa minggu ini: N", "Pasang target harian", "buku selesai", "Data mungkin belum terbaru", "Coba lagi", "Target hari ini tercapai. Selamat membaca terus.", "Streak N hari · Rekor M". Tidak ada kata "gagal" dan tidak ada warna merah di UI kebiasaan.
- **SQL:** RLS "baca milik sendiri"; penulisan lewat fungsi `security definer` dengan `set search_path = ''`; error otentikasi `raise exception 'not_authenticated' using errcode = 'P0001'`; `revoke execute … from public, anon` lalu `grant` ke `authenticated`.
- **Migrasi:**
  - di-push ke proyek Supabase dev (`npm run db:push`);
  - tipe dibuat ulang (`npm run db:types` + `npx prettier --write src/server/database.types.ts`);
  - isinya hanya tambahan, sesuai aturan migrasi prod di [`docs/ops/deploy.md`](../../ops/deploy.md) §7.
- **Proyek dev dipakai bersama** oleh situs dev, CI, dan test. Test hanya menulis baris milik member test-nya sendiri.
- **Line ending:** LF. Di Windows, jangan menulis file lewat Python tanpa `newline=''`.
- **E2E:**
  - jalankan dengan `--workers=2`;
  - kalau port 3000 dipegang aplikasi lain (cek `curl -sL localhost:3000/login | grep -o "<title>[^<]*"`), pakai config sementara di port 3100 dan jangan matikan server lain. Config itu cukup memuat project `desktop` dan `mobile` serta `webServer[0]`, lalu dihapus setelah selesai;
  - satu kegagalan dijalankan ulang sendirian dulu sebelum disebut regresi.

## Keputusan dan penyimpangan dari spec

1. **`record_reading_time` menjawab `text[]`**, satu jawaban per entri dalam urutan yang sama, seperti `save_annotations`, karena mesin antrean `createQueueSync` butuh jawaban per entri.
   - Entri dengan buku orang lain atau tanggal di luar jendela dijawab `'ok'` dan tidak disimpan (spec §5.2: dilewati diam-diam).
   - Entri yang rusak dijawab `'invalid'`, dan perangkat tidak mengirimnya lagi.
   - Batch lebih dari 50, atau yang bukan array, menjadi exception `'invalid'` (pola `save_annotations`). Zod di server function sudah mencegahnya lebih dulu.
2. **Kunci Dexie berupa string `"<day> <bookId>"`**, bukan kunci majemuk `[day+bookId]`. Perangkat menyimpan milidetik (`ms`) dan mengirim `floor(ms / 1000)`.
3. **Id perangkat baru:** `deviceId()` di `src/lib/local/device.ts` (UUID di `meta`, kunci `deviceId`). Saat data lokal dihapus, id ini ikut hilang (spec §5.4).
4. **Panel menjadi popup `/habits`** (`src/routes/_member/_lobi/habits.tsx`), seperti Kosakata. `"/habits"` ditambahkan ke `POPUP_PATHS` dan ke `OVER_LOBBY` di `MemberShell`. Hotspot `tanaman` dan peta membuka rute ini. Di HP, hotspot di atas gambar diam juga membukanya, sama seperti lemari pajang 3A.
5. **Gambar diam lobi menampilkan tahap "tunas"**, karena gambar itu dirender sekali oleh harness. Tahap sebenarnya tampil di adegan 3D dan sebagai baris "Tanaman: …" di panel.
6. **Tanpa animasi tumbuh.** Adegan hanya digambar saat ada perubahan (`requestRender`), dan animasi butuh loop frame baru. Tahap baru langsung menggantikan yang lama.
7. **Label hotspot "Kebiasaan baca" tanpa angka.** Angka hotspot selalu dibaca "· N buku".
8. **Waktu baca selalu dikirim dengan `keepalive`**, karena pengiriman sering terjadi saat tab disembunyikan atau reader ditutup. Satu batch berukuran jauh di bawah batas 64 KB.
9. **Toast hanya muncul bila ada target harian**, dan hanya bila target tercapai selama kunjungan reader ini. Hari yang sudah tercapai sebelum reader dibuka tidak memunculkan toast.
10. **Data kebiasaan dimuat ulang di layout `_lobi` dan di reader** lewat `useQueueFlush(user.id, refreshHabit)`: saat dibuka dan saat koneksi kembali. Pemuatan ulang selalu mengirim antrean dulu.
11. **Target ikut dalam jawaban `loadHabitFn`**, bukan masuk `SessionUser`, supaya sesi tidak berubah.
12. **Hari ini memakai target sekarang.** Hari lalu memakai target yang dibekukan di barisnya. Baris lokal untuk hari ini menyimpan target yang berlaku saat potongan dicatat.

## Struktur file

| File | Status | Tanggung jawab |
|---|---|---|
| `supabase/migrations/20261106000100_reading_habits.sql` | Baru | Tabel, kolom target, fungsi |
| `tests/db/habit.test.ts` | Baru | Uji DB |
| `src/server/database.types.ts` | Dibuat ulang | `npm run db:types` |
| `src/lib/dates.ts` (+ test) | Ubah | Tanggal lokal, tambah hari, Senin, label hari |
| `src/lib/reading-clock.ts` (+ test) | Baru | Jam baca murni |
| `src/lib/habit/types.ts` | Baru | Tipe dan konstanta |
| `src/lib/habit/schemas.ts` | Baru | Zod untuk server function |
| `src/lib/reading-habit.ts` (+ test) | Baru | Streak, kalender, buku tahun ini, gabungan |
| `src/lib/habit/habit-view.ts` (+ test) | Baru | Keadaan → tampilan |
| `src/server/habit.ts` | Baru | `recordReadingTimeFn`, `loadHabitFn`, `updateGoalsFn` |
| `src/lib/local/db.ts` | Ubah | Tabel `readingTime` (versi 4) |
| `src/lib/local/device.ts` | Ubah | `deviceId()`, wipe `readingTime` |
| `src/lib/local/reading-time.ts` (+ test) | Baru | Catatan lokal, antrean, cache |
| `src/lib/habit/habit-client.ts` (+ test) | Baru | Antrean, muat ulang, simpan target, `useReadingHabit` |
| `src/components/reader/useReadingClock.ts` (+ test) | Baru | Menyalurkan peristiwa reader ke jam |
| `src/components/reader/HabitRing.tsx` (+ test) | Baru | Cincin menit hari ini |
| `src/components/reader/GoalToast.tsx` (+ test) | Baru | Toast target tercapai |
| `src/components/reader/ReaderToolbar.tsx` (+ test) | Ubah | Slot `habit` |
| `src/routes/_member/read.$bookId.tsx` | Ubah | Jam, cincin, toast, muat ulang |
| `src/components/lobby/HabitPanel.tsx` (+ test) | Baru | Isi panel |
| `src/components/lobby/HabitCalendar.tsx` (+ test) | Baru | Kalender 5 minggu |
| `src/routes/_member/_lobi/habits.tsx` | Baru | Popup "Kebiasaan baca" |
| `src/routes/_member/_lobi.tsx` | Ubah | Muat ulang data kebiasaan |
| `src/components/lobby/LobbyPopup.tsx`, `src/components/member/MemberShell.tsx` | Ubah | `/habits` |
| `src/components/member/MembershipCard.tsx` (+ test) | Ubah | Baris streak |
| `src/routes/_member/_lobi/settings.tsx` | Ubah | Meneruskan streak ke kartu |
| `src/routes/privacy.tsx` | Ubah | Paragraf waktu baca |
| `src/components/lobby/scene/layout.ts` (+ test) | Ubah | `PLANT`, `PLANT_SHAPES`, hotspot `tanaman` |
| `src/components/lobby/scene/plant.ts` | Baru | Tanaman prosedural |
| `src/components/lobby/scene/stage.ts` | Ubah | `setPlant` |
| `src/components/lobby/LobbyCanvas.tsx`, `LobbyScene.tsx`, `LobbyStage.tsx` | Ubah | Meneruskan tahap, hotspot membuka `/habits` |
| `src/components/lobby/lobby-data.ts`, `LibraryMap.tsx` (+ test) | Ubah | Label hotspot, tanda peta |
| `src/styles.css` | Ubah | Cincin, kalender, tanda peta |
| `public/lobby/lobby-still*.{avif,webp}` | Dibuat ulang | `node scripts/lobby-harness.mjs still` |
| `e2e/helpers/habit.ts`, `e2e/habit.spec.ts` | Baru | E2E 3B |

---

### Task 1: Database — `reading_time`, target, fungsi

**Files:**
- Create: `supabase/migrations/20261106000100_reading_habits.sql`
- Create: `tests/db/habit.test.ts`
- Regenerate: `src/server/database.types.ts`

**Interfaces:**
- Produces:
  - `public.reading_time (user_id, day, device_id, book_id, seconds, goal_minutes, updated_at)`;
  - `profiles.daily_goal_minutes smallint null` dan `profiles.yearly_goal_books smallint null` (grant update);
  - `record_reading_time(p_entries jsonb) returns text[]`, dengan entri `{ day, device_id, book_id, seconds, goal_minutes }`;
  - `reading_days() returns table (day date, seconds integer, goal_minutes smallint)`, urut menurut `day`.

- [ ] **Step 1: Write the failing test**

Buat `tests/db/habit.test.ts`:

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
  ani: `db-habit-ani-${run}@glosa.test`,
  budi: `db-habit-budi-${run}@glosa.test`,
  cita: `db-habit-cita-${run}@glosa.test`,
}
type Client = Awaited<ReturnType<typeof signedInClient>>
type Entry = {
  day: string
  device_id: string
  book_id: string
  seconds: number
  goal_minutes: number | null
}

const DAY_MS = 86_400_000
/** The server's UTC date, moved by `offset` days. */
const utcDay = (offset = 0) =>
  new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10)

async function record(client: Client, entries: Array<Entry>) {
  const { data, error } = await client.rpc("record_reading_time", {
    p_entries: entries,
  })
  if (error) throw error
  return data
}

async function days(client: Client) {
  const { data, error } = await client.rpc("reading_days")
  if (error) throw error
  return data
}

async function rowsOf(userId: string) {
  const { data, error } = await adminClient()
    .from("reading_time")
    .select("day, device_id, book_id, seconds, goal_minutes")
    .eq("user_id", userId)
    .order("day")
  if (error) throw error
  return data
}

describe("reading habits", () => {
  const ids = { ani: "", budi: "", cita: "" }
  const books = { ani: "", ani2: "", budi: "", cita: "" }
  const phone = randomUUID()
  const laptop = randomUUID()
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
    books.cita = await newTestBook(ids.cita)
    ani = await signedInClient(emails.ani)
    budi = await signedInClient(emails.budi)
    cita = await signedInClient(emails.cita)
  })

  afterAll(async () => {
    await deleteTestMembers()
  })

  it("keeps the largest total a device sent, so a resend never counts twice", async () => {
    const entry = (seconds: number, goal: number | null = null): Entry => ({
      day: utcDay(),
      device_id: phone,
      book_id: books.ani,
      seconds,
      goal_minutes: goal,
    })
    expect(await record(ani, [entry(120)])).toEqual(["ok"])
    expect(await record(ani, [entry(120)])).toEqual(["ok"])
    expect(await record(ani, [entry(90)])).toEqual(["ok"])
    expect(await record(ani, [entry(200, 10)])).toEqual(["ok"])
    expect(await rowsOf(ids.ani)).toEqual([
      {
        day: utcDay(),
        device_id: phone,
        book_id: books.ani,
        seconds: 200,
        goal_minutes: 10,
      },
    ])
  })

  it("adds up devices and books per day, with the newest goal of the day", async () => {
    await record(ani, [
      {
        day: utcDay(),
        device_id: laptop,
        book_id: books.ani2,
        seconds: 300,
        goal_minutes: 20,
      },
      {
        day: utcDay(-1),
        device_id: laptop,
        book_id: books.ani,
        seconds: 86_400,
        goal_minutes: null,
      },
      {
        day: utcDay(-1),
        device_id: phone,
        book_id: books.ani,
        seconds: 600,
        goal_minutes: null,
      },
    ])
    expect(await days(ani)).toEqual([
      // Two devices that day: the sum stops at a whole day.
      { day: utcDay(-1), seconds: 86_400, goal_minutes: null },
      { day: utcDay(), seconds: 500, goal_minutes: 20 },
    ])
  })

  it("skips another member's book and days outside the window, but keeps the rest", async () => {
    const base = { device_id: phone, seconds: 60, goal_minutes: null }
    expect(
      await record(budi, [
        { ...base, day: utcDay(), book_id: books.ani },
        { ...base, day: utcDay(-31), book_id: books.budi },
        { ...base, day: utcDay(2), book_id: books.budi },
        { ...base, day: utcDay(), book_id: books.budi },
      ])
    ).toEqual(["ok", "ok", "ok", "ok"])
    expect(await rowsOf(ids.budi)).toEqual([
      { day: utcDay(), device_id: phone, book_id: books.budi, seconds: 60, goal_minutes: null },
    ])
    // Nothing reached Ani's rows.
    expect((await rowsOf(ids.ani)).every((row) => row.seconds !== 60)).toBe(true)
  })

  it("answers a broken entry with invalid, alone", async () => {
    expect(
      await record(budi, [
        { day: "kemarin", device_id: phone, book_id: books.budi, seconds: 5, goal_minutes: null },
        { day: utcDay(), device_id: phone, book_id: books.budi, seconds: 90_000, goal_minutes: null },
        { day: utcDay(), device_id: phone, book_id: books.budi, seconds: 5, goal_minutes: 7 },
        { day: utcDay(), device_id: laptop, book_id: books.budi, seconds: 30, goal_minutes: 5 },
      ])
    ).toEqual(["invalid", "invalid", "invalid", "ok"])
  })

  it("refuses a batch over 50", async () => {
    const entry: Entry = {
      day: utcDay(),
      device_id: phone,
      book_id: books.budi,
      seconds: 1,
      goal_minutes: null,
    }
    const { error } = await budi.rpc("record_reading_time", {
      p_entries: Array.from({ length: 51 }, () => entry),
    })
    expect(error?.message).toBe("invalid")
  })

  it("shows a member only their own rows", async () => {
    const { data, error } = await budi.from("reading_time").select("user_id")
    expect(error).toBeNull()
    expect(new Set(data?.map((row) => row.user_id))).toEqual(new Set([ids.budi]))
    expect((await days(cita)).length).toBe(0)
  })

  it("keeps the days read when the book is deleted", async () => {
    await record(cita, [
      { day: utcDay(), device_id: phone, book_id: books.cita, seconds: 400, goal_minutes: null },
    ])
    const { error } = await adminClient().from("books").delete().eq("id", books.cita)
    expect(error).toBeNull()
    expect(await days(cita)).toEqual([
      { day: utcDay(), seconds: 400, goal_minutes: null },
    ])
  })

  it("deletes the rows with the account", async () => {
    const { error } = await adminClient().auth.admin.deleteUser(ids.cita)
    expect(error).toBeNull()
    forgetTestMember(ids.cita)
    expect(await rowsOf(ids.cita)).toEqual([])
  })

  it("stores goals only within their ranges", async () => {
    const goals = (patch: Record<string, number | null>) =>
      budi.from("profiles").update(patch).eq("id", ids.budi)
    expect((await goals({ daily_goal_minutes: 20, yearly_goal_books: 12 })).error).toBeNull()
    expect((await goals({ daily_goal_minutes: 7 })).error).not.toBeNull()
    expect((await goals({ yearly_goal_books: 0 })).error).not.toBeNull()
    expect((await goals({ yearly_goal_books: 366 })).error).not.toBeNull()
    expect((await goals({ daily_goal_minutes: null, yearly_goal_books: null })).error).toBeNull()
  })

  it("refuses a caller without a session", async () => {
    const { anonClient } = await import("./helpers")
    const { error } = await anonClient().rpc("record_reading_time", {
      p_entries: [],
    })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:db -- tests/db/habit.test.ts`
Expected: FAIL. TypeScript tidak mengenal `record_reading_time` dan `reading_time` (tipe belum dibuat), dan saat dijalankan PostgREST menjawab `Could not find the function public.record_reading_time`.

- [ ] **Step 3: Write the migration**

Buat `supabase/migrations/20261106000100_reading_habits.sql`:

```sql
-- Reading time (spec 3B §5): the seconds a member read, per local day,
-- device and book. A device sends its running totals and the largest one
-- stays, so a resend never counts twice. book_id has no foreign key on
-- purpose: deleting a book keeps the days read and the streak (spec 3B §5.1).
create table public.reading_time (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  device_id uuid not null,
  book_id uuid not null,
  seconds integer not null check (seconds between 0 and 86400),
  -- The member's daily goal when the row was last written: a day keeps the
  -- goal it had (spec 3B §3.2).
  goal_minutes smallint check (goal_minutes in (5, 10, 15, 20, 30, 45, 60)),
  updated_at timestamptz not null default now(),
  primary key (user_id, day, device_id, book_id)
);

alter table public.reading_time enable row level security;

create policy reading_time_select_own on public.reading_time
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.reading_time from anon, authenticated;
grant select on table public.reading_time to authenticated;

-- Personal goals (spec 3B §3.4); null is no goal.
alter table public.profiles
  add column daily_goal_minutes smallint
    check (daily_goal_minutes in (5, 10, 15, 20, 30, 45, 60)),
  add column yearly_goal_books smallint
    check (yearly_goal_books between 1 and 365);

grant update (daily_goal_minutes, yearly_goal_books)
  on table public.profiles to authenticated;

-- Stores a batch from a device's queue (at most 50) and answers each entry,
-- in order. An entry for another member's book, or for a day outside
-- [UTC today - 30, UTC today + 1], has nothing to keep and is 'ok', so it
-- leaves the queue. A broken entry is 'invalid', for that entry alone.
create function public.record_reading_time(p_entries jsonb)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_results text[] := '{}';
  v_entry jsonb;
  v_day date;
  v_device_id uuid;
  v_book_id uuid;
  v_seconds integer;
  v_goal smallint;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array'
    or jsonb_array_length(p_entries) > 50 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;

  for v_entry in
    select e.value
    from jsonb_array_elements(p_entries) with ordinality as e (value, n)
    order by e.n
  loop
    begin
      v_day := (v_entry ->> 'day')::date;
      v_device_id := (v_entry ->> 'device_id')::uuid;
      v_book_id := (v_entry ->> 'book_id')::uuid;
      v_seconds := (v_entry ->> 'seconds')::integer;
      v_goal := (v_entry ->> 'goal_minutes')::smallint;
      if v_day is null or v_device_id is null or v_book_id is null
        or v_seconds is null then
        raise exception 'invalid' using errcode = '22023';
      end if;

      if v_day between v_today - 30 and v_today + 1
        and exists (
          select 1 from public.books b
          where b.id = v_book_id and b.user_id = v_user_id
        ) then
        insert into public.reading_time as rt
          (user_id, day, device_id, book_id, seconds, goal_minutes, updated_at)
        values
          (v_user_id, v_day, v_device_id, v_book_id, v_seconds, v_goal, now())
        on conflict (user_id, day, device_id, book_id) do update
          set seconds = greatest(rt.seconds, excluded.seconds),
              goal_minutes = excluded.goal_minutes,
              updated_at = excluded.updated_at;
      end if;
      v_results := v_results || 'ok'::text;
    exception
      when invalid_text_representation
        or invalid_datetime_format
        or datetime_field_overflow
        or numeric_value_out_of_range
        or check_violation
        or invalid_parameter_value then
        v_results := v_results || 'invalid'::text;
    end;
  end loop;
  return v_results;
end;
$$;

-- The member's reading per day: every device and book added up, at most a
-- whole day, with the goal of the row written last that day.
create function public.reading_days()
returns table (day date, seconds integer, goal_minutes smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rt.day,
    least(sum(rt.seconds), 86400)::integer,
    (array_agg(rt.goal_minutes
      order by rt.updated_at desc, rt.goal_minutes desc nulls last))[1]
  from public.reading_time rt
  where rt.user_id = (select auth.uid())
  group by rt.day
  order by rt.day
$$;

revoke execute on function public.record_reading_time(jsonb) from public, anon;
grant execute on function public.record_reading_time(jsonb) to authenticated;
revoke execute on function public.reading_days() from public, anon;
grant execute on function public.reading_days() to authenticated;
```

- [ ] **Step 4: Push and regenerate types**

```bash
npm run db:push
npm run db:types
npx prettier --write src/server/database.types.ts
```

Expected: `Applying migration 20261106000100_reading_habits.sql...` lalu `Finished supabase db push.` `database.types.ts` kini memuat tabel `reading_time`, kolom `daily_goal_minutes`/`yearly_goal_books` di `profiles`, `record_reading_time: { Args: { p_entries: Json }; Returns: string[] }`, dan `reading_days: { Args: never; Returns: { day: string; goal_minutes: number; seconds: number }[] }` (nama `Args` kosong mengikuti versi CLI).

Kalau migrasi harus diubah setelah di-push:
1. Buang objeknya: `npx supabase db query --linked "drop function if exists public.record_reading_time(jsonb), public.reading_days(); drop table if exists public.reading_time; alter table public.profiles drop column if exists daily_goal_minutes, drop column if exists yearly_goal_books;"`.
2. Jalankan `npx supabase migration repair --status reverted 20261106000100 --linked`.
3. Edit migrasinya, lalu push lagi.

Kalau itu tidak berhasil, berhenti dan laporkan.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:db -- tests/db/habit.test.ts`
Expected: PASS, 10 test. Kalau tipe `reading_days` membuat `goal_minutes` non-null, `toEqual` tetap lulus karena nilainya `null` saat runtime.

- [ ] **Step 6: Commit**

```bash
npx prettier --write tests/db/habit.test.ts
git add supabase/migrations/20261106000100_reading_habits.sql tests/db/habit.test.ts src/server/database.types.ts
git commit -m "feat(db): reading time per day, device and book, with personal goals"
```

---

### Task 2: Tanggal lokal dan jam baca

**Files:**
- Modify: `src/lib/dates.ts`
- Modify: `src/lib/dates.test.ts`
- Create: `src/lib/reading-clock.ts`
- Create: `src/lib/reading-clock.test.ts`

**Interfaces:**
- Produces (`src/lib/dates.ts`):
  - `localDay(ms?: number): string` (`YYYY-MM-DD` menurut zona waktu perangkat);
  - `nextDayAt(ms: number): number`;
  - `addDays(day: string, count: number): string`;
  - `mondayOf(day: string): string`;
  - `formatDayLabel(day: string): string` (misalnya "Rabu, 4 November").
- Produces (`src/lib/reading-clock.ts`):
  - `type ClockPiece = { day: string; ms: number }`;
  - `type DayFns = { dayOf: (ms: number) => string; nextDayAt: (ms: number) => number }`;
  - `PAGE_READ_MS = { min: 5_000, max: 600_000 }`;
  - `type ReadingClock = { show(at): Array<ClockPiece>; pause(at): Array<ClockPiece>; resume(at): void; tick(at): Array<ClockPiece> }`;
  - `createReadingClock(days?: DayFns): ReadingClock`.

- [ ] **Step 1: Write the failing tests**

Tambahkan ke `src/lib/dates.test.ts` (pertahankan test yang ada, tambah import):

```ts
import {
  addDays,
  formatDayLabel,
  localDay,
  mondayOf,
  nextDayAt,
} from "./dates"

describe("local days", () => {
  it("names the device's local date", () => {
    expect(localDay(new Date(2026, 10, 6, 23, 59).getTime())).toBe("2026-11-06")
    expect(localDay(new Date(2026, 0, 1, 0, 0).getTime())).toBe("2026-01-01")
  })

  it("finds the next local midnight", () => {
    expect(nextDayAt(new Date(2026, 10, 6, 15, 30).getTime())).toBe(
      new Date(2026, 10, 7).getTime()
    )
    expect(nextDayAt(new Date(2026, 11, 31, 0, 0).getTime())).toBe(
      new Date(2027, 0, 1).getTime()
    )
  })

  it("adds days across months and years", () => {
    expect(addDays("2026-11-06", 1)).toBe("2026-11-07")
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
    expect(addDays("2026-11-06", -28)).toBe("2026-10-09")
  })

  it("starts a week on Monday", () => {
    expect(mondayOf("2026-11-06")).toBe("2026-11-02") // Friday
    expect(mondayOf("2026-11-02")).toBe("2026-11-02") // Monday
    expect(mondayOf("2026-11-08")).toBe("2026-11-02") // Sunday
    expect(mondayOf("2027-01-01")).toBe("2026-12-28")
  })

  it("labels a day in Indonesian", () => {
    expect(formatDayLabel("2026-11-04")).toBe("Rabu, 4 November")
  })
})
```

(`describe`, `expect`, dan `it` sudah diimpor di file itu. Kalau belum, tambahkan `import { describe, expect, it } from "vitest"`.)

Buat `src/lib/reading-clock.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { type DayFns, PAGE_READ_MS, createReadingClock } from "./reading-clock"

const DAY_MS = 86_400_000
/** UTC days, so the test does not depend on the machine's time zone. */
const UTC_DAYS: DayFns = {
  dayOf: (ms) => new Date(ms).toISOString().slice(0, 10),
  nextDayAt: (ms) => Math.floor(ms / DAY_MS) * DAY_MS + DAY_MS,
}
const T0 = Date.UTC(2026, 10, 6, 8, 0)
const s = (seconds: number) => seconds * 1000
const TODAY = "2026-11-06"
const clock = () => createReadingClock(UTC_DAYS)

describe("createReadingClock", () => {
  it("counts a page read between two turns", () => {
    const c = clock()
    expect(c.show(T0)).toEqual([])
    expect(c.show(T0 + s(40))).toEqual([{ day: TODAY, ms: s(40) }])
  })

  it("drops a page turned within five seconds", () => {
    const c = clock()
    c.show(T0)
    expect(c.show(T0 + s(4))).toEqual([])
    expect(c.show(T0 + s(14))).toEqual([{ day: TODAY, ms: s(10) }])
  })

  it("counts at most ten minutes of one page", () => {
    const c = clock()
    c.show(T0)
    expect(c.show(T0 + s(25 * 60))).toEqual([
      { day: TODAY, ms: PAGE_READ_MS.max },
    ])
  })

  it("stops while paused and goes on with the same page", () => {
    const c = clock()
    c.show(T0)
    expect(c.pause(T0 + s(20))).toEqual([{ day: TODAY, ms: s(20) }])
    c.resume(T0 + s(300))
    expect(c.show(T0 + s(310))).toEqual([{ day: TODAY, ms: s(10) }])
  })

  it("lets a short page count once it passes five seconds in all", () => {
    const c = clock()
    c.show(T0)
    expect(c.pause(T0 + s(3))).toEqual([])
    c.resume(T0 + s(60))
    expect(c.show(T0 + s(63))).toEqual([{ day: TODAY, ms: s(6) }])
  })

  it("hands over the time so far on a tick, without counting it twice", () => {
    const c = clock()
    c.show(T0)
    expect(c.tick(T0 + s(30))).toEqual([{ day: TODAY, ms: s(30) }])
    expect(c.tick(T0 + s(60))).toEqual([{ day: TODAY, ms: s(30) }])
    expect(c.show(T0 + s(70))).toEqual([{ day: TODAY, ms: s(10) }])
  })

  it("keeps the cap across ticks", () => {
    const c = clock()
    c.show(T0)
    expect(c.tick(T0 + s(9 * 60))).toEqual([{ day: TODAY, ms: s(9 * 60) }])
    expect(c.tick(T0 + s(12 * 60))).toEqual([{ day: TODAY, ms: s(60) }])
    expect(c.show(T0 + s(15 * 60))).toEqual([])
  })

  it("splits a page read across midnight", () => {
    const c = clock()
    const late = Date.UTC(2026, 10, 6, 23, 59, 40)
    c.show(late)
    expect(c.show(late + s(50))).toEqual([
      { day: "2026-11-06", ms: s(20) },
      { day: "2026-11-07", ms: s(30) },
    ])
  })

  it("does not run for a page shown while paused, until it resumes", () => {
    const c = clock()
    expect(c.pause(T0)).toEqual([])
    expect(c.show(T0 + s(1))).toEqual([])
    expect(c.tick(T0 + s(100))).toEqual([])
    c.resume(T0 + s(100))
    expect(c.show(T0 + s(120))).toEqual([{ day: TODAY, ms: s(20) }])
  })

  it("ignores a clock that went back", () => {
    const c = clock()
    c.show(T0)
    expect(c.show(T0 - s(30))).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dates.test.ts src/lib/reading-clock.test.ts`
Expected: FAIL. `localDay` belum diekspor, dan `./reading-clock` tidak ditemukan.

- [ ] **Step 3: Implement**

Tambahkan ke `src/lib/dates.ts` (di bawah kode yang ada):

```ts
const pad = (value: number) => String(value).padStart(2, "0")

/** The device's local date at `ms`, as YYYY-MM-DD (spec 3B §2). */
export function localDay(ms: number = Date.now()): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** When the local day after the one at `ms` starts. */
export function nextDayAt(ms: number): number {
  const date = new Date(ms)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1
  ).getTime()
}

const DAY_MS = 86_400_000
/** A YYYY-MM-DD day as UTC midnight: day arithmetic without time zones. */
const utcOf = (day: string) => {
  const [year, month, date] = day.split("-").map(Number)
  return Date.UTC(year, month - 1, date)
}
const dayOfUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function addDays(day: string, count: number): string {
  return dayOfUtc(utcOf(day) + count * DAY_MS)
}

/** The Monday of the day's week: weeks run Monday to Sunday (spec 3B §3.3). */
export function mondayOf(day: string): string {
  const weekday = (new Date(utcOf(day)).getUTCDay() + 6) % 7
  return addDays(day, -weekday)
}

const DAY_LABEL = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
})

/** "Rabu, 4 November". */
export function formatDayLabel(day: string): string {
  return DAY_LABEL.format(new Date(utcOf(day)))
}
```

Buat `src/lib/reading-clock.ts`:

```ts
import { localDay, nextDayAt } from "./dates"

/** Time read on one local day, in milliseconds. */
export type ClockPiece = { day: string; ms: number }

/** How the clock finds days; the device's local days unless a test says otherwise. */
export type DayFns = {
  dayOf: (ms: number) => string
  nextDayAt: (ms: number) => number
}

/**
 * A page shown for less is a page turned, not read; a page shown longer
 * counts only this long (spec 3B §3.1).
 */
export const PAGE_READ_MS = { min: 5_000, max: 600_000 } as const

export type ReadingClock = {
  /** A new page shows: the page before it is done. */
  show: (at: number) => Array<ClockPiece>
  /** The book is out of sight: a hidden tab, a panel over it, the reader left. */
  pause: (at: number) => Array<ClockPiece>
  /** The book is in sight again: the same page goes on. */
  resume: (at: number) => void
  /** Hands over what the page shown has counted so far (saved every 30 s). */
  tick: (at: number) => Array<ClockPiece>
}

const LOCAL_DAYS: DayFns = { dayOf: localDay, nextDayAt }

/**
 * The active reading time of one reader visit (spec 3B §3.1). Pure: the
 * caller passes the time of every event and stores the pieces it gets back.
 */
export function createReadingClock(days: DayFns = LOCAL_DAYS): ReadingClock {
  let shown = false
  let paused = false
  // When the time of the page shown started running; null while it stands.
  let since: number | null = null
  // This page's time in sight, and how much of it was handed over.
  let pageMs = 0
  let countedMs = 0
  // Stretches of this page not handed over yet: kept until the page counts.
  let held: Array<readonly [number, number]> = []

  function stop(at: number) {
    if (since === null) return
    if (at > since) {
      held.push([since, at])
      pageMs += at - since
    }
    since = null
  }

  function run(at: number) {
    if (shown && !paused && since === null) since = at
  }

  /** The held time once the page counts, up to the cap, split at midnights. */
  function release(): Array<ClockPiece> {
    if (pageMs < PAGE_READ_MS.min) return []
    let left = Math.min(pageMs, PAGE_READ_MS.max) - countedMs
    const byDay = new Map<string, number>()
    for (const [from, to] of held) {
      let start = from
      while (left > 0 && start < to) {
        const end = Math.min(to, days.nextDayAt(start), start + left)
        const day = days.dayOf(start)
        byDay.set(day, (byDay.get(day) ?? 0) + end - start)
        left -= end - start
        countedMs += end - start
        start = end
      }
    }
    held = []
    return [...byDay].map(([day, ms]) => ({ day, ms }))
  }

  return {
    show(at) {
      stop(at)
      const pieces = release()
      shown = true
      pageMs = 0
      countedMs = 0
      held = []
      run(at)
      return pieces
    },
    pause(at) {
      stop(at)
      paused = true
      return release()
    },
    resume(at) {
      paused = false
      run(at)
    },
    tick(at) {
      if (since !== null) {
        stop(at)
        run(at)
      }
      return release()
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/dates.test.ts src/lib/reading-clock.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/lib/dates.ts src/lib/dates.test.ts src/lib/reading-clock.ts src/lib/reading-clock.test.ts
git add src/lib/dates.ts src/lib/dates.test.ts src/lib/reading-clock.ts src/lib/reading-clock.test.ts
git commit -m "feat(habit): a reading clock that counts pages read, by local day"
```

---

### Task 3: Perhitungan kebiasaan (murni)

**Files:**
- Create: `src/lib/habit/types.ts`
- Create: `src/lib/reading-habit.ts`
- Create: `src/lib/reading-habit.test.ts`

**Interfaces:**
- Consumes: `addDays`, `mondayOf`, `localDay` (Task 2).
- Produces (`src/lib/habit/types.ts`):

```ts
export const DAILY_GOALS = [5, 10, 15, 20, 30, 45, 60] as const
export type DailyGoal = (typeof DAILY_GOALS)[number]
export const MAX_READING_TIME_BATCH = 50
export const WHOLE_DAY_SECONDS = 86_400
/** One day of reading on every device and book. */
export type HabitDay = { day: string; seconds: number; goalMinutes: number | null }
export type HabitGoals = { dailyGoalMinutes: DailyGoal | null; yearlyGoalBooks: number | null }
/** What a device sends for one day and book: its running total. */
export type ReadingTimeEntry = { day: string; bookId: string; seconds: number; goalMinutes: DailyGoal | null }
export type HabitAnswer = { ok: true; days: Array<HabitDay>; goals: HabitGoals } | { ok: false; code: string }
/** This device's totals per day, as stored on it. */
export type LocalDayTotals = Record<string, { seconds: number; goalMinutes: number | null }>
```

- Produces (`src/lib/reading-habit.ts`):
  - `DEFAULT_DAY_SECONDS = 300`, `FREE_GAPS_PER_WEEK = 2`;
  - `type PlantStage = "biji" | "tunas" | "daun" | "rimbun" | "kuncup" | "berbunga"`, `PLANT_STAGE_LABELS: Record<PlantStage, string>`;
  - `plantStage(streak: number): PlantStage`, `goalSeconds(goalMinutes: number | null): number`;
  - `type HabitSummary = { streak: number; record: number; gapsLeft: number; todaySeconds: number; todayGoalSeconds: number; todayDone: boolean; stage: PlantStage; hasHistory: boolean }`;
  - `habitSummary(days: ReadonlyArray<HabitDay>, today: string, goalMinutes: number | null): HabitSummary`;
  - `type CalendarCell = { day: string; seconds: number; state: "read" | "some" | "none" | "future" }`;
  - `calendarCells(days, today, goalMinutes, weeks?: number): Array<Array<CalendarCell>>`;
  - `booksThisYear(books: ReadonlyArray<{ finishedAt: string | null }>, today: string): number`;
  - `mergeDays(server: ReadonlyArray<HabitDay>, local: LocalDayTotals, sentAtFetch: Readonly<Record<string, number>>): Array<HabitDay>`.

- [ ] **Step 1: Write the failing test**

Buat `src/lib/reading-habit.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { HabitDay } from "./habit/types"
import {
  booksThisYear,
  calendarCells,
  habitSummary,
  mergeDays,
  plantStage,
} from "./reading-habit"

// Friday 6 November 2026; its week starts on Monday 2 November.
const TODAY = "2026-11-06"
const read = (day: string, seconds = 600, goalMinutes: number | null = null): HabitDay => ({
  day,
  seconds,
  goalMinutes,
})

describe("habitSummary", () => {
  it("starts with a seed and two gaps for a member who never read", () => {
    expect(habitSummary([], TODAY, null)).toEqual({
      streak: 0,
      record: 0,
      gapsLeft: 2,
      todaySeconds: 0,
      todayGoalSeconds: 300,
      todayDone: false,
      stage: "biji",
      hasHistory: false,
    })
  })

  it("counts today once it reaches five minutes", () => {
    const summary = habitSummary([read(TODAY, 300)], TODAY, null)
    expect(summary).toMatchObject({ streak: 1, todayDone: true, stage: "tunas" })
  })

  it("does not count a short day, but knows there is history", () => {
    const summary = habitSummary([read(TODAY, 200)], TODAY, null)
    expect(summary).toMatchObject({ streak: 0, todayDone: false, hasHistory: true })
  })

  it("lets a weekend off keep the streak", () => {
    const days = [
      ...["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"],
      ...["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"],
    ].map((day) => read(day))
    expect(habitSummary(days, TODAY, null)).toMatchObject({
      streak: 9,
      record: 9,
      gapsLeft: 2,
      stage: "rimbun",
    })
  })

  it("breaks the streak when the third empty day of a week ends", () => {
    const days = [read("2026-11-02")]
    // Tuesday, Wednesday and Thursday empty.
    expect(habitSummary(days, TODAY, null)).toMatchObject({
      streak: 0,
      record: 1,
      gapsLeft: 2,
      stage: "biji",
    })
    expect(habitSummary([...days, read(TODAY)], TODAY, null)).toMatchObject({
      streak: 1,
      record: 1,
    })
  })

  it("counts the gaps used this week", () => {
    const days = [read("2026-11-02"), read("2026-11-05")]
    expect(habitSummary(days, TODAY, null)).toMatchObject({
      streak: 2,
      gapsLeft: 0,
    })
  })

  it("does not count the days before a streak began as gaps", () => {
    const days = [read("2026-11-05"), read(TODAY)]
    expect(habitSummary(days, TODAY, null)).toMatchObject({
      streak: 2,
      gapsLeft: 2,
    })
  })

  it("keeps each past day's own goal, and uses today's goal for today", () => {
    const days = [read("2026-11-05", 600, 5), read(TODAY, 600)]
    expect(habitSummary(days, TODAY, 20)).toMatchObject({
      streak: 1,
      todayDone: false,
      todayGoalSeconds: 1200,
    })
    // A past day under its own goal was not a reading day.
    expect(
      habitSummary([read("2026-11-05", 600, 20)], TODAY, null)
    ).toMatchObject({ streak: 0 })
  })

  it("remembers the longest streak", () => {
    const old = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"].map(
      (day) => read(day)
    )
    const now = [read("2026-11-05"), read(TODAY)]
    expect(habitSummary([...old, ...now], TODAY, null)).toMatchObject({
      streak: 2,
      record: 4,
    })
  })
})

describe("plantStage", () => {
  it("grows with the streak", () => {
    const stages = [0, 1, 2, 3, 6, 7, 20, 21, 49, 50, 300].map(plantStage)
    expect(stages).toEqual([
      "biji",
      "tunas",
      "tunas",
      "daun",
      "daun",
      "rimbun",
      "rimbun",
      "kuncup",
      "kuncup",
      "berbunga",
      "berbunga",
    ])
  })
})

describe("calendarCells", () => {
  it("lays out five weeks from Monday, with the days after today left out", () => {
    const weeks = calendarCells(
      [read("2026-11-04", 900), read("2026-11-05", 120), read("2026-10-05", 400)],
      TODAY,
      null
    )
    expect(weeks).toHaveLength(5)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks[0][0]).toEqual({ day: "2026-10-05", seconds: 400, state: "read" })
    const last = weeks[4]
    expect(last.map((cell) => cell.day)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ])
    expect(last.map((cell) => cell.state)).toEqual([
      "none",
      "none",
      "read",
      "some",
      "none",
      "future",
      "future",
    ])
  })

  it("judges today by the goal set now", () => {
    const [cell] = calendarCells([read(TODAY, 600)], TODAY, 20)[4].slice(4)
    expect(cell.state).toBe("some")
  })
})

describe("booksThisYear", () => {
  it("counts the books finished in this year", () => {
    expect(
      booksThisYear(
        [
          { finishedAt: "2026-06-01T10:00:00Z" },
          { finishedAt: "2026-02-11T10:00:00Z" },
          { finishedAt: "2025-12-15T10:00:00Z" },
          { finishedAt: null },
        ],
        TODAY
      )
    ).toBe(2)
  })
})

describe("mergeDays", () => {
  it("adds what this device has not sent yet, once", () => {
    const merged = mergeDays(
      [read("2026-11-05", 600, 5), read(TODAY, 100)],
      {
        "2026-11-04": { seconds: 30, goalMinutes: null },
        [TODAY]: { seconds: 160, goalMinutes: 10 },
        "2026-11-05": { seconds: 50, goalMinutes: 5 },
      },
      { [TODAY]: 100, "2026-11-05": 50 }
    )
    expect(merged).toEqual([
      read("2026-11-04", 30, null),
      read("2026-11-05", 600, 5),
      read(TODAY, 160, null),
    ])
  })

  it("never goes past a whole day", () => {
    const merged = mergeDays(
      [read(TODAY, 86_000)],
      { [TODAY]: { seconds: 1_000, goalMinutes: null } },
      {}
    )
    expect(merged[0].seconds).toBe(86_400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reading-habit.test.ts`
Expected: FAIL, karena `./reading-habit` tidak ditemukan.

- [ ] **Step 3: Implement**

Buat `src/lib/habit/types.ts` dengan isi persis seperti blok **Produces** di atas, ditambah komentar satu baris per tipe.

Buat `src/lib/reading-habit.ts`:

```ts
import { addDays, localDay, mondayOf } from "./dates"
import {
  type HabitDay,
  type LocalDayTotals,
  WHOLE_DAY_SECONDS,
} from "./habit/types"

/** A reading day without a goal: five minutes (spec 3B §3.2). */
export const DEFAULT_DAY_SECONDS = 300
/** Days a week may go without reading before the streak ends (spec 3B §3.3). */
export const FREE_GAPS_PER_WEEK = 2

export type PlantStage =
  "biji" | "tunas" | "daun" | "rimbun" | "kuncup" | "berbunga"

export const PLANT_STAGE_LABELS: Record<PlantStage, string> = {
  biji: "Biji",
  tunas: "Tunas",
  daun: "Daun",
  rimbun: "Rimbun",
  kuncup: "Kuncup",
  berbunga: "Berbunga",
}

/** The plant grows with the streak and never wilts (spec 3B §3.5). */
export function plantStage(streak: number): PlantStage {
  if (streak >= 50) return "berbunga"
  if (streak >= 21) return "kuncup"
  if (streak >= 7) return "rimbun"
  if (streak >= 3) return "daun"
  if (streak >= 1) return "tunas"
  return "biji"
}

export const goalSeconds = (goalMinutes: number | null): number =>
  goalMinutes === null ? DEFAULT_DAY_SECONDS : goalMinutes * 60

export type HabitSummary = {
  /** Reading days in the current streak; 0 without one. */
  streak: number
  record: number
  /** Free days left this week. */
  gapsLeft: number
  todaySeconds: number
  todayGoalSeconds: number
  todayDone: boolean
  stage: PlantStage
  /** The member read at some point, even for a minute. */
  hasHistory: boolean
}

/**
 * The streak with free days (spec 3B §3.3): weeks run Monday to Sunday, and
 * a streak ends when the third day of a week without reading is over. Past
 * days keep their own goal; today uses the goal set now.
 */
export function habitSummary(
  days: ReadonlyArray<HabitDay>,
  today: string,
  goalMinutes: number | null
): HabitSummary {
  const byDay = new Map(days.map((entry) => [entry.day, entry]))
  const isReadingDay = (day: string) => {
    const entry = byDay.get(day)
    return (
      entry !== undefined && entry.seconds >= goalSeconds(entry.goalMinutes)
    )
  }
  const todaySeconds = byDay.get(today)?.seconds ?? 0
  const todayGoalSeconds = goalSeconds(goalMinutes)
  const todayDone = todaySeconds >= todayGoalSeconds

  const firstDay = days
    .map((entry) => entry.day)
    .filter((day) => day < today && isReadingDay(day))
    .sort()[0] as string | undefined

  let streak = 0
  let record = 0
  let active = false
  let gaps = 0
  let week = ""
  if (firstDay !== undefined) {
    for (let day = firstDay; day < today; day = addDays(day, 1)) {
      const monday = mondayOf(day)
      if (!active) {
        if (isReadingDay(day)) {
          active = true
          streak = 1
          gaps = 0
          week = monday
        }
        continue
      }
      if (monday !== week) {
        week = monday
        gaps = 0
      }
      if (isReadingDay(day)) {
        streak += 1
      } else {
        gaps += 1
        if (gaps > FREE_GAPS_PER_WEEK) {
          record = Math.max(record, streak)
          active = false
          streak = 0
        }
      }
    }
  }
  if (todayDone) {
    if (active) {
      streak += 1
    } else {
      active = true
      streak = 1
      gaps = 0
      week = mondayOf(today)
    }
  }
  record = Math.max(record, streak)
  const gapsLeft =
    active && week === mondayOf(today)
      ? FREE_GAPS_PER_WEEK - gaps
      : FREE_GAPS_PER_WEEK

  return {
    streak,
    record,
    gapsLeft,
    todaySeconds,
    todayGoalSeconds,
    todayDone,
    stage: plantStage(streak),
    hasHistory: days.some((entry) => entry.seconds > 0),
  }
}

export type CalendarCell = {
  day: string
  seconds: number
  /** read: a reading day; some: read, under the goal; future: after today. */
  state: "read" | "some" | "none" | "future"
}

/** The last `weeks` weeks, Monday first, this week last (spec 3B §4.2). */
export function calendarCells(
  days: ReadonlyArray<HabitDay>,
  today: string,
  goalMinutes: number | null,
  weeks = 5
): Array<Array<CalendarCell>> {
  const byDay = new Map(days.map((entry) => [entry.day, entry]))
  const start = addDays(mondayOf(today), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (__, weekday): CalendarCell => {
      const day = addDays(start, week * 7 + weekday)
      if (day > today) return { day, seconds: 0, state: "future" }
      const entry = byDay.get(day)
      const seconds = entry?.seconds ?? 0
      const goal =
        day === today
          ? goalSeconds(goalMinutes)
          : goalSeconds(entry?.goalMinutes ?? null)
      const state = seconds >= goal ? "read" : seconds > 0 ? "some" : "none"
      return { day, seconds, state }
    })
  )
}

/** Books marked finished (Tahap 3A) in today's year, by local date. */
export function booksThisYear(
  books: ReadonlyArray<{ finishedAt: string | null }>,
  today: string
): number {
  const year = today.slice(0, 4)
  return books.filter(
    (book) =>
      book.finishedAt !== null &&
      localDay(Date.parse(book.finishedAt)).slice(0, 4) === year
  ).length
}

/**
 * The server's days plus what this device read since it fetched them
 * (spec 3B §5.4): its totals minus what it had sent by then. A day only this
 * device knows takes the goal stored with it.
 */
export function mergeDays(
  server: ReadonlyArray<HabitDay>,
  local: LocalDayTotals,
  sentAtFetch: Readonly<Record<string, number>>
): Array<HabitDay> {
  const byDay = new Map(server.map((entry) => [entry.day, { ...entry }]))
  for (const [day, { seconds, goalMinutes }] of Object.entries(local)) {
    const extra = seconds - (sentAtFetch[day] ?? 0)
    if (extra <= 0) continue
    const entry = byDay.get(day)
    if (entry) {
      entry.seconds = Math.min(WHOLE_DAY_SECONDS, entry.seconds + extra)
    } else {
      byDay.set(day, {
        day,
        seconds: Math.min(WHOLE_DAY_SECONDS, extra),
        goalMinutes,
      })
    }
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}
```

Catatan untuk implementer: di test `mergeDays` pertama, hari `TODAY` punya baris server, jadi `goalMinutes` server (`null`) dipertahankan. Hari ini memang selalu dinilai dengan target sekarang (Keputusan 12).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/reading-habit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/lib/habit/types.ts src/lib/reading-habit.ts src/lib/reading-habit.test.ts
git add src/lib/habit/types.ts src/lib/reading-habit.ts src/lib/reading-habit.test.ts
git commit -m "feat(habit): streaks with free days, the plant's stage and the calendar"
```

---

### Task 4: Data kebiasaan — server function, Dexie, klien

**Files:**
- Create: `src/lib/habit/schemas.ts`
- Create: `src/server/habit.ts`
- Modify: `src/lib/local/db.ts`
- Modify: `src/lib/local/device.ts`
- Create: `src/lib/local/reading-time.ts`
- Create: `src/lib/local/reading-time.test.ts`
- Create: `src/lib/habit/habit-view.ts`
- Create: `src/lib/habit/habit-view.test.ts`
- Create: `src/lib/habit/habit-client.ts`
- Create: `src/lib/habit/habit-client.test.ts`

**Interfaces:**
- Consumes: tipe dari Task 3; `ClockPiece` (Task 2); `createQueueSync`, `QueueStore`, `QueueAnswer`, `QueueResult` (`src/lib/sync/queue-sync.ts`); `localDay` (Task 2); `habitSummary`, `mergeDays` (Task 3).
- Produces:
  - `src/server/habit.ts`:
    - `recordReadingTimeFn({ data: { deviceId: string; entries: Array<ReadingTimeEntry> }, fetch? }) → Promise<QueueAnswer>`;
    - `loadHabitFn() → Promise<HabitAnswer>`;
    - `updateGoalsFn({ data: HabitGoals }) → Promise<ActionResult>`.
  - `src/lib/local/device.ts`: `deviceId(): Promise<string>`.
  - `src/lib/local/reading-time.ts`:
    - `readingTimeKey(entry: { day: string; bookId: string }): string`;
    - `addReadingTime(bookId: string, pieces: ReadonlyArray<ClockPiece>, goalMinutes: DailyGoal | null): Promise<void>`;
    - `localReadingTimeStore: QueueStore<ReadingTimeEntry>`;
    - `localDayTotals(): Promise<LocalDayTotals>`, `localSentTotals(): Promise<Record<string, number>>`;
    - `type HabitCache = { days: Array<HabitDay>; goals: HabitGoals; sentAtFetch: Record<string, number> }`;
    - `loadHabitCache(): Promise<HabitCache | null>`, `saveHabitCache(cache: HabitCache): Promise<void>`;
    - `pruneReadingTime(today: string): Promise<void>`.
  - `src/lib/habit/habit-view.ts`:
    - `type HabitState = { cache: HabitCache | null; local: LocalDayTotals; status: "loading" | "ready" | "failed" }`;
    - `type HabitView = { today: string; days: Array<HabitDay>; goals: HabitGoals; summary: HabitSummary; status: "loading" | "ready" | "stale" | "failed"; canEditGoals: boolean }`;
    - `NO_GOALS: HabitGoals`;
    - `habitView(state: HabitState, today: string): HabitView`.
  - `src/lib/habit/habit-client.ts`:
    - `habitSync(): QueueSync`;
    - `recordReadingTime(bookId: string, pieces: ReadonlyArray<ClockPiece>): Promise<void>`;
    - `refreshHabit(): Promise<void>` (tidak pernah reject; identitas tetap untuk `useQueueFlush`);
    - `saveGoals(goals: HabitGoals): Promise<ActionResult>`;
    - `useReadingHabit(): HabitView`.

- [ ] **Step 1: Write the failing tests**

Buat `src/lib/local/reading-time.test.ts`:

```ts
// @vitest-environment node
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import { localDb } from "./db"
import { clearLocalData, deviceId } from "./device"
import {
  addReadingTime,
  loadHabitCache,
  localDayTotals,
  localReadingTimeStore,
  localSentTotals,
  pruneReadingTime,
  saveHabitCache,
} from "./reading-time"

const BOOK = "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e"
const OTHER = "7d6c5b4a-3f2e-4d1c-8b0a-1f2e3d4c5b6a"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

beforeEach(async () => {
  await clearLocalData()
})

describe("reading time on this device", () => {
  it("adds pieces up per day and book, and sends whole seconds", async () => {
    await addReadingTime(BOOK, [{ day: "2026-11-06", ms: 12_400 }], null)
    await addReadingTime(
      BOOK,
      [
        { day: "2026-11-06", ms: 30_000 },
        { day: "2026-11-07", ms: 900 },
      ],
      10
    )
    await addReadingTime(OTHER, [{ day: "2026-11-06", ms: 5_000 }], 10)
    expect(await localReadingTimeStore.pending()).toEqual([
      { day: "2026-11-06", bookId: BOOK, seconds: 42, goalMinutes: 10 },
      { day: "2026-11-06", bookId: OTHER, seconds: 5, goalMinutes: 10 },
    ])
    expect(await localDayTotals()).toEqual({
      "2026-11-06": { seconds: 47, goalMinutes: 10 },
      "2026-11-07": { seconds: 0, goalMinutes: 10 },
    })
  })

  it("stops sending what the server confirmed, until more is read", async () => {
    await addReadingTime(BOOK, [{ day: "2026-11-06", ms: 20_000 }], null)
    const [entry] = await localReadingTimeStore.pending()
    await localReadingTimeStore.confirm([entry])
    expect(await localReadingTimeStore.pending()).toEqual([])
    expect(await localSentTotals()).toEqual({ "2026-11-06": 20 })
    await addReadingTime(BOOK, [{ day: "2026-11-06", ms: 6_000 }], null)
    expect(await localReadingTimeStore.pending()).toEqual([
      { day: "2026-11-06", bookId: BOOK, seconds: 26, goalMinutes: null },
    ])
  })

  it("drops an entry the server refused", async () => {
    await addReadingTime(BOOK, [{ day: "2026-11-06", ms: 9_000 }], null)
    const [entry] = await localReadingTimeStore.pending()
    await localReadingTimeStore.revert(entry)
    expect(await localReadingTimeStore.pending()).toEqual([])
  })

  it("prunes old rows only once they are sent", async () => {
    await addReadingTime(BOOK, [{ day: "2026-09-01", ms: 10_000 }], null)
    await addReadingTime(OTHER, [{ day: "2026-09-02", ms: 10_000 }], null)
    const [sent] = await localReadingTimeStore.pending()
    await localReadingTimeStore.confirm([sent])
    await pruneReadingTime("2026-11-06")
    expect(Object.keys(await localDayTotals())).toEqual(["2026-09-02"])
  })

  it("keeps the last answer from the server", async () => {
    expect(await loadHabitCache()).toBeNull()
    const cache = {
      days: [{ day: "2026-11-06", seconds: 60, goalMinutes: null }],
      goals: { dailyGoalMinutes: 20 as const, yearlyGoalBooks: 12 },
      sentAtFetch: { "2026-11-06": 60 },
    }
    await saveHabitCache(cache)
    expect(await loadHabitCache()).toEqual(cache)
  })

  it("gives this device one id, and a new one after the data is wiped", async () => {
    const first = await deviceId()
    expect(first).toMatch(UUID)
    expect(await deviceId()).toBe(first)
    await addReadingTime(BOOK, [{ day: "2026-11-06", ms: 10_000 }], null)
    await clearLocalData()
    expect(await deviceId()).not.toBe(first)
    expect(await localDb().readingTime.count()).toBe(0)
  })
})
```

Buat `src/lib/habit/habit-view.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { type HabitState, NO_GOALS, habitView } from "./habit-view"

const TODAY = "2026-11-06"
const cache = {
  days: [{ day: TODAY, seconds: 100, goalMinutes: null }],
  goals: { dailyGoalMinutes: 10 as const, yearlyGoalBooks: null },
  sentAtFetch: { [TODAY]: 100 },
}
const state = (changes: Partial<HabitState>): HabitState => ({
  cache: null,
  local: {},
  status: "loading",
  ...changes,
})

describe("habitView", () => {
  it("waits while nothing is known", () => {
    const view = habitView(state({}), TODAY)
    expect(view.status).toBe("loading")
    expect(view.goals).toEqual(NO_GOALS)
    expect(view.canEditGoals).toBe(false)
  })

  it("adds this device's unsent time to the server's", () => {
    const view = habitView(
      state({
        cache,
        status: "ready",
        local: { [TODAY]: { seconds: 700, goalMinutes: 10 } },
      }),
      TODAY
    )
    expect(view.summary.todaySeconds).toBe(700)
    expect(view.summary.todayGoalSeconds).toBe(600)
    expect(view.summary.todayDone).toBe(true)
    expect(view.canEditGoals).toBe(true)
  })

  it("is stale with a cache and failed without one", () => {
    expect(habitView(state({ cache, status: "failed" }), TODAY).status).toBe(
      "stale"
    )
    expect(habitView(state({ status: "failed" }), TODAY).status).toBe("failed")
  })
})
```

Buat `src/lib/habit/habit-client.test.ts`:

```ts
// @vitest-environment node
import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { localDay } from "@/lib/dates"

const mocks = vi.hoisted(() => ({
  recordReadingTimeFn: vi.fn(),
  loadHabitFn: vi.fn(),
  updateGoalsFn: vi.fn(),
}))
vi.mock("@/server/habit", () => mocks)

const BOOK = "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e"
const TODAY = localDay()
type Client = typeof import("./habit-client")
type View = typeof import("./habit-view")
let client: Client
let view: View

/** The state the hook would read, as a view. */
const current = () => view.habitView(client.habitStateForTests(), TODAY)

beforeEach(async () => {
  vi.stubGlobal("navigator", { onLine: true })
  vi.resetModules()
  const device = await import("@/lib/local/device")
  await device.clearLocalData()
  client = await import("./habit-client")
  view = await import("./habit-view")
  mocks.recordReadingTimeFn.mockImplementation(
    ({ data }: { data: { entries: Array<unknown> } }) =>
      Promise.resolve({ ok: true, results: data.entries.map(() => "ok") })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("habit client", () => {
  it("sends this device's time before it fetches, and counts it once", async () => {
    await client.recordReadingTime(BOOK, [{ day: TODAY, ms: 40_000 }])
    expect(current().summary.todaySeconds).toBe(40)
    mocks.loadHabitFn.mockResolvedValueOnce({
      ok: true,
      days: [{ day: TODAY, seconds: 40, goalMinutes: null }],
      goals: { dailyGoalMinutes: null, yearlyGoalBooks: null },
    })
    await client.refreshHabit()
    expect(mocks.recordReadingTimeFn).toHaveBeenCalledOnce()
    const [{ data, fetch }] = mocks.recordReadingTimeFn.mock.calls[0] as [
      { data: { deviceId: string; entries: Array<unknown> }; fetch: unknown },
    ]
    expect(data.entries).toEqual([
      { day: TODAY, bookId: BOOK, seconds: 40, goalMinutes: null },
    ])
    expect(typeof data.deviceId).toBe("string")
    expect(typeof fetch).toBe("function")
    expect(current().status).toBe("ready")
    expect(current().summary.todaySeconds).toBe(40)
  })

  it("keeps the last answer when a refresh fails", async () => {
    mocks.loadHabitFn.mockResolvedValueOnce({
      ok: true,
      days: [{ day: TODAY, seconds: 400, goalMinutes: null }],
      goals: { dailyGoalMinutes: 5, yearlyGoalBooks: null },
    })
    await client.refreshHabit()
    mocks.loadHabitFn.mockResolvedValueOnce({ ok: false, code: "unknown" })
    await client.refreshHabit()
    expect(current().status).toBe("stale")
    expect(current().summary.streak).toBe(1)
  })

  it("survives a refresh that throws", async () => {
    mocks.loadHabitFn.mockRejectedValueOnce(new Error("offline"))
    await expect(client.refreshHabit()).resolves.toBeUndefined()
    expect(current().status).toBe("failed")
  })

  it("puts the goals back when saving them fails", async () => {
    mocks.loadHabitFn.mockResolvedValueOnce({
      ok: true,
      days: [],
      goals: { dailyGoalMinutes: 10, yearlyGoalBooks: null },
    })
    await client.refreshHabit()
    mocks.updateGoalsFn.mockResolvedValueOnce({ ok: false, code: "unknown" })
    const result = await client.saveGoals({
      dailyGoalMinutes: 30,
      yearlyGoalBooks: 12,
    })
    expect(result).toEqual({ ok: false, code: "unknown" })
    expect(current().goals).toEqual({
      dailyGoalMinutes: 10,
      yearlyGoalBooks: null,
    })
    mocks.updateGoalsFn.mockResolvedValueOnce({ ok: true })
    await client.saveGoals({ dailyGoalMinutes: 30, yearlyGoalBooks: 12 })
    expect(current().goals).toEqual({ dailyGoalMinutes: 30, yearlyGoalBooks: 12 })
  })

  it("stores new time with the goal set now", async () => {
    mocks.loadHabitFn.mockResolvedValueOnce({
      ok: true,
      days: [],
      goals: { dailyGoalMinutes: 15, yearlyGoalBooks: null },
    })
    await client.refreshHabit()
    await client.recordReadingTime(BOOK, [{ day: TODAY, ms: 10_000 }])
    expect(client.habitStateForTests().local[TODAY]).toEqual({
      seconds: 10,
      goalMinutes: 15,
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/local/reading-time.test.ts src/lib/habit`
Expected: FAIL, karena modulnya belum ada.

- [ ] **Step 3: Schemas and server functions**

Buat `src/lib/habit/schemas.ts`:

```ts
import { z } from "zod"
import { DAILY_GOALS, MAX_READING_TIME_BATCH, WHOLE_DAY_SECONDS } from "./types"

const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const DailyGoalSchema = z.literal(DAILY_GOALS).nullable()

export const ReadingTimeEntrySchema = z.object({
  day: DaySchema,
  bookId: z.uuid(),
  seconds: z.number().int().min(0).max(WHOLE_DAY_SECONDS),
  goalMinutes: DailyGoalSchema,
})

export const RecordReadingTimeSchema = z.object({
  deviceId: z.uuid(),
  entries: z.array(ReadingTimeEntrySchema).min(1).max(MAX_READING_TIME_BATCH),
})

export const GoalsSchema = z.object({
  dailyGoalMinutes: DailyGoalSchema,
  yearlyGoalBooks: z.number().int().min(1).max(365).nullable(),
})
```

Buat `src/server/habit.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import type { ActionResult } from "@/lib/action-result"
import { GoalsSchema, RecordReadingTimeSchema } from "@/lib/habit/schemas"
import type {
  DailyGoal,
  HabitAnswer,
  HabitDay,
  HabitGoals,
  ReadingTimeEntry,
} from "@/lib/habit/types"
import type { QueueAnswer, QueueResult } from "@/lib/sync/queue-sync"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })
/** PostgREST answers at most this many rows at once. */
const PAGE = 1000

/**
 * Stores a device's running totals (spec 3B §5.2), one answer per entry.
 * Sent with keepalive by the queue, so it may outlive the page.
 */
export const recordReadingTimeFn = createServerFn({ method: "POST" })
  .validator(
    (data: { deviceId: string; entries: Array<ReadingTimeEntry> }) =>
      RecordReadingTimeSchema.parse(data)
  )
  .handler(async ({ data }): Promise<QueueAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data: results, error } = await supabase.rpc(
      "record_reading_time",
      {
        p_entries: data.entries.map((entry) => ({
          day: entry.day,
          device_id: data.deviceId,
          book_id: entry.bookId,
          seconds: entry.seconds,
          goal_minutes: entry.goalMinutes,
        })),
      }
    )
    if (error) {
      if (error.message === "not_authenticated") {
        return fail("not_authenticated")
      }
      logServerError("record_reading_time failed", error)
      return fail("unknown")
    }
    return { ok: true, results: results as Array<QueueResult> }
  })

/** Every day read and the member's goals (spec 3B §5.2, §5.3). */
export const loadHabitFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<HabitAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const profile = await supabase
      .from("profiles")
      .select("daily_goal_minutes, yearly_goal_books")
      .eq("id", user.id)
      .single()
    if (profile.error) {
      logServerError("reading goals lookup failed", profile.error)
      return fail("unknown")
    }

    const days: Array<HabitDay> = []
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await supabase
        .rpc("reading_days")
        .range(from, from + PAGE - 1)
      if (error) {
        logServerError("reading_days failed", error)
        return fail("unknown")
      }
      for (const row of rows) {
        days.push({
          day: row.day,
          seconds: row.seconds,
          goalMinutes: row.goal_minutes as number | null,
        })
      }
      if (rows.length < PAGE) break
    }
    const goals: HabitGoals = {
      dailyGoalMinutes: profile.data.daily_goal_minutes as DailyGoal | null,
      yearlyGoalBooks: profile.data.yearly_goal_books,
    }
    return { ok: true, days, goals }
  }
)

/** Sets both goals at once; null is no goal (spec 3B §3.4). */
export const updateGoalsFn = createServerFn({ method: "POST" })
  .validator((data: HabitGoals) => GoalsSchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { error } = await supabase
      .from("profiles")
      .update({
        daily_goal_minutes: data.dailyGoalMinutes,
        yearly_goal_books: data.yearlyGoalBooks,
      })
      .eq("id", user.id)
    if (error) {
      logServerError("saving reading goals failed", error)
      return fail("unknown")
    }
    return { ok: true }
  })
```

- [ ] **Step 4: Dexie table and device id**

Di `src/lib/local/db.ts`:
- tambahkan tipe `LocalReadingTime`:

```ts
/**
 * This device's reading time for one local day and book (spec 3B §5.4), in
 * milliseconds; `sentSeconds` is the total the server confirmed.
 */
export type LocalReadingTime = {
  key: string
  day: string
  bookId: string
  ms: number
  sentSeconds: number
  goalMinutes: DailyGoal | null
}
```
- impor `type DailyGoal` dari `@/lib/habit/types`;
- tambahkan field `readingTime!: EntityTable<LocalReadingTime, "key">` di kelas;
- setelah versi 3, tambahkan:

```ts
    // Tahap 3B: reading time per day and book (spec 3B §5.4).
    this.version(4).stores({
      readingTime: "key, day",
    })
```

Di `src/lib/local/device.ts`:
- tambahkan `db.readingTime` ke daftar `tables` di `wipeMemberData`, dan ubah komentar fungsi menjadi "Drops the member's books, positions, Kosakata, annotations, reading time, shelf snapshot, cached covers and reader settings.";
- tambahkan di bawah `clearLocalData`:

```ts
const DEVICE_KEY = "deviceId"

/**
 * This device's id for reading time (spec 3B §5.4). Wiping the member's data
 * drops it, and the device starts over under a new id: its old rows stay
 * counted on the server.
 */
export async function deviceId(): Promise<string> {
  const db = localDb()
  return db.transaction("rw", db.meta, async () => {
    const stored = await db.meta.get(DEVICE_KEY)
    if (typeof stored?.value === "string") return stored.value
    const id = crypto.randomUUID()
    await db.meta.put({ key: DEVICE_KEY, value: id })
    return id
  })
}
```

- [ ] **Step 5: Local reading time store**

Buat `src/lib/local/reading-time.ts`:

```ts
import { addDays } from "@/lib/dates"
import type {
  DailyGoal,
  HabitDay,
  HabitGoals,
  LocalDayTotals,
  ReadingTimeEntry,
} from "@/lib/habit/types"
import { WHOLE_DAY_SECONDS } from "@/lib/habit/types"
import type { ClockPiece } from "@/lib/reading-clock"
import type { QueueStore } from "@/lib/sync/queue-sync"
import { type LocalReadingTime, localDb } from "./db"

const CACHE_KEY = "habit"
/** Sent rows older than this many days leave the device. */
const KEEP_DAYS = 40

export const readingTimeKey = (entry: { day: string; bookId: string }) =>
  `${entry.day} ${entry.bookId}`

const secondsOf = (row: LocalReadingTime) =>
  Math.min(WHOLE_DAY_SECONDS, Math.floor(row.ms / 1000))

/** Adds the clock's pieces to this device's totals, with the goal set now. */
export async function addReadingTime(
  bookId: string,
  pieces: ReadonlyArray<ClockPiece>,
  goalMinutes: DailyGoal | null
): Promise<void> {
  if (pieces.length === 0) return
  const db = localDb()
  await db.transaction("rw", db.readingTime, async () => {
    for (const piece of pieces) {
      const key = readingTimeKey({ day: piece.day, bookId })
      const row = await db.readingTime.get(key)
      await db.readingTime.put({
        key,
        day: piece.day,
        bookId,
        ms: (row?.ms ?? 0) + piece.ms,
        sentSeconds: row?.sentSeconds ?? 0,
        goalMinutes,
      })
    }
  })
}

async function markSent(entries: ReadonlyArray<ReadingTimeEntry>) {
  const db = localDb()
  await db.transaction("rw", db.readingTime, async () => {
    for (const entry of entries) {
      const row = await db.readingTime.get(readingTimeKey(entry))
      if (row && row.sentSeconds < entry.seconds) {
        await db.readingTime.put({ ...row, sentSeconds: entry.seconds })
      }
    }
  })
}

/** The queue's view: a row waits while it holds more whole seconds than were sent. */
export const localReadingTimeStore: QueueStore<ReadingTimeEntry> = {
  async pending() {
    const rows = await localDb().readingTime.orderBy("day").toArray()
    return rows
      .filter((row) => secondsOf(row) > row.sentSeconds)
      .map((row) => ({
        day: row.day,
        bookId: row.bookId,
        seconds: secondsOf(row),
        goalMinutes: row.goalMinutes,
      }))
  },
  confirm: markSent,
  // A refused entry would be refused again: it is not sent any more.
  revert: (entry) => markSent([entry]),
}

/** This device's whole seconds per day, with the goal of the row written last. */
export async function localDayTotals(): Promise<LocalDayTotals> {
  const totals: LocalDayTotals = {}
  const rows = await localDb().readingTime.orderBy("day").toArray()
  for (const row of rows) {
    const day = totals[row.day] ?? { seconds: 0, goalMinutes: null }
    totals[row.day] = {
      seconds: day.seconds + secondsOf(row),
      goalMinutes: row.goalMinutes,
    }
  }
  return totals
}

/** What the server had confirmed per day: the base the next fetch is read against. */
export async function localSentTotals(): Promise<Record<string, number>> {
  const sent: Record<string, number> = {}
  for (const row of await localDb().readingTime.toArray()) {
    sent[row.day] = (sent[row.day] ?? 0) + row.sentSeconds
  }
  return sent
}

/** Drops sent rows older than 40 days; unsent ones wait for the queue. */
export async function pruneReadingTime(today: string): Promise<void> {
  const before = addDays(today, -KEEP_DAYS)
  const db = localDb()
  const old = await db.readingTime.where("day").below(before).toArray()
  const done = old.filter((row) => row.sentSeconds >= secondsOf(row))
  await db.readingTime.bulkDelete(done.map((row) => row.key))
}

/** The server's last answer, kept for offline (spec 3B §5.4). */
export type HabitCache = {
  days: Array<HabitDay>
  goals: HabitGoals
  sentAtFetch: Record<string, number>
}

export async function loadHabitCache(): Promise<HabitCache | null> {
  const stored = await localDb().meta.get(CACHE_KEY)
  return (stored?.value as HabitCache | undefined) ?? null
}

export async function saveHabitCache(cache: HabitCache): Promise<void> {
  await localDb().meta.put({ key: CACHE_KEY, value: cache })
}
```

Catatan: test "adds pieces up" mengharapkan total hari `2026-11-07` bernilai `{ seconds: 0, goalMinutes: 10 }`. Ini karena 900 ms dibulatkan ke bawah menjadi 0 detik, dan baris dengan 0 detik tidak ikut `pending()`.

- [ ] **Step 6: View and client**

Buat `src/lib/habit/habit-view.ts`:

```ts
import type { HabitCache } from "@/lib/local/reading-time"
import { type HabitSummary, habitSummary, mergeDays } from "@/lib/reading-habit"
import type { HabitDay, HabitGoals, LocalDayTotals } from "./types"

export type HabitState = {
  cache: HabitCache | null
  local: LocalDayTotals
  /** failed: the last refresh did not reach the server. */
  status: "loading" | "ready" | "failed"
}

export type HabitView = {
  today: string
  days: Array<HabitDay>
  goals: HabitGoals
  summary: HabitSummary
  /** stale: an older answer from this device; failed: nothing to show. */
  status: "loading" | "ready" | "stale" | "failed"
  /** Goals change only once the server's goals are known. */
  canEditGoals: boolean
}

export const NO_GOALS: HabitGoals = {
  dailyGoalMinutes: null,
  yearlyGoalBooks: null,
}

export function habitView(state: HabitState, today: string): HabitView {
  const { cache } = state
  const days = mergeDays(
    cache?.days ?? [],
    state.local,
    cache?.sentAtFetch ?? {}
  )
  const goals = cache?.goals ?? NO_GOALS
  const status =
    state.status === "failed"
      ? cache
        ? "stale"
        : "failed"
      : state.status === "loading" && !cache
        ? "loading"
        : "ready"
  return {
    today,
    days,
    goals,
    summary: habitSummary(days, today, goals.dailyGoalMinutes),
    status,
    canEditGoals: cache !== null,
  }
}
```

Buat `src/lib/habit/habit-client.ts`:

```ts
import { useEffect, useMemo, useSyncExternalStore } from "react"
import type { ActionResult } from "@/lib/action-result"
import { localDay } from "@/lib/dates"
import { deviceId } from "@/lib/local/device"
import {
  addReadingTime,
  loadHabitCache,
  localDayTotals,
  localReadingTimeStore,
  localSentTotals,
  pruneReadingTime,
  readingTimeKey,
  saveHabitCache,
} from "@/lib/local/reading-time"
import type { ClockPiece } from "@/lib/reading-clock"
import { type QueueSync, createQueueSync } from "@/lib/sync/queue-sync"
import { loadHabitFn, recordReadingTimeFn, updateGoalsFn } from "@/server/habit"
import { type HabitState, type HabitView, habitView } from "./habit-view"
import {
  type HabitGoals,
  MAX_READING_TIME_BATCH,
  type ReadingTimeEntry,
} from "./types"

const keepaliveFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, keepalive: true })

let state: HabitState = { cache: null, local: {}, status: "loading" }
const listeners = new Set<() => void>()

function setState(next: Partial<HabitState>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

/** For tests: the state the hook reads. */
export const habitStateForTests = (): HabitState => state

let engine: QueueSync | null = null

/** The one reading time queue of this tab (browser only). */
export function habitSync(): QueueSync {
  engine ??= createQueueSync<ReadingTimeEntry>({
    store: localReadingTimeStore,
    isOnline: () => navigator.onLine,
    keyOf: readingTimeKey,
    batchSize: MAX_READING_TIME_BATCH,
    // Often sent as the tab hides or the reader closes (plan 3B, decision 8).
    send: async (entries) =>
      recordReadingTimeFn({
        data: { deviceId: await deviceId(), entries },
        fetch: keepaliveFetch,
      }),
    onRefused: (refused) =>
      console.error("the server refused reading time", refused.length),
    debounceMs: 10_000,
  })
  return engine
}

async function reloadLocal() {
  setState({ local: await localDayTotals() })
}

let cacheRead: Promise<void> | null = null

/** Reads this device's copy once per tab, so views show numbers offline. */
function readCache(): Promise<void> {
  cacheRead ??= (async () => {
    const [cache, local] = await Promise.all([
      loadHabitCache(),
      localDayTotals(),
    ])
    // A refresh that finished first already has the newer answer.
    setState({ cache: state.cache ?? cache, local })
  })().catch((error: unknown) =>
    console.error("reading the reading habit on this device failed", error)
  )
  return cacheRead
}

/** Stores time the reader's clock handed over, then sends it after a pause. */
export async function recordReadingTime(
  bookId: string,
  pieces: ReadonlyArray<ClockPiece>
): Promise<void> {
  if (pieces.length === 0) return
  await readCache()
  await addReadingTime(
    bookId,
    pieces,
    state.cache?.goals.dailyGoalMinutes ?? null
  )
  await reloadLocal()
  habitSync().later()
}

/**
 * Sends the waiting time, then fetches every day and the goals (plan 3B,
 * decision 10). Never rejects: a failure keeps the last answer.
 */
export async function refreshHabit(): Promise<void> {
  try {
    await readCache()
    await habitSync().flush()
    const sentAtFetch = await localSentTotals()
    const answer = await loadHabitFn()
    if (!answer.ok) {
      setState({ status: "failed" })
      return
    }
    const cache = { days: answer.days, goals: answer.goals, sentAtFetch }
    await saveHabitCache(cache)
    await pruneReadingTime(localDay())
    setState({ cache, local: await localDayTotals(), status: "ready" })
  } catch (error) {
    console.error("refreshing the reading habit failed", error)
    setState({ status: "failed" })
  }
}

/** Saves both goals; shown at once, put back when the server refuses. */
export async function saveGoals(goals: HabitGoals): Promise<ActionResult> {
  const before = state.cache
  if (!before) return { ok: false, code: "offline" }
  setState({ cache: { ...before, goals } })
  let result: ActionResult
  try {
    result = await updateGoalsFn({ data: goals })
  } catch {
    result = { ok: false, code: "unknown" }
  }
  if (!result.ok) {
    if (state.cache?.goals === goals) setState({ cache: before })
    return result
  }
  if (state.cache) await saveHabitCache(state.cache)
  return result
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const SERVER_STATE: HabitState = { cache: null, local: {}, status: "loading" }

/** Streak, goals and days for the lobby, the reader and the member card. */
export function useReadingHabit(): HabitView {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE
  )
  useEffect(() => {
    void readCache()
  }, [])
  const today = localDay()
  return useMemo(() => habitView(snapshot, today), [snapshot, today])
}
```

Catatan untuk implementer:
- `bookMessage("offline")` memberi "Butuh internet.", dan kode lain yang tidak dikenal (`unknown`) memberi teks cadangan "Ada yang tidak beres. Coba lagi sebentar lagi.".
- `fetch` sebagai opsi server function dipakai dengan cara yang sama oleh `progress-sync-client.ts`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/lib/local/reading-time.test.ts src/lib/habit src/lib/local/local.test.ts src/lib/local/annotations.test.ts`
Expected: PASS. Test lokal lama ikut dijalankan untuk memastikan versi Dexie 4 dan wipe yang baru tidak merusak apa pun.

Lalu: `npm run typecheck`
Expected: tidak ada error.

- [ ] **Step 8: Commit**

```bash
npx prettier --write src/lib/habit src/server/habit.ts src/lib/local
git add src/lib/habit src/server/habit.ts src/lib/local
git commit -m "feat(habit): reading time kept on the device, queued to the server, and read back once"
```

---

### Task 5: Reader — jam, cincin, toast

**Files:**
- Create: `src/components/reader/useReadingClock.ts`
- Create: `src/components/reader/useReadingClock.test.tsx`
- Create: `src/components/reader/HabitRing.tsx`
- Create: `src/components/reader/HabitRing.test.tsx`
- Create: `src/components/reader/GoalToast.tsx`
- Create: `src/components/reader/GoalToast.test.tsx`
- Modify: `src/components/reader/ReaderToolbar.tsx`, `src/components/reader/ReaderToolbar.test.tsx`
- Modify: `src/routes/_member/read.$bookId.tsx`
- Modify: `src/lib/local/keys.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `createReadingClock` (Task 2); `recordReadingTime`, `habitSync`, `refreshHabit`, `useReadingHabit` (Task 4); `useQueueFlush` (`src/lib/sync/use-queue-flush.ts`).
- Produces:
  - `useReadingClock(bookId: string, paused: boolean): { onPage: () => void }`;
  - `HabitRing({ seconds, goalSeconds, hasGoal })`;
  - `useGoalToast({ done, hasGoal, today, settled, barsShown }): boolean`;
  - `GoalToast()` (teks persis dari spec);
  - `HABIT_TOAST_KEY = "glosa:habit-toast"`;
  - prop `habit?: ReactNode` di `ReaderToolbar`.

- [ ] **Step 1: Write the failing tests**

Buat `src/components/reader/useReadingClock.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useReadingClock } from "./useReadingClock"

const mocks = vi.hoisted(() => ({
  recordReadingTime: vi.fn(() => Promise.resolve()),
  flush: vi.fn(() => Promise.resolve()),
}))
vi.mock("@/lib/habit/habit-client", () => ({
  recordReadingTime: mocks.recordReadingTime,
  habitSync: () => ({ flush: mocks.flush }),
}))

const BOOK = "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e"
const T0 = new Date(2026, 10, 6, 9, 0).getTime()
const recorded = () =>
  mocks.recordReadingTime.mock.calls.flatMap(
    (call) => (call as unknown as [string, Array<{ ms: number }>])[1]
  )
const total = () => recorded().reduce((sum, piece) => sum + piece.ms, 0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("useReadingClock", () => {
  it("records a page when the next one shows", () => {
    const { result } = renderHook(() => useReadingClock(BOOK, false))
    act(() => result.current.onPage())
    vi.setSystemTime(T0 + 20_000)
    act(() => result.current.onPage())
    expect(mocks.recordReadingTime).toHaveBeenLastCalledWith(BOOK, [
      { day: expect.any(String) as string, ms: 20_000 },
    ])
  })

  it("saves every 30 seconds while a page stays", () => {
    const { result } = renderHook(() => useReadingClock(BOOK, false))
    act(() => result.current.onPage())
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(total()).toBe(30_000)
  })

  it("stops while paused, and saves and sends when the reader closes", () => {
    const { result, rerender, unmount } = renderHook(
      ({ paused }) => useReadingClock(BOOK, paused),
      { initialProps: { paused: false } }
    )
    act(() => result.current.onPage())
    vi.setSystemTime(T0 + 10_000)
    rerender({ paused: true })
    vi.setSystemTime(T0 + 200_000)
    rerender({ paused: false })
    vi.setSystemTime(T0 + 206_000)
    unmount()
    expect(total()).toBe(16_000)
    expect(mocks.flush).toHaveBeenCalled()
  })

  it("stops while the tab is hidden", () => {
    const { result } = renderHook(() => useReadingClock(BOOK, false))
    act(() => result.current.onPage())
    vi.setSystemTime(T0 + 8_000)
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    })
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    vi.setSystemTime(T0 + 100_000)
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    vi.setSystemTime(T0 + 104_000)
    act(() => result.current.onPage())
    expect(total()).toBe(12_000)
  })
})
```

Buat `src/components/reader/HabitRing.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HabitRing } from "./HabitRing"

describe("HabitRing", () => {
  it("says the minutes against the goal", () => {
    render(<HabitRing seconds={12 * 60 + 40} goalSeconds={1200} hasGoal />)
    expect(
      screen.getByRole("img", { name: "12 dari 20 menit hari ini" })
    ).toBeInTheDocument()
  })

  it("says only the minutes without a goal", () => {
    render(<HabitRing seconds={90} goalSeconds={300} hasGoal={false} />)
    expect(
      screen.getByRole("img", { name: "1 menit hari ini" })
    ).toBeInTheDocument()
  })
})
```

Buat `src/components/reader/GoalToast.test.tsx`:

```tsx
import { act, render, renderHook, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HABIT_TOAST_KEY } from "@/lib/local/keys"
import { GoalToast, useGoalToast } from "./GoalToast"

const TODAY = "2026-11-06"
type Props = Parameters<typeof useGoalToast>[0]
const base: Props = {
  done: false,
  hasGoal: true,
  today: TODAY,
  settled: true,
  barsShown: true,
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useGoalToast", () => {
  it("shows once when the goal is reached during the visit", () => {
    const { result, rerender } = renderHook((props: Props) => useGoalToast(props), {
      initialProps: base,
    })
    expect(result.current).toBe(false)
    rerender({ ...base, done: true })
    expect(result.current).toBe(true)
    expect(localStorage.getItem(HABIT_TOAST_KEY)).toBe(TODAY)
    act(() => {
      vi.advanceTimersByTime(6_000)
    })
    expect(result.current).toBe(false)
  })

  it("stays quiet when the goal was reached before the reader opened", () => {
    const { result, rerender } = renderHook((props: Props) => useGoalToast(props), {
      initialProps: { ...base, done: true },
    })
    rerender({ ...base, done: true, barsShown: true })
    expect(result.current).toBe(false)
  })

  it("stays quiet without a goal, and once already shown today", () => {
    const { result, rerender } = renderHook((props: Props) => useGoalToast(props), {
      initialProps: { ...base, hasGoal: false },
    })
    rerender({ ...base, hasGoal: false, done: true })
    expect(result.current).toBe(false)

    localStorage.setItem(HABIT_TOAST_KEY, TODAY)
    const second = renderHook((props: Props) => useGoalToast(props), {
      initialProps: base,
    })
    second.rerender({ ...base, done: true })
    expect(second.result.current).toBe(false)
  })

  it("waits while the bars are hidden", () => {
    const { result, rerender } = renderHook((props: Props) => useGoalToast(props), {
      initialProps: { ...base, barsShown: false },
    })
    rerender({ ...base, done: true, barsShown: false })
    expect(result.current).toBe(false)
    rerender({ ...base, done: true, barsShown: true })
    expect(result.current).toBe(true)
  })

  it("waits until the day's numbers settled before judging the start", () => {
    const { result, rerender } = renderHook((props: Props) => useGoalToast(props), {
      initialProps: { ...base, settled: false },
    })
    rerender({ ...base, done: false })
    rerender({ ...base, done: true })
    expect(result.current).toBe(true)
  })
})

describe("GoalToast", () => {
  it("says the goal is reached", () => {
    render(<GoalToast />)
    expect(screen.getByRole("status")).toHaveTextContent(
      "Target hari ini tercapai. Selamat membaca terus."
    )
  })
})
```

Di `src/components/reader/ReaderToolbar.test.tsx`, tambahkan di dalam `describe("ReaderToolbar")`:

```tsx
  it("shows the habit ring it is given", async () => {
    renderWithRouter(
      <ReaderToolbar
        {...props}
        bookmarked={false}
        onBookmark={() => undefined}
        habit={<span>cincin</span>}
      />
    )
    expect(await screen.findByText("cincin")).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/reader/useReadingClock.test.tsx src/components/reader/HabitRing.test.tsx src/components/reader/GoalToast.test.tsx src/components/reader/ReaderToolbar.test.tsx`
Expected: FAIL, karena modulnya belum ada dan prop `habit` belum dikenal.

- [ ] **Step 3: Implement**

Tambahkan ke `src/lib/local/keys.ts`: `export const HABIT_TOAST_KEY = "glosa:habit-toast"`.

Buat `src/components/reader/useReadingClock.ts`:

```ts
import { useCallback, useEffect, useRef } from "react"
import { habitSync, recordReadingTime } from "@/lib/habit/habit-client"
import {
  type ClockPiece,
  type ReadingClock,
  createReadingClock,
} from "@/lib/reading-clock"

/** The clock saves what the page shown has counted this often (spec 3B §3.1). */
export const TICK_MS = 30_000

/**
 * Feeds the reader's events to the reading clock (spec 3B §6.2): pages shown,
 * the tab hidden, panels over the book, the reader left. Separate from the
 * reading speed, which measures pages differently.
 */
export function useReadingClock(
  bookId: string,
  paused: boolean
): { onPage: () => void } {
  const clockRef = useRef<ReadingClock | null>(null)
  clockRef.current ??= createReadingClock()

  const save = useCallback(
    (pieces: Array<ClockPiece>) =>
      recordReadingTime(bookId, pieces).catch((error: unknown) =>
        console.error("saving the reading time failed", error)
      ),
    [bookId]
  )

  useEffect(() => {
    const clock = clockRef.current
    if (!clock) return
    const sync = () => {
      const now = Date.now()
      if (document.visibilityState === "hidden") {
        void save(clock.pause(now)).then(() => habitSync().flush())
      } else if (paused) {
        void save(clock.pause(now))
      } else {
        clock.resume(now)
      }
    }
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [paused, save])

  useEffect(() => {
    const timer = setInterval(() => {
      const clock = clockRef.current
      if (clock) void save(clock.tick(Date.now()))
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [save])

  // Leaving the reader: the page shown counts, and the time goes at once.
  useEffect(
    () => () => {
      const clock = clockRef.current
      if (!clock) return
      void save(clock.pause(Date.now())).then(() => habitSync().flush())
    },
    [save]
  )

  const onPage = useCallback(() => {
    const clock = clockRef.current
    if (clock) void save(clock.show(Date.now()))
  }, [save])

  return { onPage }
}
```

Catatan: test "stops while paused" memeriksa `total()` setelah `unmount`. `recordReadingTime` dipanggil secara sinkron (promise tidak ditunggu), jadi panggilan sudah tercatat. `flush` berjalan setelah promise resolve; kalau `expect(mocks.flush)` gagal karena itu, ubah test menjadi `await vi.waitFor(() => expect(mocks.flush).toHaveBeenCalled())`.

Buat `src/components/reader/HabitRing.tsx`:

```tsx
/** Today's minutes against the day's goal, small in the reader's top bar (spec 3B §4.3). */
export function HabitRing({
  seconds,
  goalSeconds,
  hasGoal,
}: {
  seconds: number
  goalSeconds: number
  hasGoal: boolean
}) {
  const minutes = Math.floor(seconds / 60)
  const goal = Math.round(goalSeconds / 60)
  const share = Math.min(1, seconds / goalSeconds)
  const label = hasGoal
    ? `${minutes} dari ${goal} menit hari ini`
    : `${minutes} menit hari ini`
  const circumference = 2 * Math.PI * 15
  return (
    <span role="img" aria-label={label} title={label} className="habit-ring">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15" className="habit-ring-track" />
        <circle
          cx="18"
          cy="18"
          r="15"
          className="habit-ring-fill"
          strokeDasharray={`${share * circumference} ${circumference}`}
        />
      </svg>
      <span aria-hidden="true" className="habit-ring-minutes">
        {minutes}
      </span>
    </span>
  )
}
```

Buat `src/components/reader/GoalToast.tsx`:

```tsx
import { useEffect, useRef, useState } from "react"
import { HABIT_TOAST_KEY } from "@/lib/local/keys"

const SHOWN_MS = 6_000

function shownToday(today: string): boolean {
  try {
    return localStorage.getItem(HABIT_TOAST_KEY) === today
  } catch {
    return false
  }
}

function markShown(today: string) {
  try {
    localStorage.setItem(HABIT_TOAST_KEY, today)
  } catch {
    // No localStorage: it may show again on another visit.
  }
}

/**
 * Whether the "goal reached" note shows (spec 3B §4.3, plan 3B decision 9):
 * once a day, only with a goal, only when reached during this visit, and
 * only while the bars show. `settled`: the day's numbers are known, so the
 * state at the start can be judged.
 */
export function useGoalToast({
  done,
  hasGoal,
  today,
  settled,
  barsShown,
}: {
  done: boolean
  hasGoal: boolean
  today: string
  settled: boolean
  barsShown: boolean
}): boolean {
  // Whether the goal was already reached when the numbers first settled.
  const [doneAtStart, setDoneAtStart] = useState<boolean | null>(null)
  if (settled && doneAtStart === null) setDoneAtStart(done)
  const [due, setDue] = useState(false)
  const [over, setOver] = useState(false)
  if (
    !due &&
    !over &&
    doneAtStart === false &&
    done &&
    hasGoal &&
    !shownToday(today)
  ) {
    setDue(true)
  }
  const shown = due && !over && barsShown
  const marked = useRef(false)

  useEffect(() => {
    if (!shown) return
    if (!marked.current) {
      marked.current = true
      markShown(today)
    }
    const timer = setTimeout(() => setOver(true), SHOWN_MS)
    return () => clearTimeout(timer)
  }, [shown, today])

  return shown
}

export function GoalToast() {
  return (
    <output className="reader-note habit-toast">
      Target hari ini tercapai. Selamat membaca terus.
    </output>
  )
}
```

Masalah urutan di test: `useGoalToast` memanggil `markShown` di dalam effect, sedangkan test memeriksa `localStorage` tepat setelah `rerender`. `renderHook` di Testing Library menjalankan effect di dalam `act`, jadi nilainya sudah tertulis. Pada test "once already shown today", `shownToday` dibaca saat render, sebelum effect berjalan, jadi hasilnya benar.

Di `src/components/reader/ReaderToolbar.tsx`:
- tambahkan prop `habit?: ReactNode` (impor `type ReactNode` dari `react`), dengan komentar `/** Today's reading against the goal (spec 3B §4.3). */`;
- render `{habit}` tepat sebelum tombol bookmark, sesudah keterangan `Belum tersinkron`.

Di `src/routes/_member/read.$bookId.tsx`:
1. Impor `useReadingClock`, `HabitRing`, `GoalToast` dan `useGoalToast`, `refreshHabit` dan `useReadingHabit` (dari `@/lib/habit/habit-client`), serta `useQueueFlush` (dari `@/lib/sync/use-queue-flush`).
2. Setelah `const [panel, setPanel] = …` (dan sesudah `noteFor` serta `sharing` dideklarasikan), tambahkan:

```tsx
  // A panel over the book stops the reading clock (spec 3B §3.1); word and
  // footnote popups do not.
  const clockPaused = panel !== null || noteFor !== null || sharing !== null
  const readingClock = useReadingClock(bookId, clockPaused)
  const habit = useReadingHabit()
  // Today's numbers and goals, and the waiting time sent (plan 3B, decision 10).
  useQueueFlush(user.id, refreshHabit)
  const goalToast = useGoalToast({
    done: habit.summary.todayDone,
    hasGoal: habit.goals.dailyGoalMinutes !== null,
    today: habit.today,
    settled: habit.status !== "loading",
    barsShown: !chromeHidden,
  })
```

   Kalau `chromeHidden` dideklarasikan sesudah tempat ini, letakkan blok ini setelah deklarasi `chromeHidden` dan `panel`.
3. Di `onRelocate`, di dalam `if (moved) { … }` yang sudah ada, tambahkan `readingClock.onPage()` setelah `setSelection(null)`. Tambahkan juga `readingClock` (fungsi `onPage`-nya stabil) ke daftar dependensi `useCallback`: pakai `const { onPage: onReadingPage } = readingClock` lalu masukkan `onReadingPage`.
4. Di `<ReaderToolbar …>` tambahkan:

```tsx
        habit={
          <HabitRing
            seconds={habit.summary.todaySeconds}
            goalSeconds={habit.summary.todayGoalSeconds}
            hasGoal={habit.goals.dailyGoalMinutes !== null}
          />
        }
```

5. Setelah blok `{finishedNote && …}`, tambahkan `{goalToast && <GoalToast />}`.

Tambahkan ke `src/styles.css`, dekat aturan `.reader-note`:

```css
  /* Today's reading in the reader's top bar (spec 3B §4.3). */
  .habit-ring {
    position: relative;
    display: inline-grid;
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    place-items: center;
  }
  .habit-ring svg {
    position: absolute;
    inset: 0;
    rotate: -90deg;
  }
  .habit-ring circle {
    fill: none;
    stroke-width: 3;
  }
  .habit-ring-track {
    stroke: color-mix(in oklab, currentColor 20%, transparent);
  }
  .habit-ring-fill {
    stroke: var(--color-mint);
    stroke-linecap: round;
  }
  .habit-ring-minutes {
    font-size: 0.65rem;
    font-weight: 700;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/reader src/routes`
Expected: PASS.

Lalu `npm run typecheck` dan `npm run lint`.
Expected: bersih.

- [ ] **Step 5: Check by hand**

Jalankan `npm run dev` (port 3000, atau 3100 kalau 3000 dipakai, lihat Global Constraints) dan buka sebuah buku.
- Cincin tampil di bilah atas dengan label "0 menit hari ini".
- Setelah ±40 detik membaca dan membalik halaman, angkanya menjadi 0 atau 1.
- Di DevTools → Application → IndexedDB → glosa → readingTime ada satu baris.

Kalau langkah ini tidak bisa dijalankan (tidak ada browser), catat di progres dan lanjutkan; E2E di Task 8 menguji hal yang sama.

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/components/reader src/routes/_member/read.\$bookId.tsx src/lib/local/keys.ts
git add src/components/reader src/routes/_member/read.\$bookId.tsx src/lib/local/keys.ts src/styles.css
git commit -m "feat(reader): count the time read, show today's ring, and say once when the goal is reached"
```

---

### Task 6: Panel "Kebiasaan baca", kartu anggota, privasi

**Files:**
- Create: `src/components/lobby/HabitCalendar.tsx`, `src/components/lobby/HabitCalendar.test.tsx`
- Create: `src/components/lobby/HabitPanel.tsx`, `src/components/lobby/HabitPanel.test.tsx`
- Create: `src/routes/_member/_lobi/habits.tsx`
- Modify: `src/routes/_member/_lobi.tsx`
- Modify: `src/components/lobby/LobbyPopup.tsx`, `src/components/member/MemberShell.tsx`
- Modify: `src/components/member/MembershipCard.tsx`, `src/components/member/MembershipCard.test.tsx`
- Modify: `src/routes/_member/_lobi/settings.tsx`
- Modify: `src/routes/privacy.tsx`
- Modify: `src/styles.css`
- Regenerate: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: `HabitView`, `habitView`, `NO_GOALS` (Task 4); `calendarCells`, `booksThisYear`, `PLANT_STAGE_LABELS`, `CalendarCell` (Task 3); `formatDayLabel` (Task 2); `DAILY_GOALS`, `HabitGoals` (Task 3); `refreshHabit`, `saveGoals`, `useReadingHabit` (Task 4).
- Produces:
  - `HabitCalendar({ weeks: Array<Array<CalendarCell>> })`;
  - `HabitPanel({ view, finishedThisYear, offline, onRetry, onSaveGoals })`;
  - rute `/habits`;
  - prop `habit?: { streak: number; record: number } | null` di `MembershipCard`.

- [ ] **Step 1: Write the failing tests**

Buat `src/components/lobby/HabitCalendar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { calendarCells } from "@/lib/reading-habit"
import { HabitCalendar } from "./HabitCalendar"

describe("HabitCalendar", () => {
  it("labels each day with its minutes, and leaves the days ahead out", () => {
    const weeks = calendarCells(
      [{ day: "2026-11-04", seconds: 23 * 60 + 10, goalMinutes: null }],
      "2026-11-06",
      null
    )
    render(<HabitCalendar weeks={weeks} />)
    expect(screen.getByLabelText("Rabu, 4 November: 23 menit")).toHaveAttribute(
      "data-state",
      "read"
    )
    expect(screen.getByLabelText("Jumat, 6 November: 0 menit")).toHaveAttribute(
      "data-state",
      "none"
    )
    expect(screen.queryByLabelText(/Sabtu, 7 November/)).toBeNull()
    expect(screen.getAllByRole("listitem")).toHaveLength(33)
  })
})
```

(5 minggu × 7 hari = 35 sel, dikurangi 2 hari sesudah hari ini = 33 sel yang punya label.)

Buat `src/components/lobby/HabitPanel.test.tsx`:

```tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { type HabitState, habitView } from "@/lib/habit/habit-view"
import { HabitPanel } from "./HabitPanel"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}))

const TODAY = "2026-11-06"
const goals = { dailyGoalMinutes: 20 as const, yearlyGoalBooks: 12 }
const ready = (changes: Partial<HabitState> = {}) =>
  habitView(
    {
      cache: {
        days: [
          { day: "2026-11-05", seconds: 1500, goalMinutes: 20 },
          { day: TODAY, seconds: 12 * 60, goalMinutes: 20 },
        ],
        goals,
        sentAtFetch: {},
      },
      local: {},
      status: "ready",
      ...changes,
    },
    TODAY
  )

const panel = (props: Partial<Parameters<typeof HabitPanel>[0]> = {}) =>
  render(
    <HabitPanel
      view={ready()}
      finishedThisYear={4}
      offline={false}
      onRetry={vi.fn()}
      onSaveGoals={vi.fn(() => Promise.resolve({ ok: true as const }))}
      {...props}
    />
  )

describe("HabitPanel", () => {
  it("shows the streak, today and this year against the goals", () => {
    panel()
    expect(screen.getByRole("heading", { name: "Kebiasaan baca" })).toBeInTheDocument()
    expect(screen.getByText("hari membaca beruntun")).toBeInTheDocument()
    expect(screen.getByText(/Rekor 1/)).toBeInTheDocument()
    expect(screen.getByText(/Jeda tersisa minggu ini: 2/)).toBeInTheDocument()
    expect(screen.getByText("12 / 20 menit")).toBeInTheDocument()
    expect(screen.getByText("4 / 12 buku selesai")).toBeInTheDocument()
    expect(screen.getByText("Tanaman: Tunas")).toBeInTheDocument()
  })

  it("invites a new member to plant the first sprout", () => {
    panel({
      view: habitView(
        {
          cache: { days: [], goals: { dailyGoalMinutes: null, yearlyGoalBooks: null }, sentAtFetch: {} },
          local: {},
          status: "ready",
        },
        TODAY
      ),
      finishedThisYear: 0,
    })
    expect(
      screen.getByText("Baca 5 menit hari ini untuk menanam tunas pertama")
    ).toBeInTheDocument()
    expect(screen.getByText(/Pasang target harian/)).toBeInTheDocument()
    expect(screen.getByText("0 buku selesai tahun ini")).toBeInTheDocument()
  })

  it("says to start again after a streak ended", () => {
    panel({
      view: habitView(
        {
          cache: {
            days: [{ day: "2026-10-01", seconds: 900, goalMinutes: null }],
            goals: { dailyGoalMinutes: null, yearlyGoalBooks: null },
            sentAtFetch: {},
          },
          local: {},
          status: "ready",
        },
        TODAY
      ),
    })
    expect(screen.getByText("Mulai lagi hari ini")).toBeInTheDocument()
  })

  it("saves the daily goal at once, and puts it back when that fails", async () => {
    const onSaveGoals = vi.fn(() =>
      Promise.resolve({ ok: false as const, code: "unknown" })
    )
    panel({ onSaveGoals })
    const select = screen.getByLabelText("Target menit per hari")
    fireEvent.change(select, { target: { value: "30" } })
    expect(onSaveGoals).toHaveBeenCalledWith({
      dailyGoalMinutes: 30,
      yearlyGoalBooks: 12,
    })
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Ada yang tidak beres.")
    )
  })

  it("saves the yearly goal when the field is left, and checks it", async () => {
    const onSaveGoals = vi.fn(() => Promise.resolve({ ok: true as const }))
    panel({ onSaveGoals })
    const field = screen.getByLabelText("Target buku per tahun")
    fireEvent.change(field, { target: { value: "400" } })
    fireEvent.blur(field)
    expect(screen.getByRole("alert")).toHaveTextContent("Isi angka 1–365.")
    expect(onSaveGoals).not.toHaveBeenCalled()
    fireEvent.change(field, { target: { value: "" } })
    await act(async () => {
      fireEvent.blur(field)
    })
    expect(onSaveGoals).toHaveBeenCalledWith({
      dailyGoalMinutes: 20,
      yearlyGoalBooks: null,
    })
  })

  it("keeps the goals still offline", () => {
    panel({ offline: true })
    expect(screen.getByLabelText("Target menit per hari")).toBeDisabled()
    expect(screen.getByLabelText("Target buku per tahun")).toBeDisabled()
    expect(screen.getByText("Target bisa diubah saat online.")).toBeInTheDocument()
  })

  it("says the numbers may be old, and offers a retry without any", () => {
    const { unmount } = panel({ view: ready({ status: "failed" }) })
    expect(screen.getByText("Data mungkin belum terbaru")).toBeInTheDocument()
    unmount()
    const onRetry = vi.fn()
    panel({
      onRetry,
      view: habitView({ cache: null, local: {}, status: "failed" }, TODAY),
    })
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
```

Di `src/components/member/MembershipCard.test.tsx` (fixture `member` sudah ada), tambahkan di dalam `describe("MembershipCard")`:

```tsx
  it("shows the streak and record when given", () => {
    render(<MembershipCard member={member} habit={{ streak: 12, record: 31 }} />)
    expect(screen.getByText("Streak 12 hari · Rekor 31")).toBeInTheDocument()
  })

  it("leaves the streak out without one", () => {
    render(<MembershipCard member={member} />)
    expect(screen.queryByText(/Streak/)).toBeNull()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/lobby/HabitCalendar.test.tsx src/components/lobby/HabitPanel.test.tsx src/components/member`
Expected: FAIL, karena komponennya belum ada dan prop `habit` belum dikenal.

- [ ] **Step 3: Implement**

Buat `src/components/lobby/HabitCalendar.tsx`:

```tsx
import { formatDayLabel } from "@/lib/dates"
import type { CalendarCell } from "@/lib/reading-habit"

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]

/** Five weeks, Monday first, this week at the bottom (spec 3B §4.2). */
export function HabitCalendar({
  weeks,
}: {
  weeks: ReadonlyArray<ReadonlyArray<CalendarCell>>
}) {
  return (
    <div className="habit-calendar">
      <div aria-hidden="true" className="habit-calendar-row">
        {WEEKDAYS.map((name) => (
          <span key={name} className="habit-calendar-weekday">
            {name}
          </span>
        ))}
      </div>
      <ol aria-label="Kalender lima minggu" className="habit-calendar-days">
        {weeks.flat().map((cell) =>
          cell.state === "future" ? (
            <li
              key={cell.day}
              aria-hidden="true"
              className="habit-calendar-day"
              data-state="future"
            />
          ) : (
            <li
              key={cell.day}
              aria-label={`${formatDayLabel(cell.day)}: ${Math.floor(cell.seconds / 60)} menit`}
              title={`${formatDayLabel(cell.day)}: ${Math.floor(cell.seconds / 60)} menit`}
              className="habit-calendar-day"
              data-state={cell.state}
            />
          )
        )}
      </ol>
    </div>
  )
}
```

Catatan: sel hari sesudah hari ini tetap berupa `<li>` supaya grid tujuh kolom tidak bergeser, tapi diberi `aria-hidden`, sehingga `getAllByRole("listitem")` hanya menghitung 33 sel berlabel.

Buat `src/components/lobby/HabitPanel.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ActionResult } from "@/lib/action-result"
import { bookMessage } from "@/lib/book-messages"
import type { HabitView } from "@/lib/habit/habit-view"
import { DAILY_GOALS, type DailyGoal, type HabitGoals } from "@/lib/habit/types"
import { PLANT_STAGE_LABELS, calendarCells } from "@/lib/reading-habit"
import { HabitCalendar } from "./HabitCalendar"

const BOOKS_INVALID = "Isi angka 1–365."

/** Streak, today, this year, five weeks and the goals (spec 3B §4.2). */
export function HabitPanel({
  view,
  finishedThisYear,
  offline,
  onRetry,
  onSaveGoals,
}: {
  view: HabitView
  finishedThisYear: number
  offline: boolean
  onRetry: () => void
  onSaveGoals: (goals: HabitGoals) => Promise<ActionResult>
}) {
  const { summary, goals } = view
  const [error, setError] = useState<string | null>(null)
  const [booksDraft, setBooksDraft] = useState<string | null>(null)
  const booksText = booksDraft ?? (goals.yearlyGoalBooks?.toString() ?? "")
  const locked = offline || !view.canEditGoals

  if (view.status === "loading") {
    return (
      <div className="habit-panel">
        <h1 className="font-heading text-2xl">Kebiasaan baca</h1>
        <p className="text-sm text-muted-foreground">Memuat…</p>
      </div>
    )
  }
  if (view.status === "failed") {
    return (
      <div className="habit-panel">
        <h1 className="font-heading text-2xl">Kebiasaan baca</h1>
        <p className="text-sm">Kebiasaan baca belum bisa dimuat.</p>
        <Button onClick={onRetry}>Coba lagi</Button>
      </div>
    )
  }

  async function save(next: HabitGoals) {
    setError(null)
    const result = await onSaveGoals(next)
    if (!result.ok) setError(bookMessage(result.code))
  }

  function saveBooks() {
    const text = booksText.trim()
    if (text === "") {
      setBooksDraft(null)
      if (goals.yearlyGoalBooks !== null) {
        void save({ ...goals, yearlyGoalBooks: null })
      }
      return
    }
    const value = Number(text)
    if (!Number.isInteger(value) || value < 1 || value > 365) {
      setError(BOOKS_INVALID)
      return
    }
    setBooksDraft(null)
    if (value !== goals.yearlyGoalBooks) {
      void save({ ...goals, yearlyGoalBooks: value })
    }
  }

  const todayMinutes = Math.floor(summary.todaySeconds / 60)
  const goalMinutes = Math.round(summary.todayGoalSeconds / 60)

  return (
    <div className="habit-panel">
      <h1 className="font-heading text-2xl">Kebiasaan baca</h1>
      {view.status === "stale" && (
        <p className="text-xs text-muted-foreground">
          Data mungkin belum terbaru
        </p>
      )}

      <section aria-label="Streak" className="habit-section">
        {summary.streak > 0 ? (
          <p className="habit-streak">
            <span className="habit-streak-number">{summary.streak}</span>
            <span>hari membaca beruntun</span>
          </p>
        ) : (
          <p className="habit-streak-empty">
            {summary.hasHistory
              ? "Mulai lagi hari ini"
              : `Baca ${goalMinutes} menit hari ini untuk menanam tunas pertama`}
          </p>
        )}
        {summary.hasHistory && (
          <p className="text-sm text-muted-foreground">
            Rekor {summary.record} · Jeda tersisa minggu ini: {summary.gapsLeft}
          </p>
        )}
        <p className="text-sm">Tanaman: {PLANT_STAGE_LABELS[summary.stage]}</p>
      </section>

      <section aria-label="Hari ini" className="habit-section">
        <h2 className="habit-heading">Hari ini</h2>
        <progress
          className="habit-bar"
          aria-label="Menit hari ini"
          value={Math.min(summary.todaySeconds, summary.todayGoalSeconds)}
          max={summary.todayGoalSeconds}
        />
        <p className="text-sm">
          {goals.dailyGoalMinutes === null
            ? `${todayMinutes} menit hari ini · Pasang target harian`
            : `${todayMinutes} / ${goals.dailyGoalMinutes} menit`}
        </p>
      </section>

      <section aria-label="Tahun ini" className="habit-section">
        <h2 className="habit-heading">Tahun ini</h2>
        <p className="text-sm">
          {goals.yearlyGoalBooks === null
            ? `${finishedThisYear} buku selesai tahun ini`
            : `${finishedThisYear} / ${goals.yearlyGoalBooks} buku selesai`}
        </p>
        <Link
          to="/shelf"
          search={{ koleksi: "selesai" }}
          className="text-sm underline"
        >
          Lihat Sudah dibaca
        </Link>
      </section>

      <section aria-label="Lima minggu terakhir" className="habit-section">
        <h2 className="habit-heading">Lima minggu terakhir</h2>
        <HabitCalendar
          weeks={calendarCells(view.days, view.today, goals.dailyGoalMinutes)}
        />
      </section>

      <section aria-label="Atur target" className="habit-section">
        <h2 className="habit-heading">Atur target</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor="habit-daily">Target menit per hari</Label>
            <select
              id="habit-daily"
              className="habit-select"
              disabled={locked}
              value={goals.dailyGoalMinutes ?? ""}
              onChange={(event) => {
                const value = event.target.value
                void save({
                  ...goals,
                  dailyGoalMinutes:
                    value === "" ? null : (Number(value) as DailyGoal),
                })
              }}
            >
              <option value="">Tanpa target</option>
              {DAILY_GOALS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} menit
                </option>
              ))}
            </select>
          </div>
          <form
            className="grid gap-1"
            onSubmit={(event) => {
              event.preventDefault()
              saveBooks()
            }}
          >
            <Label htmlFor="habit-yearly">Target buku per tahun</Label>
            <Input
              id="habit-yearly"
              inputMode="numeric"
              placeholder="Tanpa target"
              disabled={locked}
              value={booksText}
              onChange={(event) => setBooksDraft(event.target.value)}
              onBlur={saveBooks}
            />
          </form>
        </div>
        {offline && (
          <p className="text-xs text-muted-foreground">
            Target bisa diubah saat online.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
```

Catatan untuk implementer:
- Teks error untuk kode `unknown` diambil dari `bookMessage`, yaitu teks cadangan "Ada yang tidak beres. Coba lagi sebentar lagi."; test memeriksa awalannya.
- Pesan error tidak berwarna merah (Global Constraints).
- Pada test "puts it back when that fails", nilai select kembali seperti semula karena `onSaveGoals` asli (`saveGoals` dari Task 4) memulihkan cache. Di test ini `view` tetap, jadi select memang menampilkan nilai lama.

Buat `src/routes/_member/_lobi/habits.tsx`:

```tsx
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { HabitPanel } from "@/components/lobby/HabitPanel"
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
import {
  refreshHabit,
  saveGoals,
  useReadingHabit,
} from "@/lib/habit/habit-client"
import { booksThisYear } from "@/lib/reading-habit"

const lobi = getRouteApi("/_member/_lobi")

export const Route = createFileRoute("/_member/_lobi/habits")({
  head: () => ({ meta: [{ title: "Kebiasaan baca — Glosa" }] }),
  component: HabitsPage,
})

/** Kebiasaan baca over the lobby (spec 3B §4.2, plan 3B decision 4). */
function HabitsPage() {
  const { books, offline } = lobi.useLoaderData()
  const habit = useReadingHabit()
  return (
    <LobbyPopup label="Kebiasaan baca" className="lg:max-w-2xl">
      <HabitPanel
        view={habit}
        finishedThisYear={booksThisYear(books, habit.today)}
        offline={offline}
        onRetry={() => void refreshHabit()}
        onSaveGoals={saveGoals}
      />
    </LobbyPopup>
  )
}
```

Periksa props `LobbyPopup` yang ada (`label`, `className`, `bodyClassName`) dan cara rute lain memakainya, lalu sesuaikan `className`.

Perubahan kecil lainnya:
- `src/components/lobby/LobbyPopup.tsx`: tambahkan `"/habits"` ke `POPUP_PATHS`, dan ubah komentar `LobbyPopup` menjadi "Rak Saya, Kosakata, Kebiasaan baca or Pengaturan".
- `src/components/member/MemberShell.tsx`: tambahkan `"/habits"` ke `OVER_LOBBY`.
- `src/routes/_member/_lobi.tsx`: impor `refreshHabit` dan `useQueueFlush`, lalu di `LobiLayout` setelah `useShelfSnapshot(...)` tambahkan `useQueueFlush(user.id, refreshHabit)` dengan komentar `// The reading habit for the plant, the panel and the member card (plan 3B, decision 10).`
- `src/components/member/MembershipCard.tsx`: tambahkan prop `habit?: { streak: number; record: number } | null`. Kalau ada, render di atas baris paket:

```tsx
      {habit && (
        <p className="text-[10px] font-bold tracking-wide text-mint">
          Streak {habit.streak} hari · Rekor {habit.record}
        </p>
      )}
```

- `src/routes/_member/_lobi/settings.tsx`: panggil `const habit = useReadingHabit()` lalu teruskan `habit={habit.summary.hasHistory ? { streak: habit.summary.streak, record: habit.summary.record } : null}` ke `MembershipCard`.
- `src/routes/privacy.tsx`: ubah `updated="24 Oktober 2026"` menjadi `updated="6 November 2026"`, lalu tambahkan `<li>` setelah butir "Data membaca":

```tsx
        <li>
          Waktu membaca: berapa lama kamu membaca setiap hari dan di buku apa,
          untuk streak dan target bacaanmu. Data ini tidak dibagikan dan ikut
          terhapus saat akunmu dihapus.
        </li>
```

Tambahkan ke `src/styles.css`, di bagian lobby. Warna "some" sengaja samar, dan tidak ada merah:

```css
  /* Kebiasaan baca (spec 3B §4.2). */
  .habit-panel {
    display: grid;
    gap: 1.25rem;
  }
  .habit-section {
    display: grid;
    gap: 0.4rem;
  }
  .habit-heading {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }
  .habit-streak {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }
  .habit-streak-number {
    font-family: var(--font-heading);
    font-size: 3rem;
    line-height: 1;
    color: var(--color-mint);
  }
  .habit-bar {
    width: 100%;
    height: 0.5rem;
    accent-color: var(--color-mint);
  }
  .habit-select {
    height: 2.25rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: transparent;
    padding: 0 0.5rem;
  }
  .habit-calendar {
    display: grid;
    gap: 0.3rem;
    max-width: 18rem;
  }
  .habit-calendar-row,
  .habit-calendar-days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.3rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .habit-calendar-weekday {
    font-size: 0.65rem;
    text-align: center;
    color: var(--muted-foreground);
  }
  .habit-calendar-day {
    aspect-ratio: 1;
    border-radius: 0.3rem;
    border: 1px solid var(--border);
  }
  .habit-calendar-day[data-state="read"] {
    border-color: transparent;
    background: var(--color-mint);
  }
  .habit-calendar-day[data-state="some"] {
    background: color-mix(in oklab, var(--color-mint) 30%, transparent);
  }
  .habit-calendar-day[data-state="future"] {
    visibility: hidden;
  }
```

Lalu buat ulang pohon rute: `npm run generate-routes`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/lobby src/components/member src/routes`
Expected: PASS.

Lalu `npm run typecheck` dan `npm run lint`.
Expected: bersih.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/components/lobby src/components/member src/routes
git add src/components/lobby src/components/member src/routes src/routeTree.gen.ts src/styles.css
git commit -m "feat(lobby): the Kebiasaan baca panel, the streak on the member card, and the privacy note"
```

---

### Task 7: Tanaman di lobi 3D

**Files:**
- Modify: `src/components/lobby/scene/layout.ts`, `src/components/lobby/scene/layout.test.ts`
- Create: `src/components/lobby/scene/plant.ts`
- Modify: `src/components/lobby/scene/stage.ts`
- Modify: `src/components/lobby/LobbyCanvas.tsx`, `src/components/lobby/LobbyScene.tsx`, `src/components/lobby/LobbyStage.tsx`
- Modify: `src/components/lobby/lobby-data.ts`, `src/components/lobby/lobby-data.test.ts`
- Modify: `src/components/lobby/LibraryMap.tsx`, `src/components/lobby/LibraryMap.test.tsx`
- Modify: `src/styles.css`
- Regenerate: `public/lobby/lobby-still*.{avif,webp}`

**Interfaces:**
- Consumes: `PlantStage` (Task 3); `useReadingHabit` (Task 4); rute `/habits` (Task 6).
- Produces:
  - `PLANT: Point2`, `PLANT_POT`, `PLANT_SHAPES: Record<PlantStage, { stem: number; leaves: number; buds: number; flowers: number }>`, `HotspotId` + `"tanaman"` (`layout.ts`);
  - `buildPlant(kit, onChange): { set(stage): void; dispose(): void }` (`plant.ts`);
  - `Stage.setPlant(stage: PlantStage): void`;
  - prop `plant` di `LobbyCanvas` (wajib) dan di `LobbyScene` (opsional, bawaan `"tunas"`).

- [ ] **Step 1: Write the failing tests**

Di `src/components/lobby/scene/layout.test.ts`:
- impor `PLANT`, `PLANT_POT`, `PLANT_SHAPES`, `WALKER_ROUTES`, `READERS`, `SHOWCASE` (sebagian sudah diimpor);
- ubah test "lists unique hotspots in tab order" supaya daftar yang diharapkan diakhiri `"lemari", "tanaman"`;
- tambahkan:

```ts
  it("stands the plant on open floor, clear of walkers, readers and the cabinet", () => {
    expect(onFloor(PLANT)).toBe(true)
    expect(towerClearance(PLANT)).toBeGreaterThan(1)
    const distance = (a: Point2, b: Point2) =>
      Math.hypot(a[0] - b[0], a[1] - b[1])
    for (const { at } of READERS) {
      expect(distance(PLANT, at)).toBeGreaterThan(1.2)
    }
    expect(distance(PLANT, SHOWCASE)).toBeGreaterThan(3)
    for (const [index, { points }] of WALKER_ROUTES.entries()) {
      points.forEach(([x, z], i) => {
        const [nx, nz] = points[(i + 1) % points.length]
        for (let t = 0; t <= 1; t += 0.01) {
          const at: Point2 = [x + (nx - x) * t, z + (nz - z) * t]
          expect(distance(PLANT, at), `route ${index}`).toBeGreaterThan(
            PLANT_POT.width / 2 + 0.6
          )
        }
      })
    }
  })

  it("grows the plant at every stage", () => {
    const order = ["biji", "tunas", "daun", "rimbun", "kuncup", "berbunga"] as const
    const shapes = order.map((stage) => PLANT_SHAPES[stage])
    expect(shapes[0]).toEqual({ stem: 0, leaves: 0, buds: 0, flowers: 0 })
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].stem).toBeGreaterThanOrEqual(shapes[i - 1].stem)
      expect(shapes[i].leaves).toBeGreaterThanOrEqual(shapes[i - 1].leaves)
    }
    expect(shapes[4].buds).toBeGreaterThan(0)
    expect(shapes[5].flowers).toBeGreaterThan(0)
  })
```

(`onFloor` dan `towerClearance` adalah helper yang sudah ada di file test ini, dipakai oleh test "lets 'Anda' stand…". Kalau namanya berbeda, pakai yang ada.)

Di `src/components/lobby/lobby-data.test.ts` tambahkan:

```ts
  it("names the habit plant without a count", () => {
    const plant = lobbyHotspots(countBooks([])).find((h) => h.id === "tanaman")
    expect(plant).toEqual({
      id: "tanaman",
      label: "Kebiasaan baca",
      count: null,
      badge: null,
      dim: false,
    })
  })
```

(Impor `countBooks` dari `@/lib/shelf` kalau belum ada.)

Di `src/components/lobby/LibraryMap.test.tsx`, ikuti test lemari (`expect(kindOf("Sudah dibaca di peta")).toBe("lemari")`) dan tambahkan `expect(kindOf("Kebiasaan baca di peta")).toBe("tanaman")`, serta harapan bahwa legenda memuat "Kebiasaan baca".

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/lobby/scene/layout.test.ts src/components/lobby/lobby-data.test.ts src/components/lobby/LibraryMap.test.tsx`
Expected: FAIL, karena `PLANT` belum ada dan hotspot `tanaman` belum terdaftar.

- [ ] **Step 3: Implement layout, data and map**

Di `src/components/lobby/scene/layout.ts`:
- tambahkan `import type { PlantStage } from "@/lib/reading-habit"`;
- setelah blok `SHOWCASE`, tambahkan:

```ts
/**
 * The habit plant (spec 3B §4.1): a pot on open floor in front of the
 * reading table, nearer the camera than the table, clear of the walkers.
 */
export const PLANT: Point2 = [23.4, 25.4]
export const PLANT_POT = { width: 0.7, height: 0.6 } as const

/** What grows on the stem at each stage, in metres before the plant's scale. */
export const PLANT_SHAPES: Record<
  PlantStage,
  { stem: number; leaves: number; buds: number; flowers: number }
> = {
  biji: { stem: 0, leaves: 0, buds: 0, flowers: 0 },
  tunas: { stem: 0.18, leaves: 2, buds: 0, flowers: 0 },
  daun: { stem: 0.4, leaves: 4, buds: 0, flowers: 0 },
  rimbun: { stem: 0.6, leaves: 8, buds: 0, flowers: 0 },
  kuncup: { stem: 0.7, leaves: 9, buds: 3, flowers: 0 },
  berbunga: { stem: 0.75, leaves: 10, buds: 0, flowers: 4 },
}
```

- ubah `HotspotId` menjadi `Genre | "meja-baca" | "meja-admin" | "troli" | "katalog" | "lemari" | "tanaman"`;
- ubah komentar urutan tab menjadi "…, card catalogue, display cabinet, habit plant.";
- tambahkan di akhir `HOTSPOT_SPOTS`: `{ id: "tanaman", label: [23.4, 2.4, 25.4], stand: [24.9, 26.9] }`.

Di `src/components/lobby/lobby-data.ts`, di `lobbyHotspots`, sebelum cabang `lemari`, tambahkan `if (id === "tanaman") return { ...plain, label: "Kebiasaan baca" }`.

Di `src/components/lobby/LibraryMap.tsx`:
- `MapKind` mendapat `"tanaman"`;
- `kindOf` tidak perlu diubah karena `count` untuk tanaman null, jadi `id` dipakai apa adanya;
- `LEGEND` mendapat `["tanaman", "Kebiasaan baca"]` setelah `"lemari"`.

Di `src/styles.css`, setelah aturan `lemari`, tambahkan:

```css
  .lobby-map-spot[data-kind="tanaman"],
  .lobby-map-mark[data-kind="tanaman"] {
    background: #8bd17c;
  }
```

Di `src/components/lobby/LobbyStage.tsx`, di `activate`, sebelum `else if (id === "lemari")`, tambahkan:

```tsx
    } else if (id === "tanaman") {
      void navigate({ to: "/habits" })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/lobby`
Expected: PASS. Kalau test lain yang menghitung jumlah hotspot gagal (misalnya `HotspotLayer.test.tsx` atau `LobbyScene.test.tsx`), tambahkan "Kebiasaan baca" ke daftar yang mereka harapkan.

- [ ] **Step 5: Build the plant and wire it to the stage**

Buat `src/components/lobby/scene/plant.ts`:

```ts
import * as THREE from "three"
import type { PlantStage } from "@/lib/reading-habit"
import type { Kit } from "./kit"
import { PLANT, PLANT_POT, PLANT_SHAPES } from "./layout"

const POT = "#b4643c"
const SOIL = "#3b2618"
/** The plant is drawn small and scaled up, so it reads from the camera. */
const SCALE = 1.8

export type Plant = {
  /** Shows the stage; the same stage again does nothing. */
  set: (stage: PlantStage) => void
  dispose: () => void
}

/**
 * The habit plant (spec 3B §4.1): a pot with what the streak grew. It never
 * wilts; a new stage replaces the old one at once (plan 3B, decision 6).
 * onChange asks the stage to draw again.
 */
export function buildPlant(kit: Kit, onChange: () => void): Plant {
  const [x, z] = PLANT
  kit.block(PLANT_POT.width, PLANT_POT.height, PLANT_POT.width, POT, x, 0, z, {
    r: 0.06,
  })
  kit.block(
    PLANT_POT.width - 0.1,
    0.03,
    PLANT_POT.width - 0.1,
    SOIL,
    x,
    PLANT_POT.height,
    z,
    { r: 0.01, cast: false }
  )

  const group = new THREE.Group()
  group.position.set(x, PLANT_POT.height + 0.03, z)
  group.scale.setScalar(SCALE)
  kit.scene.add(group)

  const round = new THREE.SphereGeometry(1, 12, 8)
  const stem = new THREE.CylinderGeometry(0.018, 0.026, 1, 8)
  const paint = {
    seed: new THREE.MeshStandardMaterial({ color: "#7a5230", roughness: 0.9 }),
    stem: new THREE.MeshStandardMaterial({ color: "#4f7a3a", roughness: 0.8 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#5fa04a", roughness: 0.7 }),
    bud: new THREE.MeshStandardMaterial({ color: "#e58fa8", roughness: 0.6 }),
    petal: new THREE.MeshStandardMaterial({ color: "#f6d4e0", roughness: 0.6 }),
    heart: new THREE.MeshStandardMaterial({ color: "#f2c14e", roughness: 0.5 }),
  }
  let shown: PlantStage | null = null

  const blob = (
    material: THREE.Material,
    size: readonly [number, number, number],
    at: readonly [number, number, number],
    turn = 0
  ) => {
    const mesh = new THREE.Mesh(round, material)
    mesh.scale.set(...size)
    mesh.position.set(...at)
    mesh.rotation.y = turn
    mesh.castShadow = true
    group.add(mesh)
  }

  return {
    set(stage) {
      if (stage === shown) return
      shown = stage
      group.clear()
      const shape = PLANT_SHAPES[stage]
      if (shape.stem === 0) {
        blob(paint.seed, [0.05, 0.03, 0.05], [0, 0.01, 0])
        onChange()
        return
      }
      const stalk = new THREE.Mesh(stem, paint.stem)
      stalk.scale.set(1, shape.stem, 1)
      stalk.position.y = shape.stem / 2
      stalk.castShadow = true
      group.add(stalk)
      for (let i = 0; i < shape.leaves; i++) {
        const height = (shape.stem * (i + 1)) / (shape.leaves + 1)
        const angle = i * 2.4
        blob(
          paint.leaf,
          [0.09, 0.022, 0.05],
          [Math.cos(angle) * 0.08, height, Math.sin(angle) * 0.08],
          -angle
        )
      }
      for (let i = 0; i < shape.buds; i++) {
        const angle = (i / shape.buds) * Math.PI * 2
        blob(
          paint.bud,
          [0.03, 0.045, 0.03],
          [Math.cos(angle) * 0.05, shape.stem + 0.02, Math.sin(angle) * 0.05]
        )
      }
      for (let i = 0; i < shape.flowers; i++) {
        const angle = (i / shape.flowers) * Math.PI * 2
        const fx = Math.cos(angle) * 0.08
        const fz = Math.sin(angle) * 0.08
        const fy = shape.stem - 0.03 * i
        blob(paint.heart, [0.022, 0.018, 0.022], [fx, fy, fz])
        for (let petal = 0; petal < 5; petal++) {
          const around = (petal / 5) * Math.PI * 2
          blob(
            paint.petal,
            [0.03, 0.01, 0.018],
            [fx + Math.cos(around) * 0.035, fy, fz + Math.sin(around) * 0.035],
            -around
          )
        }
      }
      onChange()
    },
    dispose() {
      group.clear()
      group.removeFromParent()
      round.dispose()
      stem.dispose()
      for (const material of Object.values(paint)) material.dispose()
    },
  }
}
```

Di `src/components/lobby/scene/stage.ts`:
- impor `buildPlant` dan `type PlantStage`;
- di tipe `Stage`, setelah `setShowcase`, tambahkan `setPlant: (stage: PlantStage) => void`;
- setelah `const showcase = buildShowcase(...)`, tambahkan:

```ts
  const plant = buildPlant(kit, () => requestRender())
  // The still image shows a sprout (plan 3B, decision 5).
  plant.set("tunas")
```

- di objek yang dikembalikan, tambahkan `setPlant(stage) { plant.set(stage) }`;
- di `dispose()`, sebelum `disposeTree(scene)`, tambahkan `plant.dispose()`.

`setPlant` dipanggil sebelum `requestRender` terdefinisi? Kalau `requestRender` dideklarasikan sesudah tempat `buildShowcase` dipanggil, pola `() => requestRender()` tetap aman karena dipanggil belakangan, persis seperti yang dilakukan showcase.

Di `src/components/lobby/LobbyCanvas.tsx`, ikuti pola `showcase`:
- tambahkan prop `plant: PlantStage` (dengan komentar `/** The habit plant's stage. */`);
- tambahkan `plantRef`;
- panggil `stage.setPlant(plantRef.current)` setelah `stage.setShowcase(...)`;
- tambahkan effect `useEffect(() => { plantRef.current = plant; stageRef.current?.setPlant(plant) }, [plant])`.

Di `src/components/lobby/LobbyScene.tsx`, tambahkan prop `plant?: PlantStage` dengan bawaan `"tunas"`, lalu teruskan ke `LobbyCanvas`.

Di `src/components/lobby/LobbyStage.tsx`, panggil `const habit = useReadingHabit()` lalu teruskan `plant={habit.summary.stage}` ke `LobbyScene`.

- [ ] **Step 6: Check the placement with the harness, then render the still**

```bash
node scripts/lobby-harness.mjs shot test-results/lobby-tanaman.png
```

Buka `test-results/lobby-tanaman.png`. Pot dengan tunas harus terlihat utuh di depan meja baca, tidak tertutup menara atau kursi, dan tidak menindih pembaca. Kalau tertutup, geser `PLANT` (dan `label`/`stand` hotspotnya dengan selisih yang sama) di sekitar z 24–27, x 22–25, lalu jalankan lagi test layout dan screenshot. Catat posisi akhirnya di progres.

Untuk memeriksa tahap lain, ubah sementara `plant.set("tunas")` menjadi `"berbunga"`, ambil screenshot ke `test-results/lobby-tanaman-bunga.png`, lalu kembalikan ke `"tunas"`.

Lalu render gambar diam dengan tahap tunas:

```bash
node scripts/lobby-harness.mjs still
```

Expected: berkas `public/lobby/lobby-still*.{avif,webp}` diperbarui, dan harness tidak melaporkan ukuran berlebih (batas 250 KB).

- [ ] **Step 7: Run the lobby and scene tests**

Run: `npx vitest run src/components/lobby` lalu `npm run typecheck`.
Expected: PASS dan bersih.

- [ ] **Step 8: Commit**

```bash
npx prettier --write src/components/lobby
git add src/components/lobby src/styles.css public/lobby
git commit -m "feat(lobby): a plant grows with the reading streak and opens Kebiasaan baca"
```

---

### Task 8: E2E dan verifikasi akhir

**Files:**
- Create: `e2e/helpers/habit.ts`
- Create: `e2e/habit.spec.ts`

**Interfaces:**
- Consumes: semua task sebelumnya; `admin()`, `createConfirmedMember`, `signInAndOnboard`, `userIdOf`, `hydrated` (`e2e/helpers/members.ts`); `seedBook` (`e2e/helpers/books.ts`); `startReading`, `turnPages` (`e2e/helpers/reading.ts`).

- [ ] **Step 1: Write the helpers**

Buat `e2e/helpers/habit.ts`:

```ts
import { randomUUID } from "node:crypto"
import { admin } from "./members"

/** The time zone the habit tests run the browser in. */
export const HABIT_ZONE = "Asia/Jakarta"

/** Today in the test browser's zone, as YYYY-MM-DD. */
export function todayInZone(zone = HABIT_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** A day of reading from another device, written straight to the table. */
export async function seedReadingTime(
  userId: string,
  bookId: string,
  day: string,
  seconds: number,
  goalMinutes: number | null = null
): Promise<void> {
  const { error } = await admin().from("reading_time").insert({
    user_id: userId,
    day,
    device_id: randomUUID(),
    book_id: bookId,
    seconds,
    goal_minutes: goalMinutes,
  })
  if (error) throw error
}

export async function setDailyGoal(
  userId: string,
  minutes: number | null
): Promise<void> {
  const { error } = await admin()
    .from("profiles")
    .update({ daily_goal_minutes: minutes })
    .eq("id", userId)
  if (error) throw error
}

/** Every second the server has for the member that day. */
export async function storedSeconds(userId: string, day: string): Promise<number> {
  const { data, error } = await admin()
    .from("reading_time")
    .select("seconds")
    .eq("user_id", userId)
    .eq("day", day)
  if (error) throw error
  return data.reduce((sum, row) => sum + row.seconds, 0)
}
```

Kalau `admin()` di `members.ts` belum bertipe `Database`, tambahkan `as never` pada objek insert/update dan catat. Jangan ubah helper bersama.

- [ ] **Step 2: Write the E2E tests**

Buat `e2e/habit.spec.ts`:

```ts
import { expect, test } from "@playwright/test"
import { seedBook } from "./helpers/books"
import {
  HABIT_ZONE,
  seedReadingTime,
  setDailyGoal,
  storedSeconds,
  todayInZone,
} from "./helpers/habit"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"
import { startReading, turnPages } from "./helpers/reading"

test.use({ timezoneId: HABIT_ZONE })

test("reading a page reaches the server as today's time", async ({ page }) => {
  const { userId } = await startReading(page)
  // A page shown for more than five seconds counts.
  await page.waitForTimeout(7_000)
  await turnPages(page, "PageDown", 1)
  // Leaving the reader sends the time at once.
  await page.goto("/lobby")
  await expect
    .poll(() => storedSeconds(userId, todayInZone()), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(5)
})

test("the plant opens Kebiasaan baca with today's streak", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  const today = todayInZone()
  await seedReadingTime(userId, bookId, today, 600)

  await page.goto("/lobby")
  await hydrated(page)
  const scene = page.getByRole("region", { name: "Adegan lobi" })
  await scene.getByRole("button", { name: "Kebiasaan baca" }).press("Enter")
  await expect(page).toHaveURL(/\/habits$/)
  await expect(
    page.getByRole("heading", { name: "Kebiasaan baca" })
  ).toBeVisible()
  await expect(page.getByText("hari membaca beruntun")).toBeVisible()
  const label = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: HABIT_ZONE,
  }).format(new Date())
  await expect(page.getByLabel(`${label}: 10 menit`)).toHaveAttribute(
    "data-state",
    "read"
  )
})

test("the reader says once that today's goal is reached", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  await setDailyGoal(userId, 5)
  // Four seconds short of the goal, read on another device.
  await seedReadingTime(userId, bookId, todayInZone(), 296, 5)

  await page.goto(`/read/${bookId}`)
  await expect(
    page.getByRole("status", { name: "Posisi baca" })
  ).toHaveText(/^\d+%$/, { timeout: 30_000 })
  await expect(
    page.getByRole("img", { name: "4 dari 5 menit hari ini" })
  ).toBeVisible({ timeout: 20_000 })
  await turnPages(page, "PageDown", 1)
  await page.waitForTimeout(8_000)
  await turnPages(page, "PageDown", 1)
  await expect(
    page.getByText("Target hari ini tercapai. Selamat membaca terus.")
  ).toBeVisible({ timeout: 15_000 })
  expect(
    await page.evaluate(() => localStorage.getItem("glosa:habit-toast"))
  ).toBe(todayInZone())
})

test("the goals set in the panel are kept", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto("/habits")
  await hydrated(page)
  await page.getByLabel("Target menit per hari").selectOption("20")
  await page.getByLabel("Target buku per tahun").fill("12")
  await page.getByLabel("Target buku per tahun").press("Enter")
  await expect(page.getByText("0 / 12 buku selesai")).toBeVisible()
  await page.reload()
  await hydrated(page)
  await expect(page.getByLabel("Target menit per hari")).toHaveValue("20")
  await expect(page.getByLabel("Target buku per tahun")).toHaveValue("12")
})
```

Catatan:
- Test ketiga membuka reader pada halaman judul. Halaman pertama baru mulai dihitung saat ia tampil, sehingga waktu sebelum halaman kedua tampil adalah sekitar 8 detik, lebih dari 5 detik.
- Cincin awal "4 dari 5 menit" membuktikan reader sudah memuat data server sebelum mulai mencatat. Ini memastikan `useGoalToast` menilai keadaan awal "belum tercapai".
- Toast muncul paling lambat saat halaman berpindah, karena potongan halaman disimpan pada saat itu.

- [ ] **Step 3: Run the new E2E tests**

Periksa port 3000 dulu (Global Constraints), lalu:

Run: `npx playwright test e2e/habit.spec.ts --project=desktop --project=mobile --workers=2`
Expected: 8 test PASS (4 test × 2 project).

Kalau test pertama gagal karena waktu belum sampai di server, pastikan `useReadingClock` memanggil `habitSync().flush()` saat unmount (Task 5) dan `page.goto("/lobby")` benar-benar meninggalkan reader. Kalau test plant di HP gagal karena hotspot tertutup, periksa posisi label di gambar diam dan kembali ke Task 7 Step 6.

- [ ] **Step 4: Run every check**

```bash
npm run typecheck
npm run lint
npm run check
npm test
npm run test:db -- tests/db/habit.test.ts tests/db/profiles.test.ts tests/db/books.test.ts
npx playwright test --project=desktop --project=mobile --workers=2
```

Expected: semuanya lulus. E2E penuh mengikuti Global Constraints: satu kegagalan dijalankan ulang sendirian sebelum disebut regresi. Proyek `lobby-3d` dijalankan bila ada perubahan adegan: `npx playwright test --project=lobby-3d --no-deps --workers=1`.

- [ ] **Step 5: Commit**

```bash
npx prettier --write e2e/habit.spec.ts e2e/helpers/habit.ts
git add e2e/habit.spec.ts e2e/helpers/habit.ts
git commit -m "test(e2e): reading time, the plant and its panel, the goal toast, and the goals kept"
```

- [ ] **Step 6: Owner checks after deploy (tulis di progres, tidak dijalankan agen)**

1. **Reader di HP:** baca beberapa menit, lalu pastikan cincin naik dan toast muncul sekali ketika target 5 menit tercapai.
2. **Lobi desktop:** tanaman tampil di dekat meja baca, dan hotspot "Kebiasaan baca" membuka panel. Tahap tanaman mengikuti streak; untuk mencobanya, isi `reading_time` di dev lewat SQL untuk beberapa hari ke belakang.
3. **Dua perangkat:** baca di HP dan laptop pada hari yang sama, lalu pastikan menit di panel adalah jumlah keduanya, tanpa terhitung ganda setelah muat ulang.
4. **Offline:** baca saat offline, lalu online lagi, dan pastikan menit sampai ke server.
5. **Kartu anggota** di Pengaturan menampilkan "Streak N hari · Rekor M".
