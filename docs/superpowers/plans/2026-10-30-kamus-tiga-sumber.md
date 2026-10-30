# Glosa: Kamus Tiga Sumber (Wiktionary, WordNet Bahasa, AI): Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kamus Glosa mengisi kata yang tidak punya terjemahan Indonesia di Wiktionary dengan arti dari dua sumber lain: WordNet Bahasa, lalu AI (Claude Opus 5.5, dibuat sekali lalu disimpan). Popup arti menyebut sumber arti yang tampil.

**Architecture:**
- **Data.**
  - `dict_entries` dan staging-nya mendapat kolom `source`.
  - Tabel baru `dict_generated` menyimpan arti AI secara permanen.
  - Tabel baru `dict_misses` mencatat kata yang dicari tanpa hasil, tanpa identitas.
  - `lookup_word` mengembalikan `source` dan mencatat kata yang tidak punya arti lewat `dict_note_miss`. `dict_swap` ikut menyalin `source`.
- **Impor.** `scripts/import-dictionary.ts` membaca tiga sumber:
  - kaikki, lewat builder yang sudah ada;
  - WordNet Bahasa ditambah `index.sense` Princeton, lewat `wordnet.ts`;
  - `dict_generated`.

  Ketiganya digabung `mergeDictionary` dengan prioritas Wiktionary → WordNet → AI per (kata, kelas kata), lalu ditukar sekali dengan `dict_swap`.
- **Pengisi AI.** `scripts/fill-dictionary.ts`:
  - menyusun calon kata dari daftar frekuensi `wordfreq` dan `dict_misses` (`pickCandidates`);
  - mengirimnya lewat Message Batches API dengan output JSON terstruktur;
  - memvalidasi jawaban (`readAnswer`), lalu menulis jawaban yang valid ke `dict_generated` hanya bila `--commit`.
- **Popup.** `WordPopup` menghitung baris kredit dari `source` entri yang tampil.

**Tech Stack:** Node 24 (menjalankan `.ts` langsung, impor dengan ekstensi `.ts`), Supabase Postgres (plpgsql, RLS), `@supabase/supabase-js`, `@anthropic-ai/sdk` (Message Batches, `output_config.format` json_schema, `output_config.effort`), zod 4, React 19, Vitest + Testing Library, Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-30-kamus-tiga-sumber-design.md`](../specs/2026-10-30-kamus-tiga-sumber-design.md). Spec induk: [`2026-10-22-tahap-2-ketuk-kata-design.md`](../specs/2026-10-22-tahap-2-ketuk-kata-design.md) §4.1 dan §6.3.

## Global Constraints

- **Bahasa:** teks UI dan dokumen berbahasa Indonesia. Komentar kode dan prompt AI berbahasa Inggris, mengikuti kode yang ada. Array ditulis `Array<T>`, seperti kode yang ada.
- **Migrasi hanya menambah** (`docs/ops/deploy.md` §7): kolom dengan default, tabel baru, fungsi baru, dan isi baru untuk fungsi yang tanda tangannya sama.
- **Prioritas sumber (spec keputusan 1):** per (kata, kelas kata): Wiktionary → WordNet → AI. Satu entri berasal dari satu sumber.
- **Nilai `source`:** `'wiktionary'`, `'wordnet'`, `'ai'`. Defaultnya `'wiktionary'`.
- **Arti:** maksimal 8 per kelas kata (`MAX_MEANINGS`), tiap arti maksimal 100 karakter. Phrasal verb dan frasa hanya dari Wiktionary.
- **WordNet (spec keputusan 7):**
  - bahasa `I` atau `B`;
  - mutu bawaan `Y` dan `O`; `L` hanya bila pemilik memilihnya (Task 8);
  - `M` dan `X` selalu dibuang.
- **Model AI:** `claude-opus-5-5`, lewat Message Batches API (harga batch $2 input / $10 output per juta token), 50 kata per permintaan. Thinking tidak bisa dimatikan di model ini; `output_config.effort` adalah satu-satunya kendali, dan defaultnya `medium`.
- **Teks kredit (persis):** "Wiktionary · CC BY-SA" (tautan ke `https://en.wiktionary.org/wiki/<kata dasar>`), "WordNet Bahasa" (tautan ke `https://wn-msa.sourceforge.net/`), "Dibuat AI" (teks biasa). Urutannya selalu Wiktionary, WordNet Bahasa, Dibuat AI, dipisah " · ".
- **Dependensi baru:** hanya `@anthropic-ai/sdk`, sebagai devDependency dan hanya diimpor dari `scripts/`.
- **Kunci API** hanya ada di laptop pemilik (`ANTHROPIC_API_KEY` atau profil `ant auth login`). Implementer tidak menjalankan permintaan AI berbayar. Uji coba berbayar dijalankan pemilik (Task 8).
- **Supabase dev dipakai bersama:**
  - test hanya menulis baris miliknya sendiri, dengan kata berawalan unik yang dihapus lagi;
  - test tidak pernah memanggil `dict_swap` atau `dict_staging_reset`;
  - skrip impor memanggil `dict_swap` hanya di Task 8, dan hanya setelah pemilik setuju.
- **File besar di `dict/`** tidak masuk git (sudah ada di `.gitignore`). File unduhan dianggap data tak tepercaya: diekstrak ke direktori baru yang kosong, dan tidak ada skrip yang dijalankan dari dalamnya.
- **Memori Node:** skrip yang membaca kaikki dijalankan dengan `node --max-old-space-size=8192`.
- **Line ending:** LF.
- **E2E:**
  - Jalankan dengan `--workers=2`.
  - Kalau port 3000 dipegang aplikasi lain (cek `curl -sL localhost:3000/login | grep -o "<title>[^<]*"`), jalankan dengan config sementara di port 3100. Jangan matikan server lain.
  - Kegagalan tunggal dijalankan ulang sendirian sebelum disebut regresi.
- **Verifikasi sebelum commit:** `npm run typecheck`, `npm run lint`, `npm run check`, dan test yang relevan.

## Keputusan dan penyimpangan dari spec

1. **Dari Princeton WNdb-3.0 hanya `index.sense` yang dipakai.** Satu barisnya sudah memuat lemma Inggris, offset synset, nomor sense, dan tag count. Spec §4.1 menyebut juga `data.*`, tetapi file itu tidak dibutuhkan.
2. **Kolom jumlah di `dict_misses` bernama `lookups`, bukan `count`.** `count` bertabrakan dengan agregat PostgREST (`select=count`).
3. **`lookup_word` menjadi `volatile`.** PostgREST menjalankan fungsi `stable` di transaksi read-only, padahal fungsi ini sekarang menulis. Penulisan lewat `dict_note_miss` (`security definer`), yang boleh dipanggil member karena `lookup_word` berjalan sebagai member (`security invoker`). `dict_note_miss` memeriksa ulang bahwa kata itu memang tanpa arti, sehingga panggilan langsung tidak bisa mencatat kata yang punya arti.
4. **Kata dicatat sebagai miss bila `entries` kosong.** Phrasal verb yang ditemukan tidak dihitung, karena kata itu sendiri tetap tanpa arti.
5. **`dict_misses` dibaca maksimal 5.000 baris teratas** (berdasarkan `lookups`), dan disaring dengan `isLookupWord`. Tujuannya supaya ketukan asal tidak menjadi biaya AI.

   Baris miss dihapus pada jalan `--commit` berikutnya, saat calon kata disusun, yaitu baris yang sudah tidak menghasilkan permintaan. Spec §4.3 langkah 5 menyebut penghapusan langsung setelah menulis. Waktunya bergeser, tetapi aturannya sama: hanya kata yang sudah terjawab yang dihapus.
6. **Jawaban AI dengan lebih dari 8 arti tidak ditolak.** 8 arti pertama disimpan, karena urutannya sudah dari yang paling umum. Menolaknya berarti membayar ulang untuk jawaban yang sebenarnya baik. Arti kosong, arti lebih dari 100 karakter, atau arti dengan karakter kendali tetap menggagalkan kata itu.
7. **Kredit tidak tampil selama popup belum menampilkan arti,** termasuk saat memuat, offline, atau gagal. Spec §5 menyebut "seperti sekarang", padahal kode sekarang selalu menampilkan tautan Wiktionary. Plan mengikuti maksud spec: kredit hanya ada bila ada arti.
8. **Urutan arti WordNet bergilir per sense.** Padanan pertama dari tiap sense masuk lebih dulu, mulai dari sense dengan tag count terbesar, lalu padanan kedua dari tiap sense, dan seterusnya. Dengan begitu, 8 slot arti tidak habis untuk sinonim satu sense saja.
9. **Lemma WordNet berupa frasa dibuang,** karena frasa hanya dari Wiktionary (spec §3.1).
10. **Kelas kata `phrase` tidak pernah ditanyakan ke AI.**
11. **Opsi tambahan:**
    - impor: `--dry-run` (membaca semuanya tanpa mengubah kamus) dan `--coverage <file.txt>` (mengukur cakupan sebuah teks), untuk langkah ukur keputusan 7;
    - pengisi: `--dry-run` (calon kata tanpa API), `--discard` (melupakan batch yang tertunda), `--limit N`, dan `--effort` (default `medium`).
12. **`e2e/vocabulary.spec.ts` berhenti memeriksa tautan Wiktionary.** Kata acak di Sherlock sekarang bisa bersumber lain atau belum punya arti. Kredit diuji di test unit dan di E2E baru dengan kata fixture.
13. **`pointOf` dipindah** dari `e2e/comfort.spec.ts` ke `e2e/helpers/reading.ts`, supaya E2E baru bisa mengetuk kata fixture tepat di elemennya.

## Struktur file

| File | Tanggung jawab |
|---|---|
| `supabase/migrations/20261031000100_dictionary_sources.sql` (baru) | Kolom `source`; `dict_generated`, `dict_misses`, `dict_note_miss`; isi baru `lookup_word` dan `dict_swap` |
| `src/server/database.types.ts` (dibuat ulang) | Tipe tabel dan fungsi baru |
| `src/lib/words/types.ts` | `DICT_SOURCES`, `DictSource`, `SourcedEntry`, `LookupEntry` |
| `src/lib/words/wordnet.ts` (baru) | Membaca `wn-msa-all.tab` dan `index.sense` menjadi entri |
| `src/lib/words/dict-merge.ts` (baru) | `keyOf`, `GeneratedRow`, `mergeDictionary` |
| `src/lib/words/dict-import.ts` | Builder mengembalikan semua bentuk kata dan `partsOfSpeech` |
| `src/lib/words/coverage.ts` (baru) | `measureCoverage` |
| `src/lib/words/fill-candidates.ts` (baru) | `FillRequest`, `pickCandidates`, `chunk` |
| `src/lib/words/fill-answer.ts` (baru) | Model, prompt, skema JSON, `readAnswer`, `batchCost` |
| `scripts/dictionary-files.ts` (baru) | Membaca file sumber dan tabel kamus, bersama kedua skrip |
| `scripts/import-dictionary.ts` | Impor tiga sumber |
| `scripts/fill-dictionary.ts` (baru) | Pengisi AI lewat Batch API |
| `src/components/reader/WordPopup.tsx`, `src/styles.css` | Baris kredit per sumber |
| `tests/db/dictionary-sources.test.ts` (baru) | `source`, `dict_misses`, akses |
| `e2e/helpers/dictionary.ts` (baru), `e2e/dictionary-sources.spec.ts` (baru) | Kata fixture bersumber AI |
| `src/routes/privacy.tsx`, `docs/ops/deploy.md` §6.5 | Privasi, atribusi, panduan pemilik |

---

### Task 1: Kolom sumber, tabel AI, dan catatan kata tanpa arti

**Files:**
- Create: `supabase/migrations/20261031000100_dictionary_sources.sql`
- Create: `tests/db/dictionary-sources.test.ts`
- Modify: `src/lib/words/types.ts`
- Regenerate: `src/server/database.types.ts`

**Interfaces:**
- Produces:
  - Tipe di `types.ts`: `DICT_SOURCES`, `DictSource = "wiktionary" | "wordnet" | "ai"`, `SourcedEntry = DictEntry & { source: DictSource }`, `LookupEntry = DictEntry & { source?: DictSource }`, dan `LookupResult.entries: Array<LookupEntry>`.
  - Tabel `dict_generated(headword, pos, meanings, model, created_at)`.
  - Tabel `dict_misses(word, lookups, last_seen)`.
  - Kolom `dict_entries.source` dan `dict_entries_staging.source`.
  - RPC `dict_note_miss(p_word text)`.

- [ ] **Step 1: Tulis test DB yang gagal**

`tests/db/dictionary-sources.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  dictionaryFixture,
  fixturePrefix,
  removeDictionary,
  seedDictionary,
} from "./dictionary-fixture"
import {
  adminClient,
  anonClient,
  createTestMember,
  deleteTestMembers,
  signedInClient,
} from "./helpers"

const email = `db-dict-src-${Date.now().toString(36)}@glosa.test`
type Client = Awaited<ReturnType<typeof signedInClient>>
type Entry = { headword: string; pos: string; source?: string }

// Spec kamus tiga sumber §3, §7. Only this run's prefixed words are written,
// and the dictionary is never swapped.
describe("dictionary sources", () => {
  const prefix = fixturePrefix()
  const fixture = dictionaryFixture(prefix)
  const made = `${prefix}made`
  const missing = `${prefix}missing`
  let member: Client

  beforeAll(async () => {
    await createTestMember({ email })
    member = await signedInClient(email)
    await seedDictionary(fixture)
    const admin = adminClient()
    const { error } = await admin.from("dict_entries").insert({
      headword: made,
      pos: "noun",
      meanings: ["buatan"],
      source: "ai",
    })
    if (error) throw error
    const { error: formError } = await admin
      .from("dict_forms")
      .insert({ form: made, headword: made, pos: "noun" })
    if (formError) throw formError
  })

  afterAll(async () => {
    const admin = adminClient()
    await admin.from("dict_entries").delete().eq("headword", made)
    await admin.from("dict_misses").delete().like("word", `${prefix}%`)
    await removeDictionary(fixture)
    await deleteTestMembers()
  })

  const lookUp = (word: string, next: Array<string> = []) =>
    member.rpc("lookup_word", { p_word: word, p_next: next })

  async function missesOf(word: string) {
    const { data, error } = await adminClient()
      .from("dict_misses")
      .select("lookups, last_seen")
      .eq("word", word)
    if (error) throw error
    return data
  }

  it("names the source of each entry", async () => {
    const run = await lookUp(fixture.run)
    expect(
      (run.data as { entries: Array<Entry> }).entries.map((e) => e.source)
    ).toEqual(["wiktionary", "wiktionary"])
    const ai = await lookUp(made)
    expect((ai.data as { entries: unknown }).entries).toEqual([
      { headword: made, pos: "noun", meanings: ["buatan"], source: "ai" },
    ])
  })

  it("counts a word looked up without a meaning", async () => {
    await lookUp(missing)
    await lookUp(missing)
    const rows = await missesOf(missing)
    expect(rows).toHaveLength(1)
    expect(rows[0].lookups).toBe(2)
    expect(rows[0].last_seen).toEqual(expect.any(String))
  })

  it("does not count a word that has a meaning, or one too long", async () => {
    await lookUp(fixture.ran)
    await lookUp(made)
    expect(await missesOf(fixture.ran)).toEqual([])
    expect(await missesOf(made)).toEqual([])
    const long = `${prefix}${"a".repeat(64)}`
    const answer = await lookUp(long)
    expect(answer.data).toMatchObject({ entries: [], phrases: [] })
    expect(await missesOf(long)).toEqual([])
  })

  it("cannot be made to count a word that has a meaning", async () => {
    const { error } = await member.rpc("dict_note_miss", {
      p_word: fixture.run,
    })
    expect(error).toBeNull()
    expect(await missesOf(fixture.run)).toEqual([])
  })

  it("keeps members and guests out of the AI meanings and the misses", async () => {
    const generated = await member.from("dict_generated").select("headword")
    expect(generated.error?.code).toBe("42501")
    const misses = await member.from("dict_misses").select("word")
    expect(misses.error?.code).toBe("42501")
    const guest = await anonClient().rpc("dict_note_miss", {
      p_word: missing,
    })
    expect(guest.error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan dan pastikan gagal**

Run: `npx vitest run --config vitest.db.config.ts tests/db/dictionary-sources.test.ts`

Expected: FAIL. Insert `source` ditolak (kolomnya belum ada), dan `dict_misses` tidak ditemukan. Typecheck juga belum lolos, karena tipe `source` dan `dict_note_miss` belum ada.

- [ ] **Step 3: Tulis migrasi**

`supabase/migrations/20261031000100_dictionary_sources.sql`:

```sql
-- Three sources for the dictionary (spec kamus tiga sumber §3): English
-- Wiktionary, WordNet Bahasa, and meanings made once by AI. Only adds: a
-- column with a default, two tables, one function, and new bodies for
-- lookup_word and dict_swap with the same signatures and grants.
alter table public.dict_entries
  add column source text not null default 'wiktionary'
  check (source in ('wiktionary', 'wordnet', 'ai'));
alter table public.dict_entries_staging
  add column source text not null default 'wiktionary';

-- Meanings made by AI (spec §3.2). Kept for good: dict_swap never touches
-- it, and the import reads it. Empty meanings: the AI found no Indonesian
-- equivalent, so the word is not asked again. Only the service role
-- (scripts) reads and writes it.
create table public.dict_generated (
  headword text not null check (char_length(headword) between 1 and 64),
  pos text not null check (
    pos in (
      'noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'conj', 'interj', 'phrase',
      'article', 'det', 'num', 'particle'
    )
  ),
  meanings text[] not null check (cardinality(meanings) between 0 and 8),
  model text not null check (char_length(model) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (headword, pos)
);

-- Words looked up without a meaning (spec §3.3), with no one's identity: the
-- word, how often, and when last. Picks the words the AI is asked next.
create table public.dict_misses (
  word text primary key check (char_length(word) between 1 and 64),
  lookups integer not null default 1 check (lookups > 0),
  last_seen timestamptz not null default now()
);

alter table public.dict_generated enable row level security;
alter table public.dict_misses enable row level security;
revoke all on table public.dict_generated, public.dict_misses
  from anon, authenticated;

-- Counts one lookup of a word without a meaning. Members may call it (the
-- lookup runs as them), so it checks again that the word has none.
create function public.dict_note_miss(p_word text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_word is null or char_length(p_word) not between 1 and 64 then
    return;
  end if;
  if exists (select 1 from public.dict_forms f where f.form = p_word) then
    return;
  end if;
  insert into public.dict_misses as m (word) values (p_word)
  on conflict (word) do update
    set lookups = m.lookups + 1, last_seen = now();
end;
$$;

revoke execute on function public.dict_note_miss(text) from public, anon;
grant execute on function public.dict_note_miss(text) to authenticated;

-- Each entry names its source, and a word without a meaning is counted
-- (spec §3.1, §3.3). Volatile now: it writes, and PostgREST runs stable
-- functions read-only. Counting never fails the lookup.
create or replace function public.lookup_word(p_word text, p_next text[] default '{}')
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_entries jsonb := '[]'::jsonb;
  v_phrases jsonb := '[]'::jsonb;
  v_next integer := coalesce(cardinality(p_next), 0);
  v_version timestamptz := (select m.imported_at from public.dict_meta m);
begin
  if p_word is null or char_length(p_word) not between 1 and 64 or v_next > 2 then
    return jsonb_build_object(
      'word', p_word, 'entries', v_entries, 'phrases', v_phrases, 'version', v_version
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'headword', e.headword,
        'pos', e.pos,
        'meanings', to_jsonb(e.meanings),
        'source', e.source
      )
      order by public.dict_pos_rank(e.pos), e.headword <> p_word, e.headword
    ),
    '[]'::jsonb
  )
  into v_entries
  from (select distinct f.headword, f.pos from public.dict_forms f where f.form = p_word) b
  join public.dict_entries e on e.headword = b.headword and e.pos = b.pos;

  if v_entries = '[]'::jsonb then
    begin
      perform public.dict_note_miss(p_word);
    exception when others then
      null;
    end;
  end if;

  if v_next > 0 then
    with heads as (
      select f.headword from public.dict_forms f where f.form = p_word
      union
      select p_word
    ),
    candidates as (
      select h.headword || ' ' || p_next[1] as phrase from heads h
      union
      select h.headword || ' ' || p_next[1] || ' ' || p_next[2]
      from heads h
      where v_next = 2
    ),
    found as (
      select
        e.headword,
        (jsonb_agg(to_jsonb(e.meanings) order by public.dict_pos_rank(e.pos)))->0 as meanings
      from public.dict_entries e
      where e.headword in (select c.phrase from candidates c where c.phrase is not null)
      group by e.headword
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object('headword', p.headword, 'meanings', p.meanings)
        order by cardinality(string_to_array(p.headword, ' ')) desc, p.headword
      ),
      '[]'::jsonb
    )
    into v_phrases
    from found p;
  end if;

  return jsonb_build_object(
      'word', p_word, 'entries', v_entries, 'phrases', v_phrases, 'version', v_version
    );
end;
$$;

revoke execute on function public.lookup_word(text, text[]) from public, anon;
grant execute on function public.lookup_word(text, text[]) to authenticated;

-- The same swap, carrying each entry's source along.
create or replace function public.dict_swap(
  p_source text,
  p_dump_date date default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entries integer;
  v_forms integer;
  v_previous integer;
begin
  select count(*) into v_entries
  from (select distinct s.headword, s.pos from public.dict_entries_staging s) d;
  if v_entries = 0 then
    raise exception 'empty' using errcode = 'P0001';
  end if;
  select m.entries into v_previous from public.dict_meta m;
  if not p_force and v_previous is not null and v_entries < v_previous * 0.8 then
    raise exception 'shrunk' using errcode = 'P0001';
  end if;

  truncate public.dict_forms, public.dict_entries;
  insert into public.dict_entries (headword, pos, meanings, source)
  select distinct on (s.headword, s.pos) s.headword, s.pos, s.meanings, s.source
  from public.dict_entries_staging s
  order by s.headword, s.pos;
  insert into public.dict_forms (form, headword, pos)
  select distinct s.form, s.headword, s.pos
  from public.dict_forms_staging s
  join public.dict_entries e on e.headword = s.headword and e.pos = s.pos;
  insert into public.dict_forms (form, headword, pos)
  select e.headword, e.headword, e.pos from public.dict_entries e
  on conflict do nothing;
  select count(*) into v_forms from public.dict_forms;

  insert into public.dict_meta (id, source, dump_date, entries, forms, imported_at)
  values (true, p_source, p_dump_date, v_entries, v_forms, now())
  on conflict (id) do update
    set source = excluded.source,
        dump_date = excluded.dump_date,
        entries = excluded.entries,
        forms = excluded.forms,
        imported_at = excluded.imported_at;
  truncate public.dict_entries_staging, public.dict_forms_staging;

  return jsonb_build_object('entries', v_entries, 'forms', v_forms, 'previous', v_previous);
end;
$$;

revoke execute on function public.dict_swap(text, date, boolean)
  from public, anon, authenticated;
grant execute on function public.dict_swap(text, date, boolean) to service_role;
```

- [ ] **Step 4: Push ke dev dan buat ulang tipe**

Run: `npm run db:push`

Expected: migrasi `20261031000100_dictionary_sources.sql` diterapkan tanpa error.

Run: `npm run db:types`

Expected: `src/server/database.types.ts` memuat `dict_generated`, `dict_misses`, `source` di `dict_entries` dan `dict_entries_staging`, serta `dict_note_miss` di `Functions`. File ini dikecualikan dari Prettier (`.prettierignore`).

- [ ] **Step 5: Tambah tipe sumber**

Di `src/lib/words/types.ts`, tambahkan setelah `MAX_MEANINGS`:

```ts
/** Where an entry's meanings came from (spec kamus tiga sumber §3.1). */
export const DICT_SOURCES = ["wiktionary", "wordnet", "ai"] as const
export type DictSource = (typeof DICT_SOURCES)[number]
```

Setelah `DictForm`:

```ts
/** An entry as the dictionary keeps it: one source per headword and part of speech. */
export type SourcedEntry = DictEntry & { source: DictSource }
/**
 * An entry as lookup_word answers it. Answers cached on a device before the
 * source column came have none: those meanings came from Wiktionary.
 */
export type LookupEntry = DictEntry & { source?: DictSource }
```

Di `LookupResult`, ganti `entries: Array<DictEntry>` dengan `entries: Array<LookupEntry>`.

- [ ] **Step 6: Jalankan test dan pastikan lolos**

Run: `npx vitest run --config vitest.db.config.ts tests/db/dictionary-sources.test.ts tests/db/dictionary.test.ts tests/db/saved-words.test.ts`

Expected: PASS semuanya.

Run: `npm run typecheck && npm run lint && npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261031000100_dictionary_sources.sql src/server/database.types.ts src/lib/words/types.ts tests/db/dictionary-sources.test.ts
git commit -m "feat(words): dictionary sources, AI meanings table and anonymous misses"
```

---

### Task 2: Pembaca WordNet Bahasa

**Files:**
- Create: `src/lib/words/wordnet.ts`
- Test: `src/lib/words/wordnet.test.ts`

**Interfaces:**
- Consumes: `normalizeWord` dan `isLookupWord` dari `./normalize.ts`; `DictEntry`, `DictPos`, `MAX_MEANINGS` dari `./types.ts`.
- Produces:
  - `WORDNET_QUALITIES = ["Y", "O", "L"] as const` dan `type WordnetQuality`;
  - `DEFAULT_WORDNET_QUALITIES: ReadonlyArray<WordnetQuality>` (`["Y", "O"]`);
  - `createWordnetReader(qualities?)`, yang mengembalikan `{ addBahasa(line: string): void; addSense(line: string): void; result(): Array<DictEntry> }`.

- [ ] **Step 1: Tulis test yang gagal**

`src/lib/words/wordnet.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { type WordnetQuality, createWordnetReader } from "./wordnet"

// wn-msa-all.tab: synset, language, quality, lemma.
const BAHASA = [
  "01234567-v\tI\tY\tmembuat",
  "01234567-v\tB\tO\tmenghasilkan",
  "01234567-v\tM\tY\tbikin",
  "01234567-v\tI\tL\tmencipta",
  "01234567-v\tI\tX\tsalah",
  "07654321-v\tI\tY\tmenjadikan",
  "00011111-a\tI\tY\tcepat",
  "00022222-n\tI\tY\tes_krim",
]
// index.sense: sense key, synset offset, sense number, tag count.
const SENSES = [
  "make%2:36:00:: 01234567 2 5",
  "make%2:30:00:: 07654321 1 40",
  "quick%5:00:00:fast:01 00011111 1 3",
  "ice_cream%1:13:00:: 00022222 1 2",
  "cream%1:13:00:: 00022222 2 0",
]

function read(
  bahasa: Array<string>,
  senses: Array<string>,
  qualities?: Array<WordnetQuality>
) {
  const reader = createWordnetReader(qualities)
  for (const line of bahasa) reader.addBahasa(line)
  for (const line of senses) reader.addSense(line)
  return reader.result()
}

describe("createWordnetReader", () => {
  it("keeps Indonesian lemmas marked Y or O, the most tagged sense first", () => {
    expect(read(BAHASA, SENSES)).toEqual([
      {
        headword: "make",
        pos: "verb",
        meanings: ["menjadikan", "membuat", "menghasilkan"],
      },
      { headword: "quick", pos: "adj", meanings: ["cepat"] },
      { headword: "cream", pos: "noun", meanings: ["es krim"] },
    ])
  })

  it("takes L as well when asked, and never Malay only (M) or wrong (X)", () => {
    const [make] = read(BAHASA, SENSES, ["Y", "O", "L"])
    expect(make.meanings).toEqual([
      "menjadikan",
      "membuat",
      "menghasilkan",
      "mencipta",
    ])
  })

  it("takes each sense's first equivalent before any second one", () => {
    const bahasa = [
      "00000001-n\tI\tY\tsatu",
      "00000001-n\tI\tY\tesa",
      "00000002-n\tI\tY\tdua",
    ]
    const senses = [
      "one%1:23:00:: 00000001 1 9",
      "one%1:09:00:: 00000002 2 1",
    ]
    expect(read(bahasa, senses)[0].meanings).toEqual(["satu", "dua", "esa"])
  })

  it("keeps at most eight meanings, without repeats", () => {
    const bahasa = [
      ...Array.from({ length: 10 }, (_, i) => `00000003-n\tI\tY\tarti${i}`),
      "00000004-n\tI\tY\tarti0",
    ]
    const senses = [
      "word%1:10:00:: 00000003 1 5",
      "word%1:10:01:: 00000004 2 1",
    ]
    const [word] = read(bahasa, senses)
    expect(word.meanings).toHaveLength(8)
    expect(new Set(word.meanings).size).toBe(8)
  })

  it("leaves out phrases, senses without Indonesian, and lines it cannot read", () => {
    const entries = read(
      ["00000005-n\tI\tY\tkata"],
      [
        "kick_the_bucket%2:30:00:: 00000005 1 0",
        "lonely%1:00:00:: 09999999 1 0",
        "broken line",
        "odd%9:00:00:: 00000005 1 0",
      ]
    )
    expect(entries).toEqual([])
  })
})
```

- [ ] **Step 2: Jalankan dan pastikan gagal**

Run: `npx vitest run src/lib/words/wordnet.test.ts`

Expected: FAIL, karena `./wordnet` belum ada.

- [ ] **Step 3: Tulis implementasi**

`src/lib/words/wordnet.ts`:

```ts
// Extensions spelled out: Node runs this file for the dictionary scripts and
// resolves nothing by itself.
import { isLookupWord, normalizeWord } from "./normalize.ts"
import { type DictEntry, type DictPos, MAX_MEANINGS } from "./types.ts"

/** WordNet Bahasa's marks of quality the import may take (spec kamus tiga sumber, decision 7). */
export const WORDNET_QUALITIES = ["Y", "O", "L"] as const
export type WordnetQuality = (typeof WORDNET_QUALITIES)[number]
export const DEFAULT_WORDNET_QUALITIES: ReadonlyArray<WordnetQuality> = [
  "Y",
  "O",
]

/** Indonesian, or Indonesian and Malay alike. "M" (Malay only) stays out. */
const LANGUAGES = new Set(["I", "B"])
/** Princeton's synset types; adjectives (3) and their satellites (5) share one file. */
const SYNSET_TYPES: Partial<Record<string, { letter: string; pos: DictPos }>> =
  {
    "1": { letter: "n", pos: "noun" },
    "2": { letter: "v", pos: "verb" },
    "3": { letter: "a", pos: "adj" },
    "4": { letter: "r", pos: "adv" },
    "5": { letter: "a", pos: "adj" },
  }
const MAX_MEANING_LENGTH = 100

type Sense = { synset: string; number: number; tagged: number }

/**
 * Builds dictionary entries from WordNet Bahasa (wn-msa-all.tab) and Princeton
 * WordNet 3.0's index.sense: each English word's Indonesian lemmas, the most
 * often tagged sense first. Phrases stay out: they come from Wiktionary only.
 */
export function createWordnetReader(
  qualities: ReadonlyArray<WordnetQuality> = DEFAULT_WORDNET_QUALITIES
) {
  const accepted = new Set<string>(qualities)
  const lemmas = new Map<string, Array<string>>()
  const words = new Map<
    string,
    { headword: string; pos: DictPos; senses: Array<Sense> }
  >()

  return {
    /** One line of wn-msa-all.tab: synset, language, quality, lemma. */
    addBahasa(line: string): void {
      const [synset, language, quality, raw] = line.split("\t")
      if (!synset || !raw || !LANGUAGES.has(language)) return
      if (!accepted.has(quality)) return
      const lemma = raw.replaceAll("_", " ").replace(/\s+/gu, " ").trim()
      if (lemma.length === 0 || lemma.length > MAX_MEANING_LENGTH) return
      const list = lemmas.get(synset) ?? []
      if (!list.includes(lemma)) list.push(lemma)
      lemmas.set(synset, list)
    },

    /** One line of index.sense: sense key, synset offset, sense number, tag count. */
    addSense(line: string): void {
      const [key, offset, number, tagged] = line.trim().split(" ")
      const percent = key ? key.indexOf("%") : -1
      if (!key || !offset || percent < 1) return
      const type = SYNSET_TYPES[key.charAt(percent + 1)]
      if (!type) return
      const headword = normalizeWord(key.slice(0, percent).replaceAll("_", " "))
      if (!isLookupWord(headword)) return
      const id = `${headword}\t${type.pos}`
      const word = words.get(id) ?? { headword, pos: type.pos, senses: [] }
      word.senses.push({
        synset: `${offset}-${type.letter}`,
        number: Number(number),
        tagged: Number(tagged),
      })
      words.set(id, word)
    },

    /**
     * One entry per English word and part of speech that has Indonesian:
     * each sense's first equivalent, the most tagged sense first, then each
     * sense's second, and so on, at most eight.
     */
    result(): Array<DictEntry> {
      const entries: Array<DictEntry> = []
      for (const { headword, pos, senses } of words.values()) {
        const ranked = [...senses]
          .sort((a, b) => b.tagged - a.tagged || a.number - b.number)
          .map((sense) => lemmas.get(sense.synset) ?? [])
        const longest = Math.max(0, ...ranked.map((list) => list.length))
        const meanings: Array<string> = []
        for (let i = 0; i < longest && meanings.length < MAX_MEANINGS; i++) {
          for (const list of ranked) {
            const meaning = list.at(i)
            if (
              meaning !== undefined &&
              meanings.length < MAX_MEANINGS &&
              !meanings.includes(meaning)
            ) {
              meanings.push(meaning)
            }
          }
        }
        if (meanings.length > 0) entries.push({ headword, pos, meanings })
      }
      return entries
    },
  }
}
```

- [ ] **Step 4: Jalankan test dan pastikan lolos**

Run: `npx vitest run src/lib/words/wordnet.test.ts`

Expected: PASS (5 test).

- [ ] **Step 5: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npm run check`

Expected: PASS.

```bash
git add src/lib/words/wordnet.ts src/lib/words/wordnet.test.ts
git commit -m "feat(words): read WordNet Bahasa into dictionary entries, commonest sense first"
```

---

### Task 3: Penggabung tiga sumber dan ukuran cakupan

**Files:**
- Create: `src/lib/words/dict-merge.ts`, `src/lib/words/coverage.ts`
- Modify: `src/lib/words/dict-import.ts`
- Test: `src/lib/words/dict-merge.test.ts`, `src/lib/words/coverage.test.ts`, `src/lib/words/dict-import.test.ts`

**Interfaces:**
- Consumes: `DictEntry`, `DictForm`, `DictPos`, `DictSource`, `SourcedEntry`, `MAX_MEANINGS` (Task 1).
- Produces:
  - `keyOf(headword: string, pos: DictPos): string`, berbentuk `` `${headword}\t${pos}` ``;
  - `type GeneratedRow = DictEntry` (meanings boleh kosong);
  - `mergeDictionary({ wiktionary, wordnet, generated, forms })`, yang mengembalikan `{ entries: Array<SourcedEntry>; forms: Array<DictForm>; counts: Record<DictSource, number> }`;
  - `measureCoverage(text: string, hasMeaning: (word: string) => boolean)`, yang mengembalikan `{ tokens: number; coveredTokens: number; words: number; coveredWords: number }`;
  - `createDictionaryBuilder().result()` sekarang mengembalikan `{ entries; forms (semua bentuk, belum disaring); partsOfSpeech: Map<string, Set<DictPos>>; phrases }`.

- [ ] **Step 1: Tulis test penggabung yang gagal**

`src/lib/words/dict-merge.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { mergeDictionary } from "./dict-merge"

const forms = [
  { form: "made", headword: "make", pos: "verb" as const },
  { form: "cases", headword: "case", pos: "noun" as const },
  { form: "sang", headword: "sing", pos: "verb" as const },
]

describe("mergeDictionary", () => {
  it("takes Wiktionary first, then WordNet, then the AI, per word and part of speech", () => {
    const merged = mergeDictionary({
      wiktionary: [{ headword: "run", pos: "verb", meanings: ["berlari"] }],
      wordnet: [
        { headword: "run", pos: "verb", meanings: ["lari"] },
        { headword: "run", pos: "noun", meanings: ["larian"] },
        { headword: "case", pos: "noun", meanings: ["kasus"] },
      ],
      generated: [
        { headword: "case", pos: "noun", meanings: ["perkara"] },
        { headword: "make", pos: "verb", meanings: ["membuat"] },
      ],
      forms,
    })
    expect(merged.entries).toEqual([
      { headword: "run", pos: "verb", meanings: ["berlari"], source: "wiktionary" },
      { headword: "run", pos: "noun", meanings: ["larian"], source: "wordnet" },
      { headword: "case", pos: "noun", meanings: ["kasus"], source: "wordnet" },
      { headword: "make", pos: "verb", meanings: ["membuat"], source: "ai" },
    ])
    expect(merged.counts).toEqual({ wiktionary: 1, wordnet: 2, ai: 1 })
  })

  it("keeps the forms of headwords that got meanings from any source", () => {
    const merged = mergeDictionary({
      wiktionary: [],
      wordnet: [{ headword: "case", pos: "noun", meanings: ["kasus"] }],
      generated: [{ headword: "make", pos: "verb", meanings: ["membuat"] }],
      forms,
    })
    expect(merged.forms).toEqual([
      { form: "made", headword: "make", pos: "verb" },
      { form: "cases", headword: "case", pos: "noun" },
    ])
  })

  it("skips AI rows without meanings and keeps at most eight", () => {
    const many = Array.from({ length: 10 }, (_, i) => `arti${i}`)
    const merged = mergeDictionary({
      wiktionary: [],
      wordnet: [],
      generated: [
        { headword: "it", pos: "pron", meanings: [] },
        { headword: "case", pos: "noun", meanings: many },
      ],
      forms: [],
    })
    expect(merged.entries).toEqual([
      {
        headword: "case",
        pos: "noun",
        meanings: many.slice(0, 8),
        source: "ai",
      },
    ])
  })
})
```

`src/lib/words/coverage.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { measureCoverage } from "./coverage"

describe("measureCoverage", () => {
  it("counts the words as they occur and the distinct words, spelled the reader's way", () => {
    const known = new Set(["the", "ran"])
    expect(
      measureCoverage("The cat ran. The dog's bone -- RAN! 42", (word) =>
        known.has(word)
      )
    ).toEqual({ tokens: 7, coveredTokens: 4, words: 5, coveredWords: 2 })
  })
})
```

- [ ] **Step 2: Ubah test builder ke perilaku baru**

Di `src/lib/words/dict-import.test.ts`, ganti test `"drops forms of headwords without meanings, other languages and other parts of speech"` dengan:

```ts
  it("keeps every form and part of speech, also of headwords without meanings, but not other languages or names", () => {
    const result = build(
      { word: "sing", lang_code: "en", pos: "verb", forms: [{ form: "sang" }] },
      { ...run, lang_code: "fr" },
      { ...run, pos: "name" }
    )
    expect(result.entries).toEqual([])
    expect(result.forms).toEqual([
      { form: "sang", headword: "sing", pos: "verb" },
    ])
    expect(result.partsOfSpeech).toEqual(new Map([["sing", new Set(["verb"])]]))
  })

  it("lists every part of speech a headword has", () => {
    const like = (pos: string) => ({ word: "like", lang_code: "en", pos })
    expect(
      build(like("verb"), like("prep"), like("verb")).partsOfSpeech.get("like")
    ).toEqual(new Set(["verb", "prep"]))
  })
```

- [ ] **Step 3: Jalankan dan pastikan gagal**

Run: `npx vitest run src/lib/words/dict-merge.test.ts src/lib/words/coverage.test.ts src/lib/words/dict-import.test.ts`

Expected: FAIL. `./dict-merge` dan `./coverage` belum ada, dan builder masih menyaring bentuk kata serta belum punya `partsOfSpeech`.

- [ ] **Step 4: Tulis penggabung**

`src/lib/words/dict-merge.ts`:

```ts
// Extensions spelled out: Node runs this file for the dictionary scripts.
import {
  type DictEntry,
  type DictForm,
  type DictPos,
  type DictSource,
  MAX_MEANINGS,
  type SourcedEntry,
} from "./types.ts"

/** A row of dict_generated. Empty meanings: the AI found no Indonesian equivalent. */
export type GeneratedRow = DictEntry

export const keyOf = (headword: string, pos: DictPos) => `${headword}\t${pos}`

/**
 * One dictionary from three sources (spec kamus tiga sumber, decision 1): for
 * each headword and part of speech, Wiktionary's meanings, else WordNet
 * Bahasa's, else the AI's. Forms stay when their headword ends up with an
 * entry from any source (decision 9).
 */
export function mergeDictionary(sources: {
  wiktionary: Array<DictEntry>
  wordnet: Array<DictEntry>
  generated: Array<GeneratedRow>
  forms: Array<DictForm>
}): {
  entries: Array<SourcedEntry>
  forms: Array<DictForm>
  counts: Record<DictSource, number>
} {
  const entries = new Map<string, SourcedEntry>()
  const counts: Record<DictSource, number> = { wiktionary: 0, wordnet: 0, ai: 0 }
  const fill = (list: Array<DictEntry>, source: DictSource) => {
    for (const { headword, pos, meanings } of list) {
      const key = keyOf(headword, pos)
      if (meanings.length === 0 || entries.has(key)) continue
      entries.set(key, {
        headword,
        pos,
        meanings: meanings.slice(0, MAX_MEANINGS),
        source,
      })
      counts[source] += 1
    }
  }
  fill(sources.wiktionary, "wiktionary")
  fill(sources.wordnet, "wordnet")
  fill(sources.generated, "ai")
  return {
    entries: [...entries.values()],
    forms: sources.forms.filter((form) =>
      entries.has(keyOf(form.headword, form.pos))
    ),
    counts,
  }
}
```

- [ ] **Step 5: Tulis ukuran cakupan**

`src/lib/words/coverage.ts`:

```ts
// Extensions spelled out: Node runs this file for scripts/import-dictionary.ts.
import { isLookupWord, normalizeWord } from "./normalize.ts"

export type Coverage = {
  tokens: number
  coveredTokens: number
  words: number
  coveredWords: number
}

/**
 * How much of a text the dictionary covers (spec kamus tiga sumber §7): of
 * its words as they occur, and of its distinct words, each spelled the way
 * the reader looks it up.
 */
export function measureCoverage(
  text: string,
  hasMeaning: (word: string) => boolean
): Coverage {
  const counts = new Map<string, number>()
  for (const raw of text.split(/[^\p{L}'’-]+/u)) {
    const word = normalizeWord(raw)
    if (isLookupWord(word)) counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  const coverage: Coverage = {
    tokens: 0,
    coveredTokens: 0,
    words: counts.size,
    coveredWords: 0,
  }
  for (const [word, count] of counts) {
    coverage.tokens += count
    if (hasMeaning(word)) {
      coverage.coveredTokens += count
      coverage.coveredWords += 1
    }
  }
  return coverage
}
```

- [ ] **Step 6: Ubah builder**

Di `src/lib/words/dict-import.ts`:

1. Hapus `const keyOf = ...` lokal. Tambahkan `import { keyOf } from "./dict-merge.ts"`.
2. Di `createDictionaryBuilder`, tambahkan `const partsOfSpeech = new Map<string, Set<DictPos>>()`. Di `add`, tepat setelah baris `if (record.lang_code !== "en" || !pos || !headword) return`, tambahkan:

   ```ts
   const known = partsOfSpeech.get(headword) ?? new Set<DictPos>()
   known.add(pos)
   partsOfSpeech.set(headword, known)
   ```

3. Ganti `result()` dengan:

   ```ts
       result(): {
         entries: Array<DictEntry>
         /** Every form, of headwords without meanings too: mergeDictionary keeps the ones whose headword gets an entry. */
         forms: Array<DictForm>
         /** Each English headword's parts of speech, with meanings or without (spec kamus tiga sumber, decision 6). */
         partsOfSpeech: Map<string, Set<DictPos>>
         phrases: number
       } {
         const list = [...entries.values()]
         return {
           entries: list,
           forms: [...forms.values()],
           partsOfSpeech,
           phrases: list.filter((entry) => entry.headword.includes(" ")).length,
         }
       },
   ```

4. Ubah kalimat terakhir JSDoc builder dari "Forms whose headword has no meaning are dropped." menjadi: "Forms are kept for every headword; mergeDictionary drops those whose headword gets no meaning from any source."

`scripts/import-dictionary.ts` masih memakai `builder.result().forms` secara langsung sampai Task 4. Selama itu, bentuk kata tidak disaring, sehingga `dict_swap` menyaringnya dengan join ke `dict_entries`. Skrip itu tidak dijalankan di task ini.

- [ ] **Step 7: Jalankan test dan pastikan lolos**

Run: `npx vitest run src/lib/words`

Expected: PASS semuanya.

- [ ] **Step 8: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npm run check`

Expected: PASS.

```bash
git add src/lib/words/dict-merge.ts src/lib/words/dict-merge.test.ts src/lib/words/coverage.ts src/lib/words/coverage.test.ts src/lib/words/dict-import.ts src/lib/words/dict-import.test.ts
git commit -m "feat(words): merge Wiktionary, WordNet and AI meanings, keep forms for any source"
```

---

### Task 4: Skrip impor tiga sumber

**Files:**
- Create: `scripts/dictionary-files.ts`
- Modify: `scripts/import-dictionary.ts` (ditulis ulang)

**Interfaces:**
- Consumes:
  - `createDictionaryBuilder` (Task 3);
  - `createWordnetReader`, `WORDNET_QUALITIES`, `DEFAULT_WORDNET_QUALITIES`, `WordnetQuality` (Task 2);
  - `mergeDictionary`, `GeneratedRow`, `keyOf` (Task 3);
  - `measureCoverage` (Task 3);
  - `DICT_POS`, `DictPos` (`types.ts`);
  - `Database` (`src/server/database.types.ts`, Task 1).
- Produces, dari `scripts/dictionary-files.ts`, untuk Task 6:
  - `type EnvName = "dev" | "prod"`;
  - `stop(message: string): never`;
  - `needFile(path: string, hint: string): void`;
  - `connect(envName: string | undefined, usage: string)`, yang mengembalikan `{ supabase: SupabaseClient<Database>; envName: EnvName }`;
  - `linesOf(file: string): AsyncIterable<string>`;
  - `readWiktionary(file: string)`, yang mengembalikan hasil `createDictionaryBuilder().result()`;
  - `readWordnet(files: { bahasa: string; senses: string }, qualities: ReadonlyArray<WordnetQuality>): Promise<Array<DictEntry>>`;
  - `parseQualities(raw: string | undefined): Array<WordnetQuality>`;
  - `readGenerated(supabase): Promise<Array<GeneratedRow>>`;
  - `readMisses(supabase): Promise<Array<string>>` (maksimal `MAX_MISSES = 5000`, urut `lookups` menurun);
  - `DEFAULT_FILES = { kaikki, wordnet, senses, words }`.

- [ ] **Step 1: Unduh data WordNet Princeton dan teks Sherlock**

`wn-msa-all.tab` dan kaikki sudah ada di `dict/`. Ekstrak arsip ke direktori baru yang kosong, lalu salin hanya `index.sense`:

```bash
mkdir -p dict/wndb
curl -L -o dict/wndb/WNdb-3.0.tar.gz https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz
tar -xzf dict/wndb/WNdb-3.0.tar.gz -C dict/wndb
cp dict/wndb/dict/index.sense dict/index.sense
curl -L -o dict/sherlock.txt https://www.gutenberg.org/cache/epub/1661/pg1661.txt
head -2 dict/index.sense && wc -l dict/index.sense
```

Expected: baris seperti `'hood%1:15:00:: 08641944 1 0`, dan sekitar 206 ribu baris.

Kalau URL Princeton tidak bisa diakses, berhenti dan laporkan ke controller. Jangan mencari sumber lain sendiri.

- [ ] **Step 2: Tulis `scripts/dictionary-files.ts`**

```ts
// What the dictionary scripts share: the source files and the dictionary
// tables. Node runs it as it is, so imports spell out their extensions.
import { createReadStream, existsSync } from "node:fs"
import { createInterface } from "node:readline"
import { createGunzip } from "node:zlib"
import { type SupabaseClient, createClient } from "@supabase/supabase-js"
import type { Database } from "../src/server/database.types.ts"
import { createDictionaryBuilder } from "../src/lib/words/dict-import.ts"
import type { GeneratedRow } from "../src/lib/words/dict-merge.ts"
import { DICT_POS, type DictEntry, type DictPos } from "../src/lib/words/types.ts"
import {
  DEFAULT_WORDNET_QUALITIES,
  WORDNET_QUALITIES,
  type WordnetQuality,
  createWordnetReader,
} from "../src/lib/words/wordnet.ts"

const ENV_FILES = { dev: ".env.local", prod: ".env.prod" } as const
export type EnvName = keyof typeof ENV_FILES
/** PostgREST answers at most this many rows at once. */
const PAGE = 1000
/** Tapped words the AI may be asked about in one run (plan, decision 5). */
const MAX_MISSES = 5000

/** Where docs/ops/deploy.md §6.5 puts the downloads. */
export const DEFAULT_FILES = {
  kaikki: "dict/kaikki.org-dictionary-English.jsonl",
  wordnet: "dict/wn-msa-all.tab",
  senses: "dict/index.sense",
  words: "dict/wordfreq-en-50k.txt",
}

export function stop(message: string): never {
  console.error(message)
  process.exit(1)
}

/** Stops before anything changes when a needed file is missing. */
export function needFile(path: string, hint: string): void {
  if (!existsSync(path)) stop(`Missing ${path}. ${hint}`)
}

/** The service-role client of dev (.env.local) or prod (.env.prod). */
export function connect(
  envName: string | undefined,
  usage: string
): { supabase: SupabaseClient<Database>; envName: EnvName } {
  if (envName !== "dev" && envName !== "prod") stop(usage)
  const envFile = ENV_FILES[envName]
  if (!existsSync(envFile)) stop(`Missing ${envFile}`)
  process.loadEnvFile(envFile)
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) stop(`${envFile} needs SUPABASE_URL and SUPABASE_SECRET_KEY`)
  console.log(`Target: ${new URL(url).host} (${envName})`)
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { supabase, envName }
}

/** A text file's lines, gzipped or not. */
export function linesOf(file: string): AsyncIterable<string> {
  const input = createReadStream(file)
  return createInterface({
    input: file.endsWith(".gz") ? input.pipe(createGunzip()) : input,
    crlfDelay: Infinity,
  })
}

/** The Wiktionary side, from a kaikki.org English extract. */
export async function readWiktionary(file: string) {
  const builder = createDictionaryBuilder()
  let read = 0
  let unreadable = 0
  for await (const line of linesOf(file)) {
    if (!line.trim()) continue
    read += 1
    try {
      builder.add(JSON.parse(line))
    } catch {
      unreadable += 1
    }
    if (read % 200_000 === 0) console.log(`  ${read} records read`)
  }
  const result = builder.result()
  console.log(
    `Wiktionary: ${read} records (${unreadable} unreadable): ${result.entries.length} entries, ${result.forms.length} forms, ${result.phrases} phrasal verbs and phrases.`
  )
  return result
}

/** "YO" or "YOL" from --wordnet-quality; Y and O by default. */
export function parseQualities(raw: string | undefined): Array<WordnetQuality> {
  if (raw === undefined) return [...DEFAULT_WORDNET_QUALITIES]
  const letters = [...new Set(raw.toUpperCase())]
  const valid = (letter: string): letter is WordnetQuality =>
    (WORDNET_QUALITIES as ReadonlyArray<string>).includes(letter)
  if (letters.length === 0 || !letters.every(valid)) {
    stop(`--wordnet-quality takes letters from ${WORDNET_QUALITIES.join("")}, e.g. YO`)
  }
  return letters.filter(valid)
}

/** The WordNet Bahasa side. */
export async function readWordnet(
  files: { bahasa: string; senses: string },
  qualities: ReadonlyArray<WordnetQuality>
): Promise<Array<DictEntry>> {
  const reader = createWordnetReader(qualities)
  for await (const line of linesOf(files.bahasa)) {
    if (!line.startsWith("#")) reader.addBahasa(line)
  }
  for await (const line of linesOf(files.senses)) reader.addSense(line)
  const entries = reader.result()
  console.log(`WordNet Bahasa (${qualities.join("")}): ${entries.length} entries.`)
  return entries
}

const isPos = (pos: string): pos is DictPos =>
  (DICT_POS as ReadonlyArray<string>).includes(pos)

/** Every row of dict_generated, a page at a time. */
export async function readGenerated(
  supabase: SupabaseClient<Database>
): Promise<Array<GeneratedRow>> {
  const rows: Array<GeneratedRow> = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("dict_generated")
      .select("headword, pos, meanings")
      .order("headword")
      .order("pos")
      .range(from, from + PAGE - 1)
    if (error) stop(`Reading dict_generated failed: ${error.message}`)
    for (const row of data) {
      if (isPos(row.pos)) {
        rows.push({ headword: row.headword, pos: row.pos, meanings: row.meanings })
      }
    }
    if (data.length < PAGE) break
  }
  return rows
}

/** The most looked-up words without a meaning, most first. */
export async function readMisses(
  supabase: SupabaseClient<Database>
): Promise<Array<string>> {
  const words: Array<string> = []
  for (let from = 0; from < MAX_MISSES; from += PAGE) {
    const { data, error } = await supabase
      .from("dict_misses")
      .select("word")
      .order("lookups", { ascending: false })
      .order("word")
      .range(from, Math.min(from + PAGE, MAX_MISSES) - 1)
    if (error) stop(`Reading dict_misses failed: ${error.message}`)
    words.push(...data.map((row) => row.word))
    if (data.length < PAGE) break
  }
  return words
}
```

- [ ] **Step 3: Tulis ulang `scripts/import-dictionary.ts`**

```ts
// Imports the dictionary (spec 2 §4.1; spec kamus tiga sumber §4.2) from
// three sources: English Wiktionary (a kaikki.org extract), WordNet Bahasa,
// and the AI meanings kept in dict_generated.
//   node --max-old-space-size=8192 scripts/import-dictionary.ts <kaikki.jsonl[.gz]> --env dev|prod
//     [--wordnet dict/wn-msa-all.tab] [--senses dict/index.sense] [--wordnet-quality YO]
//     [--no-wordnet] [--no-generated] [--coverage book.txt] [--dry-run]
//     [--dump-date YYYY-MM-DD] [--force]
// dev reads .env.local, prod reads .env.prod (both kept out of git). The rows
// go to staging tables first; dict_swap then replaces the dictionary in one
// transaction. --dry-run reads and counts everything and changes nothing.
// Run by hand, never by CI (docs/ops/deploy.md §6.5).
import { readFileSync } from "node:fs"
import { basename } from "node:path"
import { parseArgs } from "node:util"
import { measureCoverage } from "../src/lib/words/coverage.ts"
import { mergeDictionary } from "../src/lib/words/dict-merge.ts"
import type { DictEntry } from "../src/lib/words/types.ts"
import {
  DEFAULT_FILES,
  connect,
  needFile,
  parseQualities,
  readGenerated,
  readWiktionary,
  readWordnet,
  stop,
} from "./dictionary-files.ts"

const BATCH = 1000
const USAGE =
  "Usage: node --max-old-space-size=8192 scripts/import-dictionary.ts <kaikki.jsonl[.gz]> --env dev|prod [--wordnet file] [--senses file] [--wordnet-quality YO] [--no-wordnet] [--no-generated] [--coverage book.txt] [--dry-run] [--dump-date YYYY-MM-DD] [--force]"
const WORDNET_HINT = "See docs/ops/deploy.md §6.5, or import without it: --no-wordnet."

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: "string" },
    wordnet: { type: "string", default: DEFAULT_FILES.wordnet },
    senses: { type: "string", default: DEFAULT_FILES.senses },
    "wordnet-quality": { type: "string" },
    "no-wordnet": { type: "boolean", default: false },
    "no-generated": { type: "boolean", default: false },
    coverage: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "dump-date": { type: "string" },
    force: { type: "boolean", default: false },
  },
})
const [file] = positionals
if (!file) stop(USAGE)
const qualities = parseQualities(values["wordnet-quality"])
needFile(file, "Download it from kaikki.org (docs/ops/deploy.md §6.5).")
if (!values["no-wordnet"]) {
  needFile(values.wordnet, WORDNET_HINT)
  needFile(values.senses, WORDNET_HINT)
}
if (values.coverage) needFile(values.coverage, "Give a plain-text book.")
const { supabase } = connect(values.env, USAGE)

const wiktionary = await readWiktionary(file)
if (wiktionary.entries.length === 0) stop("Nothing to import.")
const wordnet: Array<DictEntry> = values["no-wordnet"]
  ? []
  : await readWordnet(
      { bahasa: values.wordnet, senses: values.senses },
      qualities
    )
const generated = values["no-generated"] ? [] : await readGenerated(supabase)
console.log(
  `AI: ${generated.filter((row) => row.meanings.length > 0).length} rows with meanings, of ${generated.length}.`
)

const { entries, forms, counts } = mergeDictionary({
  wiktionary: wiktionary.entries,
  wordnet,
  generated,
  forms: wiktionary.forms,
})
console.log(
  `Dictionary: ${entries.length} entries (Wiktionary ${counts.wiktionary}, WordNet ${counts.wordnet}, AI ${counts.ai}), ${forms.length} forms.`
)

if (values.coverage) {
  // dict_swap makes every headword its own form too.
  const known = new Set([
    ...entries.map((entry) => entry.headword),
    ...forms.map((form) => form.form),
  ])
  const c = measureCoverage(readFileSync(values.coverage, "utf8"), (word) =>
    known.has(word)
  )
  const percent = (part: number, whole: number) =>
    `${((part / Math.max(whole, 1)) * 100).toFixed(1)}%`
  console.log(
    `Coverage of ${basename(values.coverage)}: ${percent(c.coveredTokens, c.tokens)} of ${c.tokens} words as they occur, ${percent(c.coveredWords, c.words)} of ${c.words} distinct words.`
  )
}
if (values["dry-run"]) {
  console.log("Dry run: the dictionary stays as it is.")
  process.exit(0)
}

async function check(
  step: string,
  request: PromiseLike<{ error: { message: string } | null }>
) {
  const { error } = await request
  if (error) stop(`${step} failed: ${error.message}`)
}

await check("Clearing the staging tables", supabase.rpc("dict_staging_reset"))
async function loadInBatches<T>(
  table: string,
  rows: Array<T>,
  insert: (
    batch: Array<T>
  ) => PromiseLike<{ error: { message: string } | null }>
) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await check(`Loading ${table}`, insert(rows.slice(i, i + BATCH)))
  }
  console.log(`Loaded ${rows.length} rows into ${table}.`)
}

await loadInBatches("dict_entries_staging", entries, (batch) =>
  supabase.from("dict_entries_staging").insert(batch)
)
await loadInBatches("dict_forms_staging", forms, (batch) =>
  supabase.from("dict_forms_staging").insert(batch)
)

const { data, error } = await supabase.rpc("dict_swap", {
  p_source: basename(file),
  p_dump_date: values["dump-date"],
  p_force: values.force,
})
if (error) {
  stop(
    error.message === "shrunk"
      ? "The new dictionary has over 20% fewer entries than the last one. Check the files, or run again with --force."
      : `Swapping the dictionary failed: ${error.message}`
  )
}
console.log("Dictionary swapped in:", data)
```

Kalau tipe `p_dump_date` dari `database.types.ts` tidak menerima `undefined`, sesuaikan seperlunya, misalnya dengan menghilangkan key itu saat kosong. Jangan pakai `as any`.

- [ ] **Step 4: Typecheck dan lint**

Run: `npm run typecheck && npm run lint && npm run check`

Expected: PASS.

- [ ] **Step 5: Uji pengaman file yang tidak ada**

Run: `node scripts/import-dictionary.ts dict/kaikki.org-dictionary-English.jsonl --env dev --senses dict/tidak-ada.sense --dry-run`

Expected: berhenti dengan `Missing dict/tidak-ada.sense. See docs/ops/deploy.md §6.5, or import without it: --no-wordnet.`, sebelum membaca kaikki.

- [ ] **Step 6: Jalankan tiga dry run dan catat angkanya**

Ketiganya hanya membaca. `dict_generated` di dev masih kosong.

```bash
node --max-old-space-size=8192 scripts/import-dictionary.ts dict/kaikki.org-dictionary-English.jsonl --env dev --no-wordnet --coverage dict/sherlock.txt --dry-run
node --max-old-space-size=8192 scripts/import-dictionary.ts dict/kaikki.org-dictionary-English.jsonl --env dev --coverage dict/sherlock.txt --dry-run
node --max-old-space-size=8192 scripts/import-dictionary.ts dict/kaikki.org-dictionary-English.jsonl --env dev --wordnet-quality YOL --coverage dict/sherlock.txt --dry-run
```

Expected:
- Run pertama: sekitar 14.5 ribu entri, semuanya dari Wiktionary.
- Run kedua dan ketiga menambah entri WordNet. Cakupan Sherlock naik dari run ke run.
- Setiap run diakhiri `Dry run: the dictionary stays as it is.`

Salin ketiga baris `Dictionary:` dan `Coverage of` ke laporan task. Controller membawanya ke pemilik di Task 8.

- [ ] **Step 7: Commit**

```bash
git add scripts/dictionary-files.ts scripts/import-dictionary.ts
git commit -m "feat(words): import the dictionary from Wiktionary, WordNet Bahasa and AI meanings"
```

---

### Task 5: Calon kata dan jawaban AI

**Files:**
- Create: `src/lib/words/fill-candidates.ts`, `src/lib/words/fill-answer.ts`
- Test: `src/lib/words/fill-candidates.test.ts`, `src/lib/words/fill-answer.test.ts`

**Interfaces:**
- Consumes: `keyOf`, `GeneratedRow` (Task 3); `normalizeWord`, `isLookupWord`; `DICT_POS`, `DictForm`, `DictPos`, `MAX_MEANINGS`.
- Produces:
  - `type FillRequest = { headword: string; pos: Array<DictPos>; from: Array<string> }`. `pos` kosong berarti AI diminta memilih satu kelas kata.
  - `pickCandidates(sources: CandidateSources): Array<FillRequest>`.
  - `chunk<T>(items: ReadonlyArray<T>, size: number): Array<Array<T>>`.
  - `FILL_MODEL = "claude-opus-5-5"`, `WORDS_PER_REQUEST = 50`, `FILL_MAX_TOKENS = 32_000`.
  - `FILL_SYSTEM: string`, `fillPrompt(requests): string`, `FILL_SCHEMA` (objek JSON Schema).
  - `readAnswer(requests, text)`, yang mengembalikan `{ rows: Array<GeneratedRow>; answered: Array<string>; problems: Array<string> }`.
  - `batchCost(usage: { input: number; output: number }): number` (dalam dolar).

- [ ] **Step 1: Tulis test calon kata yang gagal**

`src/lib/words/fill-candidates.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { DictPos } from "./types"
import { chunk, pickCandidates } from "./fill-candidates"

const partsOfSpeech = new Map<string, Set<DictPos>>([
  ["make", new Set<DictPos>(["verb", "noun"])],
  ["like", new Set<DictPos>(["verb", "prep", "noun"])],
  ["run", new Set<DictPos>(["verb"])],
  ["kick the bucket", new Set<DictPos>(["phrase"])],
])
const forms = [
  { form: "made", headword: "make", pos: "verb" as const },
  { form: "makes", headword: "make", pos: "verb" as const },
]

describe("pickCandidates", () => {
  it("asks each headword's parts of speech that no source fills, in the words' order", () => {
    const requests = pickCandidates({
      words: ["like", "made", "make", "run"],
      partsOfSpeech,
      forms,
      filled: new Set(["like\tverb", "run\tverb"]),
      generated: new Set(["make\tnoun"]),
    })
    expect(requests).toEqual([
      { headword: "like", pos: ["prep", "noun"], from: ["like"] },
      { headword: "make", pos: ["verb"], from: ["made", "make"] },
    ])
  })

  it("asks a word Wiktionary does not know as it is, for the AI to pick its part of speech", () => {
    const requests = pickCandidates({
      words: ["Gonna", "gonna", "blorp"],
      partsOfSpeech,
      forms,
      filled: new Set(["blorp\tnoun"]),
      generated: new Set(),
    })
    expect(requests).toEqual([{ headword: "gonna", pos: [], from: ["gonna"] }])
  })

  it("skips what the reader would not look up, and phrases", () => {
    expect(
      pickCandidates({
        words: ["42", "", "e-mail-", "kick the bucket", "naïve’s"],
        partsOfSpeech,
        forms,
        filled: new Set(),
        generated: new Set(),
      })
    ).toEqual([
      { headword: "e-mail", pos: [], from: ["e-mail"] },
      { headword: "naïve", pos: [], from: ["naïve"] },
    ])
  })

  it("never asks a word already asked, even with no meaning", () => {
    expect(
      pickCandidates({
        words: ["gonna"],
        partsOfSpeech,
        forms,
        filled: new Set(),
        generated: new Set(["gonna\tverb"]),
      })
    ).toEqual([])
  })
})

describe("chunk", () => {
  it("cuts a list into pieces of a size, the last one shorter", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})
```

- [ ] **Step 2: Tulis test jawaban yang gagal**

`src/lib/words/fill-answer.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { FILL_SCHEMA, batchCost, fillPrompt, readAnswer } from "./fill-answer"
import type { FillRequest } from "./fill-candidates"

const requests: Array<FillRequest> = [
  { headword: "make", pos: ["verb", "noun"], from: ["made"] },
  { headword: "gonna", pos: [], from: ["gonna"] },
]
const answer = (words: unknown) => JSON.stringify({ words })

describe("fillPrompt", () => {
  it("lists one word per line with the parts of speech asked", () => {
    expect(fillPrompt(requests)).toBe(
      'Words:\n{"word":"make","pos":["verb","noun"]}\n{"word":"gonna","pos":[]}'
    )
  })
})

describe("FILL_SCHEMA", () => {
  it("offers every part of speech but phrase", () => {
    const pos =
      FILL_SCHEMA.properties.words.items.properties.entries.items.properties.pos
    expect(pos.enum).not.toContain("phrase")
    expect(pos.enum).toContain("particle")
  })
})

describe("readAnswer", () => {
  it("gives a row per part of speech asked, and the one the AI picked", () => {
    const result = readAnswer(
      requests,
      answer([
        {
          word: "make",
          entries: [
            { pos: "verb", meanings: ["membuat", " menjadikan ", "membuat"] },
            { pos: "noun", meanings: [] },
          ],
        },
        { word: "Gonna", entries: [{ pos: "verb", meanings: ["akan"] }] },
      ])
    )
    expect(result).toEqual({
      rows: [
        { headword: "make", pos: "verb", meanings: ["membuat", "menjadikan"] },
        { headword: "make", pos: "noun", meanings: [] },
        { headword: "gonna", pos: "verb", meanings: ["akan"] },
      ],
      answered: ["make", "gonna"],
      problems: [],
    })
  })

  it("keeps the first eight meanings", () => {
    const many = Array.from({ length: 10 }, (_, i) => `arti${i}`)
    const result = readAnswer(
      [requests[1]],
      answer([{ word: "gonna", entries: [{ pos: "verb", meanings: many }] }])
    )
    expect(result.rows[0].meanings).toEqual(many.slice(0, 8))
  })

  it("leaves out a word without an answer, with other parts of speech, or with a bad meaning", () => {
    const result = readAnswer(
      [
        ...requests,
        { headword: "run", pos: ["verb"], from: ["run"] },
        { headword: "like", pos: ["prep"], from: ["like"] },
      ],
      answer([
        { word: "make", entries: [{ pos: "verb", meanings: ["membuat"] }] },
        {
          word: "gonna",
          entries: [
            { pos: "verb", meanings: ["akan"] },
            { pos: "noun", meanings: [] },
          ],
        },
        { word: "run", entries: [{ pos: "verb", meanings: ["x".repeat(101)] }] },
        { word: "like", entries: [{ pos: "prep", meanings: ["seperti\u0007"] }] },
      ])
    )
    expect(result.rows).toEqual([])
    expect(result.answered).toEqual([])
    expect(result.problems).toHaveLength(4)
  })

  it("names every word when the answer cannot be read", () => {
    const result = readAnswer(requests, "{not json")
    expect(result.rows).toEqual([])
    expect(result.problems).toEqual([
      "unreadable answer for make, gonna",
    ])
  })
})

describe("batchCost", () => {
  it("prices tokens at half the Opus 5.5 rate", () => {
    expect(batchCost({ input: 1_000_000, output: 1_000_000 })).toBeCloseTo(12)
  })
})
```

- [ ] **Step 3: Jalankan dan pastikan gagal**

Run: `npx vitest run src/lib/words/fill-candidates.test.ts src/lib/words/fill-answer.test.ts`

Expected: FAIL, karena modulnya belum ada.

- [ ] **Step 4: Tulis `fill-candidates.ts`**

```ts
// Extensions spelled out: Node runs this file for scripts/fill-dictionary.ts.
import { keyOf } from "./dict-merge.ts"
import { isLookupWord, normalizeWord } from "./normalize.ts"
import type { DictForm, DictPos } from "./types.ts"

/** One headword for the AI (spec kamus tiga sumber §4.3). */
export type FillRequest = {
  headword: string
  /** The parts of speech to fill; none: the AI gives the word's likeliest one. */
  pos: Array<DictPos>
  /** The listed or tapped words that led here ("made" leads to make). */
  from: Array<string>
}

export type CandidateSources = {
  /** The frequency list in order, then the tapped words without meanings. */
  words: Iterable<string>
  /** Wiktionary's parts of speech per headword, with meanings or without (decision 6). */
  partsOfSpeech: ReadonlyMap<string, ReadonlySet<DictPos>>
  /** Wiktionary's forms, of every headword. */
  forms: ReadonlyArray<DictForm>
  /** keyOf pairs that Wiktionary or WordNet fill. */
  filled: ReadonlySet<string>
  /** keyOf pairs already in dict_generated, those without meanings too. */
  generated: ReadonlySet<string>
}

/**
 * What the AI is asked: for each word, its headwords (the word itself and the
 * single words it is a form of) with the parts of speech Wiktionary gives
 * them that no source fills yet and that were never asked. A word Wiktionary
 * does not know, and no source fills, is asked as it is. Phrases never: they
 * come from Wiktionary only. In the order of the words, each headword once.
 */
export function pickCandidates(sources: CandidateSources): Array<FillRequest> {
  const basesOf = new Map<string, Array<string>>()
  for (const { form, headword } of sources.forms) {
    if (headword.includes(" ")) continue
    const list = basesOf.get(form) ?? []
    if (!list.includes(headword)) list.push(headword)
    basesOf.set(form, list)
  }
  const done = (headword: string, pos: DictPos) =>
    sources.filled.has(keyOf(headword, pos)) ||
    sources.generated.has(keyOf(headword, pos))
  const touched = new Set(
    [...sources.filled, ...sources.generated].map((key) => key.split("\t")[0])
  )
  const requests = new Map<string, FillRequest>()
  const ask = (headword: string, pos: Array<DictPos>, word: string) => {
    const request = requests.get(headword) ?? { headword, pos: [], from: [] }
    for (const each of pos) if (!request.pos.includes(each)) request.pos.push(each)
    if (!request.from.includes(word)) request.from.push(word)
    requests.set(headword, request)
  }

  for (const raw of sources.words) {
    const word = normalizeWord(raw)
    if (!isLookupWord(word)) continue
    const headwords = [word, ...(basesOf.get(word) ?? [])].filter(
      (headword, i, all) =>
        all.indexOf(headword) === i && sources.partsOfSpeech.has(headword)
    )
    if (headwords.length === 0) {
      if (!touched.has(word)) ask(word, [], word)
      continue
    }
    for (const headword of headwords) {
      const missing = [...(sources.partsOfSpeech.get(headword) ?? [])].filter(
        (pos) => pos !== "phrase" && !done(headword, pos)
      )
      if (missing.length > 0) ask(headword, missing, word)
    }
  }
  return [...requests.values()]
}

export function chunk<T>(items: ReadonlyArray<T>, size: number): Array<Array<T>> {
  const pieces: Array<Array<T>> = []
  for (let i = 0; i < items.length; i += size) pieces.push(items.slice(i, i + size))
  return pieces
}
```

Catatan untuk test kedua: `"blorp"` tidak dikenal Wiktionary, tetapi sudah diisi WordNet (`touched`), jadi tidak ditanyakan. `"Gonna"` dan `"gonna"` dinormalisasi menjadi satu.

- [ ] **Step 5: Tulis `fill-answer.ts`**

```ts
// Extensions spelled out: Node runs this file for scripts/fill-dictionary.ts.
import { z } from "zod"
import type { GeneratedRow } from "./dict-merge.ts"
import type { FillRequest } from "./fill-candidates.ts"
import { normalizeWord } from "./normalize.ts"
import { DICT_POS, MAX_MEANINGS } from "./types.ts"

/** Spec kamus tiga sumber, decision 5. */
export const FILL_MODEL = "claude-opus-5-5"
export const WORDS_PER_REQUEST = 50
/** Thinking counts too; a batch request has no timeout to fear. */
export const FILL_MAX_TOKENS = 32_000
const MAX_MEANING_LENGTH = 100
/** Phrases come from Wiktionary only. */
const ASKED_POS = DICT_POS.filter((pos) => pos !== "phrase")

export const FILL_SYSTEM = `You write entries for an English-Indonesian dictionary inside an e-book reader for Indonesian readers learning English. A reader taps an English word and sees its Indonesian equivalents.

For each requested word and each requested part of speech, give the Indonesian equivalents that a reader would understand the word by, the most common sense first:
- Each equivalent is an Indonesian word or a short phrase in standard spelling (KBBI): lower case unless always capitalised, with no explanation, example, brackets or English.
- At most 8 per part of speech, without repeats. A word with few senses gets few equivalents.
- Function words (pronouns, prepositions, conjunctions, determiners, articles, particles) get the Indonesian words that usually translate them, e.g. "it" (pron): "itu", "ia", "dia".
- If no Indonesian equivalent fits a part of speech, give an empty list for it.
- If a word's pos list is empty, choose the one part of speech it is most often used as, from: ${ASKED_POS.join(", ")}. Answer with that one only.

Answer every requested word, in the order given, with exactly the parts of speech requested.`

/** The user message: one JSON object per line. */
export function fillPrompt(requests: ReadonlyArray<FillRequest>): string {
  const lines = requests.map((request) =>
    JSON.stringify({ word: request.headword, pos: request.pos })
  )
  return ["Words:", ...lines].join("\n")
}

/** output_config.format's schema: what the API holds the answer to. */
export const FILL_SCHEMA = {
  type: "object",
  properties: {
    words: {
      type: "array",
      items: {
        type: "object",
        properties: {
          word: { type: "string" },
          entries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                pos: { type: "string", enum: ASKED_POS },
                meanings: { type: "array", items: { type: "string" } },
              },
              required: ["pos", "meanings"],
              additionalProperties: false,
            },
          },
        },
        required: ["word", "entries"],
        additionalProperties: false,
      },
    },
  },
  required: ["words"],
  additionalProperties: false,
}

const AnswerSchema = z.object({
  words: z.array(
    z.object({
      word: z.string(),
      entries: z.array(
        z.object({ pos: z.enum(DICT_POS), meanings: z.array(z.string()) })
      ),
    })
  ),
})

/** Trimmed and without repeats, the first eight; null if one is empty, too long or holds control characters. */
function cleanMeanings(raw: Array<string>): Array<string> | null {
  const meanings: Array<string> = []
  for (const meaning of raw) {
    const clean = meaning.replace(/\s+/gu, " ").trim()
    if (clean.length === 0 || clean.length > MAX_MEANING_LENGTH) return null
    if (/\p{Cc}/u.test(meaning.replace(/\s/gu, ""))) return null
    if (!meanings.includes(clean)) meanings.push(clean)
  }
  return meanings.slice(0, MAX_MEANINGS)
}

/**
 * The dict_generated rows an answer gives (spec kamus tiga sumber §4.3, step
 * 4): a row for each part of speech asked, or for the one the AI picked. A
 * word without an answer, with other parts of speech, or with a bad meaning
 * gives no rows and is named in problems; the next run asks it again.
 */
export function readAnswer(
  requests: ReadonlyArray<FillRequest>,
  text: string
): { rows: Array<GeneratedRow>; answered: Array<string>; problems: Array<string> } {
  let parsed: z.infer<typeof AnswerSchema> | null = null
  try {
    const result = AnswerSchema.safeParse(JSON.parse(text))
    if (result.success) parsed = result.data
  } catch {
    parsed = null
  }
  if (!parsed) {
    const words = requests.map((request) => request.headword).join(", ")
    return { rows: [], answered: [], problems: [`unreadable answer for ${words}`] }
  }

  const byWord = new Map(
    parsed.words.map((word) => [normalizeWord(word.word), word.entries])
  )
  const rows: Array<GeneratedRow> = []
  const answered: Array<string> = []
  const problems: Array<string> = []
  for (const request of requests) {
    const entries = byWord.get(request.headword)
    if (!entries) {
      problems.push(`${request.headword}: no answer`)
      continue
    }
    const given = entries.map((entry) => entry.pos)
    const fits =
      request.pos.length > 0
        ? given.length === request.pos.length &&
          request.pos.every((pos) => given.includes(pos))
        : given.length === 1 && given[0] !== "phrase"
    if (!fits) {
      const asked = request.pos.length > 0 ? request.pos.join("/") : "one"
      problems.push(
        `${request.headword}: answered ${given.join("/") || "nothing"}, asked ${asked}`
      )
      continue
    }
    const cleaned = entries.map((entry) => ({
      pos: entry.pos,
      meanings: cleanMeanings(entry.meanings),
    }))
    if (cleaned.some((entry) => entry.meanings === null)) {
      problems.push(
        `${request.headword}: a meaning is empty, too long or holds control characters`
      )
      continue
    }
    for (const entry of cleaned) {
      rows.push({
        headword: request.headword,
        pos: entry.pos,
        meanings: entry.meanings ?? [],
      })
    }
    answered.push(request.headword)
  }
  return { rows, answered, problems }
}

/** Opus 5.5 through the Batch API: half of $4 and $20 per million tokens. */
export function batchCost(usage: { input: number; output: number }): number {
  return (usage.input * 2 + usage.output * 10) / 1_000_000
}
```

Pemeriksaan karakter kendali memakai `meaning.replace(/\s/gu, "")`, karena spasi, tab, dan newline sudah dirapikan dan tidak dianggap karakter kendali. Karakter lain seperti `\u0007` tetap ditolak.

- [ ] **Step 6: Jalankan test dan pastikan lolos**

Run: `npx vitest run src/lib/words`

Expected: PASS semuanya.

- [ ] **Step 7: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npm run check`

Expected: PASS.

```bash
git add src/lib/words/fill-candidates.ts src/lib/words/fill-candidates.test.ts src/lib/words/fill-answer.ts src/lib/words/fill-answer.test.ts
git commit -m "feat(words): pick the words the AI fills and check its answers"
```

---

### Task 6: Skrip pengisi AI

**Files:**
- Create: `scripts/fill-dictionary.ts`
- Modify: `package.json`, `package-lock.json` (`@anthropic-ai/sdk` sebagai devDependency)

**Interfaces:**
- Consumes:
  - semua ekspor `scripts/dictionary-files.ts` (Task 4);
  - `pickCandidates`, `chunk`, `FillRequest` (Task 5);
  - `FILL_MODEL`, `FILL_SYSTEM`, `FILL_SCHEMA`, `FILL_MAX_TOKENS`, `WORDS_PER_REQUEST`, `fillPrompt`, `readAnswer`, `batchCost` (Task 5);
  - `keyOf` (Task 3).
- Produces: perintah `node --max-old-space-size=8192 scripts/fill-dictionary.ts --env dev|prod [--dry-run] [--trial N] [--commit] [--discard] [--effort low|medium|high] [--limit N] [--kaikki file] [--wordnet file] [--senses file] [--words file] [--wordnet-quality YO]`, dan file status `dict/fill-state.json`.

- [ ] **Step 1: Pasang SDK**

Run: `npm install --save-dev @anthropic-ai/sdk`

Expected: `@anthropic-ai/sdk` masuk ke `devDependencies` di `package.json`, dengan versi yang dipilih npm.

Lalu buka `node_modules/@anthropic-ai/sdk/package.json`. Pastikan versinya punya `messages.batches` dan tipe `output_config`: cari `output_config` di `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts`. Kalau tidak ada, laporkan ke controller.

- [ ] **Step 2: Unduh daftar frekuensi**

```bash
python -m pip install --user wordfreq
python -I -c "from wordfreq import top_n_list; open('dict/wordfreq-en-50k.txt','w',encoding='utf-8',newline='\n').write('\n'.join(top_n_list('en', 50000))+'\n')"
head -5 dict/wordfreq-en-50k.txt && wc -l dict/wordfreq-en-50k.txt
```

Expected: baris pertama `the`, total 50.000 baris.

- [ ] **Step 3: Tulis `scripts/fill-dictionary.ts`**

```ts
// Fills the dictionary's gaps with meanings made by AI (spec kamus tiga
// sumber §4.3), through the Message Batches API:
//   node --max-old-space-size=8192 scripts/fill-dictionary.ts --env dev|prod
//     [--dry-run] [--trial N] [--commit] [--discard] [--effort low|medium|high]
//     [--limit N] [--kaikki file] [--wordnet file] [--senses file] [--words file]
//     [--wordnet-quality YO]
//   --dry-run  picks the words and prints them, without the API.
//   --trial N  asks the first N words as one small batch, then prints the
//              real cost, an estimate for all words and 20 samples.
//   --commit   writes the valid answers into dict_generated. A full batch
//              needs it.
//   --discard  forgets (and cancels) the batch waiting in dict/fill-state.json.
// The batch id waits in dict/fill-state.json, so a run cut short picks the
// same batch up again without paying twice. Run by hand from the owner's
// laptop, never by CI or the server; the key comes from ANTHROPIC_API_KEY or
// an `ant auth login` profile. Then run scripts/import-dictionary.ts to
// publish the answers.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { parseArgs } from "node:util"
import Anthropic from "@anthropic-ai/sdk"
import { type GeneratedRow, keyOf } from "../src/lib/words/dict-merge.ts"
import {
  FILL_MAX_TOKENS,
  FILL_MODEL,
  FILL_SCHEMA,
  FILL_SYSTEM,
  WORDS_PER_REQUEST,
  batchCost,
  fillPrompt,
  readAnswer,
} from "../src/lib/words/fill-answer.ts"
import {
  type FillRequest,
  chunk,
  pickCandidates,
} from "../src/lib/words/fill-candidates.ts"
import {
  DEFAULT_FILES,
  type EnvName,
  connect,
  needFile,
  parseQualities,
  readGenerated,
  readMisses,
  readWiktionary,
  readWordnet,
  stop,
} from "./dictionary-files.ts"

const STATE_FILE = "dict/fill-state.json"
const PROBLEMS_FILE = "dict/fill-problems.log"
const UPSERT_BATCH = 500
const POLL_MS = 30_000
const EFFORTS = ["low", "medium", "high"] as const
type Effort = (typeof EFFORTS)[number]
const USAGE =
  "Usage: node --max-old-space-size=8192 scripts/fill-dictionary.ts --env dev|prod [--dry-run] [--trial N] [--commit] [--discard] [--effort low|medium|high] [--limit N]"

type FillState = {
  env: EnvName
  batchId: string
  trial: boolean
  effort: Effort
  /** Every word there was to ask when the batch was made, for the estimate. */
  candidates: number
  requests: Record<string, Array<FillRequest>>
}

const { values } = parseArgs({
  options: {
    env: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    trial: { type: "string" },
    commit: { type: "boolean", default: false },
    discard: { type: "boolean", default: false },
    effort: { type: "string", default: "medium" },
    limit: { type: "string" },
    kaikki: { type: "string", default: DEFAULT_FILES.kaikki },
    wordnet: { type: "string", default: DEFAULT_FILES.wordnet },
    senses: { type: "string", default: DEFAULT_FILES.senses },
    words: { type: "string", default: DEFAULT_FILES.words },
    "wordnet-quality": { type: "string" },
  },
})

function count(raw: string | undefined, flag: string): number | undefined {
  if (raw === undefined) return undefined
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) stop(`${flag} takes a whole number above 0`)
  return n
}
const trial = count(values.trial, "--trial")
const limit = count(values.limit, "--limit")
const effort = values.effort as Effort
if (!EFFORTS.includes(effort)) stop(`--effort takes ${EFFORTS.join(", ")}`)
const qualities = parseQualities(values["wordnet-quality"])
const { supabase, envName } = connect(values.env, USAGE)

function readState(): FillState | null {
  if (!existsSync(STATE_FILE)) return null
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as FillState
}

/** The words to ask, from the source files and the database. */
async function candidates(): Promise<Array<FillRequest>> {
  const hint = "See docs/ops/deploy.md §6.5."
  for (const file of [values.kaikki, values.wordnet, values.senses, values.words]) {
    needFile(file, hint)
  }
  const wiktionary = await readWiktionary(values.kaikki)
  const wordnet = await readWordnet(
    { bahasa: values.wordnet, senses: values.senses },
    qualities
  )
  const generated = await readGenerated(supabase)
  const misses = await readMisses(supabase)
  const listed = readFileSync(values.words, "utf8").split(/\r?\n/u)
  const requests = pickCandidates({
    words: [...listed, ...misses],
    partsOfSpeech: wiktionary.partsOfSpeech,
    forms: wiktionary.forms,
    filled: new Set(
      [...wiktionary.entries, ...wordnet].map((e) => keyOf(e.headword, e.pos))
    ),
    generated: new Set(generated.map((row) => keyOf(row.headword, row.pos))),
  })
  console.log(
    `${requests.length} headwords to ask (${listed.length} listed words, ${misses.length} tapped words without meanings).`
  )
  // Tapped words that lead to nothing left to ask are answered (or not words at all).
  if (values.commit) {
    const asked = new Set(requests.flatMap((request) => request.from))
    const answered = misses.filter((word) => !asked.has(word))
    for (const words of chunk(answered, 200)) {
      const { error } = await supabase.from("dict_misses").delete().in("word", words)
      if (error) stop(`Tidying dict_misses failed: ${error.message}`)
    }
    if (answered.length > 0) console.log(`Removed ${answered.length} answered misses.`)
  }
  return requests
}

const describe = (request: FillRequest) =>
  `${request.headword} (${request.pos.length > 0 ? request.pos.join("/") : "pick one"})`

async function main() {
  let state = readState()
  if (values.discard) {
    if (!state) return console.log("No batch is waiting.")
    const client = new Anthropic()
    const batch = await client.messages.batches.retrieve(state.batchId)
    if (batch.processing_status !== "ended") {
      await client.messages.batches.cancel(state.batchId)
    }
    rmSync(STATE_FILE)
    return console.log(`Forgot batch ${state.batchId}.`)
  }
  if (values["dry-run"]) {
    const requests = await candidates()
    for (const request of requests.slice(0, 40)) console.log(`  ${describe(request)}`)
    if (state) console.log(`Batch ${state.batchId} waits in ${STATE_FILE}.`)
    return
  }
  if (state && state.env !== envName) {
    stop(
      `${STATE_FILE} holds a batch for ${state.env}. Finish it with --env ${state.env}, or drop it with --discard.`
    )
  }

  const client = new Anthropic()
  if (state) {
    console.log(`Picking up batch ${state.batchId} (${state.trial ? "trial" : "full"}).`)
  } else {
    const requests = await candidates()
    const chosen = requests.slice(0, trial ?? limit ?? requests.length)
    if (chosen.length === 0) return console.log("Nothing to ask.")
    if (trial === undefined && !values.commit) {
      stop("A full batch needs --commit. Run a --trial first and check its cost.")
    }
    const groups: FillState["requests"] = {}
    chunk(chosen, WORDS_PER_REQUEST).forEach((group, i) => {
      groups[`fill-${String(i).padStart(5, "0")}`] = group
    })
    const batch = await client.messages.batches.create({
      requests: Object.entries(groups).map(([custom_id, group]) => ({
        custom_id,
        params: {
          model: FILL_MODEL,
          max_tokens: FILL_MAX_TOKENS,
          output_config: {
            effort,
            format: { type: "json_schema", schema: FILL_SCHEMA },
          },
          system: FILL_SYSTEM,
          messages: [{ role: "user", content: fillPrompt(group) }],
        },
      })),
    })
    state = {
      env: envName,
      batchId: batch.id,
      trial: trial !== undefined,
      effort,
      candidates: requests.length,
      requests: groups,
    }
    writeFileSync(STATE_FILE, `${JSON.stringify(state)}\n`)
    console.log(
      `Sent batch ${batch.id}: ${chosen.length} headwords in ${Object.keys(groups).length} requests, effort ${effort}.`
    )
  }

  for (;;) {
    const batch = await client.messages.batches.retrieve(state.batchId)
    if (batch.processing_status === "ended") break
    const c = batch.request_counts
    console.log(`  ${c.processing} requests waiting, ${c.succeeded} done, ${c.errored} errored`)
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }

  const rows: Array<GeneratedRow> = []
  const problems: Array<string> = []
  let answered = 0
  let input = 0
  let output = 0
  for await (const result of await client.messages.batches.results(state.batchId)) {
    const group = state.requests[result.custom_id] as Array<FillRequest> | undefined
    if (!group) continue
    if (result.result.type !== "succeeded") {
      problems.push(`${result.custom_id}: ${result.result.type}`)
      continue
    }
    const message = result.result.message
    input += message.usage.input_tokens
    output += message.usage.output_tokens
    if (message.stop_reason !== "end_turn") {
      problems.push(`${result.custom_id}: stopped (${message.stop_reason})`)
      continue
    }
    const text = message.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
    const answer = readAnswer(group, text)
    rows.push(...answer.rows)
    problems.push(...answer.problems)
    answered += answer.answered.length
  }

  const asked = Object.values(state.requests).reduce((n, group) => n + group.length, 0)
  const cost = batchCost({ input, output })
  console.log(
    `${answered} of ${asked} headwords answered (${rows.length} rows); ${problems.length} problems.`
  )
  console.log(`Cost: $${cost.toFixed(2)} (${input} input, ${output} output tokens).`)
  if (state.trial) {
    console.log(
      `Estimate for all ${state.candidates} headwords at effort ${state.effort}: $${((cost / Math.max(asked, 1)) * state.candidates).toFixed(2)}.`
    )
  }
  for (const row of rows.slice(0, 20)) {
    console.log(`  ${row.headword} (${row.pos}): ${row.meanings.join(", ") || "-"}`)
  }
  if (problems.length > 0) {
    writeFileSync(PROBLEMS_FILE, `${problems.join("\n")}\n`)
    console.log(`Problems are in ${PROBLEMS_FILE}; those words are asked again next run.`)
  }

  if (!values.commit) {
    return console.log(
      "Nothing written. Run again with --commit to write these answers, or --discard to drop them."
    )
  }
  for (const batch of chunk(rows, UPSERT_BATCH)) {
    const { error } = await supabase
      .from("dict_generated")
      .upsert(
        batch.map((row) => ({ ...row, model: FILL_MODEL })),
        { onConflict: "headword,pos" }
      )
    if (error) stop(`Writing dict_generated failed: ${error.message}. ${STATE_FILE} stays; run again with --commit.`)
  }
  rmSync(STATE_FILE)
  console.log(
    `Wrote ${rows.length} rows into dict_generated. Publish them: node --max-old-space-size=8192 scripts/import-dictionary.ts dict/kaikki.org-dictionary-English.jsonl --env ${envName}`
  )
}

await main()
```

Kalau ada nama tipe SDK yang tidak cocok, misalnya `output_config.effort` atau `stop_reason`, ikuti pesan `tsc` dan tipe di `node_modules/@anthropic-ai/sdk`. Jangan memakai `as any`. Kalau jalan keluar lain tidak ada, cast satu objek params dengan `satisfies` atau tipe SDK yang benar, lalu laporkan ke controller.

- [ ] **Step 4: Typecheck, lint, dan format**

Run: `npm run typecheck && npm run lint && npm run check`

Expected: PASS.

- [ ] **Step 5: Uji tanpa API**

Run: `node --max-old-space-size=8192 scripts/fill-dictionary.ts --env dev --dry-run`

Expected:
- mencetak jumlah headword yang akan ditanyakan, puluhan ribu;
- mencetak 40 contoh calon, seperti `it (pron)` atau `make (verb/noun)`;
- tidak ada permintaan ke Anthropic, dan `dict/fill-state.json` tidak dibuat.

Run: `node scripts/fill-dictionary.ts --env dev --effort ultra`

Expected: berhenti dengan `--effort takes low, medium, high`.

Jangan menjalankan `--trial` atau `--commit`. Keduanya berbayar dan dijalankan pemilik di Task 8.

- [ ] **Step 6: Commit**

```bash
git add scripts/fill-dictionary.ts package.json package-lock.json
git commit -m "feat(words): fill the dictionary's gaps with AI meanings through the Batch API"
```

---

### Task 7: Kredit per sumber di popup, dan E2E

**Files:**
- Modify: `src/components/reader/WordPopup.tsx`, `src/styles.css` (`.word-credit`)
- Modify: `src/components/reader/WordPopup.test.tsx`
- Modify: `e2e/comfort.spec.ts` (`pointOf` dipindah), `e2e/helpers/reading.ts`, `e2e/vocabulary.spec.ts`
- Create: `e2e/helpers/dictionary.ts`, `e2e/dictionary-sources.spec.ts`

**Interfaces:**
- Consumes: `LookupEntry.source?`, `DictSource` (Task 1); kolom `dict_entries.source` di dev (Task 1).
- Produces:
  - `pointOf(page: Page, id: string): Promise<{ x: number; y: number }>`, diekspor dari `e2e/helpers/reading.ts`;
  - `testWord()`, `seedWord(entry)`, `removeWord(headword)`, diekspor dari `e2e/helpers/dictionary.ts`.

- [ ] **Step 1: Tulis test unit yang gagal**

Di `src/components/reader/WordPopup.test.tsx`, tambahkan di dalam `describe("WordPopup", ...)`:

```ts
  const credit = (dialog: HTMLElement) =>
    within(dialog).getByText((_, element) =>
      element?.classList.contains("word-credit") ?? false
    )

  it("credits each source shown, in a fixed order on one line", async () => {
    show({
      kind: "result",
      result: {
        word: "running",
        entries: [
          { headword: "run", pos: "verb", meanings: ["berlari"], source: "ai" },
          { headword: "run", pos: "noun", meanings: ["lari"], source: "wordnet" },
          {
            headword: "running",
            pos: "adj",
            meanings: ["berjalan"],
            source: "wiktionary",
          },
        ],
        phrases: [],
        version: null,
      },
    })
    const dialog = await popup()
    expect(credit(dialog)).toHaveTextContent(
      "Wiktionary · CC BY-SA · WordNet Bahasa · Dibuat AI"
    )
    expect(
      within(dialog).getByRole("link", { name: "WordNet Bahasa" })
    ).toHaveAttribute("href", "https://wn-msa.sourceforge.net/")
  })

  it("says Dibuat AI as text, without a Wiktionary link, when only the AI gave meanings", async () => {
    show({
      kind: "result",
      result: {
        word: "running",
        entries: [
          { headword: "run", pos: "verb", meanings: ["berlari"], source: "ai" },
        ],
        phrases: [],
        version: null,
      },
    })
    const dialog = await popup()
    expect(credit(dialog)).toHaveTextContent(/^Dibuat AI$/)
    expect(within(dialog).queryByRole("link")).toBeNull()
  })

  it("credits Wiktionary for a phrasal verb", async () => {
    show({
      kind: "result",
      result: {
        word: "running",
        entries: [],
        phrases: [{ headword: "run up", meanings: ["menaikkan"] }],
        version: null,
      },
    })
    const dialog = await popup()
    expect(
      within(dialog).getByRole("link", { name: "Wiktionary · CC BY-SA" })
    ).toHaveAttribute("href", "https://en.wiktionary.org/wiki/running")
  })

  it("shows no credit without meanings", async () => {
    show({
      kind: "result",
      result: { word: "running", entries: [], phrases: [], version: null },
    })
    const dialog = await popup()
    expect(within(dialog).queryByText("Dibuat AI")).toBeNull()
    expect(within(dialog).queryByRole("link")).toBeNull()
  })
```

Test pertama yang sudah ada (entri tanpa `source`) tetap mengharapkan tautan "Wiktionary · CC BY-SA" ke `.../wiki/run`.

Kalau ada test lain di file ini yang mengharapkan tautan Wiktionary saat memuat, offline, atau gagal, ubah menjadi `queryByRole("link")` bernilai `null` (keputusan 7). Sebutkan perubahannya di laporan.

- [ ] **Step 2: Jalankan dan pastikan gagal**

Run: `npx vitest run src/components/reader/WordPopup.test.tsx`

Expected: FAIL di test baru. Kredit masih satu tautan Wiktionary yang selalu tampil.

- [ ] **Step 3: Tulis kreditnya**

Di `src/components/reader/WordPopup.tsx`:

1. Ubah import tipe menjadi `import type { DictSource, LookupResult } from "@/lib/words/types"`, dan tambahkan `import { Fragment } from "react"`.
2. Setelah `const WIKTIONARY = ...`, tambahkan:

```tsx
const WORDNET_BAHASA = "https://wn-msa.sourceforge.net/"
const SOURCE_ORDER: ReadonlyArray<DictSource> = ["wiktionary", "wordnet", "ai"]

/**
 * Where the shown meanings came from (spec kamus tiga sumber §5), on one
 * line in a fixed order. Entries cached before the source column came are
 * Wiktionary's, and so are phrasal verbs and phrases.
 */
function Credit({ result, page }: { result: LookupResult; page: string }) {
  const used = new Set<DictSource>(
    result.entries.map((entry) => entry.source ?? "wiktionary")
  )
  if (result.phrases.length > 0) used.add("wiktionary")
  const sources = SOURCE_ORDER.filter((source) => used.has(source))
  if (sources.length === 0) return null
  return (
    <p className="word-credit">
      {sources.map((source, i) => (
        <Fragment key={source}>
          {i > 0 && " · "}
          {source === "wiktionary" && (
            <a
              href={`${WIKTIONARY}${encodeURIComponent(page)}`}
              target="_blank"
              rel="noreferrer"
            >
              Wiktionary · CC BY-SA
            </a>
          )}
          {source === "wordnet" && (
            <a href={WORDNET_BAHASA} target="_blank" rel="noreferrer">
              WordNet Bahasa
            </a>
          )}
          {source === "ai" && "Dibuat AI"}
        </Fragment>
      ))}
    </p>
  )
}
```

3. Di `WordCard`, ganti elemen `<a className="word-credit" ...>Wiktionary · CC BY-SA</a>` dengan:

```tsx
        {result && <Credit result={result} page={base ?? tap.word} />}
```

Di `src/styles.css`, ganti blok `.word-credit` dengan:

```css
  .word-credit {
    font-size: 0.7rem;
    color: var(--muted-foreground);
  }
  .word-credit a {
    text-decoration: underline;
  }
```

- [ ] **Step 4: Jalankan test unit dan pastikan lolos**

Run: `npx vitest run src/components/reader`

Expected: PASS semuanya.

- [ ] **Step 5: Pindahkan `pointOf` ke helper**

Pindahkan fungsi `pointOf` dari `e2e/comfort.spec.ts` ke `e2e/helpers/reading.ts`, apa adanya, dengan `export` dan JSDoc yang sama (`/** The middle of an element of the shown section, in this window. */`). Di `comfort.spec.ts`, hapus definisinya dan impor `pointOf` dari `./helpers/reading`. Rapikan impor `Page` yang tidak terpakai lagi.

- [ ] **Step 6: Tulis helper kata fixture**

`e2e/helpers/dictionary.ts`:

```ts
import { admin } from "./members"

/**
 * A made-up headword, lower-case letters only and new on every call: the dev
 * dictionary is shared, so a test adds and removes only its own words (like
 * tests/db/dictionary-fixture.ts) and never swaps the dictionary.
 */
export function testWord(): string {
  const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
  return `qe${run.replace(/\d/g, (digit) => "abcdefghij"[Number(digit)])}`
}

export async function seedWord(entry: {
  headword: string
  pos: string
  meanings: Array<string>
  source: "wiktionary" | "wordnet" | "ai"
}) {
  const client = admin()
  const { error } = await client.from("dict_entries").insert(entry)
  if (error) throw error
  const { error: formError } = await client
    .from("dict_forms")
    .insert({ form: entry.headword, headword: entry.headword, pos: entry.pos })
  if (formError) throw formError
}

/** Its form goes with it (on delete cascade). */
export async function removeWord(headword: string) {
  const { error } = await admin()
    .from("dict_entries")
    .delete()
    .eq("headword", headword)
  if (error) throw error
}
```

- [ ] **Step 7: Tulis E2E**

`e2e/dictionary-sources.spec.ts`:

```ts
import { expect, test } from "@playwright/test"
import { seedBook } from "./helpers/books"
import { removeWord, seedWord, testWord } from "./helpers/dictionary"
import { makeEpub } from "./helpers/epub"
import {
  createConfirmedMember,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"
import { pointOf } from "./helpers/reading"

const BOOK = { title: "Buku Kamus", author: "Penguji" }

// Spec kamus tiga sumber §7: a meaning from the AI says so in the popup.
test("a meaning made by AI is credited as such", async ({ page, isMobile }) => {
  test.setTimeout(90_000)
  const word = testWord()
  await seedWord({
    headword: word,
    pos: "noun",
    meanings: ["arti percobaan"],
    source: "ai",
  })
  try {
    const member = await createConfirmedMember()
    await signInAndOnboard(page, member)
    const bookId = await seedBook(await userIdOf(member.email), {
      ...BOOK,
      file: await makeEpub({
        ...BOOK,
        subjects: [],
        cover: false,
        body: `<h1>Bab 1</h1><p>Di sini ada <span id="w">${word}</span> saja.</p>`,
      }),
    })
    await page.goto(`/read/${bookId}`)
    await expect(
      page.getByRole("status", { name: "Posisi baca", includeHidden: true })
    ).toHaveText(/^\d+%$/, { timeout: 30_000 })

    const { x, y } = await pointOf(page, "w")
    if (isMobile) await page.touchscreen.tap(x, y)
    else await page.mouse.click(x, y)

    const popup = page.getByRole("dialog", { name: `Arti ${word}` })
    await expect(popup.getByText("arti percobaan")).toBeVisible()
    await expect(popup.getByText("Dibuat AI", { exact: true })).toBeVisible()
    await expect(
      popup.getByRole("link", { name: "Wiktionary · CC BY-SA" })
    ).toHaveCount(0)
  } finally {
    await removeWord(word)
  }
})
```

- [ ] **Step 8: Lepas pemeriksaan kredit dari E2E Kosakata**

Di `e2e/vocabulary.spec.ts`, hapus tiga baris ini:

```ts
  await expect(
    popup.getByRole("link", { name: "Wiktionary · CC BY-SA" })
  ).toBeVisible()
```

Komentar di atas test sudah menjelaskan alasannya: test ini memeriksa apa yang dilakukan reader, bukan arti katanya.

- [ ] **Step 9: Jalankan E2E**

Cek port 3000 dulu (Global Constraints).

Run: `npx playwright test e2e/dictionary-sources.spec.ts e2e/vocabulary.spec.ts e2e/comfort.spec.ts --workers=2`

Expected: PASS di semua project (desktop dan mobile).

- [ ] **Step 10: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npm run check && npm test`

Expected: PASS.

```bash
git add src/components/reader/WordPopup.tsx src/components/reader/WordPopup.test.tsx src/styles.css e2e/helpers/dictionary.ts e2e/helpers/reading.ts e2e/comfort.spec.ts e2e/vocabulary.spec.ts e2e/dictionary-sources.spec.ts
git commit -m "feat(reader): credit each meaning's source in the word popup"
```

---

### Task 8: Privasi, panduan pemilik, ukur WordNet, dan impor dev

**Files:**
- Modify: `src/routes/privacy.tsx`, `docs/ops/deploy.md` §6.5

**Interfaces:**
- Consumes: semua perintah dari Task 4 dan Task 6, serta angka dry run Task 4 Step 6.

- [ ] **Step 1: Kebijakan Privasi**

Di `src/routes/privacy.tsx`, ganti paragraf yang dimulai "Kata yang kamu ketuk saat membaca dikirim ke server kami..." dengan:

```tsx
      <p>
        Kata yang kamu ketuk saat membaca dikirim ke server kami untuk dicari
        artinya, dan tidak dibagikan ke pihak lain. Kata yang belum punya arti
        dicatat tanpa identitas (hanya katanya, berapa kali dicari, dan kapan
        terakhir) untuk melengkapi kamus. Arti kata berasal dari{" "}
        <a href="https://en.wiktionary.org/">English Wiktionary</a> lewat
        ekstrak <a href="https://kaikki.org/">kaikki.org</a>, dengan lisensi{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">
          CC BY-SA 4.0
        </a>
        , dan dari{" "}
        <a href="https://wn-msa.sourceforge.net/">WordNet Bahasa</a>, dengan
        lisensi MIT. Sebagian arti dibuat dengan AI, sekali saat kamus disusun,
        dan ditandai &ldquo;Dibuat AI&rdquo; di popup arti.
      </p>
```

Cek apakah ada test yang membaca teks lama, dengan `grep -rn "dikirim ke server kami" src e2e tests`. Kalau ada, sesuaikan.

- [ ] **Step 2: Panduan pemilik**

Di `docs/ops/deploy.md`, ganti isi §6.5 (dari judul `### 6.5 Kamus` sampai sebelum `## 7.`) dengan teks berikut. Jangan mengubah bagian lain.

````markdown
### 6.5 Kamus

Arti kata di reader berasal dari tiga sumber, dengan urutan prioritas per kata dan kelas kata:

1. **English Wiktionary**, lewat ekstrak kaikki.org (CC BY-SA).
2. **WordNet Bahasa** (MIT), untuk kata yang tidak punya terjemahan Indonesia di Wiktionary.
3. **Arti buatan AI**, yang dibuat sekali lalu disimpan di tabel `dict_generated`.

Kedua skrip kamus tidak dijalankan CI. Jalankan dari laptop.

#### Unduhan (sekali, ke `dict/`, tidak masuk git)

- **kaikki:** ekstrak semua kata bahasa Inggris dalam format JSONL dari [kaikki.org/dictionary/English](https://kaikki.org/dictionary/English/). Bagian unduhan ada di bawah halaman. Ukurannya beberapa GB, dan boleh tetap `.gz`.
- **WordNet Bahasa:** `wn-msa-all.tab` dari [wn-msa.sourceforge.net](https://wn-msa.sourceforge.net/).
- **Princeton WordNet 3.0:** hanya `index.sense` yang dipakai.
  ```bash
  mkdir -p dict/wndb
  curl -L -o dict/wndb/WNdb-3.0.tar.gz https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz
  tar -xzf dict/wndb/WNdb-3.0.tar.gz -C dict/wndb
  cp dict/wndb/dict/index.sense dict/index.sense
  ```
- **Daftar 50.000 kata teratas** (`wordfreq`, data CC BY-SA 4.0), hanya untuk pengisi AI:
  ```bash
  python -m pip install --user wordfreq
  python -I -c "from wordfreq import top_n_list; open('dict/wordfreq-en-50k.txt','w',encoding='utf-8',newline='\n').write('\n'.join(top_n_list('en', 50000))+'\n')"
  ```

#### Impor

1. Pastikan migrasi kamus sudah ada di proyek tujuan (§7).
2. Jalankan, misalnya untuk dev:
   ```bash
   node --max-old-space-size=8192 scripts/import-dictionary.ts dict/kaikki.org-dictionary-English.jsonl --env dev --dump-date 2026-10-20
   ```
   - `--env dev` memakai `.env.local`. `--env prod` memakai `.env.prod`, yang berisi `SUPABASE_URL` dan `SUPABASE_SECRET_KEY` proyek prod. File itu tidak boleh di-commit.
   - `--dump-date` adalah tanggal dump Wiktionary yang tertulis di halaman kaikki. Boleh dikosongkan.
   - `--wordnet-quality YO` (default) atau `YOL` memilih tanda mutu WordNet Bahasa yang dipakai.
   - `--no-wordnet` mengimpor tanpa WordNet. `--no-generated` mengimpor tanpa arti AI.
   - `--dry-run` membaca dan menghitung semuanya tanpa mengubah kamus.
   - `--coverage buku.txt` mencetak berapa persen kata di sebuah teks yang punya arti.
3. Skrip mencetak jumlah entri per sumber dan jumlah bentuk kata, lalu menukar kamus dalam satu transaksi. Selama penukaran (beberapa detik), pencarian arti menunggu.
4. Kalau jumlah entri turun lebih dari 20% dari impor sebelumnya, skrip berhenti tanpa mengubah kamus. Periksa file-nya dulu. Kalau memang benar, ulangi dengan `--force`.
5. Cek hasilnya di SQL editor: `select * from dict_meta;` dan `select source, count(*) from dict_entries group by source;`

#### Mengisi celah dengan AI

Kata yang diketuk member tetapi belum punya arti dicatat di `dict_misses`, tanpa identitas. Pengisi AI menanyakan 50.000 kata teratas dan kata-kata itu ke Claude Opus 5.5 lewat Batch API (harga 50%). Kunci API hanya ada di laptop: `ANTHROPIC_API_KEY`, atau profil dari `ant auth login`.

1. Lihat calon katanya tanpa biaya:
   ```bash
   node --max-old-space-size=8192 scripts/fill-dictionary.ts --env dev --dry-run
   ```
2. Uji coba 200 kata. Biayanya kecil, dan belum ada yang ditulis ke database:
   ```bash
   node --max-old-space-size=8192 scripts/fill-dictionary.ts --env dev --trial 200
   ```
   Skrip menunggu batch selesai (biasanya beberapa menit, paling lama 24 jam), lalu mencetak:
   - biaya nyata;
   - perkiraan biaya untuk semua kata;
   - 20 contoh arti.

   Tekan Ctrl+C kapan saja. Menjalankan perintah yang sama lagi akan melanjutkan batch yang sama, karena ID-nya tersimpan di `dict/fill-state.json`, jadi tidak membayar ulang.
3. Kalau contohnya bagus, simpan hasil uji coba dengan `--commit`, tanpa `--trial`. Kalau tidak, buang dengan `--discard`. Uji coba bisa diulang dengan `--effort low` atau `--effort high` untuk membandingkan biaya dan mutu.
4. Batch penuh. Effort-nya sama dengan uji coba yang dipilih:
   ```bash
   node --max-old-space-size=8192 scripts/fill-dictionary.ts --env dev --commit --effort medium
   ```
   Kata yang jawabannya tidak valid dicatat di `dict/fill-problems.log`, lalu ditanyakan lagi pada jalan berikutnya.
5. Terbitkan arti AI dengan menjalankan **Impor** di atas.

Ulangi langkah 1, 4, dan 5 sesekali, misalnya sebulan sekali, untuk kata baru di `dict_misses`.
````

- [ ] **Step 3: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npm run check && npm test`

Expected: PASS.

```bash
git add src/routes/privacy.tsx docs/ops/deploy.md
git commit -m "docs: privacy and owner's guide for the three-source dictionary"
```

- [ ] **Step 4 (controller dan pemilik): Putuskan mutu WordNet**

Controller membawa ketiga angka dry run dari Task 4 Step 6 ke pemilik: tanpa WordNet, `YO`, dan `YOL`, masing-masing dengan jumlah entri dan cakupan Sherlock. Pemilik memilih `YO` atau `YOL`.

Kalau pemilik memilih `YOL`, ubah `DEFAULT_WORDNET_QUALITIES` di `src/lib/words/wordnet.ts` menjadi `["Y", "O", "L"]`. Ubah juga test `"keeps Indonesian lemmas marked Y or O..."` supaya memanggil `read(BAHASA, SENSES, ["Y", "O"])` secara eksplisit, lalu tambahkan test bahwa default sekarang memuat `L`. Ubah juga kata "(default)" di panduan §6.5. Lalu commit `feat(words): take WordNet Bahasa's L lemmas by default`.

- [ ] **Step 5 (controller, dengan persetujuan pemilik): Impor ke dev**

Run: `node --max-old-space-size=8192 scripts/import-dictionary.ts dict/kaikki.org-dictionary-English.jsonl --env dev --coverage dict/sherlock.txt`

Expected:
- jumlah entri per sumber sama dengan dry run yang dipilih;
- `Dictionary swapped in:` dengan `entries` lebih besar dari `previous`.

Ini satu-satunya `dict_swap` di plan ini. Skrip impor memang dibuat untuk itu.

- [ ] **Step 6 (pemilik): Uji coba AI dan batch penuh**

Pemilik menjalankan panduan §6.5 "Mengisi celah dengan AI" langkah 1 sampai 5 di dev:
- `--trial 200`;
- memeriksa biaya dan contoh;
- `--commit` atau `--discard`;
- batch penuh dengan `--commit`;
- impor ulang.

Setelah impor, cakupan Sherlock diukur ulang dengan `--coverage dict/sherlock.txt --dry-run`, lalu dicatat.

- [ ] **Step 7: Verifikasi penuh**

Run: `npm run typecheck && npm run lint && npm run check && npm test && npm run test:db`

Run: `npx playwright test --workers=2`

Expected: PASS. Kegagalan tunggal dijalankan ulang sendirian sebelum disebut regresi.
