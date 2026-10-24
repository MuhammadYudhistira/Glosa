# Glosa Tahap 2A — Ketuk Kata & Kosakata: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Member mengetuk kata di reader dan langsung melihat artinya dalam bahasa Indonesia, menyimpan kata itu bersama kalimat asalnya, lalu membuka semua kata tersimpan di halaman Kosakata (hotspot lemari katalog di lobi, tab di HP). Kata tersimpan bergaris bawah di semua buku, dan semuanya tetap jalan offline.

**Architecture:**
- **Kamus.** Tabel `dict_entries` dan `dict_forms` di Postgres, diisi skrip `scripts/import-dictionary.ts` dari ekstrak kaikki/wiktextract lewat tabel staging dan fungsi `dict_swap`. Fungsi SQL `lookup_word` mencari bentuk dasar dan phrasal verb dalam satu panggilan.
- **Kata tersimpan.** Tabel `saved_words` dengan fungsi `save_word`, `delete_word`, dan `saved_word_forms`. Browser memanggilnya lewat server function di `src/server/words.ts`.
- **Perangkat.** Dexie versi 2 menambah cache arti (`lookups`, maksimal 2.000), salinan Kosakata (`words`), dan antrean (`wordOps`, satu operasi per kata, yang terbaru menang). Mesin sinkron `createWordSync` mengikuti pola `createProgressSync`.
- **Reader.** Klik di dokumen section mencoba `wordAt` dulu. Kata yang kena membuka `WordPopup` (popover di desktop, bottom sheet di HP). Ruang kosong tetap memakai zona lama. Garis bawah kata tersimpan dan sorotan kata aktif memakai CSS Custom Highlight API, tanpa mengubah DOM buku.

**Tech Stack:** TanStack Start + Router (file routes, `tsr generate`), React 19, TypeScript, Tailwind CSS 4, Base UI (Popover, Dialog), Dexie 4, Supabase (Postgres, RLS, PostgREST RPC), zod 4, foliate-js, Three.js r160, Vitest + Testing Library (jsdom, `fake-indexeddb`), Playwright, Node 24 (type stripping untuk skrip impor).

**Spec:** [`docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md`](../specs/2026-10-22-tahap-2-ketuk-kata-design.md) §2, §3 (2A), §4.1, §4.2, §4.5, §5, §6.1–§6.5, §7, §8, §10.

## Global Constraints

- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris (mengikuti kode yang ada). Array ditulis `Array<T>`, seperti kode yang ada.
- **Dependensi:** tidak ada dependensi baru.
- **Breakpoint desktop:** `(min-width: 1024px)` (`useWideScreen()` / `isWideScreen()` di `src/lib/use-wide-screen.ts`).
- **Batas (persis dari spec):** headword 1–64 karakter; arti 0–8 item (kamus 1–8); kalimat asal maksimal 500 karakter; CFI maksimal 2.000 karakter; judul buku maksimal 300 karakter; 5.000 kata tersimpan per user; batch antrean maksimal 50 operasi; `p_next` maksimal 2 kata; cache arti maksimal 2.000 kata.
- **Waktu (persis dari spec):** skeleton popup muncul bila memuat lebih dari 150 ms; antrean dikirim 2 detik setelah perubahan terakhir, saat online kembali, dan saat buku dibuka.
- **Teks dari spec, persis:** "Belum ada arti untuk kata ini", "Arti butuh koneksi", "Arti tidak bisa dimuat", "Coba lagi", "Simpan", "Tersimpan", "Wiktionary · CC BY-SA", "frasa", "Kosakata sudah penuh (5.000 kata). Hapus beberapa kata untuk menyimpan yang baru.", "Posisi itu tidak ditemukan di buku ini", "Ketuk kata yang sulit saat membaca, lalu simpan. Kata itu akan muncul di sini.", "Buka di buku", "Urungkan".
- **Label kelas kata:** `noun` kata benda, `verb` kata kerja, `adj` kata sifat, `adv` kata keterangan, `pron` kata ganti, `prep` kata depan, `conj` kata sambung, `interj` kata seru, `phrase` frasa.
- **SQL:** tabel memakai RLS "baca milik sendiri"; penulisan lewat fungsi `security definer` dengan `set search_path = ''`; `revoke execute … from public, anon` lalu `grant` ke peran yang perlu (pola `save_progress`).
- **Migrasi:** di-push ke proyek Supabase dev sebelum branch di-push (`npm run db:push`), lalu tipe dibuat ulang (`npm run db:types`). Lihat [`docs/ops/deploy.md`](../../ops/deploy.md) §7.
- **Proyek dev dipakai bersama** oleh situs dev, CI, dan test. Test tidak boleh memanggil `dict_swap` (itu mengganti kamus asli) dan hanya boleh menulis baris kamus milik fixture-nya sendiri.
- **E2E:** kalau port 3000 dipegang aplikasi lain (cek `curl -sL localhost:3000/login | grep -o "<title>[^<]*"`), jalankan dengan config sementara di port 3100, jangan matikan server lain.

## Keputusan dan penyimpangan dari spec

Semua keputusan berikut disengaja. Spec diperbarui mengikutinya di Task 16.

1. **`lookup_word` dipanggil lewat server function `lookupWordFn`, bukan RPC langsung dari browser.** Proyek ini tidak punya klien Supabase di browser; sesi ada di cookie dan semua panggilan lewat server function. Tahap 5 nanti menghitung kuota di tempat yang sama.
2. **Skrip impor bernama `scripts/import-dictionary.ts`** dan dijalankan Node 24 langsung (type stripping), supaya bisa memakai `normalizeWord` yang sama dengan reader. Karena itu `normalize.ts`, `types.ts`, dan `dict-import.ts` saling meng-import dengan ekstensi `.ts`.
3. **Kunci rahasia skrip memakai nama yang sudah ada:** `SUPABASE_URL` dan `SUPABASE_SECRET_KEY`. `--env dev` membaca `.env.local`, `--env prod` membaca `.env.prod`. Keduanya sudah di-ignore git (`.env.*`).
4. **Penukaran kamus memakai fungsi SQL `dict_swap`** (dan `dict_staging_reset`), hanya untuk `service_role`. Bentuk dasar (`run → run`) ditambahkan oleh `dict_swap`, bukan oleh skrip.
5. **`saved_word_forms()` mengembalikan satu objek `jsonb`** `{ headword: [bentuk…] }`, bukan tabel. PostgREST memotong hasil di 1.000 baris, sedangkan 5.000 kata bisa punya puluhan ribu bentuk. Dengan alasan yang sama, `listSavedWordsFn` membaca per 1.000 baris.
6. **`save_word` dan buku:** buku milik user lain ditolak (`invalid`). Buku yang sudah tidak ada sama sekali (dihapus saat simpanan masih di antrean offline) tidak membuat kata hilang: kata disimpan tanpa buku.
7. **Kosakata offline disimpan di tabel Dexie `words`**, bukan cache TanStack Query (proyek ini tidak memakai TanStack Query). Polanya sama dengan salinan rak: loader membaca server saat online, lalu salinan perangkat dipakai saat offline.
8. **Antrean kata: satu operasi per headword, yang terbaru menang.** *Urungkan* setelah hapus cukup memasukkan simpan lagi. Kalau hapus belum terkirim, simpan menggantikannya. Kalau sudah terkirim, simpan membuat baris baru dengan konteks yang sama.
9. **Ketukan di ruang kosong saat popup arti terbuka hanya menutup popup**, tidak membalik halaman.
10. **Kunci cache arti adalah kata + 2 kata sesudahnya**, karena phrasal verb bergantung pada keduanya. Saat offline tanpa kunci yang persis, arti dari pencarian lain untuk kata yang sama tetap dipakai (tanpa frasa).
11. **Popup arti di HP memakai Dialog Base UI yang digayakan sebagai bottom sheet** (modal). Di desktop memakai Popover Base UI dengan anchor virtual di posisi kata.
12. **E2E tidak memeriksa isi arti**, karena isi kamus di proyek dev berubah mengikuti impor. Isi arti diuji di test SQL (fixture) dan unit test komponen.
13. **Pesan baru masuk ke `src/lib/book-messages.ts`** (modul pesan reader yang sudah ada): `words_full`, `word_invalid`, `position_missing`.
14. **Parameter `?cfi` dibuang dari alamat setelah buku terbuka** (`replace`), supaya muat ulang tidak melompat ke kata itu lagi.
15. **Hotspot `katalog` ditempatkan di depan kiri, di samping Meja Admin**, di titik yang tidak tertutup menara dari sudut kamera, dan berada paling akhir di urutan Tab.
16. **Ketukan HP di E2E "turning pages by key or tap" dipindah ke tepi kanan layar** (di luar teks). Ketukan di atas kata sekarang membuka arti (spec §2 keputusan 3).
17. **Kalimat asal tidak dipotong di singkatan umum** (*Mr.*, *Mrs.*, *Dr.*, *St.*, …). Novel Sherlock Holmes penuh dengan *Mr. Holmes*.
18. **Kata yang ditebalkan di kartu Kosakata** dicari dari headword dan semua bentuknya (cache `saved_word_forms`), karena kata yang diketuk bisa berupa bentuk turunan (*ran* untuk *run*).

## Struktur file

| File | Status | Tanggung jawab |
|---|---|---|
| `src/lib/words/normalize.ts` | Baru | `normalizeWord`, `isLookupWord`, `MAX_WORD_LENGTH` |
| `src/lib/words/types.ts` | Baru | Tipe kamus, kata tersimpan, operasi antrean, batas |
| `src/lib/words/dict-import.ts` | Baru | `createDictionaryBuilder` (dari rekaman wiktextract ke baris tabel) |
| `scripts/import-dictionary.ts` | Baru | Perintah impor kamus |
| `supabase/migrations/20261024000100_dictionary.sql` | Baru | `dict_*`, staging, `lookup_word`, `dict_swap`, `dict_staging_reset` |
| `supabase/migrations/20261024000200_saved_words.sql` | Baru | `saved_words`, `save_word`, `delete_word`, `saved_word_forms` |
| `src/server/database.types.ts` | Dibuat ulang | `npm run db:types` |
| `tests/db/dictionary-fixture.ts` | Baru | Kamus kecil milik test |
| `tests/db/dictionary.test.ts` | Baru | RLS kamus dan `lookup_word` |
| `tests/db/saved-words.test.ts` | Baru | `save_word`, `delete_word`, `saved_word_forms`, RLS, cascade |
| `tests/db/helpers.ts` | Ubah | `newTestBook()` |
| `src/lib/words/schemas.ts` | Baru | Skema zod operasi kata (dipakai client dan server) |
| `src/server/words.ts` | Baru | `lookupWordFn`, `syncSavedWordsFn`, `listSavedWordsFn`, `savedWordFormsFn` |
| `src/lib/local/db.ts` | Ubah | Dexie versi 2: `lookups`, `words`, `wordOps` |
| `src/lib/local/device.ts` | Ubah | Hapus data juga mengosongkan tabel baru |
| `src/lib/local/lookups.ts` | Baru | Cache arti (2.000, LRU) |
| `src/lib/words/lookup.ts` | Baru | `lookUp` (cache → server), `savedChoice` |
| `src/lib/local/saved-words.ts` | Baru | Salinan Kosakata, antrean, cache bentuk kata |
| `src/lib/words/word-sync.ts` | Baru | `createWordSync` |
| `src/lib/words/word-sync-client.ts` | Baru | Mesin satu-satunya di tab, hook React, `refreshSavedForms` |
| `src/lib/progress-sync-client.ts` | Ubah | `leaveDevice` juga mengirim antrean kata |
| `src/routes/_member.tsx` | Ubah | `useWordFlush()` |
| `src/lib/words/word-at.ts` | Baru | `wordAt` dan fungsi teks murni di baliknya |
| `src/lib/words/saved-marks.ts` | Baru | Garis bawah dan sorotan lewat `CSS.highlights` |
| `src/lib/reader-settings.ts` | Ubah | Gaya `::highlight(...)` dan warna `mark` per tema |
| `src/lib/words/labels.ts` | Baru | `POS_LABELS` |
| `src/components/reader/useWordLookup.ts` | Baru | Status pencarian untuk popup (memuat, lambat, coba lagi) |
| `src/components/reader/WordPopup.tsx` | Baru | Popup arti |
| `src/components/reader/VocabularyNotice.tsx` | Baru | Pesan penolakan server |
| `src/components/reader/ReaderView.tsx` | Ubah | Urutan klik, kata, sorotan, garis bawah, target CFI |
| `src/types/foliate-js.d.ts` | Ubah | `getCFI`, `resolveNavigation` |
| `src/routes/_member/read.$bookId.tsx` | Ubah | `?cfi`, popup, simpan/hapus |
| `src/lib/book-messages.ts` | Ubah | Pesan baru |
| `src/lib/words/vocabulary.ts` | Baru | Saring, pilihan buku, bagian kalimat yang ditebalkan |
| `src/lib/vocabulary-loader.ts` | Baru | `loadVocabulary` |
| `src/components/vocabulary/VocabularyList.tsx` | Baru | Isi halaman Kosakata |
| `src/routes/_member/_lobi/vocabulary.tsx` | Baru | Route `/vocabulary` di dalam `LobbyPopup` |
| `src/components/lobby/LobbyPopup.tsx` | Ubah | `/vocabulary` termasuk popup |
| `src/components/member/MemberShell.tsx` | Ubah | Tautan Kosakata |
| `src/routes/privacy.tsx` | Ubah | Kosakata, kalimat asal, atribusi Wiktionary |
| `src/components/lobby/scene/layout.ts` | Ubah | `CARD_CATALOG`, hotspot `katalog` |
| `src/components/lobby/scene/furniture.ts` | Ubah | Model lemari katalog kartu |
| `src/components/lobby/lobby-data.ts` | Ubah | Label "Kosakata" |
| `src/components/lobby/LibraryMap.tsx` | Ubah | Tanda peta dan legenda katalog |
| `src/components/lobby/LobbyStage.tsx` | Ubah | Hotspot katalog membuka `/vocabulary` |
| `src/styles.css` | Ubah | Popup arti, sheet, kartu Kosakata, tanda peta |
| `src/routeTree.gen.ts` | Dibuat ulang | `npm run generate-routes` |
| `docs/ops/deploy.md` | Ubah | §6.5 Kamus |
| `e2e/helpers/words.ts` | Baru | Mencari kata yang terlihat, membaca `saved_words` |
| `e2e/vocabulary.spec.ts` | Baru | E2E 2A |
| `e2e/reader.spec.ts` | Ubah | Ketukan HP di tepi |

---

### Task 1: `normalizeWord` dan `isLookupWord`

**Files:**
- Create: `src/lib/words/normalize.ts`
- Test: `src/lib/words/normalize.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `MAX_WORD_LENGTH = 64`
  - `normalizeWord(raw: string): string`: huruf kecil, `’`/`‘`/`ʼ` menjadi `'`, spasi tunggal, tanpa tanda baca di ujung, tanpa akhiran `'s`.
  - `isLookupWord(word: string): boolean`: huruf Latin (boleh beraksen) yang disambung `'` atau `-`, maksimal 64 karakter.
  - File ini **tidak boleh punya import**, karena dijalankan Node langsung oleh skrip impor.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/words/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { MAX_WORD_LENGTH, isLookupWord, normalizeWord } from "./normalize"

describe("normalizeWord", () => {
  it("lowers the case and straightens curly apostrophes", () => {
    expect(normalizeWord("Don’t")).toBe("don't")
    expect(normalizeWord("RUNNING")).toBe("running")
  })

  it("drops punctuation at either end and a possessive 's", () => {
    expect(normalizeWord("“Holmes’s,")).toBe("holmes")
    expect(normalizeWord("(Watson)!")).toBe("watson")
    expect(normalizeWord("dogs’")).toBe("dogs")
  })

  it("keeps hyphens and apostrophes inside a word", () => {
    expect(normalizeWord("well-known.")).toBe("well-known")
    expect(normalizeWord("o’clock")).toBe("o'clock")
  })

  it("joins a phrase with single spaces", () => {
    expect(normalizeWord("  Give \n Up ")).toBe("give up")
  })
})

describe("isLookupWord", () => {
  it("accepts Latin words, accented ones too", () => {
    for (const word of ["holmes", "don't", "well-known", "café"]) {
      expect(isLookupWord(word), word).toBe(true)
    }
    expect(isLookupWord("a".repeat(MAX_WORD_LENGTH))).toBe(true)
  })

  it("refuses numbers, other scripts, empty and over-long words", () => {
    for (const word of ["1890", "b2", "москва", "", "a".repeat(65)]) {
      expect(isLookupWord(word), word).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/words/normalize.test.ts`
Expected: FAIL, modul `./normalize` tidak ditemukan.

- [ ] **Step 3: Implementasi**

Buat `src/lib/words/normalize.ts`:

```ts
/** The longest word or phrase looked up, saved or kept in the dictionary (spec 2 §4). */
export const MAX_WORD_LENGTH = 64

const APOSTROPHES = /[‘’ʼ]/gu
const EDGES = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu
/** Latin letters joined by apostrophes or hyphens: "don't", "well-known". */
const LOOKUP_WORD = /^\p{Script=Latin}+(?:['-]\p{Script=Latin}+)*$/u

/**
 * The form a word is looked up and saved in (spec 2 §5): lower case, straight
 * apostrophes, single spaces, no punctuation at either end and no possessive
 * 's. The dictionary import runs every headword and form through it too, so
 * the reader and the dictionary always agree. No imports: Node runs this file
 * as it is for scripts/import-dictionary.ts.
 */
export function normalizeWord(raw: string): string {
  const word = raw
    .normalize("NFC")
    .replace(APOSTROPHES, "'")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .replace(EDGES, "")
  return word.replace(/'s$/u, "").replace(EDGES, "")
}

/** Whether a tapped word opens its meaning (spec 2 §6.2): Latin letters only, at most 64. */
export function isLookupWord(word: string): boolean {
  return word.length <= MAX_WORD_LENGTH && LOOKUP_WORD.test(word)
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run src/lib/words/normalize.test.ts`
Expected: semua PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/words/normalize.ts src/lib/words/normalize.test.ts
git commit -m "feat(words): one way to spell a word for lookups and the dictionary"
```

---

### Task 2: Tabel kamus dan `lookup_word`

**Files:**
- Create: `supabase/migrations/20261024000100_dictionary.sql`
- Create: `tests/db/dictionary-fixture.ts`
- Test: `tests/db/dictionary.test.ts`
- Regenerate: `src/server/database.types.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - Tabel `dict_entries (headword, pos, meanings text[])`, `dict_forms (form, headword, pos)`, `dict_meta`, `dict_entries_staging`, `dict_forms_staging`.
  - `lookup_word(p_word text, p_next text[] default '{}') returns jsonb` → `{ word, entries: [{ headword, pos, meanings }], phrases: [{ headword, meanings }] }` (untuk `authenticated`).
  - `dict_staging_reset() returns void` dan `dict_swap(p_source text, p_dump_date date default null, p_force boolean default false) returns jsonb` → `{ entries, forms, previous }`; error `empty` atau `shrunk` (hanya `service_role`).
  - `tests/db/dictionary-fixture.ts`: `fixturePrefix(): string`, `dictionaryFixture(prefix)`, `seedDictionary(fixture)`, `removeDictionary(fixture)`. Task 4 memakainya.

- [ ] **Step 1: Tulis fixture dan test yang gagal**

Buat `tests/db/dictionary-fixture.ts`:

```ts
import { adminClient } from "./helpers"

/**
 * Letters only (headwords hold no digits) and new on every run: the dev
 * project holds the real dictionary as well, so tests add and remove only
 * their own words and never swap the dictionary.
 */
export function fixturePrefix(): string {
  const run = Date.now()
    .toString(36)
    .replace(/\d/g, (digit) => "abcdefghij"[Number(digit)])
  return `qz${run}`
}

/** A few made-up words with a derived form and two phrasal verbs (spec 2 §10). */
export function dictionaryFixture(prefix: string) {
  const run = `${prefix}run`
  const ran = `${prefix}ran`
  const running = `${prefix}running`
  const fast = `${prefix}fast`
  const runUp = `${run} up`
  const runUpAgainst = `${run} up against`
  return {
    run,
    ran,
    running,
    fast,
    runUp,
    runUpAgainst,
    entries: [
      { headword: run, pos: "noun", meanings: ["lari"] },
      { headword: run, pos: "verb", meanings: ["berlari", "menjalankan"] },
      { headword: runUp, pos: "verb", meanings: ["menaikkan"] },
      { headword: runUpAgainst, pos: "verb", meanings: ["menghadapi"] },
      { headword: fast, pos: "adj", meanings: ["cepat"] },
    ],
    forms: [
      { form: run, headword: run, pos: "noun" },
      { form: run, headword: run, pos: "verb" },
      { form: ran, headword: run, pos: "verb" },
      { form: running, headword: run, pos: "verb" },
      { form: runUp, headword: runUp, pos: "verb" },
      { form: `${ran} up`, headword: runUp, pos: "verb" },
      { form: runUpAgainst, headword: runUpAgainst, pos: "verb" },
      { form: fast, headword: fast, pos: "adj" },
    ],
  }
}

export type DictionaryFixture = ReturnType<typeof dictionaryFixture>

export async function seedDictionary(fixture: DictionaryFixture) {
  const admin = adminClient()
  const { error } = await admin.from("dict_entries").insert(fixture.entries)
  if (error) throw error
  const { error: formsError } = await admin
    .from("dict_forms")
    .insert(fixture.forms)
  if (formsError) throw formsError
}

/** Its forms go with the entries (on delete cascade). */
export async function removeDictionary(fixture: DictionaryFixture) {
  const headwords = [...new Set(fixture.entries.map((e) => e.headword))]
  const { error } = await adminClient()
    .from("dict_entries")
    .delete()
    .in("headword", headwords)
  if (error) throw error
}
```

Buat `tests/db/dictionary.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  dictionaryFixture,
  fixturePrefix,
  removeDictionary,
  seedDictionary,
} from "./dictionary-fixture"
import {
  anonClient,
  createTestMember,
  deleteTestMembers,
  signedInClient,
} from "./helpers"

const email = `db-dict-${Date.now().toString(36)}@glosa.test`
type Client = Awaited<ReturnType<typeof signedInClient>>

describe("dictionary", () => {
  const fixture = dictionaryFixture(fixturePrefix())
  let member: Client

  beforeAll(async () => {
    await createTestMember({ email })
    member = await signedInClient(email)
    await seedDictionary(fixture)
  })

  afterAll(async () => {
    await removeDictionary(fixture)
    await deleteTestMembers()
  })

  const lookUp = (word: string, next: Array<string> = []) =>
    member.rpc("lookup_word", { p_word: word, p_next: next })

  it("finds a derived form's headword", async () => {
    const { data, error } = await lookUp(fixture.ran)
    expect(error).toBeNull()
    expect(data).toEqual({
      word: fixture.ran,
      entries: [
        {
          headword: fixture.run,
          pos: "verb",
          meanings: ["berlari", "menjalankan"],
        },
      ],
      phrases: [],
    })
  })

  it("lists verbs before nouns", async () => {
    const { data } = await lookUp(fixture.run)
    expect(
      (data as { entries: Array<{ pos: string }> }).entries.map((e) => e.pos)
    ).toEqual(["verb", "noun"])
  })

  it("suggests the phrasal verbs that start here, longest first", async () => {
    const { data } = await lookUp(fixture.ran, ["up", "against"])
    expect((data as { phrases: unknown }).phrases).toEqual([
      { headword: fixture.runUpAgainst, meanings: ["menghadapi"] },
      { headword: fixture.runUp, meanings: ["menaikkan"] },
    ])
  })

  it("tries one particle when only one follows", async () => {
    const { data } = await lookUp(fixture.running, ["up"])
    expect((data as { phrases: unknown }).phrases).toEqual([
      { headword: fixture.runUp, meanings: ["menaikkan"] },
    ])
  })

  it("answers nothing for a word over 64 characters or more than two next words", async () => {
    const long = await lookUp("a".repeat(65))
    expect(long.data).toMatchObject({ entries: [], phrases: [] })
    const many = await lookUp(fixture.run, ["up", "against", "it"])
    expect(many.data).toMatchObject({ entries: [], phrases: [] })
  })

  it("lets members read the dictionary but not change it", async () => {
    const { data } = await member
      .from("dict_entries")
      .select("pos")
      .eq("headword", fixture.run)
    expect(data).toHaveLength(2)
    const insert = await member
      .from("dict_entries")
      .insert({ headword: `${fixture.run}x`, pos: "noun", meanings: ["x"] })
    expect(insert.error).not.toBeNull()
    const reset = await member.rpc("dict_staging_reset")
    expect(reset.error).not.toBeNull()
    const swap = await member.rpc("dict_swap", {
      p_source: "test",
      p_force: true,
    })
    expect(swap.error).not.toBeNull()
  })

  it("keeps guests out", async () => {
    const anon = anonClient()
    const read = await anon.from("dict_entries").select("headword").limit(1)
    expect(read.error).not.toBeNull()
    const lookup = await anon.rpc("lookup_word", {
      p_word: fixture.run,
      p_next: [],
    })
    expect(lookup.error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Tulis migrasi**

Buat `supabase/migrations/20261024000100_dictionary.sql`:

```sql
-- Dictionary (spec 2 §4.1): English headwords with their Indonesian meanings,
-- from English Wiktionary (kaikki.org / wiktextract, CC BY-SA). Members only
-- read it; scripts/import-dictionary.ts fills it with the service role.
create table public.dict_entries (
  headword text not null check (char_length(headword) between 1 and 64),
  pos text not null check (
    pos in ('noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'conj', 'interj', 'phrase')
  ),
  meanings text[] not null check (cardinality(meanings) between 1 and 8),
  primary key (headword, pos)
);

-- Every form that leads to a headword, the headword itself included, so a
-- lookup takes one query.
create table public.dict_forms (
  form text not null check (char_length(form) between 1 and 64),
  headword text not null,
  pos text not null,
  primary key (form, headword, pos),
  foreign key (headword, pos)
    references public.dict_entries (headword, pos) on delete cascade
);

create index dict_forms_headword_idx on public.dict_forms (headword);

-- One row: which extract the dictionary came from and how big it was.
create table public.dict_meta (
  id boolean primary key default true check (id),
  source text not null,
  dump_date date,
  entries integer not null,
  forms integer not null,
  imported_at timestamptz not null default now()
);

-- Filled by the import, then swapped in by dict_swap.
create table public.dict_entries_staging (
  headword text not null,
  pos text not null,
  meanings text[] not null
);

create table public.dict_forms_staging (
  form text not null,
  headword text not null,
  pos text not null
);

alter table public.dict_entries enable row level security;
alter table public.dict_forms enable row level security;
alter table public.dict_meta enable row level security;
alter table public.dict_entries_staging enable row level security;
alter table public.dict_forms_staging enable row level security;

create policy dict_entries_select on public.dict_entries
  for select to authenticated using (true);
create policy dict_forms_select on public.dict_forms
  for select to authenticated using (true);
create policy dict_meta_select on public.dict_meta
  for select to authenticated using (true);

revoke all on table
  public.dict_entries, public.dict_forms, public.dict_meta,
  public.dict_entries_staging, public.dict_forms_staging
  from anon, authenticated;
grant select on table public.dict_entries, public.dict_forms, public.dict_meta
  to authenticated;

-- The most common parts of speech first (spec 2 §4.1).
create function public.dict_pos_rank(p_pos text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_pos
    when 'verb' then 1
    when 'noun' then 2
    when 'adj' then 3
    when 'adv' then 4
    else 5
  end
$$;

-- What a tapped word means (spec 2 §4.1): the headwords its form leads to, and
-- the phrasal verbs that start with it and the next one or two words, longest
-- first. Anything too long answers nothing.
create function public.lookup_word(p_word text, p_next text[] default '{}')
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_entries jsonb := '[]'::jsonb;
  v_phrases jsonb := '[]'::jsonb;
  v_next integer := coalesce(cardinality(p_next), 0);
begin
  if p_word is null or char_length(p_word) not between 1 and 64 or v_next > 2 then
    return jsonb_build_object('word', p_word, 'entries', v_entries, 'phrases', v_phrases);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('headword', e.headword, 'pos', e.pos, 'meanings', to_jsonb(e.meanings))
      order by public.dict_pos_rank(e.pos), e.headword <> p_word, e.headword
    ),
    '[]'::jsonb
  )
  into v_entries
  from (select distinct f.headword, f.pos from public.dict_forms f where f.form = p_word) b
  join public.dict_entries e on e.headword = b.headword and e.pos = b.pos;

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

  return jsonb_build_object('word', p_word, 'entries', v_entries, 'phrases', v_phrases);
end;
$$;

-- Empties the staging tables before an import.
create function public.dict_staging_reset()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  truncate public.dict_entries_staging, public.dict_forms_staging;
end;
$$;

-- Replaces the dictionary with the staging tables in one transaction, so a
-- lookup never sees half of one (spec 2 §4.1). Every headword also becomes
-- its own form. Refuses a dictionary over 20% smaller than the last unless
-- forced.
create function public.dict_swap(
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
  insert into public.dict_entries (headword, pos, meanings)
  select distinct on (s.headword, s.pos) s.headword, s.pos, s.meanings
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

revoke execute on function public.dict_pos_rank(text) from public, anon;
grant execute on function public.dict_pos_rank(text) to authenticated;
revoke execute on function public.lookup_word(text, text[]) from public, anon;
grant execute on function public.lookup_word(text, text[]) to authenticated;
revoke execute on function public.dict_staging_reset() from public, anon, authenticated;
grant execute on function public.dict_staging_reset() to service_role;
revoke execute on function public.dict_swap(text, date, boolean)
  from public, anon, authenticated;
grant execute on function public.dict_swap(text, date, boolean) to service_role;
```

- [ ] **Step 3: Push migrasi ke proyek dev dan buat ulang tipe**

Run: `npm run db:push`
Expected: `Applying migration 20261024000100_dictionary.sql...` lalu selesai tanpa error.

Run: `npm run db:types`
Expected: `src/server/database.types.ts` sekarang memuat `dict_entries`, `dict_forms`, `dict_meta`, `lookup_word`, `dict_swap`, dan `dict_staging_reset`.

Run: `npx prettier --write src/server/database.types.ts`
(Tipe hasil CLI tidak mengikuti format proyek.)

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run --config vitest.db.config.ts tests/db/dictionary.test.ts`
Expected: 7 test PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261024000100_dictionary.sql src/server/database.types.ts tests/db/dictionary-fixture.ts tests/db/dictionary.test.ts
git commit -m "feat(db): dictionary tables, lookup_word with phrasal verbs, and a swap for imports"
```

---

### Task 3: Skrip impor kamus

**Files:**
- Create: `src/lib/words/types.ts`
- Create: `src/lib/words/dict-import.ts`
- Create: `scripts/import-dictionary.ts`
- Modify: `docs/ops/deploy.md` (subbab baru §6.5, sesudah §6.4)
- Test: `src/lib/words/dict-import.test.ts`

**Interfaces:**
- Consumes: `normalizeWord`, `MAX_WORD_LENGTH` (Task 1); `dict_staging_reset`, `dict_swap`, tabel staging (Task 2).
- Produces:
  - `src/lib/words/types.ts` (tanpa import; Task 5 menambah isinya):
    - `DICT_POS` (tuple 9 kelas kata), `type DictPos`, `MAX_MEANINGS = 8`
    - `type DictEntry = { headword: string; pos: DictPos; meanings: Array<string> }`
    - `type DictPhrase = { headword: string; meanings: Array<string> }`
    - `type LookupResult = { word: string; entries: Array<DictEntry>; phrases: Array<DictPhrase> }`
  - `createDictionaryBuilder()` → `{ add(record: unknown): void; result(): { entries: Array<DictEntry>; forms: Array<DictForm>; phrases: number } }`, dengan `type DictForm = { form: string; headword: string; pos: DictPos }`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/words/dict-import.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { createDictionaryBuilder } from "./dict-import"

const run = {
  word: "run",
  lang_code: "en",
  pos: "verb",
  forms: [
    { form: "runs", tags: ["present", "singular", "third-person"] },
    { form: "running", tags: ["participle", "present"] },
    { form: "en-verb", tags: ["inflection-template"] },
    { form: "will run", tags: ["future"] },
  ],
  translations: [
    { code: "id", word: "lari" },
    { code: "id", word: "berlari" },
  ],
  senses: [
    {
      translations: [
        { lang_code: "id", word: "berlari" },
        { lang_code: "ms", word: "lari" },
      ],
    },
  ],
}

const build = (...records: Array<unknown>) => {
  const builder = createDictionaryBuilder()
  for (const record of records) builder.add(record)
  return builder.result()
}

describe("createDictionaryBuilder", () => {
  it("keeps the Indonesian translations of each part of speech, without repeats", () => {
    expect(build(run).entries).toEqual([
      { headword: "run", pos: "verb", meanings: ["lari", "berlari"] },
    ])
  })

  it("keeps at most eight meanings", () => {
    const many = {
      ...run,
      translations: Array.from({ length: 10 }, (_, i) => ({
        code: "id",
        word: `arti ${i}`,
      })),
      senses: [],
    }
    expect(build(many).entries[0].meanings).toHaveLength(8)
  })

  it("takes forms from the headword and from form-of senses, but not table tags or multiword tenses", () => {
    const ran = {
      word: "Ran",
      lang_code: "en",
      pos: "verb",
      senses: [{ form_of: [{ word: "run" }] }],
    }
    const forms = build(run, ran).forms.map(({ form }) => form)
    expect(forms.sort()).toEqual(["ran", "running", "runs"])
  })

  it("drops forms of headwords without meanings, other languages and other parts of speech", () => {
    const result = build(
      { word: "sing", lang_code: "en", pos: "verb", forms: [{ form: "sang" }] },
      { ...run, lang_code: "fr" },
      { ...run, pos: "name" }
    )
    expect(result).toEqual({ entries: [], forms: [], phrases: 0 })
  })

  it("keeps phrasal verbs, their own forms, and counts them", () => {
    const giveUp = {
      word: "give up",
      lang_code: "en",
      pos: "verb",
      forms: [{ form: "gave up", tags: ["past"] }],
      translations: [{ code: "id", word: "menyerah" }],
    }
    const result = build(giveUp)
    expect(result.phrases).toBe(1)
    expect(result.forms).toEqual([
      { form: "gave up", headword: "give up", pos: "verb" },
    ])
  })

  it("spells headwords the way the reader does", () => {
    const record = {
      word: "Well-known",
      lang_code: "en",
      pos: "adj",
      translations: [{ code: "id", word: "terkenal" }],
    }
    expect(build(record).entries[0].headword).toBe("well-known")
  })

  it("files interjections under interj", () => {
    const record = {
      word: "hello",
      lang_code: "en",
      pos: "intj",
      translations: [{ code: "id", word: "halo" }],
    }
    expect(build(record).entries[0].pos).toBe("interj")
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/words/dict-import.test.ts`
Expected: FAIL, modul `./dict-import` tidak ditemukan.

- [ ] **Step 3: Implementasi**

Buat `src/lib/words/types.ts`:

```ts
/**
 * The dictionary's parts of speech (spec 2 §4.1). No imports here: Node runs
 * this file as it is for scripts/import-dictionary.ts.
 */
export const DICT_POS = [
  "noun",
  "verb",
  "adj",
  "adv",
  "pron",
  "prep",
  "conj",
  "interj",
  "phrase",
] as const
export type DictPos = (typeof DICT_POS)[number]

/** Meanings kept per part of speech, and copied into a saved word. */
export const MAX_MEANINGS = 8

export type DictEntry = {
  headword: string
  pos: DictPos
  meanings: Array<string>
}
export type DictPhrase = { headword: string; meanings: Array<string> }
export type DictForm = { form: string; headword: string; pos: DictPos }

/** What lookup_word answers (spec 2 §4.1). */
export type LookupResult = {
  word: string
  entries: Array<DictEntry>
  phrases: Array<DictPhrase>
}
```

Buat `src/lib/words/dict-import.ts`:

```ts
// Extensions spelled out: Node runs this file for scripts/import-dictionary.ts
// and resolves nothing by itself.
import { MAX_WORD_LENGTH, normalizeWord } from "./normalize.ts"
import {
  type DictEntry,
  type DictForm,
  type DictPos,
  MAX_MEANINGS,
} from "./types.ts"

/** One wiktextract (kaikki.org) record, as far as the import reads it. */
type WiktTranslation = { code?: string; lang_code?: string; word?: string }
type WiktRecord = {
  word?: string
  lang_code?: string
  pos?: string
  forms?: Array<{ form?: string; tags?: Array<string> }>
  translations?: Array<WiktTranslation>
  senses?: Array<{
    form_of?: Array<{ word?: string }>
    translations?: Array<WiktTranslation>
  }>
}

/** Wiktionary's parts of speech that the popup shows, by the dictionary's names. */
const POS: Partial<Record<string, DictPos>> = {
  noun: "noun",
  verb: "verb",
  adj: "adj",
  adv: "adv",
  pron: "pron",
  prep: "prep",
  conj: "conj",
  intj: "interj",
  phrase: "phrase",
  prep_phrase: "phrase",
}
/** Inflection-table bookkeeping, not forms anyone reads. */
const SKIPPED_FORM_TAGS = new Set([
  "table-tags",
  "inflection-template",
  "class",
  "romanization",
])
const MAX_MEANING_LENGTH = 100

const keyOf = (headword: string, pos: DictPos) => `${headword}\t${pos}`

function cleanWord(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const word = normalizeWord(raw)
  return word.length > 0 && word.length <= MAX_WORD_LENGTH ? word : null
}

/** Translations into Indonesian, entry-level first, in Wiktionary's order. */
function indonesian(record: WiktRecord): Array<string> {
  const all = [
    ...(record.translations ?? []),
    ...(record.senses ?? []).flatMap((sense) => sense.translations ?? []),
  ]
  return all
    .filter((translation) => (translation.lang_code ?? translation.code) === "id")
    .map((translation) => translation.word?.trim() ?? "")
    .filter((word) => word.length > 0 && word.length <= MAX_MEANING_LENGTH)
}

/**
 * Builds the dictionary from wiktextract records (spec 2 §4.1): English
 * entries with their Indonesian translations, at most eight per part of
 * speech, and the forms that lead to them. Forms whose headword has no
 * meaning are dropped.
 */
export function createDictionaryBuilder() {
  const entries = new Map<string, DictEntry>()
  const forms = new Map<string, DictForm>()

  function addForm(form: string | null, headword: string | null, pos: DictPos) {
    if (!form || !headword || form === headword) return
    forms.set(`${form}\t${keyOf(headword, pos)}`, { form, headword, pos })
  }

  return {
    add(raw: unknown): void {
      if (typeof raw !== "object" || raw === null) return
      const record = raw as WiktRecord
      const pos = record.pos ? POS[record.pos] : undefined
      const headword = cleanWord(record.word)
      if (record.lang_code !== "en" || !pos || !headword) return

      const meanings = indonesian(record)
      if (meanings.length > 0) {
        const key = keyOf(headword, pos)
        const entry = entries.get(key) ?? { headword, pos, meanings: [] }
        for (const meaning of meanings) {
          if (
            entry.meanings.length < MAX_MEANINGS &&
            !entry.meanings.includes(meaning)
          ) {
            entry.meanings.push(meaning)
          }
        }
        entries.set(key, entry)
      }

      for (const { form, tags } of record.forms ?? []) {
        if (tags?.some((tag) => SKIPPED_FORM_TAGS.has(tag))) continue
        const clean = cleanWord(form)
        // "will run", "more beautiful": tenses built from a single word are not its forms.
        if (clean?.includes(" ") && !headword.includes(" ")) continue
        addForm(clean, headword, pos)
      }
      for (const sense of record.senses ?? []) {
        for (const base of sense.form_of ?? []) {
          addForm(headword, cleanWord(base.word), pos)
        }
      }
    },

    result(): {
      entries: Array<DictEntry>
      forms: Array<DictForm>
      phrases: number
    } {
      const list = [...entries.values()]
      return {
        entries: list,
        forms: [...forms.values()].filter((form) =>
          entries.has(keyOf(form.headword, form.pos))
        ),
        phrases: list.filter((entry) => entry.headword.includes(" ")).length,
      }
    },
  }
}
```

Buat `scripts/import-dictionary.ts`:

```ts
// Imports the dictionary (spec 2 §4.1) from a kaikki.org English extract:
//   node scripts/import-dictionary.ts <file.jsonl[.gz]> --env dev|prod [--dump-date YYYY-MM-DD] [--force]
// dev reads .env.local, prod reads .env.prod (both kept out of git). The rows
// go to staging tables first; dict_swap then replaces the dictionary in one
// transaction. Run by hand, never by CI (docs/ops/deploy.md §6.5).
import { createReadStream, existsSync } from "node:fs"
import { basename } from "node:path"
import { createInterface } from "node:readline"
import { parseArgs } from "node:util"
import { createGunzip } from "node:zlib"
import { createClient } from "@supabase/supabase-js"
import { createDictionaryBuilder } from "../src/lib/words/dict-import.ts"

const ENV_FILES = { dev: ".env.local", prod: ".env.prod" } as const
const BATCH = 1000
const USAGE =
  "Usage: node scripts/import-dictionary.ts <file.jsonl[.gz]> --env dev|prod [--dump-date YYYY-MM-DD] [--force]"

function stop(message: string): never {
  console.error(message)
  process.exit(1)
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: "string" },
    "dump-date": { type: "string" },
    force: { type: "boolean", default: false },
  },
})
const [file] = positionals
const envName = values.env
if (!file || (envName !== "dev" && envName !== "prod")) stop(USAGE)
const envFile = ENV_FILES[envName]
if (!existsSync(envFile)) stop(`Missing ${envFile}`)
process.loadEnvFile(envFile)
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) stop(`${envFile} needs SUPABASE_URL and SUPABASE_SECRET_KEY`)
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
console.log(`Target: ${new URL(url).host} (${envName})`)

const builder = createDictionaryBuilder()
const input = createReadStream(file)
const lines = createInterface({
  input: file.endsWith(".gz") ? input.pipe(createGunzip()) : input,
  crlfDelay: Infinity,
})
let read = 0
let unreadable = 0
for await (const line of lines) {
  if (!line.trim()) continue
  read += 1
  try {
    builder.add(JSON.parse(line))
  } catch {
    unreadable += 1
  }
  if (read % 200_000 === 0) console.log(`  ${read} records read`)
}
const { entries, forms, phrases } = builder.result()
console.log(
  `Read ${read} records (${unreadable} unreadable): ${entries.length} entries, ${forms.length} forms, ${phrases} phrasal verbs and phrases.`
)
if (entries.length === 0) stop("Nothing to import.")

async function check(
  step: string,
  request: PromiseLike<{ error: { message: string } | null }>
) {
  const { error } = await request
  if (error) stop(`${step} failed: ${error.message}`)
}

await check("Clearing the staging tables", supabase.rpc("dict_staging_reset"))
const tables = [
  ["dict_entries_staging", entries],
  ["dict_forms_staging", forms],
] as const
for (const [table, rows] of tables) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await check(
      `Loading ${table}`,
      supabase.from(table).insert(rows.slice(i, i + BATCH))
    )
  }
  console.log(`Loaded ${rows.length} rows into ${table}.`)
}

const { data, error } = await supabase.rpc("dict_swap", {
  p_source: basename(file),
  p_dump_date: values["dump-date"],
  p_force: values.force,
})
if (error) {
  stop(
    error.message === "shrunk"
      ? "The new dictionary has over 20% fewer entries than the last one. Check the file, or run again with --force."
      : `Swapping the dictionary failed: ${error.message}`
  )
}
console.log("Dictionary swapped in:", data)
```

Di `docs/ops/deploy.md`, sisipkan subbab ini tepat sebelum `## 7. Aturan migrasi`:

```markdown
### 6.5 Kamus

Arti kata di reader berasal dari English Wiktionary, lewat ekstrak kaikki.org (lisensi CC BY-SA). Selama kamus belum diimpor, semua kata tampil "Belum ada arti untuk kata ini". Skrip impor tidak dijalankan CI. Jalankan dari laptop setiap kali kamus perlu diperbarui, misalnya beberapa bulan sekali.

1. Unduh ekstrak semua kata bahasa Inggris dalam format JSONL dari [kaikki.org/dictionary/English](https://kaikki.org/dictionary/English/). Bagian unduhan ada di bawah halaman. Ukurannya beberapa GB, dan boleh tetap dalam bentuk `.gz`.
2. Pastikan migrasi kamus sudah ada di proyek tujuan (§7).
3. Jalankan, misalnya untuk dev:
   ```bash
   node scripts/import-dictionary.ts ~/Downloads/kaikki.org-dictionary-English.jsonl --env dev --dump-date 2026-10-20
   ```
   - `--env dev` memakai `.env.local`. `--env prod` memakai `.env.prod`, yang berisi `SUPABASE_URL` dan `SUPABASE_SECRET_KEY` proyek prod. File itu tidak boleh di-commit.
   - `--dump-date` adalah tanggal dump Wiktionary yang tertulis di halaman kaikki. Boleh dikosongkan.
4. Skrip mencetak jumlah entri, bentuk kata, dan phrasal verb, lalu menukar kamus dalam satu transaksi. Selama penukaran (beberapa detik), pencarian arti menunggu.
5. Kalau jumlah entri turun lebih dari 20% dari impor sebelumnya, skrip berhenti tanpa mengubah kamus. Periksa file-nya dulu. Kalau memang benar, ulangi dengan `--force`.
6. Cek hasilnya di SQL editor: `select * from dict_meta;`
```

- [ ] **Step 4: Jalankan test dan pemeriksaan, pastikan lolos**

Run: `npx vitest run src/lib/words/dict-import.test.ts`
Expected: 7 test PASS.

Run: `npm run typecheck && npx eslint scripts/import-dictionary.ts src/lib/words`
Expected: PASS.

Coba skrip dengan file kecil (tanpa menukar kamus, karena `--env` tidak valid):

Run: `node scripts/import-dictionary.ts missing.jsonl`
Expected: pesan `Usage: node scripts/import-dictionary.ts …`, exit code 1.

- [ ] **Step 5: Commit**

```bash
git add src/lib/words/types.ts src/lib/words/dict-import.ts src/lib/words/dict-import.test.ts scripts/import-dictionary.ts docs/ops/deploy.md
git commit -m "feat(words): import the Wiktionary dictionary from a kaikki extract"
```

---

### Task 4: Tabel kata tersimpan dan fungsinya

**Files:**
- Create: `supabase/migrations/20261024000200_saved_words.sql`
- Modify: `tests/db/helpers.ts` (tambah `newTestBook`)
- Test: `tests/db/saved-words.test.ts`
- Regenerate: `src/server/database.types.ts`

**Interfaces:**
- Consumes: `dict_forms` (Task 2); fixture kamus (Task 2).
- Produces:
  - Tabel `saved_words (id, user_id, headword, pos, meanings, book_id, book_title, sentence, cfi, created_at)`, unik per (`user_id`, `headword`).
  - `save_word(p_headword text, p_pos text default null, p_meanings text[] default '{}', p_book_id uuid default null, p_sentence text default '', p_cfi text default null) returns text` (argumen opsional dikirim `undefined`, bukan `null`, karena tipe hasil `db:types` tidak menerima `null`) → `'ok'` atau `'limit_reached'`; error `invalid` (buku milik user lain) atau `not_authenticated`.
  - `delete_word(p_headword text) returns void`.
  - `saved_word_forms() returns jsonb` → `{ "<headword>": ["<bentuk>", …] }`, bentuk termasuk headword-nya sendiri.
  - `tests/db/helpers.ts`: `newTestBook(userId: string, options?: { ready?: boolean; title?: string }): Promise<string>`.

- [ ] **Step 1: Tulis helper dan test yang gagal**

Di `tests/db/helpers.ts`, tambahkan import dan fungsi di akhir file:

```ts
import { createHash, randomUUID } from "node:crypto"
```

```ts
/** A book on the member's shelf (ready unless asked otherwise), reserved as the server does. */
export async function newTestBook(
  userId: string,
  options: { ready?: boolean; title?: string } = {}
): Promise<string> {
  const bookId = randomUUID()
  const admin = adminClient()
  const { error } = await admin
    .rpc("reserve_book_upload", {
      p_user_id: userId,
      p_book_id: bookId,
      p_sha256: createHash("sha256").update(bookId).digest("hex"),
      p_epub_bytes: 1000,
      p_title: options.title ?? "Buku Uji",
      p_author: "Penulis Uji",
      p_subjects: [],
    })
    .single()
  if (error) throw error
  if (options.ready ?? true) {
    const { error: readyError } = await admin
      .from("books")
      .update({ status: "ready" })
      .eq("id", bookId)
    if (readyError) throw readyError
  }
  return bookId
}
```

Buat `tests/db/saved-words.test.ts`:

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
  createTestMember,
  deleteTestMembers,
  forgetTestMember,
  newTestBook,
  signedInClient,
} from "./helpers"

const run = Date.now().toString(36)
const emails = {
  ani: `db-words-ani-${run}@glosa.test`,
  budi: `db-words-budi-${run}@glosa.test`,
  cita: `db-words-cita-${run}@glosa.test`,
}
type Client = Awaited<ReturnType<typeof signedInClient>>

function save(
  client: Client,
  headword: string,
  context: { bookId?: string | null; sentence?: string } = {}
) {
  return client.rpc("save_word", {
    p_headword: headword,
    p_pos: "verb",
    p_meanings: ["berlari"],
    p_book_id: context.bookId ?? undefined,
    p_sentence: context.sentence ?? "",
    p_cfi: "epubcfi(/6/4!/4/2/1:0)",
  })
}

async function rowOf(userId: string, headword: string) {
  const { data, error } = await adminClient()
    .from("saved_words")
    .select("book_id, book_title, sentence, meanings")
    .eq("user_id", userId)
    .eq("headword", headword)
    .maybeSingle()
  if (error) throw error
  return data
}

describe("saved words", () => {
  const fixture = dictionaryFixture(fixturePrefix())
  const ids = { ani: "", budi: "", cita: "" }
  const books = { ani: "", budi: "" }
  let ani: Client
  let budi: Client

  beforeAll(async () => {
    ids.ani = (await createTestMember({ email: emails.ani })).id
    ids.budi = (await createTestMember({ email: emails.budi })).id
    ids.cita = (await createTestMember({ email: emails.cita })).id
    books.ani = await newTestBook(ids.ani, { title: "Petualangan Ani" })
    books.budi = await newTestBook(ids.budi)
    ani = await signedInClient(emails.ani)
    budi = await signedInClient(emails.budi)
    await seedDictionary(fixture)
  })

  afterAll(async () => {
    await removeDictionary(fixture)
    await deleteTestMembers()
  })

  it("saves a word once and keeps its first context", async () => {
    const first = await save(ani, "holmes", {
      bookId: books.ani,
      sentence: "Holmes smiled.",
    })
    expect(first).toMatchObject({ data: "ok", error: null })
    const again = await save(ani, "holmes", { sentence: "Another sentence." })
    expect(again).toMatchObject({ data: "ok", error: null })
    expect(await rowOf(ids.ani, "holmes")).toEqual({
      book_id: books.ani,
      book_title: "Petualangan Ani",
      sentence: "Holmes smiled.",
      meanings: ["berlari"],
    })
  })

  it("refuses another member's book", async () => {
    const { error } = await save(ani, "watson", { bookId: books.budi })
    expect(error?.message).toBe("invalid")
    expect(await rowOf(ids.ani, "watson")).toBeNull()
  })

  it("keeps a word whose book is already gone, without the book", async () => {
    const gone = "00000000-0000-4000-8000-000000000000"
    const { data } = await save(ani, "lestrade", { bookId: gone })
    expect(data).toBe("ok")
    expect(await rowOf(ids.ani, "lestrade")).toMatchObject({
      book_id: null,
      book_title: null,
    })
  })

  it("deletes a word, and deleting it again is fine", async () => {
    await save(ani, "moriarty")
    expect(
      (await ani.rpc("delete_word", { p_headword: "moriarty" })).error
    ).toBeNull()
    expect(await rowOf(ids.ani, "moriarty")).toBeNull()
    expect(
      (await ani.rpc("delete_word", { p_headword: "moriarty" })).error
    ).toBeNull()
  })

  it("stops at 5,000 words", async () => {
    const cita = await signedInClient(emails.cita)
    const rows = Array.from({ length: 4999 }, (_, i) => ({
      user_id: ids.cita,
      headword: `kata${i}`,
    }))
    const { error } = await adminClient().from("saved_words").insert(rows)
    expect(error).toBeNull()
    expect((await save(cita, "terakhir")).data).toBe("ok")
    expect((await save(cita, "kelebihan")).data).toBe("limit_reached")
    // A word already there still answers ok.
    expect((await save(cita, "terakhir")).data).toBe("ok")
  })

  it("lists each saved word's forms for the underline", async () => {
    await save(ani, fixture.run)
    const { data, error } = await ani.rpc("saved_word_forms")
    expect(error).toBeNull()
    const forms = data as Record<string, Array<string>>
    expect([...forms[fixture.run]].sort()).toEqual(
      [fixture.ran, fixture.run, fixture.running].sort()
    )
    expect(forms.holmes).toEqual(["holmes"])
  })

  it("shows members only their own words, and writes go through the functions", async () => {
    const { data } = await budi.from("saved_words").select("headword")
    expect(data).toEqual([])
    const insert = await budi
      .from("saved_words")
      .insert({ user_id: ids.budi, headword: "langsung" })
    expect(insert.error).not.toBeNull()
  })

  it("keeps the words when their book is deleted", async () => {
    const bookId = await newTestBook(ids.ani, { title: "Buku Sementara" })
    await save(ani, "irene", { bookId })
    const { error } = await adminClient().from("books").delete().eq("id", bookId)
    expect(error).toBeNull()
    expect(await rowOf(ids.ani, "irene")).toMatchObject({
      book_id: null,
      book_title: "Buku Sementara",
    })
  })

  it("removes everything with the account", async () => {
    expect((await save(budi, "mycroft")).data).toBe("ok")
    const { error } = await adminClient().auth.admin.deleteUser(ids.budi)
    expect(error).toBeNull()
    forgetTestMember(ids.budi)
    const { count } = await adminClient()
      .from("saved_words")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ids.budi)
    expect(count).toBe(0)
  })
})
```

Test "shows members only their own words" berjalan sebelum Budi menyimpan apa pun, jadi daftarnya kosong. Test terakhir menyimpan satu kata untuk Budi dulu, supaya cascade benar-benar terbukti.

- [ ] **Step 2: Tulis migrasi**

Buat `supabase/migrations/20261024000200_saved_words.sql`:

```sql
-- Saved words (spec 2 §4.2): one row per member and headword, with the
-- meanings copied from the dictionary and the sentence it was found in.
-- Members read their own rows; writes go through save_word and delete_word.
create table public.saved_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  headword text not null check (char_length(headword) between 1 and 64),
  pos text check (
    pos in ('noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'conj', 'interj', 'phrase')
  ),
  meanings text[] not null default '{}' check (cardinality(meanings) <= 8),
  -- The words stay when their book goes (spec 2 §2, decision 8).
  book_id uuid references public.books (id) on delete set null,
  book_title text check (char_length(book_title) <= 300),
  sentence text not null default '' check (char_length(sentence) <= 500),
  cfi text check (char_length(cfi) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (user_id, headword)
);

create index saved_words_book_id_idx on public.saved_words (book_id);

alter table public.saved_words enable row level security;

create policy saved_words_select_own on public.saved_words
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.saved_words from anon, authenticated;
grant select on table public.saved_words to authenticated;

-- Saves a word unless the member has it already, in which case its first
-- context stays and the answer is still 'ok' (the queue may send it twice).
-- At most 5,000 words: the profile row is locked so two saves cannot both
-- pass the limit. The book's title is read from the member's own book; a book
-- gone in the meantime leaves the word without one.
-- Defaults, so the generated types let callers leave the optional ones out.
create function public.save_word(
  p_headword text,
  p_pos text default null,
  p_meanings text[] default '{}',
  p_book_id uuid default null,
  p_sentence text default '',
  p_cfi text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_book_id uuid;
  v_title text;
  v_owner uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  perform 1 from public.profiles pr where pr.id = v_user_id for update;
  if not found then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.saved_words s
    where s.user_id = v_user_id and s.headword = p_headword
  ) then
    return 'ok';
  end if;
  if (select count(*) from public.saved_words s where s.user_id = v_user_id) >= 5000 then
    return 'limit_reached';
  end if;

  if p_book_id is not null then
    select b.user_id, b.title into v_owner, v_title
    from public.books b
    where b.id = p_book_id;
    if found and v_owner <> v_user_id then
      raise exception 'invalid' using errcode = 'P0001';
    end if;
    if found then
      v_book_id := p_book_id;
    end if;
  end if;

  insert into public.saved_words (
    user_id, headword, pos, meanings, book_id, book_title, sentence, cfi
  ) values (
    v_user_id, p_headword, p_pos, coalesce(p_meanings, '{}'), v_book_id,
    left(v_title, 300), coalesce(p_sentence, ''), p_cfi
  );
  return 'ok';
end;
$$;

create function public.delete_word(p_headword text)
returns void
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
  delete from public.saved_words s
  where s.user_id = v_user_id and s.headword = p_headword;
end;
$$;

-- Every form of the member's saved words, for the underline in books (spec 2
-- §6.5). One jsonb object, not rows: PostgREST stops at 1,000 rows.
create function public.saved_word_forms()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(w.headword, w.forms), '{}'::jsonb)
  from (
    select
      s.headword,
      to_jsonb(array(
        select f.form from public.dict_forms f where f.headword = s.headword
        union
        select s.headword
      )) as forms
    from public.saved_words s
    where s.user_id = (select auth.uid())
  ) w
$$;

revoke execute on function public.save_word(text, text, text[], uuid, text, text)
  from public, anon;
grant execute on function public.save_word(text, text, text[], uuid, text, text)
  to authenticated;
revoke execute on function public.delete_word(text) from public, anon;
grant execute on function public.delete_word(text) to authenticated;
revoke execute on function public.saved_word_forms() from public, anon;
grant execute on function public.saved_word_forms() to authenticated;
```

- [ ] **Step 3: Push migrasi dan buat ulang tipe**

Run: `npm run db:push && npm run db:types && npx prettier --write src/server/database.types.ts`
Expected: migrasi `20261024000200_saved_words.sql` diterapkan; `database.types.ts` memuat `saved_words`, `save_word`, `delete_word`, `saved_word_forms`.

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run --config vitest.db.config.ts tests/db/saved-words.test.ts tests/db/dictionary.test.ts`
Expected: semua PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261024000200_saved_words.sql src/server/database.types.ts tests/db/helpers.ts tests/db/saved-words.test.ts
git commit -m "feat(db): saved words with their first context, a 5,000 limit and their forms"
```

---

### Task 5: Skema operasi kata dan server function

**Files:**
- Modify: `src/lib/words/types.ts` (tambah di akhir file)
- Create: `src/lib/words/schemas.ts`
- Create: `src/server/words.ts`
- Test: `src/lib/words/schemas.test.ts`

**Interfaces:**
- Consumes: `DICT_POS`, `MAX_MEANINGS`, `LookupResult` (Task 3); `MAX_WORD_LENGTH` (Task 1); `MAX_CFI_LENGTH` dari `src/lib/progress.ts`; fungsi SQL (Task 2, 4).
- Produces (di `src/lib/words/types.ts`):
  - `MAX_SAVED_WORDS = 5000`, `MAX_WORD_OPS = 50`, `MAX_SENTENCE_LENGTH = 500`
  - `type SavedWord = { headword; pos: DictPos | null; meanings: Array<string>; bookId: string | null; bookTitle: string | null; sentence: string; cfi: string | null; createdAt: string }`
  - `type WordOp = { kind: "save"; headword; pos; meanings; bookId; sentence; cfi } | { kind: "delete"; headword }`
  - `type WordOpResult = "ok" | "limit_reached" | "invalid"`
  - `type LookupAnswer`, `WordSyncAnswer`, `SavedWordsAnswer`, `SavedFormsAnswer` (masing-masing `{ ok: true; … } | { ok: false; code: string }`)
- Produces (di `src/lib/words/schemas.ts`): `LookupRequestSchema`, `WordOpSchema`, `WordSyncSchema`, `isValidWordOp(op: WordOp): boolean`.
- Produces (di `src/server/words.ts`):
  - `lookupWordFn({ data: { word: string; next: Array<string> } }): Promise<LookupAnswer>` (GET)
  - `syncSavedWordsFn({ data: { ops: Array<WordOp> } }): Promise<WordSyncAnswer>` (POST), satu hasil per operasi, urutan sama.
  - `listSavedWordsFn(): Promise<SavedWordsAnswer>` (GET), terbaru di atas.
  - `savedWordFormsFn(): Promise<SavedFormsAnswer>` (GET).

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/words/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { LookupRequestSchema, isValidWordOp } from "./schemas"
import type { WordOp } from "./types"

const save: WordOp = {
  kind: "save",
  headword: "run",
  pos: "verb",
  meanings: ["berlari"],
  bookId: "0f9f5c1e-8a4b-4c2e-9d3a-1b2c3d4e5f60",
  sentence: "He ran.",
  cfi: "epubcfi(/6/4!/4/2/1:0)",
}

describe("isValidWordOp", () => {
  it("accepts a save and a delete the server will take", () => {
    expect(isValidWordOp(save)).toBe(true)
    expect(isValidWordOp({ ...save, pos: null, bookId: null, cfi: null })).toBe(
      true
    )
    expect(isValidWordOp({ kind: "delete", headword: "run" })).toBe(true)
  })

  it("refuses what the database would refuse", () => {
    expect(isValidWordOp({ ...save, headword: "" })).toBe(false)
    expect(isValidWordOp({ ...save, headword: "a".repeat(65) })).toBe(false)
    expect(isValidWordOp({ ...save, sentence: "a".repeat(501) })).toBe(false)
    expect(isValidWordOp({ ...save, meanings: Array(9).fill("arti") })).toBe(
      false
    )
    expect(isValidWordOp({ ...save, cfi: "c".repeat(2001) })).toBe(false)
    expect(isValidWordOp({ ...save, bookId: "bukan-uuid" })).toBe(false)
  })
})

describe("LookupRequestSchema", () => {
  it("takes a word and at most two next words", () => {
    expect(
      LookupRequestSchema.safeParse({ word: "gave", next: ["up", "on"] })
        .success
    ).toBe(true)
    expect(
      LookupRequestSchema.safeParse({ word: "gave", next: ["up", "on", "it"] })
        .success
    ).toBe(false)
    expect(LookupRequestSchema.safeParse({ word: "", next: [] }).success).toBe(
      false
    )
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/words/schemas.test.ts`
Expected: FAIL, modul `./schemas` tidak ditemukan.

- [ ] **Step 3: Implementasi**

Tambahkan di akhir `src/lib/words/types.ts`:

```ts
export const MAX_SAVED_WORDS = 5000
/** Changes sent in one request (spec 2 §4.2). */
export const MAX_WORD_OPS = 50
export const MAX_SENTENCE_LENGTH = 500

/** A word in Kosakata (spec 2 §4.2), as the server and this device keep it. */
export type SavedWord = {
  headword: string
  pos: DictPos | null
  meanings: Array<string>
  bookId: string | null
  /** Copied from the book when saved; stays after the book is deleted. */
  bookTitle: string | null
  sentence: string
  cfi: string | null
  createdAt: string
}

/** One change to Kosakata, as it travels to the server. */
export type WordOp =
  | {
      kind: "save"
      headword: string
      pos: DictPos | null
      meanings: Array<string>
      bookId: string | null
      sentence: string
      cfi: string | null
    }
  | { kind: "delete"; headword: string }

export type WordOpResult = "ok" | "limit_reached" | "invalid"

type Failed = { ok: false; code: string }
export type LookupAnswer = { ok: true; result: LookupResult } | Failed
export type WordSyncAnswer =
  | { ok: true; results: Array<WordOpResult> }
  | Failed
export type SavedWordsAnswer = { ok: true; words: Array<SavedWord> } | Failed
/** Every form of every saved word, by headword (the headword included). */
export type SavedFormsAnswer =
  | { ok: true; forms: Record<string, Array<string>> }
  | Failed
```

Buat `src/lib/words/schemas.ts`:

```ts
import { z } from "zod"
import { MAX_CFI_LENGTH } from "@/lib/progress"
import { MAX_WORD_LENGTH } from "./normalize"
import {
  DICT_POS,
  MAX_MEANINGS,
  MAX_SENTENCE_LENGTH,
  MAX_WORD_OPS,
  type WordOp,
} from "./types"

const Word = z.string().min(1).max(MAX_WORD_LENGTH)

export const LookupRequestSchema = z.object({
  word: Word,
  next: z.array(Word).max(2),
})

export const WordOpSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("save"),
    headword: Word,
    pos: z.enum(DICT_POS).nullable(),
    meanings: z.array(z.string().min(1).max(200)).max(MAX_MEANINGS),
    bookId: z.uuid().nullable(),
    sentence: z.string().max(MAX_SENTENCE_LENGTH),
    cfi: z.string().min(1).max(MAX_CFI_LENGTH).nullable(),
  }),
  z.object({ kind: z.literal("delete"), headword: Word }),
])

export const WordSyncSchema = z.object({
  ops: z.array(WordOpSchema).min(1).max(MAX_WORD_OPS),
})

/**
 * Whether the server will take this change. One it would refuse never enters
 * the queue: a bad change in a batch would hold up every change behind it.
 */
export function isValidWordOp(op: WordOp): boolean {
  return WordOpSchema.safeParse(op).success
}
```

Buat `src/server/words.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { LookupRequestSchema, WordSyncSchema } from "@/lib/words/schemas"
import type {
  DictPos,
  LookupAnswer,
  LookupResult,
  SavedFormsAnswer,
  SavedWord,
  SavedWordsAnswer,
  WordOp,
  WordOpResult,
  WordSyncAnswer,
} from "@/lib/words/types"
import type { Database } from "./database.types"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })
/** PostgREST answers at most this many rows at once. */
const PAGE = 1000

type SavedWordRow = Pick<
  Database["public"]["Tables"]["saved_words"]["Row"],
  | "headword"
  | "pos"
  | "meanings"
  | "book_id"
  | "book_title"
  | "sentence"
  | "cfi"
  | "created_at"
>

const toSavedWord = (row: SavedWordRow): SavedWord => ({
  headword: row.headword,
  pos: row.pos as DictPos | null,
  meanings: row.meanings,
  bookId: row.book_id,
  bookTitle: row.book_title,
  sentence: row.sentence,
  cfi: row.cfi,
  createdAt: row.created_at,
})

/**
 * The meanings of a tapped word (spec 2 §4.1), through the server like every
 * other call: there is no Supabase client in the browser. Tahap 5 counts the
 * daily taps here.
 */
export const lookupWordFn = createServerFn({ method: "GET" })
  .validator((data: { word: string; next: Array<string> }) =>
    LookupRequestSchema.parse(data)
  )
  .handler(async ({ data }): Promise<LookupAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data: result, error } = await supabase.rpc("lookup_word", {
      p_word: data.word,
      p_next: data.next,
    })
    if (error) {
      logServerError("lookup_word failed", error)
      return fail("unknown")
    }
    return { ok: true, result: result as unknown as LookupResult }
  })

/**
 * Applies the changes waiting on a device, in order (spec 2 §4.2). Each one is
 * idempotent, so a batch cut short by an error is simply sent again.
 */
export const syncSavedWordsFn = createServerFn({ method: "POST" })
  .validator((data: { ops: Array<WordOp> }) => WordSyncSchema.parse(data))
  .handler(async ({ data }): Promise<WordSyncAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const results: Array<WordOpResult> = []
    for (const op of data.ops) {
      const { data: answer, error } =
        op.kind === "save"
          ? await supabase.rpc("save_word", {
              p_headword: op.headword,
              p_pos: op.pos ?? undefined,
              p_meanings: op.meanings,
              p_book_id: op.bookId ?? undefined,
              p_sentence: op.sentence,
              p_cfi: op.cfi ?? undefined,
            })
          : await supabase.rpc("delete_word", { p_headword: op.headword })
      if (error) {
        // Another member's book, or a value the table's checks refuse.
        if (error.message === "invalid" || error.code === "23514") {
          results.push("invalid")
          continue
        }
        if (error.message === "not_authenticated") {
          return fail("not_authenticated")
        }
        logServerError("saving a word failed", error)
        return fail("unknown")
      }
      results.push(answer === "limit_reached" ? "limit_reached" : "ok")
    }
    return { ok: true, results }
  })

/** Kosakata, newest first, read a page at a time (up to 5,000 words). */
export const listSavedWordsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SavedWordsAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const words: Array<SavedWord> = []
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await supabase
        .from("saved_words")
        .select(
          "headword, pos, meanings, book_id, book_title, sentence, cfi, created_at"
        )
        .order("created_at", { ascending: false })
        .order("headword")
        .range(from, from + PAGE - 1)
      if (error) {
        logServerError("listing saved words failed", error)
        return fail("unknown")
      }
      words.push(...rows.map(toSavedWord))
      if (rows.length < PAGE) return { ok: true, words }
    }
  }
)

/** Every form of the saved words, for the underline in books (spec 2 §6.5). */
export const savedWordFormsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SavedFormsAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { data, error } = await supabase.rpc("saved_word_forms")
    if (error) {
      logServerError("saved_word_forms failed", error)
      return fail("unknown")
    }
    return { ok: true, forms: data as unknown as Record<string, Array<string>> }
  }
)
```

- [ ] **Step 4: Jalankan test dan pemeriksaan, pastikan lolos**

Run: `npx vitest run src/lib/words/schemas.test.ts`
Expected: 3 test PASS.

Run: `npm run typecheck && npx eslint src/server/words.ts src/lib/words`
Expected: PASS. Kalau TypeScript menolak destrukturisasi `data: answer` dari dua RPC yang tipenya berbeda, pisahkan jadi dua cabang `if (op.kind === "save") { … } else { … }` yang masing-masing mengisi `answer` dan `error`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/words/types.ts src/lib/words/schemas.ts src/lib/words/schemas.test.ts src/server/words.ts
git commit -m "feat(words): server functions to look words up and sync Kosakata"
```

---

### Task 6: Dexie versi 2 dan cache arti

**Files:**
- Modify: `src/lib/local/db.ts`
- Modify: `src/lib/local/device.ts` (`wipeMemberData`)
- Create: `src/lib/local/lookups.ts`
- Create: `src/lib/words/lookup.ts`
- Test: `src/lib/local/lookups.test.ts`
- Test: `src/lib/words/lookup.test.ts`

**Interfaces:**
- Consumes: `LookupResult`, `LookupAnswer`, `SavedWord`, `DictPos`, `MAX_MEANINGS` (Task 3, 5); `lookupWordFn` (Task 5); `reportError` dari `src/lib/sentry-client.ts`.
- Produces:
  - Dexie: tabel `lookups` (`key, word, usedAt`), `words` (`headword, createdAt`), `wordOps` (`headword, queuedAt`); tipe `LocalLookup` dan `LocalWordOp = { headword: string; kind: "save" | "delete"; word: SavedWord | null; queuedAt: number }`.
  - `src/lib/local/lookups.ts`: `LOOKUP_CACHE_LIMIT = 2000`; `getCachedLookup(word, next, now?)`; `getCachedWord(word)`; `putCachedLookup(word, next, result, now?, limit?)`.
  - `src/lib/words/lookup.ts`:
    - `type LookupOutcome = { kind: "result"; result: LookupResult } | { kind: "offline" } | { kind: "failed" }`
    - `lookUp(word: string, next: Array<string>, deps?: LookupDeps): Promise<LookupOutcome>`, tidak pernah reject.
    - `type SavedChoice = { headword: string; pos: DictPos | null; meanings: Array<string> }`
    - `savedChoice(result: LookupResult | null, tapped: string): SavedChoice`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/local/lookups.test.ts`:

```ts
// @vitest-environment node
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import type { LookupResult } from "@/lib/words/types"
import { localDb } from "./db"
import { clearLocalData } from "./device"
import { getCachedLookup, getCachedWord, putCachedLookup } from "./lookups"

const result = (word: string, phrase = false): LookupResult => ({
  word,
  entries: [{ headword: word, pos: "verb", meanings: ["arti"] }],
  phrases: phrase ? [{ headword: `${word} up`, meanings: ["frasa"] }] : [],
})

beforeEach(async () => {
  await clearLocalData()
})

describe("lookup cache", () => {
  it("answers a word with the same next words, and marks it used", async () => {
    await putCachedLookup("gave", ["up"], result("gave", true), 1)
    expect(await getCachedLookup("gave", ["up"], 5)).toEqual(
      result("gave", true)
    )
    expect(await getCachedLookup("gave", ["in"])).toBeNull()
    expect((await localDb().lookups.get("gave up"))?.usedAt).toBe(5)
  })

  it("offers any lookup of the word for offline, without its phrases", async () => {
    await putCachedLookup("gave", ["up"], result("gave", true), 1)
    expect(await getCachedWord("gave")).toEqual(result("gave"))
    expect(await getCachedWord("took")).toBeNull()
  })

  it("keeps at most the limit, dropping the least recently used", async () => {
    await putCachedLookup("a", [], result("a"), 1, 2)
    await putCachedLookup("b", [], result("b"), 2, 2)
    await getCachedLookup("a", [], 3)
    await putCachedLookup("c", [], result("c"), 4, 2)
    expect(
      (await localDb().lookups.toCollection().primaryKeys()).sort()
    ).toEqual(["a", "c"])
  })

  it("is cleared with the member's data", async () => {
    await putCachedLookup("a", [], result("a"), 1)
    await clearLocalData()
    expect(await localDb().lookups.count()).toBe(0)
  })
})
```

Buat `src/lib/words/lookup.test.ts`:

```ts
// @vitest-environment node
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearLocalData } from "@/lib/local/device"
import { putCachedLookup } from "@/lib/local/lookups"
import { reportError } from "@/lib/sentry-client"
import { lookUp, savedChoice } from "./lookup"
import type { LookupAnswer, LookupResult } from "./types"

vi.mock("@/server/words", () => ({ lookupWordFn: vi.fn() }))
vi.mock("@/lib/sentry-client", () => ({ reportError: vi.fn() }))

const ran: LookupResult = {
  word: "ran",
  entries: [
    { headword: "run", pos: "verb", meanings: ["berlari", "menjalankan"] },
    { headword: "run", pos: "noun", meanings: ["lari", "berlari"] },
    { headword: "ran", pos: "noun", meanings: ["nama"] },
  ],
  phrases: [],
}
const empty: LookupResult = { word: "zzz", entries: [], phrases: [] }

function deps(answer: LookupAnswer | Error, online = true) {
  return {
    fetch: vi.fn(() =>
      answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
    ),
    isOnline: () => online,
  }
}

beforeEach(async () => {
  await clearLocalData()
  vi.mocked(reportError).mockClear()
})

describe("lookUp", () => {
  it("answers from this device without asking the server", async () => {
    await putCachedLookup("ran", [], ran)
    const source = deps({ ok: true, result: empty })
    expect(await lookUp("ran", [], source)).toEqual({
      kind: "result",
      result: ran,
    })
    expect(source.fetch).not.toHaveBeenCalled()
  })

  it("asks the server and keeps the answer, an empty one too", async () => {
    const source = deps({ ok: true, result: empty })
    expect(await lookUp("zzz", [], source)).toEqual({
      kind: "result",
      result: empty,
    })
    expect(source.fetch).toHaveBeenCalledWith("zzz", [])
    const offline = deps(new TypeError("Failed to fetch"), false)
    expect(await lookUp("zzz", [], offline)).toEqual({
      kind: "result",
      result: empty,
    })
  })

  it("offline, another lookup of the word stands in, else it needs a connection", async () => {
    await putCachedLookup("ran", ["up"], ran)
    const offline = deps({ ok: true, result: empty }, false)
    expect(await lookUp("ran", ["away"], offline)).toEqual({
      kind: "result",
      result: ran,
    })
    expect(await lookUp("took", [], offline)).toEqual({ kind: "offline" })
    expect(offline.fetch).not.toHaveBeenCalled()
  })

  it("counts a connection lost on the way as offline", async () => {
    expect(
      await lookUp("took", [], deps(new TypeError("Failed to fetch")))
    ).toEqual({ kind: "offline" })
    expect(reportError).not.toHaveBeenCalled()
  })

  it("reports a server error", async () => {
    expect(
      await lookUp("took", [], deps({ ok: false, code: "unknown" }))
    ).toEqual({ kind: "failed" })
    expect(reportError).toHaveBeenCalledOnce()
  })
})

describe("savedChoice", () => {
  it("saves the phrase shown first", () => {
    const withPhrase = {
      ...ran,
      phrases: [{ headword: "run up", meanings: ["menaikkan"] }],
    }
    expect(savedChoice(withPhrase, "ran")).toEqual({
      headword: "run up",
      pos: "phrase",
      meanings: ["menaikkan"],
    })
  })

  it("otherwise saves the base form with its meanings, without repeats", () => {
    expect(savedChoice(ran, "ran")).toEqual({
      headword: "run",
      pos: "verb",
      meanings: ["berlari", "menjalankan", "lari"],
    })
  })

  it("otherwise saves the word as tapped", () => {
    expect(savedChoice(empty, "zzz")).toEqual({
      headword: "zzz",
      pos: null,
      meanings: [],
    })
    expect(savedChoice(null, "took")).toEqual({
      headword: "took",
      pos: null,
      meanings: [],
    })
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/local/lookups.test.ts src/lib/words/lookup.test.ts`
Expected: FAIL, modul `./lookups` dan `./lookup` tidak ditemukan.

- [ ] **Step 3: Implementasi**

Di `src/lib/local/db.ts`, tambahkan import dan tipe di atas `class GlosaDb`:

```ts
import type { LookupResult, SavedWord } from "@/lib/words/types"
```

```ts
/** A word's meanings as the server gave them, keyed by the word and the next ones (spec 2 §5). */
export type LocalLookup = {
  key: string
  word: string
  result: LookupResult
  usedAt: number
}

/** A change to Kosakata the server does not have yet: one per word, the latest wins. */
export type LocalWordOp = {
  headword: string
  kind: "save" | "delete"
  /** The word as saved; null for a deletion. */
  word: SavedWord | null
  queuedAt: number
}
```

Di dalam `class GlosaDb`, tambahkan properti sesudah `meta!: …`:

```ts
  lookups!: EntityTable<LocalLookup, "key">
  words!: EntityTable<SavedWord, "headword">
  wordOps!: EntityTable<LocalWordOp, "headword">
```

dan di constructor, sesudah blok `this.version(1)…`:

```ts
    // Tahap 2A: the meanings cache, Kosakata and its queue (spec 2 §5).
    this.version(2).stores({
      lookups: "key, word, usedAt",
      words: "headword, createdAt",
      wordOps: "headword, queuedAt",
    })
```

Di `src/lib/local/device.ts`, ganti komentar dan transaksi di awal `wipeMemberData`:

```ts
/** Drops the member's books, positions, Kosakata, shelf snapshot, cached covers and reader settings. */
async function wipeMemberData(): Promise<void> {
  const db = localDb()
  const tables = [
    db.files,
    db.positions,
    db.meta,
    db.lookups,
    db.words,
    db.wordOps,
  ]
  await db.transaction("rw", tables, async () => {
    await Promise.all(tables.map((table) => table.clear()))
  })
```

Bagian `localStorage` dan `caches` di bawahnya tetap.

Buat `src/lib/local/lookups.ts`:

```ts
import type { LookupResult } from "@/lib/words/types"
import { localDb } from "./db"

/** Words whose meanings stay on this device; the least recently used go first (spec 2 §5). */
export const LOOKUP_CACHE_LIMIT = 2000

/** Phrasal verbs depend on the next words, so they are part of the key. */
const keyOf = (word: string, next: ReadonlyArray<string>) =>
  [word, ...next].join(" ")

export async function getCachedLookup(
  word: string,
  next: ReadonlyArray<string>,
  now = Date.now()
): Promise<LookupResult | null> {
  const db = localDb()
  const row = await db.lookups.get(keyOf(word, next))
  if (!row) return null
  await db.lookups.update(row.key, { usedAt: now })
  return row.result
}

/** Offline: any lookup of the same word. Its meanings hold; its phrases may not. */
export async function getCachedWord(word: string): Promise<LookupResult | null> {
  const row = await localDb().lookups.where("word").equals(word).first()
  return row ? { ...row.result, phrases: [] } : null
}

export async function putCachedLookup(
  word: string,
  next: ReadonlyArray<string>,
  result: LookupResult,
  now = Date.now(),
  limit = LOOKUP_CACHE_LIMIT
): Promise<void> {
  const db = localDb()
  await db.transaction("rw", db.lookups, async () => {
    await db.lookups.put({ key: keyOf(word, next), word, result, usedAt: now })
    const extra = (await db.lookups.count()) - limit
    if (extra > 0) {
      const oldest = await db.lookups.orderBy("usedAt").limit(extra).primaryKeys()
      await db.lookups.bulkDelete(oldest)
    }
  })
}
```

Buat `src/lib/words/lookup.ts`:

```ts
import {
  getCachedLookup,
  getCachedWord,
  putCachedLookup,
} from "@/lib/local/lookups"
import { reportError } from "@/lib/sentry-client"
import { lookupWordFn } from "@/server/words"
import {
  type DictPos,
  type LookupAnswer,
  type LookupResult,
  MAX_MEANINGS,
} from "./types"

export type LookupOutcome =
  | { kind: "result"; result: LookupResult }
  /** A new word without a connection: "Arti butuh koneksi". */
  | { kind: "offline" }
  | { kind: "failed" }

export type LookupDeps = {
  fetch: (word: string, next: Array<string>) => Promise<LookupAnswer>
  isOnline: () => boolean
}

const browserDeps: LookupDeps = {
  fetch: (word, next) => lookupWordFn({ data: { word, next } }),
  isOnline: () => navigator.onLine,
}

/** IndexedDB can fail (private mode, a full disk): the lookup goes on without it. */
async function quietly<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work()
  } catch {
    return fallback
  }
}

/**
 * A word's meanings (spec 2 §5, §7): this device's cache first, then the
 * server, whose answer (an empty one too) is kept for offline. Never rejects.
 */
export async function lookUp(
  word: string,
  next: Array<string>,
  deps: LookupDeps = browserDeps
): Promise<LookupOutcome> {
  const cached = await quietly(() => getCachedLookup(word, next), null)
  if (cached) return { kind: "result", result: cached }

  const offline = async (): Promise<LookupOutcome> => {
    const same = await quietly(() => getCachedWord(word), null)
    return same ? { kind: "result", result: same } : { kind: "offline" }
  }
  if (!deps.isOnline()) return offline()

  let answer: LookupAnswer
  try {
    answer = await deps.fetch(word, next)
  } catch (error) {
    // The connection can drop while the request is in flight.
    if (!deps.isOnline() || error instanceof TypeError) return offline()
    reportError(error)
    return { kind: "failed" }
  }
  if (!answer.ok) {
    reportError(new Error(`lookup_word answered ${answer.code}`))
    return { kind: "failed" }
  }
  const result = answer.result
  await quietly(() => putCachedLookup(word, next, result), undefined)
  return { kind: "result", result }
}

export type SavedChoice = {
  headword: string
  pos: DictPos | null
  meanings: Array<string>
}

/**
 * What Simpan keeps (spec 2 §6.3): the phrase shown first, else the base form
 * with the meanings of all its parts of speech, else the word as tapped.
 */
export function savedChoice(
  result: LookupResult | null,
  tapped: string
): SavedChoice {
  const phrase = result?.phrases.at(0)
  if (phrase) {
    return {
      headword: phrase.headword,
      pos: "phrase",
      meanings: phrase.meanings.slice(0, MAX_MEANINGS),
    }
  }
  const first = result?.entries.at(0)
  if (!result || !first) return { headword: tapped, pos: null, meanings: [] }
  const meanings = result.entries
    .filter((entry) => entry.headword === first.headword)
    .flatMap((entry) => entry.meanings)
  return {
    headword: first.headword,
    pos: first.pos,
    meanings: [...new Set(meanings)].slice(0, MAX_MEANINGS),
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run src/lib/local src/lib/words/lookup.test.ts`
Expected: semua PASS, termasuk `src/lib/local/local.test.ts` yang sudah ada.

- [ ] **Step 5: Commit**

```bash
git add src/lib/local/db.ts src/lib/local/device.ts src/lib/local/lookups.ts src/lib/local/lookups.test.ts src/lib/words/lookup.ts src/lib/words/lookup.test.ts
git commit -m "feat(words): look words up through a cache that works offline"
```

---

### Task 7: Salinan Kosakata, antrean, dan cache bentuk kata di perangkat

**Files:**
- Create: `src/lib/words/word-sync.ts` (di task ini hanya tipe `QueuedWordOp` dan `WordStore`; mesinnya di Task 8)
- Create: `src/lib/local/saved-words.ts`
- Test: `src/lib/local/saved-words.test.ts`

**Interfaces:**
- Consumes: tabel Dexie `words`, `wordOps`, `meta` dan `LocalWordOp` (Task 6); `SavedWord` (Task 5).
- Produces:
  - Di `src/lib/words/word-sync.ts`:
    - `type QueuedWordOp = LocalWordOp`
    - `type WordStore = { save(word: SavedWord, forms: Array<string>): Promise<void>; remove(headword: string): Promise<void>; pending(): Promise<Array<QueuedWordOp>>; confirm(sent: ReadonlyArray<QueuedWordOp>): Promise<void>; revert(op: QueuedWordOp): Promise<void> }`
  - Di `src/lib/local/saved-words.ts`:
    - `type FormsByHeadword = Record<string, Array<string>>`
    - `listLocalWords(): Promise<Array<SavedWord>>` (terbaru di atas)
    - `localHeadwords(): Promise<Set<string>>`
    - `replaceLocalWords(words: Array<SavedWord>): Promise<void>`
    - `loadSavedForms(): Promise<FormsByHeadword>`
    - `saveSavedForms(forms: FormsByHeadword): Promise<void>`
    - `localWordStore: WordStore`

- [ ] **Step 1: Tulis tipe antrean dan test yang gagal**

Buat `src/lib/words/word-sync.ts`:

```ts
import type { LocalWordOp } from "@/lib/local/db"
import type { SavedWord } from "./types"

/** A change waiting for the server; `queuedAt` tells a later change of the same word apart. */
export type QueuedWordOp = LocalWordOp

/** Where Kosakata and its waiting changes live (IndexedDB in the browser). */
export type WordStore = {
  /** Shows the word at once and queues its save; `forms` underline it until the server's arrive. */
  save: (word: SavedWord, forms: Array<string>) => Promise<void>
  /** Hides the word at once and queues its deletion. */
  remove: (headword: string) => Promise<void>
  /** Oldest first. */
  pending: () => Promise<Array<QueuedWordOp>>
  /** Drops sent changes, unless the word changed again since. */
  confirm: (sent: ReadonlyArray<QueuedWordOp>) => Promise<void>
  /** Takes back a save the server refused, unless the word changed again since. */
  revert: (op: QueuedWordOp) => Promise<void>
}
```

Buat `src/lib/local/saved-words.test.ts`:

```ts
// @vitest-environment node
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import type { SavedWord } from "@/lib/words/types"
import { localDb } from "./db"
import { clearLocalData } from "./device"
import {
  listLocalWords,
  loadSavedForms,
  localHeadwords,
  localWordStore,
  replaceLocalWords,
  saveSavedForms,
} from "./saved-words"

const word = (headword: string, minute = 0): SavedWord => ({
  headword,
  pos: "verb",
  meanings: ["arti"],
  bookId: null,
  bookTitle: "Buku Uji",
  sentence: `Kalimat dengan ${headword}.`,
  cfi: null,
  createdAt: new Date(Date.UTC(2026, 9, 24, 8, minute)).toISOString(),
})

beforeEach(async () => {
  await clearLocalData()
})

describe("Kosakata on this device", () => {
  it("shows a saved word at once and queues it", async () => {
    await localWordStore.save(word("run"), ["ran"])
    expect(await localHeadwords()).toEqual(new Set(["run"]))
    expect(await loadSavedForms()).toEqual({ run: ["run", "ran"] })
    const pending = await localWordStore.pending()
    expect(pending.map(({ headword, kind }) => [headword, kind])).toEqual([
      ["run", "save"],
    ])
  })

  it("keeps one waiting change per word, the latest", async () => {
    await localWordStore.save(word("run"), [])
    await localWordStore.remove("run")
    expect(await listLocalWords()).toEqual([])
    expect(await loadSavedForms()).toEqual({})
    const pending = await localWordStore.pending()
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({ headword: "run", kind: "delete" })
  })

  it("keeps a change made after the batch was sent", async () => {
    await localWordStore.save(word("run"), [])
    const sent = await localWordStore.pending()
    await localWordStore.remove("run")
    await localWordStore.confirm(sent)
    expect((await localWordStore.pending()).map((op) => op.kind)).toEqual([
      "delete",
    ])
    await localWordStore.confirm(await localWordStore.pending())
    expect(await localWordStore.pending()).toEqual([])
  })

  it("takes back a refused save, unless the word changed again", async () => {
    await localWordStore.save(word("run"), [])
    const [op] = await localWordStore.pending()
    await localWordStore.confirm([op])
    await localWordStore.revert(op)
    expect(await listLocalWords()).toEqual([])
    expect(await loadSavedForms()).toEqual({})

    await localWordStore.save(word("walk"), [])
    const [first] = await localWordStore.pending()
    await localWordStore.save(word("walk", 1), [])
    await localWordStore.revert(first)
    expect(await localHeadwords()).toEqual(new Set(["walk"]))
  })

  it("lays this device's waiting changes over the server's list", async () => {
    await localWordStore.save(word("new", 3), [])
    await localWordStore.remove("gone")
    await replaceLocalWords([word("gone", 1), word("kept", 2)])
    expect((await listLocalWords()).map((w) => w.headword)).toEqual([
      "new",
      "kept",
    ])
  })

  it("keeps the server's forms, with waiting changes laid over them", async () => {
    await localWordStore.save(word("new"), ["newer"])
    await localWordStore.remove("gone")
    await saveSavedForms({ gone: ["gone", "went"], kept: ["kept"] })
    expect(await loadSavedForms()).toEqual({
      kept: ["kept"],
      new: ["new", "newer"],
    })
  })

  it("is cleared with the member's data", async () => {
    await localWordStore.save(word("run"), [])
    await clearLocalData()
    expect(await localDb().words.count()).toBe(0)
    expect(await localDb().wordOps.count()).toBe(0)
    expect(await loadSavedForms()).toEqual({})
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/local/saved-words.test.ts`
Expected: FAIL, modul `./saved-words` tidak ditemukan.

- [ ] **Step 3: Implementasi**

Buat `src/lib/local/saved-words.ts`:

```ts
import type { SavedWord } from "@/lib/words/types"
import type { WordStore } from "@/lib/words/word-sync"
import { localDb } from "./db"

/** Every form of every saved word, by headword: what the books underline (spec 2 §6.5). */
export type FormsByHeadword = Record<string, Array<string>>

const FORMS_KEY = "saved-forms"

// Two changes of a word within one millisecond still get different stamps,
// so confirm() never drops the later one.
let lastStamp = 0
function stamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1)
  return lastStamp
}

/** Kosakata on this device, newest first. */
export async function listLocalWords(): Promise<Array<SavedWord>> {
  return localDb().words.orderBy("createdAt").reverse().toArray()
}

export async function localHeadwords(): Promise<Set<string>> {
  return new Set(await localDb().words.toCollection().primaryKeys())
}

export async function loadSavedForms(): Promise<FormsByHeadword> {
  const row = await localDb().meta.get(FORMS_KEY)
  return (row?.value as FormsByHeadword | undefined) ?? {}
}

async function changeForms(
  change: (forms: FormsByHeadword) => FormsByHeadword
): Promise<void> {
  await localDb().meta.put({
    key: FORMS_KEY,
    value: change(await loadSavedForms()),
  })
}

const without = (forms: FormsByHeadword, headword: string): FormsByHeadword =>
  Object.fromEntries(Object.entries(forms).filter(([key]) => key !== headword))

/** The server's list, with this device's waiting changes laid over it (spec 2 §7). */
export async function replaceLocalWords(words: Array<SavedWord>): Promise<void> {
  const db = localDb()
  await db.transaction("rw", db.words, db.wordOps, async () => {
    const ops = await db.wordOps.toArray()
    await db.words.clear()
    await db.words.bulkPut(words)
    for (const op of ops) {
      if (op.kind === "save" && op.word) await db.words.put(op.word)
      else await db.words.delete(op.headword)
    }
  })
}

/** The server's forms, with this device's waiting changes laid over them. */
export async function saveSavedForms(forms: FormsByHeadword): Promise<void> {
  const db = localDb()
  await db.transaction("rw", db.wordOps, db.meta, async () => {
    const local = await loadSavedForms()
    let merged = forms
    for (const op of await db.wordOps.toArray()) {
      merged =
        op.kind === "save"
          ? {
              ...merged,
              [op.headword]: merged[op.headword] ??
                local[op.headword] ?? [op.headword],
            }
          : without(merged, op.headword)
    }
    await db.meta.put({ key: FORMS_KEY, value: merged })
  })
}

/** Kosakata in IndexedDB: a change shows at once and waits for the server in wordOps. */
export const localWordStore: WordStore = {
  async save(word, forms) {
    const db = localDb()
    await db.transaction("rw", db.words, db.wordOps, db.meta, async () => {
      await db.words.put(word)
      await db.wordOps.put({
        headword: word.headword,
        kind: "save",
        word,
        queuedAt: stamp(),
      })
      await changeForms((all) => ({
        ...all,
        [word.headword]: [...new Set([word.headword, ...forms])],
      }))
    })
  },

  async remove(headword) {
    const db = localDb()
    await db.transaction("rw", db.words, db.wordOps, db.meta, async () => {
      await db.words.delete(headword)
      await db.wordOps.put({
        headword,
        kind: "delete",
        word: null,
        queuedAt: stamp(),
      })
      await changeForms((all) => without(all, headword))
    })
  },

  pending: () => localDb().wordOps.orderBy("queuedAt").toArray(),

  async confirm(sent) {
    const db = localDb()
    await db.transaction("rw", db.wordOps, async () => {
      for (const op of sent) {
        const row = await db.wordOps.get(op.headword)
        if (row?.queuedAt === op.queuedAt) await db.wordOps.delete(op.headword)
      }
    })
  },

  async revert(op) {
    if (op.kind !== "save") return
    const db = localDb()
    await db.transaction("rw", db.words, db.wordOps, db.meta, async () => {
      if (await db.wordOps.get(op.headword)) return
      await db.words.delete(op.headword)
      await changeForms((all) => without(all, op.headword))
    })
  },
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run src/lib/local`
Expected: semua PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/words/word-sync.ts src/lib/local/saved-words.ts src/lib/local/saved-words.test.ts
git commit -m "feat(words): keep Kosakata and its waiting changes on the device"
```

---

### Task 8: Mesin sinkron kata dan pemicunya

**Files:**
- Modify: `src/lib/words/word-sync.ts` (tambah mesin di bawah tipe dari Task 7)
- Create: `src/lib/words/word-sync-client.ts`
- Modify: `src/lib/progress-sync-client.ts` (`leaveDevice`)
- Modify: `src/routes/_member.tsx`
- Test: `src/lib/words/word-sync.test.ts`

**Interfaces:**
- Consumes: `WordStore`, `QueuedWordOp` (Task 7); `localWordStore`, `listLocalWords`, `localHeadwords`, `loadSavedForms`, `saveSavedForms`, `FormsByHeadword` (Task 7); `isValidWordOp` (Task 5); `syncSavedWordsFn`, `savedWordFormsFn` (Task 5); `MAX_WORD_OPS`, `SavedWord`, `WordOp`, `WordSyncAnswer` (Task 5).
- Produces:
  - Di `src/lib/words/word-sync.ts`:
    - `type WordRejection = { code: "words_full" | "word_invalid"; headword: string }` (`code` adalah kunci `bookMessage`, Task 12)
    - `type SendWords = (ops: Array<WordOp>) => Promise<WordSyncAnswer>`
    - `type WordSync = { save(word, forms): Promise<void>; remove(headword): Promise<void>; flush(): Promise<void>; version(): number; notify(): void; rejection(): WordRejection | null; dismissRejection(): void; subscribe(listener): () => void; dispose(): void }`
    - `toWordOp(op: QueuedWordOp): WordOp`
    - `createWordSync(options: { store: WordStore; send: SendWords; isOnline: () => boolean; onSynced?: () => Promise<void>; debounceMs?: number }): WordSync`
  - Di `src/lib/words/word-sync-client.ts`:
    - `wordSync(): WordSync` (satu per tab)
    - `refreshSavedForms(): Promise<void>` (tidak pernah reject)
    - `useWordFlush(): void`
    - `useVocabularyVersion(): number`
    - `useSavedHeadwords(): ReadonlySet<string>`
    - `useSavedForms(): FormsByHeadword`
    - `useLocalWords(initial: Array<SavedWord>): Array<SavedWord>`
    - `useWordRejection(): WordRejection | null`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/words/word-sync.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SavedWord, WordOp, WordSyncAnswer } from "./types"
import { type QueuedWordOp, type WordStore, createWordSync } from "./word-sync"

/** The same rules as localWordStore, in memory. */
function memoryStore() {
  const words = new Map<string, SavedWord>()
  const ops = new Map<string, QueuedWordOp>()
  let clock = 0
  const store: WordStore = {
    save: async (word) => {
      words.set(word.headword, word)
      ops.set(word.headword, {
        headword: word.headword,
        kind: "save",
        word,
        queuedAt: ++clock,
      })
    },
    remove: async (headword) => {
      words.delete(headword)
      ops.set(headword, {
        headword,
        kind: "delete",
        word: null,
        queuedAt: ++clock,
      })
    },
    pending: async () =>
      [...ops.values()].sort((a, b) => a.queuedAt - b.queuedAt),
    confirm: async (sent) => {
      for (const op of sent) {
        if (ops.get(op.headword)?.queuedAt === op.queuedAt) {
          ops.delete(op.headword)
        }
      }
    },
    revert: async (op) => {
      if (op.kind === "save" && !ops.has(op.headword)) words.delete(op.headword)
    },
  }
  return { words, ops, store }
}

const word = (headword: string): SavedWord => ({
  headword,
  pos: "verb",
  meanings: ["berlari"],
  bookId: null,
  bookTitle: null,
  sentence: "He ran.",
  cfi: null,
  createdAt: "2026-10-24T08:00:00.000Z",
})

const allOk = async (sent: Array<WordOp>): Promise<WordSyncAnswer> => ({
  ok: true,
  results: sent.map(() => "ok"),
})

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createWordSync", () => {
  it("shows a save at once and sends it two seconds after the last change", async () => {
    const { words, store } = memoryStore()
    const send = vi.fn(allOk)
    const sync = createWordSync({ store, send, isOnline: () => true })
    const listener = vi.fn()
    sync.subscribe(listener)

    await sync.save(word("run"), ["ran"])
    expect(words.has("run")).toBe(true)
    expect(listener).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_999)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledWith([
      {
        kind: "save",
        headword: "run",
        pos: "verb",
        meanings: ["berlari"],
        bookId: null,
        sentence: "He ran.",
        cfi: null,
      },
    ])
  })

  it("sends only the latest change of a word", async () => {
    const { store } = memoryStore()
    const send = vi.fn(allOk)
    const sync = createWordSync({ store, send, isOnline: () => true })
    await sync.save(word("run"), [])
    await sync.remove("run")
    await vi.advanceTimersByTimeAsync(2_000)
    expect(send).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith([{ kind: "delete", headword: "run" }])
  })

  it("takes back a save the server refuses as full, and says why", async () => {
    const { words, ops, store } = memoryStore()
    const send = vi.fn(
      async (): Promise<WordSyncAnswer> => ({
        ok: true,
        results: ["limit_reached"],
      })
    )
    const sync = createWordSync({ store, send, isOnline: () => true })
    await sync.save(word("run"), [])
    const before = sync.version()
    await sync.flush()
    expect(words.has("run")).toBe(false)
    expect(ops.size).toBe(0)
    expect(sync.rejection()).toEqual({ code: "words_full", headword: "run" })
    expect(sync.version()).toBeGreaterThan(before)
    sync.dismissRejection()
    expect(sync.rejection()).toBeNull()
  })

  it("refuses a word the server would refuse, without queueing it", async () => {
    const { ops, store } = memoryStore()
    const sync = createWordSync({ store, send: allOk, isOnline: () => true })
    await sync.save({ ...word("run"), sentence: "a".repeat(501) }, [])
    expect(ops.size).toBe(0)
    expect(sync.rejection()).toEqual({ code: "word_invalid", headword: "run" })
  })

  it("keeps changes that could not be sent for the next flush", async () => {
    const { ops, store } = memoryStore()
    const send = vi
      .fn<(sent: Array<WordOp>) => Promise<WordSyncAnswer>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: false, code: "unknown" })
      .mockImplementation(allOk)
    const sync = createWordSync({ store, send, isOnline: () => true })
    await sync.save(word("run"), [])
    await sync.flush()
    expect(ops.size).toBe(1)
    await sync.flush()
    expect(ops.size).toBe(1)
    await sync.flush()
    expect(ops.size).toBe(0)
  })

  it("waits while offline", async () => {
    const { ops, store } = memoryStore()
    const send = vi.fn(allOk)
    const sync = createWordSync({ store, send, isOnline: () => false })
    await sync.save(word("run"), [])
    await sync.flush()
    expect(send).not.toHaveBeenCalled()
    expect(ops.size).toBe(1)
  })

  it("fetches the forms again after the server took changes", async () => {
    const { store } = memoryStore()
    const onSynced = vi.fn(async () => {})
    const sync = createWordSync({
      store,
      send: allOk,
      isOnline: () => true,
      onSynced,
    })
    await sync.flush()
    expect(onSynced).not.toHaveBeenCalled()
    await sync.save(word("run"), [])
    await sync.flush()
    expect(onSynced).toHaveBeenCalledOnce()
  })

  it("sends at most 50 changes per request", async () => {
    const { store } = memoryStore()
    const send = vi.fn(allOk)
    const sync = createWordSync({ store, send, isOnline: () => true })
    for (let i = 0; i < 51; i++) await sync.remove(`w${i}`)
    await sync.flush()
    expect(send.mock.calls.map(([sent]) => sent.length)).toEqual([50, 1])
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/words/word-sync.test.ts`
Expected: FAIL, `createWordSync` tidak diekspor.

- [ ] **Step 3: Implementasi**

Di `src/lib/words/word-sync.ts`, ganti import di atas file:

```ts
import type { LocalWordOp } from "@/lib/local/db"
import { isValidWordOp } from "./schemas"
import {
  MAX_WORD_OPS,
  type SavedWord,
  type WordOp,
  type WordSyncAnswer,
} from "./types"
```

dan tambahkan di bawah tipe `WordStore`:

```ts
/** A change the server refused, shown until dismissed. `code` is a bookMessage key. */
export type WordRejection = {
  code: "words_full" | "word_invalid"
  headword: string
}

export type SendWords = (ops: Array<WordOp>) => Promise<WordSyncAnswer>

export type WordSync = {
  save: (word: SavedWord, forms: Array<string>) => Promise<void>
  remove: (headword: string) => Promise<void>
  /** Sends every waiting change now. Never rejects. */
  flush: () => Promise<void>
  /** Grows on every change to Kosakata on this device, so views read it again. */
  version: () => number
  /** For changes made beside the queue, such as the server's forms arriving. */
  notify: () => void
  rejection: () => WordRejection | null
  dismissRejection: () => void
  subscribe: (listener: () => void) => () => void
  dispose: () => void
}

export function toWordOp(op: QueuedWordOp): WordOp {
  if (op.kind === "delete" || !op.word) {
    return { kind: "delete", headword: op.headword }
  }
  const { headword, pos, meanings, bookId, sentence, cfi } = op.word
  return { kind: "save", headword, pos, meanings, bookId, sentence, cfi }
}

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
  const { store, send, isOnline } = options
  const debounceMs = options.debounceMs ?? 2_000
  const listeners = new Set<() => void>()
  let version = 0
  let rejection: WordRejection | null = null
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

  function refuse(code: WordRejection["code"], headword: string) {
    rejection = { code, headword }
    changed()
  }

  /** Sends the waiting changes until a batch fails; the next trigger retries. */
  async function sendWaiting() {
    if (!isOnline()) return
    const waiting = await store.pending()
    let delivered = false
    try {
      for (let i = 0; i < waiting.length; i += MAX_WORD_OPS) {
        const batch = waiting.slice(i, i + MAX_WORD_OPS)
        let answer: WordSyncAnswer
        try {
          answer = await send(batch.map(toWordOp))
        } catch {
          return
        }
        if (!answer.ok) return
        await store.confirm(batch)
        delivered = true
        for (const [index, result] of answer.results.entries()) {
          if (result === "ok") continue
          const op = batch[index]
          await store.revert(op)
          refuse(
            result === "limit_reached" ? "words_full" : "word_invalid",
            op.headword
          )
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
      changed()
      later()
    },
    async remove(headword) {
      await store.remove(headword)
      changed()
      later()
    },
    flush,
    version: () => version,
    notify: changed,
    rejection: () => rejection,
    dismissRejection() {
      if (!rejection) return
      rejection = null
      changed()
    },
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

Buat `src/lib/words/word-sync-client.ts`:

```ts
import { useEffect, useState, useSyncExternalStore } from "react"
import {
  type FormsByHeadword,
  listLocalWords,
  loadSavedForms,
  localHeadwords,
  localWordStore,
  saveSavedForms,
} from "@/lib/local/saved-words"
import { savedWordFormsFn, syncSavedWordsFn } from "@/server/words"
import type { SavedWord } from "./types"
import { type WordRejection, type WordSync, createWordSync } from "./word-sync"

let engine: WordSync | null = null

/** The one word sync of this tab (browser only). */
export function wordSync(): WordSync {
  engine ??= createWordSync({
    store: localWordStore,
    isOnline: () => navigator.onLine,
    send: (ops) => syncSavedWordsFn({ data: { ops } }),
    onSynced: refreshSavedForms,
  })
  return engine
}

/**
 * Fetches the forms of every saved word, words saved on other devices too,
 * and keeps them for offline. Without a connection the device's copy stays.
 */
export async function refreshSavedForms(): Promise<void> {
  try {
    const answer = await savedWordFormsFn()
    if (!answer.ok) return
    await saveSavedForms(answer.forms)
    wordSync().notify()
  } catch (error) {
    console.error("fetching the saved words' forms failed", error)
  }
}

/** Sends waiting changes when the app opens and when the connection comes back (spec 2 §7). */
export function useWordFlush(): void {
  useEffect(() => {
    const sync = wordSync()
    void sync.flush()
    const onOnline = () => void sync.flush()
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [])
}

export function useVocabularyVersion(): number {
  return useSyncExternalStore(
    (listener) => wordSync().subscribe(listener),
    () => wordSync().version(),
    () => 0
  )
}

/** Reads this device's copy on mount and again after every change to Kosakata. */
function useLocal<T>(read: () => Promise<T>, initial: T): T {
  const version = useVocabularyVersion()
  const [value, setValue] = useState(initial)
  useEffect(() => {
    let live = true
    read()
      .then((next) => {
        if (live) setValue(next)
      })
      .catch((error: unknown) =>
        console.error("reading Kosakata on this device failed", error)
      )
    return () => {
      live = false
    }
  }, [read, version])
  return value
}

const NO_HEADWORDS: ReadonlySet<string> = new Set()
const NO_FORMS: FormsByHeadword = {}

export function useSavedHeadwords(): ReadonlySet<string> {
  return useLocal<ReadonlySet<string>>(localHeadwords, NO_HEADWORDS)
}

export function useSavedForms(): FormsByHeadword {
  return useLocal(loadSavedForms, NO_FORMS)
}

/**
 * Kosakata as the loader gave it, then as this device keeps it once anything
 * changes. Not read on mount: after a server render the device's copy may be
 * older than the loader's list until the page has stored it.
 */
export function useLocalWords(initial: Array<SavedWord>): Array<SavedWord> {
  const version = useVocabularyVersion()
  const [state, setState] = useState({ version, words: initial })
  useEffect(() => {
    if (version === state.version) return
    let live = true
    listLocalWords()
      .then((words) => {
        if (live) setState({ version, words })
      })
      .catch((error: unknown) =>
        console.error("reading Kosakata on this device failed", error)
      )
    return () => {
      live = false
    }
  }, [version, state.version])
  return state.words
}

export function useWordRejection(): WordRejection | null {
  useVocabularyVersion()
  return wordSync().rejection()
}
```

Di `src/lib/progress-sync-client.ts`, tambahkan import:

```ts
import { wordSync } from "./words/word-sync-client"
```

dan ganti `leaveDevice` beserta komentarnya:

```ts
/**
 * Before signing out: send the positions and word changes still waiting (for
 * a few seconds at most), then wipe this device's copies (plan 1C, decision 6).
 */
export async function leaveDevice(): Promise<void> {
  await Promise.race([
    Promise.all([progressSync().flush(), wordSync().flush()]).catch(
      () => undefined
    ),
    new Promise((resolve) => setTimeout(resolve, LEAVE_FLUSH_MS)),
  ])
  await clearLocalData()
}
```

Di `src/routes/_member.tsx`, tambahkan import dan panggilan sesudah `useProgressFlush()`:

```ts
import { useWordFlush } from "@/lib/words/word-sync-client"
```

```ts
  useProgressFlush()
  useWordFlush()
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run src/lib src/components/member`
Expected: semua PASS.

Run: `npm run typecheck && npm run lint && npm run check`
Expected: PASS (jalankan `npm run format` dulu bila `check` mengeluh soal format).

- [ ] **Step 5: Commit**

```bash
git add src/lib/words/word-sync.ts src/lib/words/word-sync.test.ts src/lib/words/word-sync-client.ts src/lib/progress-sync-client.ts src/routes/_member.tsx
git commit -m "feat(words): send saved and deleted words in the background, offline first"
```

---

### Task 9: `wordAt`, kata di titik ketuk

**Files:**
- Create: `src/lib/words/word-at.ts`
- Test: `src/lib/words/word-at.test.ts`

**Interfaces:**
- Consumes: `normalizeWord`, `isLookupWord` (Task 1); `MAX_SENTENCE_LENGTH` (Task 5).
- Produces:
  - `wordBounds(text: string, offset: number): { start: number; end: number } | null`
  - `sentenceAround(text: string, start: number, end: number, max?: number): string`
  - `nextWords(text: string, end: number, count?: number): Array<string>` (sudah dinormalisasi)
  - `type WordHit = { word: string; range: Range; sentence: string; next: Array<string> }`
  - `wordAt(doc: Document, x: number, y: number): WordHit | null`, dengan `x`, `y` dalam koordinat dokumen section. `null` bila ketukan jatuh di spasi, di margin, di angka, atau di kata yang bukan huruf Latin.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/words/word-at.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest"
import { nextWords, sentenceAround, wordAt, wordBounds } from "./word-at"

describe("wordBounds", () => {
  const text = "Mr. Holmes, the well-known detective."

  it("finds the word around a caret inside it or just after it", () => {
    expect(wordBounds(text, 5)).toEqual({ start: 4, end: 10 })
    expect(wordBounds(text, 10)).toEqual({ start: 4, end: 10 })
  })

  it("keeps a hyphenated word whole", () => {
    expect(wordBounds(text, 22)).toEqual({ start: 16, end: 26 })
  })

  it("finds nothing between spaces and punctuation", () => {
    expect(wordBounds("a , b", 2)).toBeNull()
  })

  it("leaves quotes at the edges out", () => {
    expect(wordBounds("'yes'", 2)).toEqual({ start: 1, end: 4 })
  })
})

describe("sentenceAround", () => {
  const around = (text: string, word: string) => {
    const start = text.indexOf(word)
    return sentenceAround(text, start, start + word.length)
  }

  it("takes the sentence between the stops", () => {
    expect(around("He sat down. Watson stood up! Then", "Watson")).toBe(
      "Watson stood up!"
    )
  })

  it("does not stop at Mr. and the like", () => {
    expect(around("Mr. Holmes sat down. Watson stood.", "Holmes")).toBe(
      "Mr. Holmes sat down."
    )
  })

  it("keeps the closing quote with its sentence", () => {
    const text = '"Come in!" said Holmes. Watson entered.'
    expect(around(text, "Come")).toBe('"Come in!"')
    expect(around(text, "said")).toBe("said Holmes.")
  })

  it("cuts a long sentence to 500 characters around the word", () => {
    const text = `${"kata ".repeat(300)}target ${"kata ".repeat(300)}`
    const sentence = around(text, "target")
    expect(sentence.length).toBeLessThanOrEqual(500)
    expect(sentence).toContain("target")
  })
})

describe("nextWords", () => {
  const after = (text: string, word: string) =>
    nextWords(text, text.indexOf(word) + word.length)

  it("takes the next two words of the paragraph", () => {
    expect(after("He Gave Up on it.", "Gave")).toEqual(["up", "on"])
  })

  it("stops at punctuation", () => {
    expect(after("He gave it. Then", "it")).toEqual([])
    expect(after("He gave, up", "gave")).toEqual([])
  })
})

describe("wordAt", () => {
  const restore: Array<() => void> = []
  function stub(target: object, name: string, value: unknown) {
    Object.defineProperty(target, name, { configurable: true, value })
    restore.push(() => Reflect.deleteProperty(target, name))
  }
  afterEach(() => {
    for (const undo of restore.splice(0)) undo()
  })

  const box = { left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 }

  /** A paragraph with a caret at `offset` of its first text node. */
  function page(html: string, offset: number) {
    document.body.innerHTML = html
    const text = document.querySelector("p")?.firstChild as Text
    stub(document, "caretPositionFromPoint", undefined)
    stub(document, "caretRangeFromPoint", () => {
      const range = document.createRange()
      range.setStart(text, offset)
      return range
    })
    stub(Range.prototype, "getClientRects", () => [box])
    return { doc: document, text }
  }

  it("takes the tapped word, its sentence and the next two words", () => {
    const { doc } = page(
      "<p>Mr. Holmes <i>smiled</i> at the well-known detective.</p>",
      5
    )
    expect(wordAt(doc, 10, 10)).toMatchObject({
      word: "holmes",
      sentence: "Mr. Holmes smiled at the well-known detective.",
      next: ["smiled", "at"],
    })
  })

  it("prefers caretPositionFromPoint where the browser has it", () => {
    const { doc, text } = page("<p>Holmes smiled.</p>", 0)
    stub(doc, "caretPositionFromPoint", () => ({ offsetNode: text, offset: 9 }))
    expect(wordAt(doc, 10, 10)?.word).toBe("smiled")
  })

  it("misses a tap outside the word's box, as in the margin", () => {
    const { doc } = page("<p>Holmes smiled.</p>", 6)
    expect(wordAt(doc, 300, 10)).toBeNull()
  })

  it("ignores numbers", () => {
    const { doc } = page("<p>In 1890 he left.</p>", 4)
    expect(wordAt(doc, 10, 10)).toBeNull()
  })

  it("finds nothing without a caret", () => {
    const { doc } = page("<p>Holmes</p>", 0)
    stub(doc, "caretRangeFromPoint", () => null)
    expect(wordAt(doc, 10, 10)).toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/words/word-at.test.ts`
Expected: FAIL, modul `./word-at` tidak ditemukan.

- [ ] **Step 3: Implementasi**

Buat `src/lib/words/word-at.ts`:

```ts
import { isLookupWord, normalizeWord } from "./normalize"
import { MAX_SENTENCE_LENGTH } from "./types"

/** Letters, marks and digits, with apostrophes and hyphens inside a word. */
const WORD_CHAR = /[\p{L}\p{M}\p{N}'’-]/u
const EDGE_CHAR = /['’-]/u
const TERMINALS = new Set([".", "!", "?", "…"])
const CLOSERS = /["'”’)\]]/u
/** Periods that do not end a sentence: "Mr. Holmes". */
const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "st",
  "jr",
  "sr",
  "prof",
  "rev",
  "mt",
  "vs",
  "etc",
])
/** Elements whose text makes one paragraph for the sentence and the next words. */
const BLOCKS =
  "p, li, blockquote, dd, dt, td, th, h1, h2, h3, h4, h5, h6, figcaption, pre, div"
/** How far outside a word's box a tap still counts, in pixels. */
const SLOP = 1

export type Bounds = { start: number; end: number }

/** The word around a caret at `offset`, or null on a space or punctuation. */
export function wordBounds(text: string, offset: number): Bounds | null {
  let at = offset
  if (!WORD_CHAR.test(text.charAt(at))) at -= 1
  if (at < 0 || !WORD_CHAR.test(text.charAt(at))) return null
  let start = at
  while (start > 0 && WORD_CHAR.test(text.charAt(start - 1))) start -= 1
  let end = at + 1
  while (end < text.length && WORD_CHAR.test(text.charAt(end))) end += 1
  while (start < end && EDGE_CHAR.test(text.charAt(start))) start += 1
  while (end > start && EDGE_CHAR.test(text.charAt(end - 1))) end -= 1
  return start < end ? { start, end } : null
}

/** Whether the stop at `index` ends a sentence: not "Mr.", and followed by a space or the end. */
function endsSentence(text: string, index: number): boolean {
  if (text.charAt(index) === ".") {
    const before = /(\p{L}+)$/u.exec(text.slice(Math.max(0, index - 8), index))
    if (before && ABBREVIATIONS.has(before[1].toLowerCase())) return false
  }
  let next = index + 1
  while (next < text.length && CLOSERS.test(text.charAt(next))) next += 1
  return next >= text.length || /\s/u.test(text.charAt(next))
}

/**
 * The sentence holding text[start, end) (spec 2 §6.2): from the last stop
 * before it to the first after it, or the paragraph's edges, cut to `max`
 * characters around the word.
 */
export function sentenceAround(
  text: string,
  start: number,
  end: number,
  max = MAX_SENTENCE_LENGTH
): string {
  let from = 0
  for (let i = start - 1; i >= 0; i -= 1) {
    if (TERMINALS.has(text.charAt(i)) && endsSentence(text, i)) {
      from = i + 1
      while (from < start && CLOSERS.test(text.charAt(from))) from += 1
      break
    }
  }
  let to = text.length
  for (let i = end; i < text.length; i += 1) {
    if (TERMINALS.has(text.charAt(i)) && endsSentence(text, i)) {
      to = i + 1
      while (to < text.length && CLOSERS.test(text.charAt(to))) to += 1
      break
    }
  }
  if (to - from > max) {
    from = Math.max(from, Math.min(Math.round((start + end - max) / 2), to - max))
    to = Math.min(to, from + max)
  }
  return text.slice(from, to).replace(/\s+/gu, " ").trim()
}

/** Up to `count` words right after text[end] in the paragraph, for phrasal verbs (spec 2 §6.2). */
export function nextWords(text: string, end: number, count = 2): Array<string> {
  const words: Array<string> = []
  let rest = text.slice(end, end + 200)
  while (words.length < count) {
    const match = /^\s+([\p{L}\p{M}'’-]+)/u.exec(rest)
    if (!match) break
    const word = normalizeWord(match[1])
    if (!isLookupWord(word)) break
    words.push(word)
    rest = rest.slice(match[0].length)
  }
  return words
}

/** Duck-typed: both are missing in some browsers, and in the book's frame they belong to another window. */
type CaretDocument = {
  caretPositionFromPoint?: (
    x: number,
    y: number
  ) => { offsetNode: Node; offset: number } | null
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}

function caretAt(
  doc: Document,
  x: number,
  y: number
): { node: Node; offset: number } | null {
  const caret = doc as unknown as CaretDocument
  if (typeof caret.caretPositionFromPoint === "function") {
    const position = caret.caretPositionFromPoint(x, y)
    return position ? { node: position.offsetNode, offset: position.offset } : null
  }
  if (typeof caret.caretRangeFromPoint === "function") {
    const range = caret.caretRangeFromPoint(x, y)
    return range ? { node: range.startContainer, offset: range.startOffset } : null
  }
  return null
}

/** The browser puts a caret near any point, margins too: only a tap on the word counts. */
function containsPoint(range: Range, x: number, y: number): boolean {
  return [...range.getClientRects()].some(
    (box) =>
      x >= box.left - SLOP &&
      x <= box.right + SLOP &&
      y >= box.top - SLOP &&
      y <= box.bottom + SLOP
  )
}

/** The paragraph's text and where `node` starts in it. */
function paragraphOf(node: Text): { text: string; offset: number } {
  const doc = node.ownerDocument
  const block = node.parentElement?.closest(BLOCKS) ?? doc.body
  const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let offset = 0
  for (
    let current = walker.nextNode();
    current && current !== node;
    current = walker.nextNode()
  ) {
    offset += (current as Text).data.length
  }
  return { text: block.textContent ?? "", offset }
}

export type WordHit = {
  /** Normalized, as it is looked up. */
  word: string
  range: Range
  sentence: string
  next: Array<string>
}

/** The word tapped at (x, y) in a section's document (spec 2 §5, §6.2), or null. */
export function wordAt(doc: Document, x: number, y: number): WordHit | null {
  const caret = caretAt(doc, x, y)
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return null
  const node = caret.node as Text
  const bounds = wordBounds(node.data, caret.offset)
  if (!bounds) return null

  const range = doc.createRange()
  range.setStart(node, bounds.start)
  range.setEnd(node, bounds.end)
  if (!containsPoint(range, x, y)) return null

  const word = normalizeWord(node.data.slice(bounds.start, bounds.end))
  if (!isLookupWord(word)) return null
  const paragraph = paragraphOf(node)
  const start = paragraph.offset + bounds.start
  const end = paragraph.offset + bounds.end
  return {
    word,
    range,
    sentence: sentenceAround(paragraph.text, start, end),
    next: nextWords(paragraph.text, end),
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run src/lib/words/word-at.test.ts`
Expected: semua PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/words/word-at.ts src/lib/words/word-at.test.ts
git commit -m "feat(words): find the word under a tap, with its sentence and the next words"
```

---

### Task 10: Garis bawah kata tersimpan dan sorotan kata aktif

**Files:**
- Create: `src/lib/words/saved-marks.ts`
- Modify: `src/lib/reader-settings.ts` (`THEME_COLORS`, `readerCss`)
- Test: `src/lib/words/saved-marks.test.ts`
- Test: `src/lib/reader-settings.test.ts` (tambah test)

**Interfaces:**
- Consumes: `normalizeWord` (Task 1).
- Produces:
  - `SAVED_HIGHLIGHT = "glosa-saved"`, `ACTIVE_HIGHLIGHT = "glosa-active"`
  - `type SavedForms = { set: ReadonlySet<string>; maxWords: number }`, `NO_SAVED_FORMS`
  - `savedFormsOf(forms: Record<string, Array<string>>): SavedForms`
  - `findSavedSpans(text: string, forms: SavedForms): Array<{ start: number; end: number }>`
  - `markSavedWords(doc: Document, forms: SavedForms, scope?): void`
  - `showActiveWord(doc: Document, range: Range | null, scope?): void`
  - `whenIdle(win: Window, task: () => void): () => void` (mengembalikan pembatal)
  - `THEME_COLORS[theme].mark` (warna sorotan kata aktif); `readerCss` memuat `::highlight(glosa-saved)` dan `::highlight(glosa-active)`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/words/saved-marks.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import {
  ACTIVE_HIGHLIGHT,
  NO_SAVED_FORMS,
  SAVED_HIGHLIGHT,
  findSavedSpans,
  markSavedWords,
  savedFormsOf,
  showActiveWord,
  whenIdle,
} from "./saved-marks"

const forms = savedFormsOf({
  run: ["run", "ran", "running"],
  "give up": ["give up", "gave up"],
  give: ["give"],
})
const spans = (text: string) =>
  findSavedSpans(text, forms).map(({ start, end }) => text.slice(start, end))

/** The Custom Highlight API, as far as these functions use it. */
function fakeScope() {
  const registry = new Map<string, { ranges: Array<Range> }>()
  class Highlight {
    ranges: Array<Range>
    constructor(...ranges: Array<Range>) {
      this.ranges = ranges
    }
  }
  return { registry, scope: { CSS: { highlights: registry }, Highlight } }
}

describe("findSavedSpans", () => {
  it("finds every form of a saved word, in any case and with 's", () => {
    expect(spans("He Ran, she ran; Running’s fun.")).toEqual([
      "Ran",
      "ran",
      "Running’s",
    ])
  })

  it("prefers a saved phrase over its first word, across a line break", () => {
    expect(spans("She gave\nup. Give it.")).toEqual(["gave\nup", "Give"])
  })

  it("does not join words across punctuation", () => {
    expect(spans("She gave, up")).toEqual([])
  })

  it("finds nothing without saved words", () => {
    expect(findSavedSpans("run", NO_SAVED_FORMS)).toEqual([])
  })
})

describe("markSavedWords", () => {
  it("does nothing where the browser has no Custom Highlight API", () => {
    document.body.innerHTML = "<p>He ran.</p>"
    expect(() => markSavedWords(document, forms, null)).not.toThrow()
  })

  it("puts every saved form of the section in one highlight", () => {
    document.body.innerHTML = "<p>He ran. <i>Running</i> is fun.</p>"
    const { registry, scope } = fakeScope()
    markSavedWords(document, forms, scope)
    const ranges = registry.get(SAVED_HIGHLIGHT)?.ranges ?? []
    expect(ranges.map((range) => range.toString())).toEqual(["ran", "Running"])
  })
})

describe("showActiveWord", () => {
  it("lights the tapped word and clears it", () => {
    document.body.innerHTML = "<p>He ran.</p>"
    const { registry, scope } = fakeScope()
    const range = document.createRange()
    showActiveWord(document, range, scope)
    expect(registry.get(ACTIVE_HIGHLIGHT)?.ranges).toEqual([range])
    showActiveWord(document, null, scope)
    expect(registry.has(ACTIVE_HIGHLIGHT)).toBe(false)
  })
})

describe("whenIdle", () => {
  it("falls back to a timeout, and can be cancelled", () => {
    vi.useFakeTimers()
    const task = vi.fn()
    const idleless = {
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
    } as unknown as Window
    whenIdle(idleless, task)
    const cancel = whenIdle(idleless, task)
    cancel()
    vi.runAllTimers()
    expect(task).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
```

Tambahkan di akhir `describe("readerCss", …)` di `src/lib/reader-settings.test.ts`:

```ts
  it("underlines saved words and lights the tapped one in the theme's colours", () => {
    const css = readerCss({ ...DEFAULT_READER_SETTINGS, theme: "dark" }, fonts)
    expect(css).toContain(
      "::highlight(glosa-saved) { text-decoration: underline dotted 2px #2fe0b8; }"
    )
    expect(css).toContain(
      "::highlight(glosa-active) { background-color: #2a5b52; }"
    )
  })
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/words/saved-marks.test.ts src/lib/reader-settings.test.ts`
Expected: FAIL, modul `./saved-marks` tidak ditemukan dan CSS belum memuat `::highlight`.

- [ ] **Step 3: Implementasi**

Buat `src/lib/words/saved-marks.ts`:

```ts
import { normalizeWord } from "./normalize"

/** The highlights' names; readerCss styles them inside the book. */
export const SAVED_HIGHLIGHT = "glosa-saved"
export const ACTIVE_HIGHLIGHT = "glosa-active"

/** Every form of every saved word, and how many words the longest has (at most 3). */
export type SavedForms = { set: ReadonlySet<string>; maxWords: number }
export const NO_SAVED_FORMS: SavedForms = { set: new Set(), maxWords: 0 }

export function savedFormsOf(forms: Record<string, Array<string>>): SavedForms {
  const set = new Set(Object.values(forms).flat())
  let maxWords = 0
  for (const form of set) maxWords = Math.max(maxWords, form.split(" ").length)
  return { set, maxWords: Math.min(maxWords, 3) }
}

const TOKEN = /[\p{L}\p{M}'’-]+/gu
/** Words with only spaces between them: a phrase never spans punctuation. */
const SPACED = /^[\p{L}\p{M}'’-]+(?:\s+[\p{L}\p{M}'’-]+)*$/u

/** Where the saved forms are in a text: single words, or phrases of up to 3 words, longest first. */
export function findSavedSpans(
  text: string,
  forms: SavedForms
): Array<{ start: number; end: number }> {
  if (forms.set.size === 0) return []
  const tokens = [...text.matchAll(TOKEN)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }))
  const spans: Array<{ start: number; end: number }> = []
  let i = 0
  while (i < tokens.length) {
    let taken = 0
    for (let n = Math.min(forms.maxWords, tokens.length - i); n >= 1; n -= 1) {
      const piece = text.slice(tokens[i].start, tokens[i + n - 1].end)
      if (n > 1 && !SPACED.test(piece)) continue
      if (forms.set.has(normalizeWord(piece))) {
        spans.push({ start: tokens[i].start, end: tokens[i + n - 1].end })
        taken = n
        break
      }
    }
    i += Math.max(taken, 1)
  }
  return spans
}

/** The Custom Highlight API of the book's frame, which may not have one. */
type HighlightScope = {
  CSS?: { highlights?: Pick<Map<string, unknown>, "set" | "delete"> }
  Highlight?: new (...ranges: Array<Range>) => unknown
}

const scopeOf = (doc: Document) =>
  doc.defaultView as unknown as HighlightScope | null

/**
 * Underlines the saved words in a section (spec 2 §6.5) without touching its
 * DOM, so CFIs stay valid. Browsers without the API show no underline.
 */
export function markSavedWords(
  doc: Document,
  forms: SavedForms,
  scope: HighlightScope | null = scopeOf(doc)
): void {
  const registry = scope?.CSS?.highlights
  const Highlight = scope?.Highlight
  if (!registry || !Highlight) return
  const ranges: Array<Range> = []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text
    if (text.parentElement?.closest("script, style")) continue
    for (const { start, end } of findSavedSpans(text.data, forms)) {
      const range = doc.createRange()
      range.setStart(text, start)
      range.setEnd(text, end)
      ranges.push(range)
    }
  }
  registry.set(SAVED_HIGHLIGHT, new Highlight(...ranges))
}

/** Lights the tapped word while its meaning shows (spec 2 §6.2); null clears it. */
export function showActiveWord(
  doc: Document,
  range: Range | null,
  scope: HighlightScope | null = scopeOf(doc)
): void {
  const registry = scope?.CSS?.highlights
  const Highlight = scope?.Highlight
  if (!registry || !Highlight) return
  if (range) registry.set(ACTIVE_HIGHLIGHT, new Highlight(range))
  else registry.delete(ACTIVE_HIGHLIGHT)
}

type IdleWindow = {
  requestIdleCallback?: (task: () => void, options: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
  setTimeout: (task: () => void, ms: number) => number
  clearTimeout: (id: number) => void
}

/** Runs once the browser is idle, so turning a page never waits for it. Returns a cancel. */
export function whenIdle(win: Window, task: () => void): () => void {
  const idle = win as unknown as IdleWindow
  if (typeof idle.requestIdleCallback === "function") {
    const id = idle.requestIdleCallback(task, { timeout: 1000 })
    return () => idle.cancelIdleCallback?.(id)
  }
  const id = idle.setTimeout(task, 50)
  return () => idle.clearTimeout(id)
}
```

Di `src/lib/reader-settings.ts`:
- tambahkan import di atas file:

```ts
import { ACTIVE_HIGHLIGHT, SAVED_HIGHLIGHT } from "@/lib/words/saved-marks"
```

- ganti `THEME_COLORS`:

```ts
/** `mark` lights the tapped word while its meaning shows (spec 2 §6.2). */
export const THEME_COLORS: Record<
  ReaderTheme,
  { background: string; text: string; link: string; mark: string }
> = {
  light: {
    background: "#ffffff",
    text: "#1c1b19",
    link: "#1d4ed8",
    mark: "#fde68a",
  },
  sepia: {
    background: "#f6eedb",
    text: "#2b2118",
    link: "#7a2e2e",
    mark: "#ecd59a",
  },
  dark: {
    background: "#0b1518",
    text: "#d8e4e1",
    link: "#2fe0b8",
    mark: "#2a5b52",
  },
}
```

- di array yang dikembalikan `readerCss`, tambahkan dua baris sesudah `"pre { white-space: pre-wrap !important; }",`:

```ts
    `::highlight(${SAVED_HIGHLIGHT}) { text-decoration: underline dotted 2px ${colors.link}; }`,
    `::highlight(${ACTIVE_HIGHLIGHT}) { background-color: ${colors.mark}; }`,
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run src/lib/words/saved-marks.test.ts src/lib/reader-settings.test.ts src/components/reader`
Expected: semua PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/words/saved-marks.ts src/lib/words/saved-marks.test.ts src/lib/reader-settings.ts src/lib/reader-settings.test.ts
git commit -m "feat(words): underline saved words in books and light the tapped one"
```

---

### Task 11: Popup arti

**Files:**
- Create: `src/lib/words/labels.ts`
- Create: `src/components/reader/useWordLookup.ts`
- Create: `src/components/reader/WordPopup.tsx`
- Modify: `src/styles.css` (aturan baru di dalam `@layer components`)
- Test: `src/components/reader/useWordLookup.test.tsx`
- Test: `src/components/reader/WordPopup.test.tsx`

**Interfaces:**
- Consumes: `lookUp`, `LookupOutcome` (Task 6); `LookupResult`, `DictPos` (Task 3); `useWideScreen` dari `src/lib/use-wide-screen.ts`; `stubWideScreen`/`unstubWideScreen` dari `src/test/media.ts`.
- Produces:
  - `POS_LABELS: Record<DictPos, string>`
  - `type WordLookupState = { kind: "loading"; slow: boolean } | LookupOutcome`
  - `useWordLookup(word: string | null, next: ReadonlyArray<string>): { state: WordLookupState; retry: () => void }`
  - `type WordRect = { left: number; top: number; width: number; height: number }` (koordinat jendela)
  - `type WordTap = { word: string; sentence: string; next: Array<string>; cfi: string | null; rect: WordRect }`
  - `WordPopup` dengan props `{ tap: WordTap | null; lookup: WordLookupState; saved: boolean; onToggleSave: () => void; onRetry: () => void; onClose: () => void; finalFocus: () => HTMLElement | null }`. Popup ber-`role="dialog"` dengan nama `Arti <kata>`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/components/reader/useWordLookup.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type LookupOutcome, lookUp } from "@/lib/words/lookup"
import { useWordLookup } from "./useWordLookup"

vi.mock("@/lib/words/lookup", () => ({ lookUp: vi.fn() }))

const found: LookupOutcome = {
  kind: "result",
  result: { word: "ran", entries: [], phrases: [] },
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(lookUp).mockReset()
})

describe("useWordLookup", () => {
  it("loads quietly for 150 ms, then shows it is still loading", async () => {
    let answer: (outcome: LookupOutcome) => void = () => {}
    vi.mocked(lookUp).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve
      })
    )
    const { result } = renderHook(() => useWordLookup("ran", ["up"]))
    expect(result.current.state).toEqual({ kind: "loading", slow: false })
    expect(lookUp).toHaveBeenCalledWith("ran", ["up"])

    await act(() => vi.advanceTimersByTimeAsync(150))
    expect(result.current.state).toEqual({ kind: "loading", slow: true })
    await act(async () => answer(found))
    expect(result.current.state).toEqual(found)
  })

  it("looks the word up again on retry", async () => {
    vi.mocked(lookUp)
      .mockResolvedValueOnce({ kind: "failed" })
      .mockResolvedValueOnce(found)
    const { result } = renderHook(() => useWordLookup("ran", []))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.state).toEqual({ kind: "failed" })
    act(() => result.current.retry())
    expect(result.current.state).toEqual({ kind: "loading", slow: false })
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.state).toEqual(found)
  })

  it("does nothing without a word", () => {
    renderHook(() => useWordLookup(null, []))
    expect(lookUp).not.toHaveBeenCalled()
  })
})
```

Buat `src/components/reader/WordPopup.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { LookupResult } from "@/lib/words/types"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { type WordTap, WordPopup } from "./WordPopup"
import type { WordLookupState } from "./useWordLookup"

const tap: WordTap = {
  word: "running",
  sentence: "He was running.",
  next: [],
  cfi: null,
  rect: { left: 100, top: 100, width: 50, height: 20 },
}
const result: LookupResult = {
  word: "running",
  entries: [
    { headword: "run", pos: "verb", meanings: ["berlari", "menjalankan"] },
    { headword: "running", pos: "noun", meanings: ["lari"] },
  ],
  phrases: [{ headword: "run up", meanings: ["menaikkan"] }],
}

function show(
  lookup: WordLookupState,
  extra: Partial<Parameters<typeof WordPopup>[0]> = {}
) {
  const props = {
    tap,
    lookup,
    saved: false,
    onToggleSave: vi.fn(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
    finalFocus: () => null,
    ...extra,
  }
  render(<WordPopup {...props} />)
  return props
}

const popup = () => screen.findByRole("dialog", { name: "Arti running" })

beforeEach(() => {
  stubWideScreen(false)
})

afterEach(() => {
  unstubWideScreen()
})

describe("WordPopup", () => {
  it("shows the base form, the phrasal verb and the meanings per part of speech", async () => {
    show({ kind: "result", result })
    const dialog = await popup()
    expect(within(dialog).getByText("→ run")).toBeInTheDocument()
    expect(within(dialog).getByText("run up")).toBeInTheDocument()
    expect(within(dialog).getByText("frasa")).toBeInTheDocument()
    expect(within(dialog).getByText("menaikkan")).toBeInTheDocument()
    expect(within(dialog).getByText("kata kerja")).toBeInTheDocument()
    expect(within(dialog).getByText("berlari, menjalankan")).toBeInTheDocument()
    expect(within(dialog).getByText("kata benda · running")).toBeInTheDocument()
    expect(
      within(dialog).getByRole("link", { name: "Wiktionary · CC BY-SA" })
    ).toHaveAttribute("href", "https://en.wiktionary.org/wiki/run")
  })

  it("says when there is no meaning yet, and still saves", async () => {
    const props = show({
      kind: "result",
      result: { word: "running", entries: [], phrases: [] },
    })
    const dialog = await popup()
    expect(
      within(dialog).getByText("Belum ada arti untuk kata ini")
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }))
    expect(props.onToggleSave).toHaveBeenCalledOnce()
  })

  it("needs a connection for a new word offline", async () => {
    show({ kind: "offline" })
    expect(
      within(await popup()).getByText("Arti butuh koneksi")
    ).toBeInTheDocument()
  })

  it("offers another try after a failure", async () => {
    const props = show({ kind: "failed" })
    const dialog = await popup()
    expect(within(dialog).getByText("Arti tidak bisa dimuat")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Coba lagi" }))
    expect(props.onRetry).toHaveBeenCalledOnce()
  })

  it("shows no skeleton while loading is quick, and saves only after", async () => {
    show({ kind: "loading", slow: false })
    const dialog = await popup()
    expect(dialog.querySelector(".word-skeleton")).toBeNull()
    expect(within(dialog).getByRole("button", { name: "Simpan" })).toBeDisabled()
  })

  it("shows a skeleton once loading is slow", async () => {
    show({ kind: "loading", slow: true })
    expect((await popup()).querySelector(".word-skeleton")).not.toBeNull()
  })

  it("marks a saved word", async () => {
    show({ kind: "result", result }, { saved: true })
    expect(
      within(await popup()).getByRole("button", { name: "Tersimpan" })
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("closes on Escape", async () => {
    const props = show({ kind: "result", result })
    fireEvent.keyDown(await popup(), { key: "Escape" })
    expect(props.onClose).toHaveBeenCalled()
  })

  it("opens beside the word on wide screens", async () => {
    stubWideScreen(true)
    show({ kind: "result", result })
    expect(within(await popup()).getByText("→ run")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/reader/useWordLookup.test.tsx src/components/reader/WordPopup.test.tsx`
Expected: FAIL, modul `./useWordLookup` dan `./WordPopup` tidak ditemukan.

- [ ] **Step 3: Implementasi**

Buat `src/lib/words/labels.ts`:

```ts
import type { DictPos } from "./types"

/** Parts of speech as the popup and Kosakata name them (spec 2 §6.3). */
export const POS_LABELS: Record<DictPos, string> = {
  noun: "kata benda",
  verb: "kata kerja",
  adj: "kata sifat",
  adv: "kata keterangan",
  pron: "kata ganti",
  prep: "kata depan",
  conj: "kata sambung",
  interj: "kata seru",
  phrase: "frasa",
}
```

Buat `src/components/reader/useWordLookup.ts`:

```ts
import { useEffect, useState } from "react"
import { type LookupOutcome, lookUp } from "@/lib/words/lookup"

/** `slow`: still loading after SKELETON_DELAY_MS, so the skeleton shows (spec 2 §6.3). */
export type WordLookupState = { kind: "loading"; slow: boolean } | LookupOutcome

const SKELETON_DELAY_MS = 150

/** The meanings of the tapped word, looked up again when it changes or on retry. */
export function useWordLookup(
  word: string | null,
  next: ReadonlyArray<string>
): { state: WordLookupState; retry: () => void } {
  const nextKey = next.join(" ")
  const [attempt, setAttempt] = useState(0)
  const key = word === null ? null : `${word} ${nextKey}#${attempt}`
  const [done, setDone] = useState<{
    key: string
    outcome: LookupOutcome
  } | null>(null)
  const [slowKey, setSlowKey] = useState<string | null>(null)

  useEffect(() => {
    if (word === null || key === null) return
    let live = true
    const timer = setTimeout(() => {
      if (live) setSlowKey(key)
    }, SKELETON_DELAY_MS)
    lookUp(word, nextKey ? nextKey.split(" ") : [])
      .catch((): LookupOutcome => ({ kind: "failed" }))
      .then((outcome) => {
        if (live) setDone({ key, outcome })
      })
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [word, nextKey, key])

  const outcome = done?.key === key ? done.outcome : null
  return {
    state: outcome ?? { kind: "loading", slow: slowKey === key },
    retry: () => setAttempt((count) => count + 1),
  }
}
```

Buat `src/components/reader/WordPopup.tsx`:

```tsx
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Popover } from "@base-ui/react/popover"
import { Button } from "@/components/ui/button"
import { useWideScreen } from "@/lib/use-wide-screen"
import { POS_LABELS } from "@/lib/words/labels"
import type { LookupResult } from "@/lib/words/types"
import type { WordLookupState } from "./useWordLookup"

/** Where the tapped word is, in this window's coordinates. */
export type WordRect = { left: number; top: number; width: number; height: number }

/** A tapped word and what Simpan keeps with it (spec 2 §6.2). */
export type WordTap = {
  word: string
  sentence: string
  next: Array<string>
  cfi: string | null
  rect: WordRect
}

const WIKTIONARY = "https://en.wiktionary.org/wiki/"

/** A virtual element at the word, for the popover to sit beside. */
function anchorAt({ left, top, width, height }: WordRect) {
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

type CardProps = {
  tap: WordTap
  lookup: WordLookupState
  saved: boolean
  onToggleSave: () => void
  onRetry: () => void
}

function Meanings({
  result,
  base,
}: {
  result: LookupResult
  base: string | null
}) {
  return (
    <>
      {result.phrases.map((phrase) => (
        <section key={phrase.headword} className="word-sense">
          <h3>
            <span className="font-bold">{phrase.headword}</span>{" "}
            <span className="word-tag">frasa</span>
          </h3>
          <p>{phrase.meanings.join(", ")}</p>
        </section>
      ))}
      {result.entries.map((entry) => (
        <section key={`${entry.headword} ${entry.pos}`} className="word-sense">
          <h3 className="word-pos">
            {entry.headword === base
              ? POS_LABELS[entry.pos]
              : `${POS_LABELS[entry.pos]} · ${entry.headword}`}
          </h3>
          <p>{entry.meanings.join(", ")}</p>
        </section>
      ))}
    </>
  )
}

function WordCard({ tap, lookup, saved, onToggleSave, onRetry }: CardProps) {
  const result = lookup.kind === "result" ? lookup.result : null
  const base = result?.entries.at(0)?.headword ?? null
  const empty =
    result !== null && result.entries.length === 0 && result.phrases.length === 0
  return (
    <div className="word-card">
      <p className="word-head">
        <span className="font-heading text-xl font-bold">{tap.word}</span>
        {base && base !== tap.word && (
          <span className="text-muted-foreground">→ {base}</span>
        )}
      </p>
      {lookup.kind === "loading" && lookup.slow && (
        <div aria-hidden="true" className="word-skeleton">
          <span />
          <span />
        </div>
      )}
      {lookup.kind === "offline" && (
        <p className="word-note">Arti butuh koneksi</p>
      )}
      {lookup.kind === "failed" && (
        <div className="word-note">
          <p>Arti tidak bisa dimuat</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Coba lagi
          </Button>
        </div>
      )}
      {empty && <p className="word-note">Belum ada arti untuk kata ini</p>}
      {result && <Meanings result={result} base={base} />}
      <div className="word-actions">
        <Button
          size="lg"
          aria-pressed={saved}
          disabled={lookup.kind === "loading"}
          onClick={onToggleSave}
        >
          {saved ? "Tersimpan" : "Simpan"}
        </Button>
        <a
          className="word-credit"
          href={`${WIKTIONARY}${encodeURIComponent(base ?? tap.word)}`}
          target="_blank"
          rel="noreferrer"
        >
          Wiktionary · CC BY-SA
        </a>
      </div>
    </div>
  )
}

/**
 * A tapped word's meanings (spec 2 §6.3): a popover beside the word on wide
 * screens, a bottom sheet on phones. Escape or a tap outside closes it, and
 * the focus goes back to the book.
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
  const wide = useWideScreen()
  if (!tap) return null
  const label = `Arti ${tap.word}`
  const onOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  if (wide) {
    return (
      <Popover.Root open onOpenChange={onOpenChange}>
        <Popover.Portal>
          <Popover.Positioner
            anchor={anchorAt(tap.rect)}
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
              <WordCard tap={tap} {...card} />
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
          <WordCard tap={tap} {...card} />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
```

Di `src/styles.css`, sisipkan aturan berikut di dalam `@layer components`, tepat sebelum kurung `}` yang menutup layer itu (baris sebelum komentar `A member page fills exactly the space beside the navigation…`):

```css
  /* A tapped word's meanings (spec 2 §6.3). */
  .word-positioner {
    z-index: 40;
  }
  .word-popup,
  .word-sheet {
    overflow-y: auto;
    border: 1px solid var(--border);
    background: var(--color-panel);
    padding: 1rem;
    color: var(--foreground);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.25);
    outline: none;
  }
  .word-popup {
    width: min(22rem, calc(100vw - 2rem));
    max-height: min(60dvh, 28rem);
    border-radius: 0.75rem;
  }
  .word-sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgb(0 0 0 / 0.35);
  }
  .word-sheet {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 50;
    max-height: 70dvh;
    border-radius: 1rem 1rem 0 0;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  }
  .word-card {
    display: grid;
    gap: 0.75rem;
    font-size: 0.9rem;
  }
  .word-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
  }
  .word-sense h3 {
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }
  .word-tag {
    border: 1px solid var(--border);
    border-radius: 9999px;
    padding: 0 0.4rem;
    font-size: 0.7rem;
  }
  .word-note {
    display: grid;
    justify-items: start;
    gap: 0.5rem;
    color: var(--muted-foreground);
  }
  .word-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .word-credit {
    font-size: 0.7rem;
    color: var(--muted-foreground);
    text-decoration: underline;
  }
  .word-skeleton {
    display: grid;
    gap: 0.4rem;
  }
  .word-skeleton span {
    height: 0.8rem;
    border-radius: 0.25rem;
    background: var(--muted);
    animation: word-pulse 1.5s ease-in-out infinite;
  }
  .word-skeleton span:last-child {
    width: 60%;
  }
  @media (prefers-reduced-motion: reduce) {
    .word-skeleton span {
      animation: none;
    }
  }
```

Tambahkan juga keyframes-nya di luar layer, di akhir file:

```css
@keyframes word-pulse {
  50% {
    opacity: 0.5;
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run src/components/reader`
Expected: semua PASS.

Run: `npm run typecheck`
Expected: PASS. Kalau tipe `anchor` menolak objek `anchorAt`, ketik hasilnya sebagai `{ getBoundingClientRect: () => DOMRect }` dan cast `box` dengan `as DOMRect`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/words/labels.ts src/components/reader/useWordLookup.ts src/components/reader/useWordLookup.test.tsx src/components/reader/WordPopup.tsx src/components/reader/WordPopup.test.tsx src/styles.css
git commit -m "feat(reader): a popup with the tapped word's meanings"
```

---

### Task 12: Ketuk kata di reader

**Files:**
- Modify: `src/types/foliate-js.d.ts` (`View`)
- Modify: `src/components/reader/ReaderView.tsx`
- Create: `src/components/vocabulary/VocabularyNotice.tsx`
- Modify: `src/lib/book-messages.ts`
- Modify: `src/routes/_member/read.$bookId.tsx`
- Modify: `src/styles.css` (`.reader-host`)
- Modify: `e2e/reader.spec.ts` (ketukan HP)
- Test: `src/lib/book-messages.test.ts` (tambah test)

**Interfaces:**
- Consumes: `wordAt` (Task 9); `markSavedWords`, `showActiveWord`, `whenIdle`, `savedFormsOf`, `SavedForms` (Task 10); `WordPopup`, `WordTap`, `WordRect`, `useWordLookup` (Task 11); `savedChoice` (Task 6); `wordSync`, `refreshSavedForms`, `useSavedHeadwords`, `useSavedForms`, `useWordRejection` (Task 8); `MAX_CFI_LENGTH` dari `src/lib/progress.ts`.
- Produces:
  - `ReaderView` menerima props baru `target: string | null`, `wordOpen: boolean`, `savedForms: SavedForms`, dan callback `onWord(tap: WordTap)`, `onDismissWord()`, `onTargetMissing()`.
  - Route `/read/$bookId` menerima search `{ cfi?: string }`. Task 13 menautkannya dengan `<Link to="/read/$bookId" params={{ bookId }} search={{ cfi }}>`.
  - `bookMessage("words_full" | "word_invalid" | "position_missing")`.
  - `VocabularyNotice({ className?: string })`: pesan penolakan server dengan tombol Tutup, atau tidak ada apa-apa.

- [ ] **Step 1: Tulis test pesan yang gagal**

Tambahkan di akhir `describe("bookMessage", …)` di `src/lib/book-messages.test.ts`:

```ts
  it("explains why a word was not kept, and a place that is gone", () => {
    expect(bookMessage("words_full")).toBe(
      "Kosakata sudah penuh (5.000 kata). Hapus beberapa kata untuk menyimpan yang baru."
    )
    expect(bookMessage("word_invalid")).toBe("Kata ini tidak bisa disimpan.")
    expect(bookMessage("position_missing")).toBe(
      "Posisi itu tidak ditemukan di buku ini"
    )
  })
```

Run: `npx vitest run src/lib/book-messages.test.ts`
Expected: FAIL, pesan masih pesan cadangan.

- [ ] **Step 2: Tambahkan pesan**

Di `src/lib/book-messages.ts`, tambahkan di `MESSAGES` sesudah `offline: "Butuh internet.",`:

```ts
  words_full:
    "Kosakata sudah penuh (5.000 kata). Hapus beberapa kata untuk menyimpan yang baru.",
  word_invalid: "Kata ini tidak bisa disimpan.",
  position_missing: "Posisi itu tidak ditemukan di buku ini",
```

Run: `npx vitest run src/lib/book-messages.test.ts`
Expected: PASS.

- [ ] **Step 3: Tipe foliate dan `ReaderView`**

Di `src/types/foliate-js.d.ts`, di dalam `class View`, tambahkan sesudah `goTo(target: string): Promise<unknown>`:

```ts
    /** The CFI of a range in section `index`. */
    getCFI(index: number, range?: Range): string
    /** Where a CFI or href leads; index -1 when the book has no such place. */
    resolveNavigation(target: string): { index: number } | undefined
```

Di `src/components/reader/ReaderView.tsx`:

1. Tambahkan import:

```ts
import {
  type SavedForms,
  markSavedWords,
  showActiveWord,
  whenIdle,
} from "@/lib/words/saved-marks"
import { wordAt } from "@/lib/words/word-at"
import type { WordRect, WordTap } from "./WordPopup"
```

2. Di `type Callbacks`, tambahkan sesudah `onTapMenu: () => void`:

```ts
  /** A tap on a word (spec 2 §6.1, step 4). */
  onWord: (tap: WordTap) => void
  /** A tap beside the words while a meaning shows: it closes, the page stays. */
  onDismissWord: () => void
  /** `target` is not a place in this book (spec 2 §8). */
  onTargetMissing: () => void
```

3. Tambahkan fungsi ini sesudah `animateUnlessReduced`:

```ts
/** Whether the book has the place a CFI points at. */
function canOpen(view: View, cfi: string): boolean {
  try {
    const resolved = view.resolveNavigation(cfi)
    return (
      resolved !== undefined &&
      resolved.index >= 0 &&
      resolved.index < view.book.sections.length
    )
  } catch {
    return false
  }
}
```

4. Ganti tanda tangan komponen:

```tsx
export function ReaderView({
  file,
  start,
  target,
  settings,
  wordOpen,
  savedForms,
  ...callbacks
}: {
  file: Blob
  /** CFI to open at; null opens at the start of the text. */
  start: string | null
  /** A place asked for (Kosakata's "Buka di buku"); opened instead of `start`. */
  target: string | null
  settings: ReaderSettings
  /** A word's meaning shows: a tap beside the words closes it. */
  wordOpen: boolean
  savedForms: SavedForms
} & Callbacks) {
```

5. Sesudah `const startRef = useRef(start)`, tambahkan:

```ts
  const targetRef = useRef(target)
  const wordOpenRef = useRef(wordOpen)
  const savedFormsRef = useRef(savedForms)
```

dan ubah effect yang menyalin callback:

```ts
  useEffect(() => {
    callbacksRef.current = callbacks
    settingsRef.current = settings
    wordOpenRef.current = wordOpen
    savedFormsRef.current = savedForms
  })
```

6. Di dalam effect utama, tambahkan sesudah definisi `tapAt`:

```ts
    const cfiOf = (index: number, range: Range): string | null => {
      try {
        return view?.getCFI(index, range) ?? null
      } catch {
        return null
      }
    }
```

7. Di `onSectionLoad`, ganti baris pertama dan handler `click`:

```ts
    const onSectionLoad = (event: Event) => {
      const { doc, index } = (
        event as CustomEvent<{ doc: Document; index: number }>
      ).detail
```

```ts
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
      // In order (spec 2 §6.1): links (foliate), a selection, a word, then the zones.
      doc.addEventListener("click", (click) => {
        // foliate follows links itself and marks those clicks handled.
        if (click.defaultPrevented || doc.getSelection()?.toString()) return
        const hit = wordAt(doc, click.clientX, click.clientY)
        if (hit) {
          showActiveWord(doc, hit.range)
          call().onWord({
            word: hit.word,
            sentence: hit.sentence,
            next: hit.next,
            cfi: cfiOf(index, hit.range),
            rect: rectInWindow(hit.range.getBoundingClientRect()),
          })
          return
        }
        if (wordOpenRef.current) {
          call().onDismissWord()
          return
        }
        tapAt(inWindow(click.clientX))
      })
      const win = doc.defaultView
      if (win) whenIdle(win, () => markSavedWords(doc, savedFormsRef.current))
```

Hapus definisi `inWindow` lama (sudah diganti di atas). Listener `pointermove` dan `pointerout` di bawahnya tetap.

8. Ganti bagian sebelum `view.init`:

```ts
        const target = targetRef.current
        const reachable = target !== null && canOpen(view, target)
        if (target !== null && !reachable) call().onTargetMissing()
        const startAt = reachable ? target : startRef.current
        await view.init(
          startAt ? { lastLocation: startAt } : { showTextStart: true }
        )
```

9. Tambahkan dua effect sesudah effect `[settings]`:

```ts
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
      return doc && win ? [whenIdle(win, () => markSavedWords(doc, savedForms))] : []
    })
    return () => {
      for (const cancel of cancels) cancel()
    }
  }, [savedForms])
```

10. Pada `<section ref={hostRef} …>`, tambahkan `tabIndex={-1}` sesudah `aria-label="Isi buku"`. Popup arti mengembalikan fokus ke sini.

Di `src/styles.css`, cari aturan `.reader-host {` dan tambahkan sesudah blok itu:

```css
  /* Takes the focus back from the word popup; there is nothing to outline. */
  .reader-host:focus {
    outline: none;
  }
```

- [ ] **Step 4: `VocabularyNotice` dan halaman reader**

Buat `src/components/vocabulary/VocabularyNotice.tsx`:

```tsx
import { Button } from "@/components/ui/button"
import { bookMessage } from "@/lib/book-messages"
import { cn } from "@/lib/utils"
import { useWordRejection, wordSync } from "@/lib/words/word-sync-client"

/** Why the server did not keep a word (spec 2 §7), until the member closes it. */
export function VocabularyNotice({ className }: { className?: string }) {
  const rejection = useWordRejection()
  if (!rejection) return null
  return (
    <aside aria-label="Kosakata" className={cn("reader-toast", className)}>
      <output className="text-sm">{bookMessage(rejection.code)}</output>
      <Button
        size="lg"
        variant="ghost"
        onClick={() => wordSync().dismissRejection()}
      >
        Tutup
      </Button>
    </aside>
  )
}
```

Di `src/routes/_member/read.$bookId.tsx`:

1. Ubah dan tambah import:

```ts
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { WordPopup, type WordTap } from "@/components/reader/WordPopup"
import { useWordLookup } from "@/components/reader/useWordLookup"
import { VocabularyNotice } from "@/components/vocabulary/VocabularyNotice"
import { MAX_CFI_LENGTH, jumpOffer, toPercentage } from "@/lib/progress"
import { savedChoice } from "@/lib/words/lookup"
import { savedFormsOf } from "@/lib/words/saved-marks"
import {
  refreshSavedForms,
  useSavedForms,
  useSavedHeadwords,
  wordSync,
} from "@/lib/words/word-sync-client"
```

(hapus import `jumpOffer, toPercentage` lama dari `@/lib/progress` dan `useCallback, useEffect, useRef, useState` lama dari `react`.)

2. Tambahkan di atas `export const Route`:

```ts
type ReaderSearch = { cfi?: string }

const NO_WORDS: Array<string> = []
/** The popup gives the focus back to the book. */
const bookFocus = () => document.querySelector<HTMLElement>(".reader-host")
```

3. Di opsi route, sesudah `ssr: false,`:

```ts
  // "Buka di buku" in Kosakata opens a word's place (spec 2 §6.4).
  validateSearch: (search: Record<string, unknown>): ReaderSearch =>
    typeof search.cfi === "string" &&
    search.cfi.length > 0 &&
    search.cfi.length <= MAX_CFI_LENGTH
      ? { cfi: search.cfi }
      : {},
```

4. Di `ReaderPage`, sesudah `const markOpened = …`:

```ts
  const search = Route.useSearch()
  const navigate = useNavigate()
  // Read once: the place asked for applies only when the book opens.
  const [target] = useState(() => search.cfi ?? null)
  const [targetMissing, setTargetMissing] = useState(false)
  const [tap, setTap] = useState<WordTap | null>(null)
  const lookup = useWordLookup(tap?.word ?? null, tap?.next ?? NO_WORDS)
  const savedHeadwords = useSavedHeadwords()
  const formsByHeadword = useSavedForms()
  const savedForms = useMemo(
    () => savedFormsOf(formsByHeadword),
    [formsByHeadword]
  )
  const choice = tap
    ? savedChoice(
        lookup.state.kind === "result" ? lookup.state.result : null,
        tap.word
      )
    : null
  const saved = choice !== null && savedHeadwords.has(choice.headword)
```

5. Ganti `useState` `offer`:

```ts
  const [offer, setOffer] = useState<Position | null>(() =>
    target ? null : jumpOffer(data.local, data.server)
  )
```

6. Sesudah effect `markOpened`, tambahkan:

```ts
  // Waiting word changes go when a book opens (spec 2 §7), and the forms of
  // words saved on other devices come in for the underline.
  useEffect(() => {
    void wordSync().flush()
    if (data.online) void refreshSavedForms()
  }, [data.online])
```

7. Ganti `onReady`:

```ts
  const onReady = useCallback(
    (info: ReaderReady) => {
      ready.current = true
      setControls(info.controls)
      setToc(info.toc)
      // Reloading the page opens the last place read, not the word again.
      if (target) {
        void navigate({
          to: "/read/$bookId",
          params: { bookId },
          search: {},
          replace: true,
        })
      }
    },
    [bookId, navigate, target]
  )
```

8. Di `onRelocate`, tambahkan baris pertama di dalam callback:

```ts
      // Turning the page closes the meaning (spec 2 §6.3).
      setTap(null)
```

9. Sesudah `onError`, tambahkan:

```ts
  const closeWord = useCallback(() => setTap(null), [])
  const onTargetMissing = useCallback(() => setTargetMissing(true), [])

  const toggleSave = () => {
    if (!tap || !choice) return
    const sync = wordSync()
    const done = saved
      ? sync.remove(choice.headword)
      : sync.save(
          {
            ...choice,
            bookId,
            bookTitle: data.book.title,
            sentence: tap.sentence,
            cfi:
              tap.cfi && tap.cfi.length <= MAX_CFI_LENGTH ? tap.cfi : null,
            createdAt: new Date().toISOString(),
          },
          [tap.word]
        )
    done.catch((error: unknown) =>
      console.error("saving the word failed", error)
    )
  }
```

10. Ganti `<ReaderView … />`:

```tsx
      <ReaderView
        file={data.file}
        start={data.local?.cfi ?? null}
        target={target}
        settings={settings}
        wordOpen={tap !== null}
        savedForms={savedForms}
        onReady={onReady}
        onRelocate={onRelocate}
        onInteract={onInteract}
        onTapMenu={onTapMenu}
        onWord={setTap}
        onDismissWord={closeWord}
        onTargetMissing={onTargetMissing}
        onError={onError}
      />
```

11. Sesudah blok `{!data.saved && (…)}`, tambahkan:

```tsx
      {targetMissing && (
        <output className="reader-note">
          {bookMessage("position_missing")}
        </output>
      )}
      <VocabularyNotice />
      <WordPopup
        key={tap ? `${tap.word} ${tap.rect.left} ${tap.rect.top}` : "none"}
        tap={tap}
        lookup={lookup.state}
        saved={saved}
        onToggleSave={toggleSave}
        onRetry={lookup.retry}
        onClose={closeWord}
        finalFocus={bookFocus}
      />
```

- [ ] **Step 5: Ketukan HP di E2E reader pindah ke tepi**

Di `e2e/reader.spec.ts`, test `turning pages by key or tap saves the new place`, ganti baris ketuk:

```ts
      // The far edge, beside the text: a tap on a word opens its meaning (spec 2 §2).
      await page.touchscreen.tap(viewport.width - 4, viewport.height / 2)
```

- [ ] **Step 6: Pemeriksaan**

Run: `npm run generate-routes && npm run typecheck && npm run lint && npx vitest run`
Expected: semua PASS.

Run: `npx playwright test e2e/reader.spec.ts --project=desktop --project=mobile`
Expected: semua PASS (ingat aturan port 3000 di Global Constraints).

- [ ] **Step 7: Commit**

```bash
git add src/types/foliate-js.d.ts src/components/reader/ReaderView.tsx src/components/vocabulary/VocabularyNotice.tsx src/lib/book-messages.ts src/lib/book-messages.test.ts src/routes/_member/read.\$bookId.tsx src/routeTree.gen.ts src/styles.css e2e/reader.spec.ts
git commit -m "feat(reader): tap a word for its meaning, save it, and open a saved place"
```

---

### Task 13: Halaman Kosakata

**Files:**
- Create: `src/lib/words/vocabulary.ts`
- Create: `src/lib/vocabulary-loader.ts`
- Create: `src/components/vocabulary/VocabularyList.tsx`
- Create: `src/routes/_member/_lobi/vocabulary.tsx`
- Modify: `src/components/lobby/LobbyPopup.tsx` (`POPUP_PATHS`)
- Modify: `src/components/member/MemberShell.tsx` (`LINKS`, `OVER_LOBBY`)
- Modify: `src/styles.css` (`.member-tabbar`, kartu Kosakata)
- Modify: `src/test/router.tsx` (`PATHS`)
- Modify: `src/routes/privacy.tsx`
- Regenerate: `src/routeTree.gen.ts`
- Test: `src/lib/words/vocabulary.test.ts`
- Test: `src/components/vocabulary/VocabularyList.test.tsx`
- Test: `src/components/lobby/LobbyPopup.test.tsx`, `src/components/member/MemberShell.test.tsx` (sesuaikan)

**Interfaces:**
- Consumes: `findSavedSpans`, `savedFormsOf` (Task 10); `normalizeWord` (Task 1); `POS_LABELS` (Task 11); `SavedWord` (Task 5); `listSavedWordsFn` (Task 5); `listLocalWords`, `replaceLocalWords`, `FormsByHeadword` (Task 7); `wordSync`, `refreshSavedForms`, `useLocalWords`, `useSavedForms` (Task 8); `VocabularyNotice` (Task 12); `LobbyPopup` (1F); `ShelfLoadError`; search `{ cfi }` di `/read/$bookId` (Task 12).
- Produces:
  - Route `/vocabulary` (judul tab "Kosakata — Glosa"), popup di atas lobi pada desktop, halaman biasa di HP.
  - `ALL_BOOKS`, `bookKeyOf`, `bookOptions`, `filterWords`, `sentenceParts` di `src/lib/words/vocabulary.ts`.
  - `loadVocabulary(userId: string): Promise<{ words: Array<SavedWord>; offline: boolean }>`.
  - `VocabularyList({ words, forms, shelfIds, onDelete })`.
  - Tautan "Kosakata" di menu samping dan tab bar.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/words/vocabulary.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { SavedWord } from "./types"
import { ALL_BOOKS, bookOptions, filterWords, sentenceParts } from "./vocabulary"

const word = (headword: string, changes: Partial<SavedWord> = {}): SavedWord => ({
  headword,
  pos: "verb",
  meanings: ["berlari"],
  bookId: "b1",
  bookTitle: "Sherlock",
  sentence: "",
  cfi: null,
  createdAt: "2026-10-24T08:00:00.000Z",
  ...changes,
})

const words = [
  word("run"),
  word("walk", { meanings: ["berjalan"], bookId: "b2", bookTitle: "Alice" }),
  word("flee", { bookId: null, bookTitle: "Buku Lama" }),
  word("hum", { bookId: null, bookTitle: null }),
]

describe("filterWords", () => {
  const headwords = (q: string, book = ALL_BOOKS) =>
    filterWords(words, { q, book }).map((w) => w.headword)

  it("finds a word by itself or by a meaning, in any case", () => {
    expect(headwords("BERJALAN")).toEqual(["walk"])
    expect(headwords("ru")).toEqual(["run"])
    expect(headwords("  ")).toEqual(["run", "walk", "flee", "hum"])
  })

  it("keeps one book's words, a deleted book's by its title", () => {
    expect(headwords("", "b2")).toEqual(["walk"])
    expect(headwords("", "judul:Buku Lama")).toEqual(["flee"])
    expect(headwords("", "tanpa-buku")).toEqual(["hum"])
  })
})

describe("bookOptions", () => {
  it("lists every book once, by title", () => {
    expect(bookOptions(words)).toEqual([
      { key: "b2", title: "Alice" },
      { key: "judul:Buku Lama", title: "Buku Lama" },
      { key: "b1", title: "Sherlock" },
      { key: "tanpa-buku", title: "Tanpa buku" },
    ])
  })
})

describe("sentenceParts", () => {
  it("picks out every form of the word", () => {
    expect(sentenceParts("He ran away. Ran!", ["run", "ran"])).toEqual([
      { text: "He ", bold: false },
      { text: "ran", bold: true },
      { text: " away. ", bold: false },
      { text: "Ran", bold: true },
      { text: "!", bold: false },
    ])
  })

  it("picks out a phrasal verb only where its words stand together", () => {
    expect(sentenceParts("She gave up.", ["give up", "gave up"])).toEqual([
      { text: "She ", bold: false },
      { text: "gave up", bold: true },
      { text: ".", bold: false },
    ])
    expect(sentenceParts("She gave it up.", ["give up", "gave up"])).toEqual([
      { text: "She gave it up.", bold: false },
    ])
  })
})
```

Buat `src/components/vocabulary/VocabularyList.test.tsx`:

```tsx
import { fireEvent, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { SavedWord } from "@/lib/words/types"
import { renderWithRouter } from "@/test/router"
import { VocabularyList } from "./VocabularyList"

const cfi = "epubcfi(/6/4!/4/2/1:0)"
const run: SavedWord = {
  headword: "run",
  pos: "verb",
  meanings: ["berlari", "menjalankan", "mengelola", "mencalonkan"],
  bookId: "b1",
  bookTitle: "The Adventures of Sherlock Holmes",
  sentence: "He ran to the door.",
  cfi,
  createdAt: "2026-10-24T08:00:00.000Z",
}
const walk: SavedWord = {
  ...run,
  headword: "walk",
  meanings: ["berjalan"],
  bookId: "b2",
  bookTitle: "Alice",
  sentence: "",
}

function show(
  words: Array<SavedWord>,
  shelfIds: ReadonlySet<string> = new Set(["b1", "b2"])
) {
  const onDelete = vi.fn()
  renderWithRouter(
    <VocabularyList
      words={words}
      forms={{ run: ["run", "ran"], walk: ["walk"] }}
      shelfIds={shelfIds}
      onDelete={onDelete}
    />
  )
  return onDelete
}

const card = (headword: string) =>
  screen.findByRole("article", { name: headword })

describe("VocabularyList", () => {
  it("says how words get here while there are none", async () => {
    show([])
    expect(
      await screen.findByText(
        "Ketuk kata yang sulit saat membaca, lalu simpan. Kata itu akan muncul di sini."
      )
    ).toBeInTheDocument()
  })

  it("shows the word, its first three meanings, its sentence and its book", async () => {
    show([run])
    const item = await card("run")
    expect(within(item).getByText("kata kerja")).toBeInTheDocument()
    expect(
      within(item).getByText("berlari, menjalankan, mengelola")
    ).toBeInTheDocument()
    expect(within(item).getByText("ran").tagName).toBe("B")
    expect(
      within(item).getByText("The Adventures of Sherlock Holmes")
    ).toBeInTheDocument()
    expect(
      within(item).getByRole("link", { name: "Buka di buku" })
    ).toHaveAttribute("href", expect.stringContaining("/read/b1?cfi="))
  })

  it("leaves out Buka di buku once the book or the place is gone", async () => {
    show([run, { ...walk, cfi: null }], new Set(["b2"]))
    expect(
      within(await card("run")).queryByRole("link", { name: "Buka di buku" })
    ).toBeNull()
    expect(
      within(await card("walk")).queryByRole("link", { name: "Buka di buku" })
    ).toBeNull()
  })

  it("searches the words and filters them by book", async () => {
    show([run, walk])
    fireEvent.change(await screen.findByLabelText("Cari kata"), {
      target: { value: "berjalan" },
    })
    expect(screen.queryByRole("article", { name: "run" })).toBeNull()
    expect(await card("walk")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Cari kata"), {
      target: { value: "" },
    })
    fireEvent.change(screen.getByLabelText("Buku"), { target: { value: "b1" } })
    expect(await card("run")).toBeInTheDocument()
    expect(screen.queryByRole("article", { name: "walk" })).toBeNull()
  })

  it("deletes a word", async () => {
    const onDelete = show([run])
    fireEvent.click(
      within(await card("run")).getByRole("button", { name: "Hapus run" })
    )
    expect(onDelete).toHaveBeenCalledWith(run)
  })
})
```

Di `src/components/lobby/LobbyPopup.test.tsx`, di test yang memanggil `isPopupPath`, tambahkan:

```ts
    expect(isPopupPath("/vocabulary")).toBe(true)
```

Di `src/components/member/MemberShell.test.tsx`, di test `offers the sidebar and the tab bar, with the current page marked`, ganti daftar `href` yang diharapkan:

```ts
      expect(links.map((link) => link.getAttribute("href"))).toEqual([
        "/lobby",
        "/shelf",
        "/vocabulary",
        "/settings",
      ])
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/words/vocabulary.test.ts src/components/vocabulary src/components/lobby/LobbyPopup.test.tsx src/components/member/MemberShell.test.tsx`
Expected: FAIL, modul belum ada, `/vocabulary` belum popup, dan tautan Kosakata belum ada.

- [ ] **Step 3: Implementasi**

Buat `src/lib/words/vocabulary.ts`:

```ts
import { normalizeWord } from "./normalize"
import { findSavedSpans, savedFormsOf } from "./saved-marks"
import type { SavedWord } from "./types"

export const ALL_BOOKS = "semua"

/** A book to filter by: its id while it exists, its copied title after it is deleted. */
export function bookKeyOf(word: SavedWord): string {
  if (word.bookId) return word.bookId
  return word.bookTitle ? `judul:${word.bookTitle}` : "tanpa-buku"
}

export type BookOption = { key: string; title: string }

export function bookOptions(words: ReadonlyArray<SavedWord>): Array<BookOption> {
  const titles = new Map<string, string>()
  for (const word of words) {
    const key = bookKeyOf(word)
    if (!titles.has(key)) titles.set(key, word.bookTitle ?? "Tanpa buku")
  }
  return [...titles]
    .map(([key, title]) => ({ key, title }))
    .sort((a, b) => a.title.localeCompare(b.title, "id"))
}

/** Kosakata's search (a word or a meaning) and book filter, in the browser (spec 2 §6.4). */
export function filterWords(
  words: ReadonlyArray<SavedWord>,
  { q, book }: { q: string; book: string }
): Array<SavedWord> {
  const query = normalizeWord(q)
  return words.filter(
    (word) =>
      (book === ALL_BOOKS || bookKeyOf(word) === book) &&
      (query === "" ||
        word.headword.includes(query) ||
        word.meanings.some((meaning) => meaning.toLowerCase().includes(query)))
  )
}

export type SentencePart = { text: string; bold: boolean }

/** The sentence with every form of its word picked out, for the card to bold. */
export function sentenceParts(
  sentence: string,
  forms: ReadonlyArray<string>
): Array<SentencePart> {
  const parts: Array<SentencePart> = []
  let last = 0
  const spans = findSavedSpans(sentence, savedFormsOf({ word: [...forms] }))
  for (const { start, end } of spans) {
    if (start > last) parts.push({ text: sentence.slice(last, start), bold: false })
    parts.push({ text: sentence.slice(start, end), bold: true })
    last = end
  }
  if (last < sentence.length) {
    parts.push({ text: sentence.slice(last), bold: false })
  }
  return parts
}
```

Buat `src/lib/vocabulary-loader.ts`:

```ts
import { listSavedWordsFn } from "@/server/words"
import { BookLoadError } from "./book-download"
import { claimLocalData } from "./local/device"
import { listLocalWords } from "./local/saved-words"
import type { SavedWord } from "./words/types"
import { wordSync } from "./words/word-sync-client"

export type VocabularyView = { words: Array<SavedWord>; offline: boolean }

// The connection can drop while the request is in flight.
const unreachable = (error: unknown) =>
  !navigator.onLine || error instanceof TypeError

/**
 * Kosakata (spec 2 §7). Online: the server's list, once this device's
 * waiting changes went out; the page then stores it on the device. Offline,
 * or when the server cannot answer: this device's copy.
 */
export async function loadVocabulary(userId: string): Promise<VocabularyView> {
  if (import.meta.env.SSR) {
    const answer = await listSavedWordsFn()
    if (!answer.ok) throw new BookLoadError(answer.code)
    return { words: answer.words, offline: false }
  }
  // Another member's copy must not show, even for a moment.
  await claimLocalData(userId)
  if (navigator.onLine) {
    try {
      await wordSync().flush()
      const answer = await listSavedWordsFn()
      if (answer.ok) return { words: answer.words, offline: false }
    } catch (error) {
      if (!unreachable(error)) throw error
    }
  }
  return { words: await listLocalWords(), offline: !navigator.onLine }
}
```

Buat `src/components/vocabulary/VocabularyList.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { Trash2Icon } from "lucide-react"
import { useMemo, useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { FormsByHeadword } from "@/lib/local/saved-words"
import { POS_LABELS } from "@/lib/words/labels"
import type { SavedWord } from "@/lib/words/types"
import {
  ALL_BOOKS,
  bookOptions,
  filterWords,
  sentenceParts,
} from "@/lib/words/vocabulary"

const SHOWN_MEANINGS = 3

function VocabularyCard({
  word,
  forms,
  onShelf,
  onDelete,
}: {
  word: SavedWord
  forms: Array<string>
  /** The book is still on the shelf, so its place can open. */
  onShelf: boolean
  onDelete: () => void
}) {
  const headingId = `kata-${word.headword.replaceAll(" ", "-")}`
  return (
    <article aria-labelledby={headingId} className="vocab-card">
      <header className="flex items-baseline gap-2">
        <h2 id={headingId} className="font-heading text-xl font-bold">
          {word.headword}
        </h2>
        {word.pos && (
          <span className="text-xs text-muted-foreground">
            {POS_LABELS[word.pos]}
          </span>
        )}
      </header>
      {word.meanings.length > 0 && (
        <p>{word.meanings.slice(0, SHOWN_MEANINGS).join(", ")}</p>
      )}
      {word.sentence && (
        <blockquote className="vocab-sentence">
          {sentenceParts(word.sentence, forms).map((part, index) =>
            part.bold ? (
              <b key={index}>{part.text}</b>
            ) : (
              <span key={index}>{part.text}</span>
            )
          )}
        </blockquote>
      )}
      <footer className="vocab-card-footer">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {word.bookTitle}
        </span>
        <div className="flex shrink-0 gap-1">
          {onShelf && word.bookId && word.cfi && (
            <Link
              to="/read/$bookId"
              params={{ bookId: word.bookId }}
              search={{ cfi: word.cfi }}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Buka di buku
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Hapus ${word.headword}`}
            onClick={onDelete}
          >
            <Trash2Icon />
          </Button>
        </div>
      </footer>
    </article>
  )
}

/** Kosakata's words, newest first, with a search and a book filter (spec 2 §6.4). */
export function VocabularyList({
  words,
  forms,
  shelfIds,
  onDelete,
}: {
  words: Array<SavedWord>
  forms: FormsByHeadword
  shelfIds: ReadonlySet<string>
  onDelete: (word: SavedWord) => void
}) {
  const [q, setQ] = useState("")
  const [book, setBook] = useState(ALL_BOOKS)
  const options = useMemo(() => bookOptions(words), [words])
  const visible = useMemo(
    () => filterWords(words, { q, book }),
    [words, q, book]
  )

  if (words.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ketuk kata yang sulit saat membaca, lalu simpan. Kata itu akan muncul di
        sini.
      </p>
    )
  }
  return (
    <>
      <div className="vocab-toolbar">
        <Label htmlFor="vocab-q" className="sr-only">
          Cari kata
        </Label>
        <Input
          id="vocab-q"
          type="search"
          placeholder="Cari kata atau arti"
          autoComplete="off"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <Label htmlFor="vocab-book" className="sr-only">
          Buku
        </Label>
        <select
          id="vocab-book"
          className="vocab-select"
          value={book}
          onChange={(event) => setBook(event.target.value)}
        >
          <option value={ALL_BOOKS}>Semua buku</option>
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.title}
            </option>
          ))}
        </select>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tidak ada kata yang cocok.
        </p>
      ) : (
        <ul className="vocab-list">
          {visible.map((word) => (
            <li key={word.headword}>
              <VocabularyCard
                word={word}
                forms={forms[word.headword] ?? [word.headword]}
                onShelf={word.bookId !== null && shelfIds.has(word.bookId)}
                onDelete={() => onDelete(word)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
```

Buat `src/routes/_member/_lobi/vocabulary.tsx`:

```tsx
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
import { ShelfLoadError } from "@/components/shelf/ShelfLoadError"
import { Button } from "@/components/ui/button"
import { VocabularyList } from "@/components/vocabulary/VocabularyList"
import { VocabularyNotice } from "@/components/vocabulary/VocabularyNotice"
import { replaceLocalWords } from "@/lib/local/saved-words"
import { loadVocabulary } from "@/lib/vocabulary-loader"
import type { SavedWord } from "@/lib/words/types"
import {
  refreshSavedForms,
  useLocalWords,
  useSavedForms,
  wordSync,
} from "@/lib/words/word-sync-client"

const lobi = getRouteApi("/_member/_lobi")
/** How long "Urungkan" stays after a word is deleted. */
const UNDO_MS = 6_000

export const Route = createFileRoute("/_member/_lobi/vocabulary")({
  loader: ({ context }) => loadVocabulary(context.user.id),
  head: () => ({ meta: [{ title: "Kosakata — Glosa" }] }),
  errorComponent: ShelfLoadError,
  component: VocabularyPage,
})

function VocabularyPage() {
  const loaded = Route.useLoaderData()
  const { books } = lobi.useLoaderData()
  const words = useLocalWords(loaded.words)
  const forms = useSavedForms()
  const shelfIds = useMemo(() => new Set(books.map((book) => book.id)), [books])
  const [removed, setRemoved] = useState<{
    word: SavedWord
    forms: Array<string>
  } | null>(null)

  // The server's list becomes this device's copy for offline (spec 2 §7).
  useEffect(() => {
    if (loaded.offline) return
    replaceLocalWords(loaded.words)
      .then(() => {
        wordSync().notify()
        return refreshSavedForms()
      })
      .catch((error: unknown) =>
        console.error("storing Kosakata on this device failed", error)
      )
  }, [loaded])

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [removed])

  const remove = (word: SavedWord) => {
    setRemoved({ word, forms: forms[word.headword] ?? [word.headword] })
    wordSync()
      .remove(word.headword)
      .catch((error: unknown) => console.error("deleting the word failed", error))
  }
  const undo = () => {
    if (!removed) return
    wordSync()
      .save(removed.word, removed.forms)
      .catch((error: unknown) => console.error("restoring the word failed", error))
    setRemoved(null)
  }

  return (
    <LobbyPopup label="Kosakata" className="max-w-4xl" bodyClassName="gap-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-heading text-3xl font-bold">Kosakata</h1>
        {words.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {words.length} kata
          </span>
        )}
      </header>
      {loaded.offline && (
        <output className="block rounded-lg border bg-panel px-4 py-2 text-sm">
          Kamu sedang offline. Kosakata ditampilkan dari salinan di perangkat
          ini.
        </output>
      )}
      <VocabularyNotice className="vocab-notice" />
      {removed && (
        <aside aria-label="Kata dihapus" className="vocab-notice">
          <output className="text-sm">
            “{removed.word.headword}” dihapus.
          </output>
          <Button variant="outline" size="lg" onClick={undo}>
            Urungkan
          </Button>
        </aside>
      )}
      <VocabularyList
        words={words}
        forms={forms}
        shelfIds={shelfIds}
        onDelete={remove}
      />
    </LobbyPopup>
  )
}
```

Di `src/components/lobby/LobbyPopup.tsx`, ganti `POPUP_PATHS`:

```ts
/** The pages that open over the lobby on desktop (spec 1F §3, spec 2 §6.4). */
export const POPUP_PATHS: ReadonlyArray<string> = [
  "/shelf",
  "/vocabulary",
  "/settings",
]
```

Ubah juga komentar `LobbyPopup` dari "Rak Saya or Pengaturan" menjadi "Rak Saya, Kosakata or Pengaturan".

Di `src/components/member/MemberShell.tsx`:
- import ikon: `import { BookOpenIcon, LanguagesIcon, LibraryIcon, SettingsIcon } from "lucide-react"`
- di `LINKS`, sisipkan sesudah tautan Rak Saya:

```ts
  {
    to: "/vocabulary",
    label: "Kosakata",
    short: "Kosakata",
    Icon: LanguagesIcon,
  },
```

- ganti `OVER_LOBBY`:

```ts
/** Pages with the lobby behind them on desktop (spec 1F §3, spec 2 §6.4). */
const OVER_LOBBY = ["/lobby", "/shelf", "/vocabulary", "/settings"]
```

Di `src/test/router.tsx`, tambahkan `"/vocabulary"` ke `PATHS`:

```ts
const PATHS = [
  "/lobby",
  "/shelf",
  "/vocabulary",
  "/settings",
  "/logout",
  "/read/$bookId",
]
```

Di `src/styles.css`, di aturan `.member-tabbar`, ganti `grid-template-columns: repeat(3, 1fr);` dengan `grid-template-columns: repeat(4, 1fr);`. Lalu tambahkan di dalam `@layer components`, sesudah aturan `.word-skeleton` dari Task 11:

```css
  /* Kosakata (spec 2 §6.4). */
  .vocab-toolbar {
    display: grid;
    gap: 0.5rem;
  }
  .vocab-select {
    height: 2.25rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--background);
    padding-inline: 0.5rem;
    font-size: 0.875rem;
  }
  .vocab-list {
    display: grid;
    gap: 0.75rem;
  }
  .vocab-card {
    display: grid;
    gap: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--color-panel);
    padding: 1rem;
    font-size: 0.9rem;
  }
  .vocab-sentence {
    border-left: 3px solid var(--border);
    padding-left: 0.75rem;
    color: var(--muted-foreground);
    font-style: italic;
  }
  .vocab-sentence b {
    color: var(--foreground);
    font-style: normal;
  }
  .vocab-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .vocab-notice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--color-panel);
    padding: 0.75rem 1rem;
  }
  @media (min-width: 640px) {
    .vocab-toolbar {
      grid-template-columns: 1fr 14rem;
    }
  }
```

`VocabularyNotice` memakai kelas `reader-toast` (posisi absolut di reader) ditambah `vocab-notice`. Di halaman Kosakata, `reader-toast` tidak boleh mengapung. Tambahkan aturan ini tepat sesudah `.vocab-notice { … }`:

```css
  .vocab-notice.reader-toast {
    position: static;
    max-width: none;
    margin: 0;
  }
```

Di `src/routes/privacy.tsx`:
- ganti `updated="20 Oktober 2026"` dengan `updated="24 Oktober 2026"`;
- ganti butir data membaca:

```tsx
        <li>
          Data membaca: posisi baca, pengaturan tampilan, dan aktivitas belajar,
          termasuk kata yang kamu simpan di Kosakata beserta artinya, kalimat
          asalnya, dan judul bukunya.
        </li>
```

- tambahkan subbab ini sebelum `<h2>Tempat penyimpanan</h2>`:

```tsx
      <h2>Kamus</h2>
      <p>
        Kata yang kamu ketuk saat membaca dikirim ke server kami untuk dicari
        artinya, dan tidak dibagikan ke pihak lain. Arti kata berasal dari{" "}
        <a href="https://en.wiktionary.org/">English Wiktionary</a> lewat
        ekstrak <a href="https://kaikki.org/">kaikki.org</a>, dengan lisensi{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
      </p>
```

Buat ulang pohon route:

Run: `npm run generate-routes`
Expected: `src/routeTree.gen.ts` memuat `/_member/_lobi/vocabulary`.

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run`
Expected: semua PASS.

Run: `npm run typecheck && npm run lint && npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/words/vocabulary.ts src/lib/words/vocabulary.test.ts src/lib/vocabulary-loader.ts src/components/vocabulary/VocabularyList.tsx src/components/vocabulary/VocabularyList.test.tsx src/routes/_member/_lobi/vocabulary.tsx src/routeTree.gen.ts src/components/lobby/LobbyPopup.tsx src/components/lobby/LobbyPopup.test.tsx src/components/member/MemberShell.tsx src/components/member/MemberShell.test.tsx src/test/router.tsx src/styles.css src/routes/privacy.tsx
git commit -m "feat(vocabulary): Kosakata lists saved words over the lobby, with search and undo"
```

---

### Task 14: Lemari katalog kartu di lobi

**Files:**
- Modify: `src/components/lobby/scene/layout.ts`
- Modify: `src/components/lobby/scene/furniture.ts`
- Modify: `src/components/lobby/lobby-data.ts`
- Modify: `src/components/lobby/LibraryMap.tsx`
- Modify: `src/components/lobby/LobbyStage.tsx` (`activate`)
- Modify: `src/styles.css` (tanda peta)
- Regenerate: `public/lobby/lobby-still*.{avif,webp}`
- Test: `src/components/lobby/scene/layout.test.ts`, `src/components/lobby/lobby-data.test.ts`, `src/components/lobby/LibraryMap.test.tsx` (sesuaikan)

**Interfaces:**
- Consumes: route `/vocabulary` (Task 13).
- Produces:
  - `CARD_CATALOG: Point2 = [1.0, 28.5]`
  - `HotspotId` termasuk `"katalog"`; `HOTSPOT_SPOTS` diakhiri `{ id: "katalog", label: [1.0, 2.1, 28.5], stand: [2.8, 28.6] }`.
  - Hotspot berlabel "Kosakata" (tombol 3D dan peta "Kosakata di peta") yang membuka `/vocabulary`.

- [ ] **Step 1: Sesuaikan test, pastikan gagal**

Di `src/components/lobby/scene/layout.test.ts`, ganti harapan urutan Tab:

```ts
  it("lists unique hotspots in tab order", () => {
    expect(HOTSPOT_SPOTS.map(({ id }) => id)).toEqual([
      "meja-baca",
      ...GENRE_VALUES,
      "troli",
      "meja-admin",
      "katalog",
    ])
  })
```

Di `src/components/lobby/lobby-data.test.ts`, tambahkan di akhir `describe("lobbyHotspots", …)`:

```ts
  it("ends with the card catalogue, which opens Kosakata", () => {
    const hotspots = lobbyHotspots(summarizeLobby([]).counts)
    expect(hotspots.at(-1)).toEqual({
      id: "katalog",
      label: "Kosakata",
      count: null,
      badge: null,
      dim: false,
    })
  })
```

Di `src/components/lobby/LibraryMap.test.tsx`:
- ganti `expect(screen.getAllByRole("button")).toHaveLength(11)` dengan `toHaveLength(12)`;
- di test `marks each kind of place as its legend shows`, tambahkan:

```ts
    expect(kindOf("Kosakata di peta")).toBe("katalog")
```

Run: `npx vitest run src/components/lobby`
Expected: FAIL pada ketiga test itu.

- [ ] **Step 2: Implementasi**

Di `src/components/lobby/scene/layout.ts`:
- sesudah `export const TROLLEY: Point2 = [9, 26.8]`, tambahkan:

```ts
/**
 * The card catalogue that opens Kosakata (spec 2 §6.4), against the left wall
 * by the admin desk: nothing tall stands between it and the camera.
 */
export const CARD_CATALOG: Point2 = [1.0, 28.5]
```

- ganti tipe `HotspotId`:

```ts
export type HotspotId =
  | Genre
  | "meja-baca"
  | "meja-admin"
  | "troli"
  | "katalog"
```

- ganti komentar dan isi akhir `HOTSPOT_SPOTS`:

```ts
/** In tab order (spec 1D §6): reading table, zones, trolley, admin desk, card catalogue. */
export const HOTSPOT_SPOTS: ReadonlyArray<HotspotSpot> = [
  { id: "meja-baca", label: [19.5, 2.2, 26], stand: [19.5, 28.2] },
  ...ZONES.map(({ genre, at: [x, z] }): HotspotSpot => ({
    id: genre,
    label: [x, TOWER.height + 0.7, z],
    stand: [x + 1.9, z + 1.9],
  })),
  { id: "troli", label: [9, 1.9, 26.8], stand: [10.5, 28.3] },
  { id: "meja-admin", label: [5.5, 2.8, 25.5], stand: [7.5, 27.8] },
  { id: "katalog", label: [1.0, 2.1, 28.5], stand: [2.8, 28.6] },
]
```

Di `src/components/lobby/scene/furniture.ts`:
- tambahkan `CARD_CATALOG` ke import dari `./layout` (urut abjad, sesudah `ATRIUM`);
- tambahkan fungsi ini sesudah `trolley`:

```ts
/** A low cabinet of small drawers with brass pulls: the card catalogue (spec 2 §6.4). */
function cardCatalog(kit: Kit) {
  const [cx, cz] = CARD_CATALOG
  kit.block(0.7, 1.25, 1.5, "#7a4a2a", cx, 0, cz, { r: 0.04 })
  kit.block(0.8, 0.06, 1.6, WOOD, cx, 1.25, cz, { r: 0.02 })
  const front = cx + 0.36
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      const y = 0.14 + row * 0.27
      const z = cz - 0.54 + column * 0.36
      kit.block(0.03, 0.22, 0.31, "#b9824c", front, y, z, {
        r: 0.01,
        cast: false,
      })
      kit.block(0.03, 0.03, 0.1, "#d9b26a", front + 0.02, y + 0.09, z, {
        r: 0.01,
        cast: false,
      })
    }
  }
}
```

- di `buildFurniture`, panggil sesudah `trolley(kit)` (fungsi ini tidak memakai `kit.rand`, jadi urutan acak perabot lain tidak berubah):

```ts
  cardCatalog(kit)
```

- ubah komentar `buildFurniture` menjadi `/** Towers, desks, the trolley, the card catalogue, decorations and the lounges (spec 1D §4). */`.

Di `src/components/lobby/lobby-data.ts`, di `lobbyHotspots`, tambahkan sesudah baris `meja-admin`:

```ts
    if (id === "katalog") return { ...plain, label: "Kosakata" }
```

Di `src/components/lobby/LibraryMap.tsx`:

```ts
type MapKind = "zone" | "meja-baca" | "meja-admin" | "troli" | "katalog"
```

dan di `LEGEND`, sisipkan sebelum `["anda", "Posisi Anda"]`:

```ts
  ["katalog", "Kosakata"],
```

Di `src/styles.css`, sesudah aturan `.lobby-map-spot[data-kind="troli"], .lobby-map-mark[data-kind="troli"] { … }`:

```css
  .lobby-map-spot[data-kind="katalog"],
  .lobby-map-mark[data-kind="katalog"] {
    background: #ff8fa3;
  }
```

Di `src/components/lobby/LobbyStage.tsx`, di `activate`, sisipkan sebelum `} else {` terakhir:

```ts
    } else if (id === "katalog") {
      void navigate({ to: "/vocabulary" })
```

- [ ] **Step 3: Jalankan test, pastikan lolos**

Run: `npx vitest run src/components/lobby`
Expected: semua PASS.

- [ ] **Step 4: Lihat lemarinya dan buat ulang gambar diam lobi**

Run: `node scripts/lobby-harness.mjs shot C:/Users/YUDHIS~1/AppData/Local/Temp/claude/c--project-epub-reader/2687717f-123f-44da-92ae-d1309b53ce77/scratchpad/lobby-katalog.png`
Expected: PNG 1440 × 900. Buka gambarnya. Lemari cokelat berlaci kecil terlihat di dinding kiri, di samping Meja Admin, dan tidak tertutup menara. Kalau tertutup, geser `CARD_CATALOG` (beserta `label` dan `stand` hotspot-nya) sepanjang dinding kiri, lalu jalankan lagi test layout.

Run: `node scripts/lobby-harness.mjs still`
Expected: `public/lobby/lobby-still.avif`, `lobby-still.webp`, `lobby-still-1280.avif`, dan `lobby-still-1280.webp` dibuat ulang, masing-masing di bawah 250 KB (skrip menolak yang lebih besar).

- [ ] **Step 5: Commit**

```bash
git add src/components/lobby public/lobby src/styles.css
git commit -m "feat(lobby): a card catalogue that opens Kosakata"
```

---

### Task 15: E2E Tahap 2A

**Files:**
- Create: `e2e/helpers/words.ts`
- Create: `e2e/vocabulary.spec.ts`

**Interfaces:**
- Consumes: semua task sebelumnya; helper `e2e/helpers/books.ts` (`seedBook`, `SHERLOCK`) dan `e2e/helpers/members.ts` (`createConfirmedMember`, `signInAndOnboard`, `userIdOf`, `hydrated`, `admin`).
- Produces: `visibleWord(page)`, `tapWord(page, isMobile)`, `savedWordsOf(userId)`.

- [ ] **Step 1: Tulis helper**

Buat `e2e/helpers/words.ts`:

```ts
import type { Page } from "@playwright/test"
import { admin } from "./members"

/**
 * A word of at least four letters that shows on the current page, and where
 * it sits in the window. foliate's frame is reached through its renderer;
 * its shadow root is closed to locators.
 */
export async function visibleWord(
  page: Page
): Promise<{ word: string; x: number; y: number }> {
  const found = await page.evaluate(() => {
    const view = document.querySelector("foliate-view") as unknown as {
      renderer: { getContents: () => Array<{ doc: Document }> }
    }
    const doc = view.renderer.getContents()[0].doc
    const frame = doc.defaultView?.frameElement?.getBoundingClientRect()
    if (!frame) return null
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text
      for (const match of text.data.matchAll(/\b[A-Za-z]{4,}\b/g)) {
        const range = doc.createRange()
        range.setStart(text, match.index)
        range.setEnd(text, match.index + match[0].length)
        const box = range.getBoundingClientRect()
        const x = frame.left + box.left + box.width / 2
        const y = frame.top + box.top + box.height / 2
        // Clear of the bars and of the window's edges.
        if (
          box.width > 0 &&
          x > 40 &&
          x < innerWidth - 40 &&
          y > 90 &&
          y < innerHeight - 110
        ) {
          return { word: match[0].toLowerCase(), x, y }
        }
      }
    }
    return null
  })
  if (!found) throw new Error("No word shows on this page")
  return found
}

/** Taps (or clicks) a word on the page and returns it, lower case. */
export async function tapWord(page: Page, isMobile: boolean): Promise<string> {
  const { word, x, y } = await visibleWord(page)
  if (isMobile) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
  return word
}

export async function savedWordsOf(
  userId: string
): Promise<Array<{ headword: string; sentence: string; cfi: string | null }>> {
  const { data, error } = await admin()
    .from("saved_words")
    .select("headword, sentence, cfi")
    .eq("user_id", userId)
  if (error) throw error
  return data
}
```

- [ ] **Step 2: Tulis E2E**

Buat `e2e/vocabulary.spec.ts`:

```ts
import { type Page, expect, test } from "@playwright/test"
import { seedBook } from "./helpers/books"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"
import { savedWordsOf, tapWord } from "./helpers/words"

// The dev project's dictionary changes with each import, so these tests
// check what the reader does with a word, not what the word means (plan 2A,
// decision 12).

async function memberReading(page: Page) {
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

test("a tapped word is saved, listed in Kosakata, and opens its place again", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000)
  const { userId, bookId } = await memberReading(page)

  const word = await tapWord(page, isMobile)
  const popup = page.getByRole("dialog", { name: `Arti ${word}` })
  await expect(popup).toBeVisible()
  await expect(
    popup.getByRole("link", { name: "Wiktionary · CC BY-SA" })
  ).toBeVisible()
  await popup.getByRole("button", { name: "Simpan" }).click()
  await expect(popup.getByRole("button", { name: "Tersimpan" })).toBeVisible()

  // Sent two seconds after the last change (spec 2 §7).
  await expect
    .poll(async () => (await savedWordsOf(userId)).length, { timeout: 20_000 })
    .toBe(1)
  const [saved] = await savedWordsOf(userId)
  expect(saved.sentence.toLowerCase()).toContain(word)
  expect(saved.cfi).not.toBeNull()

  await page.keyboard.press("Escape")
  await expect(popup).toBeHidden()

  // Kosakata: the tab bar on phones, the card catalogue in the lobby on desktop.
  if (isMobile) {
    await page.goto("/lobby")
    await hydrated(page)
    await page
      .getByRole("navigation", { name: "Navigasi anggota" })
      .last()
      .getByRole("link", { name: "Kosakata" })
      .click()
  } else {
    await page.goto("/lobby")
    await hydrated(page)
    await page
      .getByRole("region", { name: "Adegan lobi" })
      .getByRole("button", { name: "Kosakata", exact: true })
      .press("Enter")
  }
  await expect(page).toHaveURL(/\/vocabulary$/)
  const card = page.getByRole("article", { name: saved.headword })
  await expect(card).toBeVisible()

  await card.getByRole("link", { name: "Buka di buku" }).click()
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))
  await expect(page.getByRole("status", { name: "Posisi baca" })).toHaveText(
    /^\d+%$/,
    { timeout: 30_000 }
  )
  // The other device's place is not offered over the word's.
  await expect(page.getByText(/dibaca di perangkat lain/)).toBeHidden()
  // The saved word is underlined where it was found (spec 2 §6.5).
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const view = document.querySelector("foliate-view") as unknown as {
            renderer: { getContents: () => Array<{ doc: Document }> }
          }
          const frame = view.renderer.getContents().at(0)?.doc.defaultView as
            | (Window & { CSS: { highlights: Map<string, { size: number }> } })
            | null
            | undefined
          return frame?.CSS.highlights.get("glosa-saved")?.size ?? 0
        }),
      { timeout: 15_000 }
    )
    .toBeGreaterThan(0)
})

test("a deleted word comes back with Urungkan", async ({ page, isMobile }) => {
  const { userId } = await memberReading(page)
  await tapWord(page, isMobile)
  await page.getByRole("button", { name: "Simpan" }).click()
  await expect
    .poll(async () => (await savedWordsOf(userId)).length, { timeout: 20_000 })
    .toBe(1)
  const [saved] = await savedWordsOf(userId)

  await page.goto("/vocabulary")
  await hydrated(page)
  const card = page.getByRole("article", { name: saved.headword })
  await card.getByRole("button", { name: `Hapus ${saved.headword}` }).click()
  await expect(card).toBeHidden()
  await page.getByRole("button", { name: "Urungkan" }).click()
  await expect(page.getByRole("article", { name: saved.headword })).toBeVisible()
  // Whichever reached the server, the word is there in the end.
  await expect
    .poll(async () => (await savedWordsOf(userId)).length, { timeout: 20_000 })
    .toBe(1)
})

test("a tap beside the text still turns the page", async ({
  page,
  isMobile,
}) => {
  await memberReading(page)
  const pageNumber = () =>
    page.evaluate(
      () =>
        (
          document.querySelector("foliate-view") as unknown as {
            renderer: { page: number }
          }
        ).renderer.page
    )
  const before = await pageNumber()
  const { width, height } = page.viewportSize()!
  if (isMobile) await page.touchscreen.tap(width - 4, height / 2)
  else await page.mouse.click(width - 4, height / 2)
  await expect.poll(pageNumber).toBeGreaterThan(before)
  await expect(page.getByRole("dialog")).toBeHidden()
})

test("a place that is not in the book opens the last one, and says so", async ({
  page,
}) => {
  const { bookId } = await memberReading(page)
  await page.goto(
    `/read/${bookId}?cfi=${encodeURIComponent("epubcfi(/6/999!/4/2/1:0)")}`
  )
  await expect(
    page.getByText("Posisi itu tidak ditemukan di buku ini")
  ).toBeVisible({ timeout: 30_000 })
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))
})
```

- [ ] **Step 3: Jalankan E2E**

Run: `npx playwright test e2e/vocabulary.spec.ts --project=desktop --project=mobile`
Expected: 8 test PASS (4 per proyek). Ingat aturan port 3000 di Global Constraints.

Kalau test pertama gagal karena garis bawah atau popup menutupi kata berikutnya, perbaiki kodenya, bukan test-nya. Kalau `visibleWord` tidak menemukan kata di HP (halaman pembuka buku), tambah satu `PageDown` lagi di `memberReading`.

- [ ] **Step 4: Jalankan E2E yang terkait lobi dan reader**

Run: `npx playwright test e2e/reader.spec.ts e2e/lobby.spec.ts e2e/lobby-popup.spec.ts --project=desktop --project=mobile`
Expected: semua PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/helpers/words.ts e2e/vocabulary.spec.ts
git commit -m "test(e2e): tap a word, keep it in Kosakata, and open its place again"
```

---

### Task 16: Verifikasi akhir, spec, dan kamus di dev

**Files:**
- Modify: `docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md` (keputusan plan)
- (perbaikan lain hanya kalau verifikasi menemukan masalah)

- [ ] **Step 1: Seluruh pemeriksaan statis, unit, dan database**

Run: `npm run typecheck && npm run lint && npm run check && npm test`
Expected: semua PASS.

Run: `npm run test:db`
Expected: semua PASS, termasuk `dictionary.test.ts` dan `saved-words.test.ts`.

- [ ] **Step 2: Build produksi**

Run: `npm run build && node scripts/check-client-secrets.mjs`
Expected: build selesai tanpa error. Pemeriksaan rahasia lolos (kunci `SUPABASE_SECRET_KEY` tidak masuk bundle browser, walaupun `scripts/import-dictionary.ts` memakainya).

- [ ] **Step 3: Seluruh E2E kecuali uji batas kamera**

Run: `npx playwright test --project=desktop --project=mobile --project=offline`
Expected: semua PASS.

- [ ] **Step 4: Perbarui spec mengikuti keputusan plan**

Di `docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md`:
- §4.1: "Browser memanggil fungsi ini langsung lewat RPC…" diganti menjadi "Browser memanggil fungsi ini lewat server function `lookupWordFn`, seperti panggilan lain (tidak ada klien Supabase di browser). Di Tahap 5, kuota harian dihitung di server function yang sama."
- §4.1 Impor: perintahnya menjadi `node scripts/import-dictionary.ts <file.jsonl[.gz]> --env dev|prod [--dump-date YYYY-MM-DD] [--force]`, dengan `SUPABASE_URL` dan `SUPABASE_SECRET_KEY` dari `.env.local` (dev) atau `.env.prod` (prod); penukaran lewat fungsi `dict_swap`.
- §4.2: `saved_word_forms()` mengembalikan satu objek `jsonb` `{ headword: [bentuk…] }`; buku yang sudah tidak ada membuat kata disimpan tanpa buku; buku milik user lain ditolak.
- §7: "daftar disimpan di cache TanStack Query…" diganti menjadi "daftar disimpan di tabel Dexie `words`, seperti salinan rak".
- §6.3: tambahkan "Ketukan di ruang kosong saat popup terbuka hanya menutup popup."

Commit:

```bash
git add docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md
git commit -m "docs(spec): tahap 2 follows plan 2A, lookups through the server, Kosakata in Dexie"
```

- [ ] **Step 5: Isi kamus di proyek dev**

Ini perlu file kaikki beberapa GB. Tanyakan pemilik proyek apakah file sudah diunduh dan di mana letaknya, lalu jalankan sesuai [`docs/ops/deploy.md`](../../ops/deploy.md) §6.5:

Run: `node scripts/import-dictionary.ts <path-ke-file> --env dev`
Expected: ringkasan jumlah entri, bentuk kata, dan phrasal verb, lalu `Dictionary swapped in: { entries: …, forms: …, previous: null }`.

Kalau pemilik proyek belum mengunduh file-nya, lewati langkah ini dan catat di laporan akhir. Fitur tetap jalan; semua kata tampil "Belum ada arti untuk kata ini".

- [ ] **Step 6: Catat pemeriksaan manual untuk pemilik proyek**

Setelah merge ke `main`, situs dev ter-deploy otomatis. Migrasi sudah ada di proyek dev sejak Task 2 dan 4. Sampaikan daftar cek berikut untuk `glosa.nuvrastudio.space`:
- **HP (Android):**
  - ketuk kata → sheet arti dari bawah; ketuk di luar untuk menutup;
  - swipe tetap membalik halaman, dan ketukan di tepi tetap jalan;
  - tab **Kosakata** di tab bar.
- **Desktop:**
  - klik kata → popover di samping kata, kata disorot; Esc menutup;
  - hotspot lemari katalog di lobi membuka Kosakata di atas lobi.
- **Phrasal verb:** ketuk *gave* di "gave up" → saran frasa *give up* muncul paling atas.
- **Garis bawah:** kata tersimpan bergaris bawah titik-titik di buku lain juga, di tema terang, sepia, dan gelap.
- **Offline:** buka kata yang pernah dicari dalam mode pesawat → arti muncul; kata baru → "Arti butuh koneksi"; simpan saat offline → muncul di Kosakata, lalu terkirim saat online.
- **Buka di buku:** dari kartu Kosakata, buku terbuka di halaman kata itu.
