# Glosa Tahap 3C — Toko lobi: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membaca menghasilkan koin (1 per menit, ≤ 240 per hari, +50 per buku selesai yang dibaca ≥ 60 menit), dan koin membeli 18 dekorasi untuk 6 slot tetap di lobi 3D. Toko dibuka dari kios baru di lobi, dengan pratinjau 3D di desktop.

**Architecture:**
- **Server.** Katalog `lobby_items` (diisi migrasi). Saldo tidak disimpan: dihitung dari `reading_time` + `coin_awards` (bonus buku, ditulis sekali) + `coin_grants` (Tahap 5) − `lobby_purchases`. Barang terpasang di `lobby_placements`. Fungsi `lobby_state`, `buy_lobby_item`, `place_lobby_item`. Server function di `src/server/shop.ts`.
- **Perangkat.** `src/lib/shop/shop-client.ts` adalah store modul (pola `habit-client.ts`): status toko, cache di Dexie `meta`, pratinjau, beli, pasang.
- **3D.** `scene/decor.ts` membangun barang per id di slotnya dan kios toko. `stage.setDecor(placed)`. `LobbyScene` mendapat `showDecor(slot)` untuk menggeser kamera ke slot.
- **UI.** Popup `/shop` (`ShopPanel`), panel sempit di kanan pada desktop supaya lobi terlihat di sampingnya. Hotspot `toko`.

**Tech Stack:** TanStack Start + Router, React 19, TypeScript, Tailwind CSS 4, Supabase (Postgres, RLS, PostgREST RPC), zod 4, Dexie, three.js, Vitest + Testing Library (jsdom), fake-indexeddb, Playwright, sharp.

**Spec:** [`docs/superpowers/specs/2026-11-06-tahap-3c-toko-lobi-design.md`](../specs/2026-11-06-tahap-3c-toko-lobi-design.md)

## Global Constraints

- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris (mengikuti kode yang ada). Array ditulis `Array<T>`.
- **Dependensi:** tidak ada dependensi baru.
- **Angka (persis dari spec):**
  - 1 koin per menit baca: per tanggal `least(floor(total detik / 60), 240)`;
  - bonus buku selesai +50, sekali per buku, bila total detik buku itu ≥ 3600;
  - target harian **tidak** memberi koin;
  - plafon jam baca tetap 10 menit per halaman (tidak diubah);
  - 6 slot × 3 barang, harga 60–600 (tabel di Task 1).
- **Teks dari spec, persis:** "Toko lobi", "1 koin per menit baca, +50 per buku selesai (dibaca minimal 1 jam)", "Beli", "Pasang", "Terpasang", "Lepas", "Kurang N koin", "Beli Kucing tidur seharga 250 koin?" (nama dan harga mengikuti barang), "Baca untuk mendapat koin", "Perlu koneksi internet", "Koinmu belum cukup".
- **SQL:** RLS "baca milik sendiri"; penulisan lewat fungsi `security definer` dengan `set search_path = ''`; error otentikasi `raise exception 'not_authenticated' using errcode = 'P0001'`; `revoke execute … from public, anon` lalu `grant` ke `authenticated`. Fungsi internal (dengan parameter `p_user_id`) di-`revoke` juga dari `authenticated`.
- **Migrasi:**
  - di-push ke proyek Supabase dev (`npm run db:push`);
  - tipe dibuat ulang (`npm run db:types` + `npx prettier --write src/server/database.types.ts`);
  - isinya hanya tambahan, sesuai aturan migrasi prod di [`docs/ops/deploy.md`](../../ops/deploy.md) §7.
- **Proyek dev dipakai bersama** oleh situs dev, CI, dan test. Test hanya menulis baris milik member test-nya sendiri.
- **Line ending:** LF. Di Windows, jangan menulis file lewat Python tanpa `newline=''`.
- **Route tree:** jangan pakai `npm run generate-routes`; biarkan dev server/`vite build` membuat ulang `routeTree.gen.ts`, lalu pastikan blok `Register` milik TanStack Start masih ada (pelajaran 3B Task 6).
- **E2E:**
  - jalankan dengan `--workers=2`;
  - kalau port 3000 dipegang aplikasi lain (cek `curl -sL localhost:3000/login | grep -o "<title>[^<]*"`), pakai config sementara di port 3100 dan jangan matikan server lain. Config itu cukup memuat project `desktop` dan `mobile` serta `webServer[0]`, lalu dihapus setelah selesai;
  - satu kegagalan dijalankan ulang sendirian dulu sebelum disebut regresi.
- **Tidak ada push ke GitHub** sampai seluruh Tahap 3 selesai (keputusan pemilik 2026-11-06). Commit lokal saja; `npm run db:push` ke Supabase dev tetap boleh.

## Keputusan dan penyimpangan dari spec

1. **`coin_balance()` digabung ke `lobby_state()`.** Klien hanya butuh satu panggilan; `lobby_state` menjawab `jsonb` `{earned, spent, balance, owned, placed}`. Perhitungan bersama ada di fungsi internal `coin_totals(p_user_id)` dan `award_book_coins(p_user_id)`.
2. **`lobby_placements` memakai foreign key majemuk** `(user_id, item_id) → lobby_purchases`, sehingga barang yang tidak dimiliki tidak bisa terpasang, juga lewat jalan lain. Kecocokan slot dijaga `place_lobby_item`.
3. **Kode `not_found` dari DB menjadi `item_missing`** di server function, karena `bookMessage("not_found")` berbunyi "Buku ini tidak ada di rakmu.". Pesan baru: `not_enough` → "Koinmu belum cukup.", `not_owned` → "Barang ini belum kamu miliki.", `item_missing` → "Barang ini tidak ada di toko.".
4. **Panel toko di desktop berdiri di kanan, selebar ±28rem, tanpa latar buram** (`LobbyPopup side`). Popup lain menutupi lobi dengan latar buram, sehingga pratinjau 3D tidak akan terlihat. Klik di lobi tetap menutup toko, seperti latar popup lain.
5. **Pratinjau dipicu tombol "Lihat di lobi"** di tiap barang (hanya desktop, `hidden lg:inline-flex`). Kamera memusatkan slot di bagian lobi yang terlihat: `panBy(centerOn(view, focus), PREVIEW_SHIFT, 0, viewport)` dengan `PREVIEW_SHIFT = 0.16`.
6. **Barang tidak bergerak.** Spec membolehkan gerak pelan; adegan hanya digambar saat ada perubahan (keputusan 3B no. 6), jadi gerak butuh loop frame baru. Tanpa gerak juga berarti `prefers-reduced-motion` tidak perlu ditangani.
7. **`buildDecor` menerima `THREE.Scene`, bukan `Kit`,** dan memakai material miliknya sendiri. Material `kit.mat` dipakai bersama seluruh lobi sehingga tidak boleh dibuang saat barang diganti; tanpa `Kit` juga bisa diuji di jsdom (kit membuat tekstur kanvas).
8. **Cache perangkat berisi seluruh `LobbyState`** (bukan hanya barang terpasang) di `meta` dengan kunci `lobbyShop`, supaya panel offline menampilkan saldo terakhir dan barang milik dengan tombol nonaktif. `meta` sudah dihapus oleh `wipeMemberData`.
9. **Status dimuat ulang di layout `_lobi`** lewat `useQueueFlush(user.id, refreshShop)`, seperti `refreshHabit`. `refreshShop` mengirim antrean waktu baca dulu (`habitSync().flush()`).
10. **Letak slot dan kios** (diperiksa screenshot harness di Task 3, boleh digeser bila tertutup):
    - `rug` [19.5, 0, 26] di bawah meja baca (rata lantai); `lamp` [14.6, 0, 26.4]; `seat` [31.5, 0, 3.2] menghadap kaca; `wall` [0.1, 6, 30] di dinding kiri; `pet` [30.5, 0, 22]; `ceiling` [22, 9.5, 19] menggantung;
    - kios `KIOSK` [24.6, 31.6], hotspot `toko` terakhir dalam urutan tab, label "Toko lobi".
11. **Gambar kecil** dibuat oleh perintah harness baru `thumbs` (480 × 360, webp) dari adegan dengan satu barang terpasang dan kamera di slotnya. Katalog dibaca lewat `server.ssrLoadModule`.

## Struktur file

| File | Tanggung jawab |
|---|---|
| `supabase/migrations/20261106000300_lobby_shop.sql` | Tabel, katalog, fungsi (Task 1) |
| `src/lib/shop/catalog.ts` | Slot, barang, angka koin (Task 1) |
| `tests/db/shop.test.ts` | Tes DB (Task 1) |
| `src/lib/shop/types.ts`, `src/lib/shop/schemas.ts` | `LobbyState`, `Placements`, zod (Task 2) |
| `src/server/shop.ts` | Server function (Task 2) |
| `src/lib/shop/shop-client.ts` | Store modul, cache, pratinjau (Task 2) |
| `src/lib/local/shop-cache.ts` | Baca/tulis `meta.lobbyShop` (Task 2) |
| `src/components/lobby/scene/decor.ts` | Barang 3D dan kios (Task 3) |
| `src/components/lobby/scene/layout.ts` | `DECOR_SLOTS`, `KIOSK`, hotspot `toko` (Task 3) |
| `src/components/lobby/ShopPanel.tsx` | Panel toko (Task 4) |
| `src/routes/_member/_lobi/shop.tsx` | Rute popup (Task 4) |
| `scripts/lobby-harness.mjs`, `scripts/lobby-harness/main.ts` | `thumbs`, `?decor=` (Task 5) |
| `public/lobby/shop/*.webp` | 18 gambar kecil (Task 5) |
| `e2e/shop.spec.ts`, `e2e/helpers/shop.ts` | E2E (Task 6) |

---

### Task 1: Database — katalog, koin, belanja

**Files:**
- Create: `src/lib/shop/catalog.ts`
- Create: `src/lib/shop/catalog.test.ts`
- Create: `supabase/migrations/20261106000300_lobby_shop.sql`
- Create: `tests/db/shop.test.ts`
- Modify: `src/server/database.types.ts` (dibuat ulang)

**Interfaces:**
- Produces: `SLOT_IDS`, `SlotId`, `SLOTS`, `SHOP_ITEMS`, `ShopItem`, `itemOf(id)`, `COINS_PER_BOOK = 50`, `MIN_BOOK_SECONDS = 3600`, `DAILY_COIN_CAP = 240` dari `@/lib/shop/catalog`. RPC `lobby_state() → jsonb`, `buy_lobby_item(p_item text) → text`, `place_lobby_item(p_slot text, p_item text) → text`.

- [ ] **Step 1: Tulis tes katalog yang gagal**

`src/lib/shop/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { SHOP_ITEMS, SLOTS, SLOT_IDS, itemOf } from "./catalog"

describe("shop catalog", () => {
  it("has three items in each of the six slots", () => {
    expect(SLOT_IDS).toEqual(["rug", "lamp", "seat", "wall", "pet", "ceiling"])
    expect(SLOTS.map(({ id }) => id)).toEqual([...SLOT_IDS])
    for (const slot of SLOT_IDS) {
      expect(SHOP_ITEMS.filter((item) => item.slot === slot)).toHaveLength(3)
    }
  })

  it("names every item after its slot, once, at 60–600 coins", () => {
    const ids = SHOP_ITEMS.map(({ id }) => id)
    expect(new Set(ids).size).toBe(18)
    for (const item of SHOP_ITEMS) {
      expect(item.id.startsWith(`${item.slot}_`)).toBe(true)
      expect(item.price).toBeGreaterThanOrEqual(60)
      expect(item.price).toBeLessThanOrEqual(600)
    }
  })

  it("adds up to 760 for the cheapest per slot and 4,330 for all", () => {
    const cheapest = SLOT_IDS.map((slot) =>
      Math.min(
        ...SHOP_ITEMS.filter((item) => item.slot === slot).map((i) => i.price)
      )
    )
    expect(cheapest.reduce((a, b) => a + b, 0)).toBe(760)
    expect(SHOP_ITEMS.reduce((sum, item) => sum + item.price, 0)).toBe(4330)
  })

  it("finds an item by id", () => {
    expect(itemOf("pet_cat")).toMatchObject({ name: "Kucing tidur", price: 250 })
    expect(itemOf("nope")).toBeUndefined()
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/shop/catalog.test.ts`
Expected: FAIL, modul `./catalog` tidak ada.

- [ ] **Step 3: Tulis katalog**

`src/lib/shop/catalog.ts`:

```ts
/** The lobby shop (spec 3C §4): six fixed slots, three items each. */
export const SLOT_IDS = ["rug", "lamp", "seat", "wall", "pet", "ceiling"] as const
export type SlotId = (typeof SLOT_IDS)[number]

export const SLOTS: ReadonlyArray<{ id: SlotId; name: string }> = [
  { id: "rug", name: "Karpet baca" },
  { id: "lamp", name: "Lampu" },
  { id: "seat", name: "Kursi santai" },
  { id: "wall", name: "Dinding" },
  { id: "pet", name: "Teman" },
  { id: "ceiling", name: "Gantungan" },
]

export type ShopItem = { id: string; slot: SlotId; name: string; price: number }

/** Same ids, slots and prices as the lobby_items rows (tests/db/shop.test.ts). */
export const SHOP_ITEMS: ReadonlyArray<ShopItem> = [
  { id: "rug_woven", slot: "rug", name: "Karpet anyaman", price: 60 },
  { id: "rug_round", slot: "rug", name: "Karpet bundar", price: 120 },
  { id: "rug_pattern", slot: "rug", name: "Karpet motif", price: 300 },
  { id: "lamp_floor", slot: "lamp", name: "Lampu lantai", price: 80 },
  { id: "lamp_arc", slot: "lamp", name: "Lampu tiang lengkung", price: 150 },
  { id: "lamp_lantern", slot: "lamp", name: "Lentera gantung", price: 250 },
  { id: "seat_beanbag", slot: "seat", name: "Bean bag", price: 100 },
  { id: "seat_armchair", slot: "seat", name: "Kursi berlengan", price: 200 },
  { id: "seat_sofa", slot: "seat", name: "Sofa jendela", price: 400 },
  { id: "wall_map", slot: "wall", name: "Peta dunia", price: 120 },
  { id: "wall_painting", slot: "wall", name: "Lukisan", price: 200 },
  { id: "wall_clock", slot: "wall", name: "Jam dinding besar", price: 300 },
  { id: "pet_cat", slot: "pet", name: "Kucing tidur", price: 250 },
  { id: "pet_bird", slot: "pet", name: "Sangkar burung", price: 300 },
  { id: "pet_aquarium", slot: "pet", name: "Akuarium", price: 400 },
  { id: "ceiling_lights", slot: "ceiling", name: "Untaian lampu", price: 150 },
  { id: "ceiling_books", slot: "ceiling", name: "Buku terbang", price: 350 },
  { id: "ceiling_globe", slot: "ceiling", name: "Bola dunia antik", price: 600 },
]

export const itemOf = (id: string): ShopItem | undefined =>
  SHOP_ITEMS.find((item) => item.id === id)

/** Coins for a finished book read at least MIN_BOOK_SECONDS (spec 3C §3.1). */
export const COINS_PER_BOOK = 50
export const MIN_BOOK_SECONDS = 3600
/** The most coins one day of reading earns. */
export const DAILY_COIN_CAP = 240
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run src/lib/shop/catalog.test.ts`
Expected: PASS, 4 tes.

- [ ] **Step 5: Tulis tes DB yang gagal**

`tests/db/shop.test.ts`:

```ts
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { SHOP_ITEMS } from "@/lib/shop/catalog"
import {
  adminClient,
  createTestMember,
  deleteTestMembers,
  newTestBook,
  signedInClient,
} from "./helpers"

const run = Date.now().toString(36)
const emails = {
  ani: `db-shop-ani-${run}@glosa.test`,
  budi: `db-shop-budi-${run}@glosa.test`,
  cita: `db-shop-cita-${run}@glosa.test`,
}
type Client = Awaited<ReturnType<typeof signedInClient>>
type State = {
  earned: number
  spent: number
  balance: number
  owned: Array<string>
  placed: Record<string, string>
}

/** Reading from another device, written straight to the table. */
async function seed(userId: string, bookId: string, day: string, seconds: number) {
  const { error } = await adminClient().from("reading_time").insert({
    user_id: userId,
    day,
    device_id: randomUUID(),
    book_id: bookId,
    seconds,
    goal_minutes: null,
  })
  if (error) throw error
}

async function state(client: Client): Promise<State> {
  const { data, error } = await client.rpc("lobby_state")
  if (error) throw error
  return data as State
}

async function buy(client: Client, item: string) {
  const { data, error } = await client.rpc("buy_lobby_item", { p_item: item })
  if (error) throw error
  return data
}

async function place(client: Client, slot: string, item: string | null) {
  const { data, error } = await client.rpc("place_lobby_item", {
    p_slot: slot,
    p_item: item as string,
  })
  if (error) throw error
  return data
}

describe("lobby shop", () => {
  const ids = { ani: "", budi: "", cita: "" }
  const books = { ani: "", budi: "", budi2: "", cita: "" }
  let ani: Client
  let budi: Client
  let cita: Client

  beforeAll(async () => {
    ids.ani = (await createTestMember({ email: emails.ani })).id
    ids.budi = (await createTestMember({ email: emails.budi })).id
    ids.cita = (await createTestMember({ email: emails.cita })).id
    books.ani = await newTestBook(ids.ani)
    books.budi = await newTestBook(ids.budi)
    books.budi2 = await newTestBook(ids.budi)
    books.cita = await newTestBook(ids.cita)
    ani = await signedInClient(emails.ani)
    budi = await signedInClient(emails.budi)
    cita = await signedInClient(emails.cita)
  })

  afterAll(async () => {
    await deleteTestMembers()
  })

  it("keeps the same catalogue as the code", async () => {
    const { data, error } = await ani
      .from("lobby_items")
      .select("id, slot, price")
      .order("id")
    if (error) throw error
    const code = SHOP_ITEMS.map(({ id, slot, price }) => ({ id, slot, price }))
    expect(data).toEqual(code.sort((a, b) => a.id.localeCompare(b.id)))
  })

  it("starts empty", async () => {
    expect(await state(ani)).toEqual({
      earned: 0,
      spent: 0,
      balance: 0,
      owned: [],
      placed: {},
    })
  })

  it("pays a coin per whole minute, at most 240 a day, over every device", async () => {
    await seed(ids.ani, books.ani, "2026-01-01", 59)
    await seed(ids.ani, books.ani, "2026-01-01", 62) // same day: 121 s = 2
    await seed(ids.ani, books.ani, "2026-01-02", 20_000) // capped at 240
    await seed(ids.ani, books.ani, "2026-01-03", 599) // 9
    expect((await state(ani)).earned).toBe(2 + 240 + 9)
  })

  it("buys, places in the slot, and refuses what it cannot pay", async () => {
    // Ani has 251 coins.
    expect(await buy(ani, "nope")).toBe("not_found")
    expect(await buy(ani, "rug_woven")).toBe("ok")
    expect(await buy(ani, "rug_woven")).toBe("owned")
    let now = await state(ani)
    expect(now).toMatchObject({ spent: 60, balance: 191 })
    expect(now.owned).toEqual(["rug_woven"])
    expect(now.placed).toEqual({ rug: "rug_woven" })
    expect(await buy(ani, "rug_round")).toBe("ok") // replaces the woven rug
    now = await state(ani)
    expect(now.placed).toEqual({ rug: "rug_round" })
    expect(now.balance).toBe(71)
    expect(await buy(ani, "pet_cat")).toBe("not_enough")
    const { data } = await adminClient()
      .from("lobby_purchases")
      .select("item_id, price")
      .eq("user_id", ids.ani)
      .order("item_id")
    expect(data).toEqual([
      { item_id: "rug_round", price: 120 },
      { item_id: "rug_woven", price: 60 },
    ])
  })

  it("places and takes off only items owned, in their own slot", async () => {
    expect(await place(ani, "rug", "rug_woven")).toBe("ok")
    expect((await state(ani)).placed).toEqual({ rug: "rug_woven" })
    expect(await place(ani, "rug", "rug_pattern")).toBe("not_owned")
    expect(await place(ani, "lamp", "rug_woven")).toBe("not_found")
    expect(await place(ani, "sofa", null)).toBe("not_found")
    expect(await place(ani, "rug", null)).toBe("ok")
    expect((await state(ani)).placed).toEqual({})
    expect(await place(ani, "rug", null)).toBe("ok")
  })

  it("lets two purchases at once spend the balance once", async () => {
    // Cita: 300 coins; each item costs 250 or 300.
    await seed(ids.cita, books.cita, "2026-01-01", 240 * 60)
    await seed(ids.cita, books.cita, "2026-01-02", 60 * 60)
    const answers = await Promise.all([
      buy(cita, "pet_cat"),
      buy(cita, "pet_bird"),
    ])
    expect(answers.filter((answer) => answer === "ok")).toHaveLength(1)
    expect(answers.filter((answer) => answer === "not_enough")).toHaveLength(1)
    expect((await state(cita)).balance).toBeGreaterThanOrEqual(0)
  })

  it("pays 50 once per finished book read an hour, kept after unfinishing and deleting", async () => {
    const finish = (bookId: string, at: string | null) =>
      adminClient().from("books").update({ finished_at: at }).eq("id", bookId)
    await finish(books.budi, new Date().toISOString())
    await seed(ids.budi, books.budi, "2026-01-01", 3599)
    // 59 minutes: no bonus yet.
    expect((await state(budi)).earned).toBe(59)
    await seed(ids.budi, books.budi, "2026-01-02", 1) // the last second arrives
    expect((await state(budi)).earned).toBe(59 + 0 + 50)
    expect((await state(budi)).earned).toBe(109) // once
    await finish(books.budi, null)
    expect((await state(budi)).earned).toBe(109)
    await adminClient().from("books").delete().eq("id", books.budi)
    expect((await state(budi)).earned).toBe(109)
    // Read an hour but not finished: no bonus.
    await seed(ids.budi, books.budi2, "2026-01-03", 3600)
    expect((await state(budi)).earned).toBe(109 + 60)
  })

  it("adds coins granted from outside reading", async () => {
    const before = (await state(budi)).earned
    const { error } = await adminClient()
      .from("coin_grants")
      .insert({ user_id: ids.budi, coins: 25, reason: "test" })
    if (error) throw error
    expect((await state(budi)).earned).toBe(before + 25)
  })

  it("keeps every table read-only and private", async () => {
    for (const [table, row] of [
      ["lobby_purchases", { user_id: ids.ani, item_id: "pet_cat", price: 1 }],
      ["lobby_placements", { user_id: ids.ani, slot: "rug", item_id: "rug_round" }],
      ["coin_awards", { user_id: ids.ani, book_id: randomUUID(), coins: 50 }],
      ["coin_grants", { user_id: ids.ani, coins: 1000, reason: "me" }],
      ["lobby_items", { id: "free", slot: "rug", price: 1 }],
    ] as const) {
      const { error } = await ani.from(table).insert(row as never)
      expect(error, table).not.toBeNull()
    }
    const { data } = await budi.from("lobby_purchases").select("item_id")
    expect(data).toEqual([])
    const { error } = await ani.rpc("award_book_coins" as never, {
      p_user_id: ids.ani,
    } as never)
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 6: Jalankan, pastikan gagal**

Run: `npx vitest run --config vitest.db.config.ts tests/db/shop.test.ts`
Expected: FAIL, tabel `lobby_items` dan fungsi `lobby_state` tidak ada.

- [ ] **Step 7: Tulis migrasi**

`supabase/migrations/20261106000300_lobby_shop.sql`:

```sql
-- The lobby shop (spec 3C §5). Coins are never stored: the balance is
-- worked out from reading_time, coin_awards and coin_grants, minus the
-- purchases, so it cannot drift from what was read.

-- The catalogue; the server takes prices from here, never from the client.
-- Same rows as src/lib/shop/catalog.ts (tests/db/shop.test.ts).
create table public.lobby_items (
  id text primary key,
  slot text not null
    check (slot in ('rug', 'lamp', 'seat', 'wall', 'pet', 'ceiling')),
  price integer not null check (price > 0)
);

insert into public.lobby_items (id, slot, price) values
  ('rug_woven', 'rug', 60),
  ('rug_round', 'rug', 120),
  ('rug_pattern', 'rug', 300),
  ('lamp_floor', 'lamp', 80),
  ('lamp_arc', 'lamp', 150),
  ('lamp_lantern', 'lamp', 250),
  ('seat_beanbag', 'seat', 100),
  ('seat_armchair', 'seat', 200),
  ('seat_sofa', 'seat', 400),
  ('wall_map', 'wall', 120),
  ('wall_painting', 'wall', 200),
  ('wall_clock', 'wall', 300),
  ('pet_cat', 'pet', 250),
  ('pet_bird', 'pet', 300),
  ('pet_aquarium', 'pet', 400),
  ('ceiling_lights', 'ceiling', 150),
  ('ceiling_books', 'ceiling', 350),
  ('ceiling_globe', 'ceiling', 600);

alter table public.lobby_items enable row level security;
create policy lobby_items_select on public.lobby_items
  for select to authenticated
  using (true);
revoke all on table public.lobby_items from anon, authenticated;
grant select on table public.lobby_items to authenticated;

-- +50 for a finished book read an hour (spec 3C §3.1). Written once and
-- never deleted; book_id has no foreign key, like reading_time, so the
-- bonus stays after the book is deleted.
create table public.coin_awards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid not null,
  coins integer not null check (coins > 0),
  awarded_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- Coins from outside reading, e.g. bought in Tahap 5. Empty in 3C.
create table public.coin_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  coins integer not null check (coins > 0),
  reason text not null,
  created_at timestamptz not null default now()
);
create index coin_grants_user_id on public.coin_grants (user_id);

-- Bought once, kept for good, with the price paid then.
create table public.lobby_purchases (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.lobby_items (id),
  price integer not null check (price > 0),
  bought_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- At most one item per slot, and only an item the member owns.
create table public.lobby_placements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot text not null,
  item_id text not null,
  primary key (user_id, slot),
  foreign key (user_id, item_id)
    references public.lobby_purchases (user_id, item_id) on delete cascade
);

alter table public.coin_awards enable row level security;
alter table public.coin_grants enable row level security;
alter table public.lobby_purchases enable row level security;
alter table public.lobby_placements enable row level security;

create policy coin_awards_select_own on public.coin_awards
  for select to authenticated using (user_id = (select auth.uid()));
create policy coin_grants_select_own on public.coin_grants
  for select to authenticated using (user_id = (select auth.uid()));
create policy lobby_purchases_select_own on public.lobby_purchases
  for select to authenticated using (user_id = (select auth.uid()));
create policy lobby_placements_select_own on public.lobby_placements
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on table public.coin_awards from anon, authenticated;
revoke all on table public.coin_grants from anon, authenticated;
revoke all on table public.lobby_purchases from anon, authenticated;
revoke all on table public.lobby_placements from anon, authenticated;
grant select on table public.coin_awards to authenticated;
grant select on table public.coin_grants to authenticated;
grant select on table public.lobby_purchases to authenticated;
grant select on table public.lobby_placements to authenticated;

-- Internal: the bonus for every finished book read an hour that has none.
-- Run before every balance, so a book finished before its last minutes
-- arrived still earns it once they do.
create function public.award_book_coins(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.coin_awards (user_id, book_id, coins)
  select b.user_id, b.id, 50
  from public.books b
  where b.user_id = p_user_id
    and b.finished_at is not null
    and (
      select coalesce(sum(rt.seconds), 0)
      from public.reading_time rt
      where rt.user_id = p_user_id and rt.book_id = b.id
    ) >= 3600
  on conflict (user_id, book_id) do nothing
$$;

-- Internal: coins earned (whole minutes per day, at most 240, plus bonuses
-- and grants) and coins spent.
create function public.coin_totals(p_user_id uuid)
returns table (earned integer, spent integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      (select coalesce(sum(least(d.seconds / 60, 240)), 0)
        from (
          select sum(rt.seconds) as seconds
          from public.reading_time rt
          where rt.user_id = p_user_id
          group by rt.day
        ) d)
      + (select coalesce(sum(a.coins), 0)
        from public.coin_awards a where a.user_id = p_user_id)
      + (select coalesce(sum(g.coins), 0)
        from public.coin_grants g where g.user_id = p_user_id)
    )::integer,
    (select coalesce(sum(p.price), 0)
      from public.lobby_purchases p where p.user_id = p_user_id)::integer
$$;

-- The balance, the items owned and the items placed, in one answer.
create function public.lobby_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_earned integer;
  v_spent integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  perform public.award_book_coins(v_user_id);
  select t.earned, t.spent into v_earned, v_spent
  from public.coin_totals(v_user_id) t;
  return jsonb_build_object(
    'earned', v_earned,
    'spent', v_spent,
    'balance', v_earned - v_spent,
    'owned', coalesce(
      (select jsonb_agg(p.item_id order by p.bought_at, p.item_id)
        from public.lobby_purchases p where p.user_id = v_user_id),
      '[]'::jsonb),
    'placed', coalesce(
      (select jsonb_object_agg(l.slot, l.item_id)
        from public.lobby_placements l where l.user_id = v_user_id),
      '{}'::jsonb)
  );
end;
$$;

-- Buys an item and places it in its slot. The member's profile row is
-- locked, so two purchases at once cannot both spend the same coins: the
-- second waits and then sees the first.
create function public.buy_lobby_item(p_item text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_slot text;
  v_price integer;
  v_earned integer;
  v_spent integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select i.slot, i.price into v_slot, v_price
  from public.lobby_items i where i.id = p_item;
  if not found then
    return 'not_found';
  end if;
  perform 1 from public.profiles p where p.id = v_user_id for update;
  if exists (
    select 1 from public.lobby_purchases p
    where p.user_id = v_user_id and p.item_id = p_item
  ) then
    return 'owned';
  end if;
  perform public.award_book_coins(v_user_id);
  select t.earned, t.spent into v_earned, v_spent
  from public.coin_totals(v_user_id) t;
  if v_earned - v_spent < v_price then
    return 'not_enough';
  end if;
  insert into public.lobby_purchases (user_id, item_id, price)
  values (v_user_id, p_item, v_price);
  insert into public.lobby_placements as l (user_id, slot, item_id)
  values (v_user_id, v_slot, p_item)
  on conflict (user_id, slot) do update set item_id = excluded.item_id;
  return 'ok';
end;
$$;

-- Places an owned item in its slot; a null item takes the slot's item off.
create function public.place_lobby_item(p_slot text, p_item text)
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
  if p_slot is null or not exists (
    select 1 from public.lobby_items i where i.slot = p_slot
  ) then
    return 'not_found';
  end if;
  if p_item is null then
    delete from public.lobby_placements l
    where l.user_id = v_user_id and l.slot = p_slot;
    return 'ok';
  end if;
  if not exists (
    select 1 from public.lobby_items i where i.id = p_item and i.slot = p_slot
  ) then
    return 'not_found';
  end if;
  if not exists (
    select 1 from public.lobby_purchases p
    where p.user_id = v_user_id and p.item_id = p_item
  ) then
    return 'not_owned';
  end if;
  insert into public.lobby_placements as l (user_id, slot, item_id)
  values (v_user_id, p_slot, p_item)
  on conflict (user_id, slot) do update set item_id = excluded.item_id;
  return 'ok';
end;
$$;

revoke execute on function public.award_book_coins(uuid)
  from public, anon, authenticated;
revoke execute on function public.coin_totals(uuid)
  from public, anon, authenticated;
revoke execute on function public.lobby_state() from public, anon;
grant execute on function public.lobby_state() to authenticated;
revoke execute on function public.buy_lobby_item(text) from public, anon;
grant execute on function public.buy_lobby_item(text) to authenticated;
revoke execute on function public.place_lobby_item(text, text)
  from public, anon;
grant execute on function public.place_lobby_item(text, text)
  to authenticated;
```

- [ ] **Step 8: Push migrasi dan buat ulang tipe**

Run: `npm run db:push && npm run db:types && npx prettier --write src/server/database.types.ts`
Expected: migrasi `20261106000300_lobby_shop.sql` diterapkan; `database.types.ts` memuat `lobby_items`, `lobby_purchases`, `lobby_placements`, `coin_awards`, `coin_grants`, dan fungsi `lobby_state`, `buy_lobby_item`, `place_lobby_item`. Pastikan tidak ada baris "Connecting to remote database…" atau teks CLI lain yang ikut masuk ke file.

- [ ] **Step 9: Jalankan tes DB, pastikan lulus**

Run: `npx vitest run --config vitest.db.config.ts tests/db/shop.test.ts`
Expected: PASS, 9 tes. Lalu `npx vitest run --config vitest.db.config.ts tests/db/habit.test.ts tests/db/collections.test.ts`: tetap PASS.

- [ ] **Step 10: Typecheck dan commit**

Run: `npm run typecheck && npm run lint`
Expected: bersih.

```bash
git add src/lib/shop supabase/migrations/20261106000300_lobby_shop.sql tests/db/shop.test.ts src/server/database.types.ts
git commit -m "feat(db): the lobby shop's catalogue, coins worked out from reading, and buying and placing"
```

---

### Task 2: Data toko — server function, cache, klien

**Files:**
- Create: `src/lib/shop/types.ts`
- Create: `src/lib/shop/schemas.ts`
- Create: `src/server/shop.ts`
- Create: `src/lib/local/shop-cache.ts`
- Create: `src/lib/local/shop-cache.test.ts`
- Create: `src/lib/shop/shop-client.ts`
- Create: `src/lib/shop/shop-client.test.ts`
- Modify: `src/lib/book-messages.ts` (tiga pesan baru)
- Modify: `src/routes/_member/_lobi.tsx` (`useQueueFlush(user.id, refreshShop)`)

**Interfaces:**
- Consumes: `SlotId`, `SLOT_IDS`, `itemOf` (Task 1); `habitSync()` dari `@/lib/habit/habit-client`; `onMemberDataWiped` dari `@/lib/local/device`; `localDb().meta`.
- Produces:
  - `type Placements = Partial<Record<SlotId, string>>`
  - `type LobbyState = { earned: number; spent: number; balance: number; owned: Array<string>; placed: Placements }`
  - `type LobbyAnswer = { ok: true; state: LobbyState } | { ok: false; code: string }`
  - `type ShopView = { status: "loading" | "ready" | "failed"; state: LobbyState | null; preview: string | null }`
  - `loadLobbyFn()`, `buyLobbyItemFn({ data: { itemId } })`, `placeLobbyItemFn({ data: { slot, itemId } })` → `ActionResult`
  - `loadShopCache(): Promise<LobbyState | null>`, `saveShopCache(state): Promise<void>`
  - `refreshShop(): Promise<void>`, `buyItem(itemId): Promise<ActionResult>`, `placeItem(slot, itemId | null): Promise<ActionResult>`, `previewItem(itemId | null): void`, `useShop(): ShopView`, `useLobbyDecor(): Placements`, `shopStateForTests(): ShopView`

- [ ] **Step 1: Tipe dan schema**

`src/lib/shop/types.ts`:

```ts
import type { SlotId } from "./catalog"

/** The item in each slot that has one. */
export type Placements = Partial<Record<SlotId, string>>

/** What lobby_state answers (spec 3C §5.2). */
export type LobbyState = {
  earned: number
  spent: number
  balance: number
  owned: Array<string>
  placed: Placements
}

export type LobbyAnswer =
  | { ok: true; state: LobbyState }
  | { ok: false; code: string }

/** The shop as the lobby and the panel see it. `preview`: an item tried on. */
export type ShopView = {
  status: "loading" | "ready" | "failed"
  state: LobbyState | null
  preview: string | null
}
```

`src/lib/shop/schemas.ts`:

```ts
import { z } from "zod"
import { SHOP_ITEMS, SLOT_IDS } from "./catalog"

const ItemIdSchema = z.enum(SHOP_ITEMS.map(({ id }) => id) as [string, ...Array<string>])
const SlotSchema = z.enum(SLOT_IDS)

export const LobbyStateSchema = z.object({
  earned: z.number().int(),
  spent: z.number().int(),
  balance: z.number().int(),
  owned: z.array(z.string()),
  placed: z.partialRecord(SlotSchema, z.string()),
})

export const BuySchema = z.object({ itemId: ItemIdSchema })
export const PlaceSchema = z.object({
  slot: SlotSchema,
  itemId: ItemIdSchema.nullable(),
})
```

- [ ] **Step 2: Server function**

`src/server/shop.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import type { ActionResult } from "@/lib/action-result"
import type { SlotId } from "@/lib/shop/catalog"
import { BuySchema, LobbyStateSchema, PlaceSchema } from "@/lib/shop/schemas"
import type { LobbyAnswer } from "@/lib/shop/types"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })

/** The DB's answers; not_found would read "Buku ini…" (plan 3C, decision 3). */
const answerOf = (answer: unknown): ActionResult =>
  answer === "ok"
    ? { ok: true }
    : answer === "not_found"
      ? fail("item_missing")
      : answer === "owned" || answer === "not_enough" || answer === "not_owned"
        ? fail(answer)
        : fail("unknown")

/** The balance, the items owned and placed (spec 3C §5.2). */
export const loadLobbyFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<LobbyAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")
    const { data, error } = await supabase.rpc("lobby_state")
    if (error) {
      logServerError("lobby_state failed", error)
      return fail("unknown")
    }
    const parsed = LobbyStateSchema.safeParse(data)
    if (!parsed.success) {
      logServerError("lobby_state answered something else", parsed.error)
      return fail("unknown")
    }
    return { ok: true, state: parsed.data }
  }
)

export const buyLobbyItemFn = createServerFn({ method: "POST" })
  .validator((data: { itemId: string }) => BuySchema.parse(data))
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("buy_lobby_item", {
      p_item: data.itemId,
    })
    if (error) {
      logServerError("buy_lobby_item failed", error)
      return fail("unknown")
    }
    return answerOf(answer)
  })

export const placeLobbyItemFn = createServerFn({ method: "POST" })
  .validator((data: { slot: SlotId; itemId: string | null }) =>
    PlaceSchema.parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")
    const { data: answer, error } = await supabase.rpc("place_lobby_item", {
      p_slot: data.slot,
      p_item: data.itemId as string,
    })
    if (error) {
      logServerError("place_lobby_item failed", error)
      return fail("unknown")
    }
    return answerOf(answer)
  })
```

Bila `z.partialRecord` tidak ada di versi zod proyek ini (cek `node_modules/zod/package.json`), pakai `z.record(SlotSchema, z.string()).partial()` atau `z.record(z.string(), z.string())` lalu saring kunci dengan `SLOT_IDS`; tipe hasilnya harus tetap `Placements`.

- [ ] **Step 3: Pesan baru**

Di `src/lib/book-messages.ts`, tambahkan ke `MESSAGES` setelah `position_missing`:

```ts
  not_enough: "Koinmu belum cukup.",
  not_owned: "Barang ini belum kamu miliki.",
  item_missing: "Barang ini tidak ada di toko.",
```

- [ ] **Step 4: Tes cache yang gagal**

`src/lib/local/shop-cache.test.ts` (pola `reading-time.test.ts`: `import "fake-indexeddb/auto"` dan `localDb().delete()` di `beforeEach` bila file itu melakukannya; ikuti persis cara file tersebut mengosongkan DB):

```ts
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import { localDb } from "./db"
import { loadShopCache, saveShopCache } from "./shop-cache"

const STATE = {
  earned: 300,
  spent: 60,
  balance: 240,
  owned: ["rug_woven"],
  placed: { rug: "rug_woven" },
}

describe("shop cache", () => {
  beforeEach(async () => {
    await localDb().meta.clear()
  })

  it("is empty at first", async () => {
    expect(await loadShopCache()).toBeNull()
  })

  it("keeps the last state", async () => {
    await saveShopCache(STATE)
    expect(await loadShopCache()).toEqual(STATE)
  })

  it("ignores what is not a state", async () => {
    await localDb().meta.put({ key: "lobbyShop", value: { balance: "x" } })
    expect(await loadShopCache()).toBeNull()
  })
})
```

- [ ] **Step 5: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/local/shop-cache.test.ts`
Expected: FAIL, modul `./shop-cache` tidak ada.

- [ ] **Step 6: Tulis cache**

`src/lib/local/shop-cache.ts`:

```ts
import { LobbyStateSchema } from "@/lib/shop/schemas"
import type { LobbyState } from "@/lib/shop/types"
import { localDb } from "./db"

/** In meta, so wiping the member's data drops it (plan 3C, decision 8). */
const CACHE_KEY = "lobbyShop"

export async function loadShopCache(): Promise<LobbyState | null> {
  const stored = await localDb().meta.get(CACHE_KEY)
  const parsed = LobbyStateSchema.safeParse(stored?.value)
  return parsed.success ? parsed.data : null
}

export async function saveShopCache(state: LobbyState): Promise<void> {
  await localDb().meta.put({ key: CACHE_KEY, value: state })
}
```

- [ ] **Step 7: Jalankan, pastikan lulus**

Run: `npx vitest run src/lib/local/shop-cache.test.ts`
Expected: PASS, 3 tes.

- [ ] **Step 8: Tes klien yang gagal**

`src/lib/shop/shop-client.test.ts`:

```ts
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"

const server = vi.hoisted(() => ({
  loadLobbyFn: vi.fn(),
  buyLobbyItemFn: vi.fn(),
  placeLobbyItemFn: vi.fn(),
}))
vi.mock("@/server/shop", () => server)
const flush = vi.hoisted(() => vi.fn(() => Promise.resolve()))
vi.mock("@/lib/habit/habit-client", () => ({
  habitSync: () => ({ flush }),
}))

import { localDb } from "@/lib/local/db"
import { clearLocalData } from "@/lib/local/device"
import { loadShopCache, saveShopCache } from "@/lib/local/shop-cache"
import {
  buyItem,
  placeItem,
  previewItem,
  refreshShop,
  shopStateForTests,
  useLobbyDecor,
} from "./shop-client"

const state = (changes = {}) => ({
  earned: 300,
  spent: 60,
  balance: 240,
  owned: ["rug_woven"],
  placed: { rug: "rug_woven" },
  ...changes,
})

describe("shop client", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await clearLocalData() // also resets the store through onMemberDataWiped
  })

  it("sends the reading time, then loads and keeps the state", async () => {
    server.loadLobbyFn.mockResolvedValue({ ok: true, state: state() })
    await refreshShop()
    expect(flush).toHaveBeenCalledBefore(server.loadLobbyFn)
    expect(shopStateForTests()).toMatchObject({ status: "ready", state: state() })
    expect(await loadShopCache()).toEqual(state())
  })

  it("keeps the cached state when loading fails", async () => {
    await saveShopCache(state({ balance: 7 }))
    server.loadLobbyFn.mockResolvedValue({ ok: false, code: "unknown" })
    await refreshShop()
    expect(shopStateForTests()).toMatchObject({
      status: "failed",
      state: { balance: 7 },
    })
  })

  it("refreshes after a purchase, also when the coins ran short", async () => {
    server.loadLobbyFn.mockResolvedValue({ ok: true, state: state() })
    server.buyLobbyItemFn.mockResolvedValue({ ok: false, code: "not_enough" })
    expect(await buyItem("pet_cat")).toEqual({ ok: false, code: "not_enough" })
    expect(server.loadLobbyFn).toHaveBeenCalledTimes(1)
  })

  it("takes an item already owned as bought", async () => {
    server.loadLobbyFn.mockResolvedValue({ ok: true, state: state() })
    server.buyLobbyItemFn.mockResolvedValue({ ok: false, code: "owned" })
    expect(await buyItem("rug_woven")).toEqual({ ok: true })
  })

  it("places at once and puts it back when the server refuses", async () => {
    server.loadLobbyFn.mockResolvedValue({ ok: true, state: state() })
    await refreshShop()
    let answer!: (value: unknown) => void
    server.placeLobbyItemFn.mockReturnValue(
      new Promise((resolve) => (answer = resolve))
    )
    const placing = placeItem("rug", null)
    await vi.waitFor(() =>
      expect(shopStateForTests().state?.placed).toEqual({})
    )
    answer({ ok: false, code: "unknown" })
    expect(await placing).toEqual({ ok: false, code: "unknown" })
    expect(shopStateForTests().state?.placed).toEqual({ rug: "rug_woven" })
  })

  it("shows an item tried on in its slot, over the one placed", async () => {
    server.loadLobbyFn.mockResolvedValue({ ok: true, state: state() })
    await refreshShop()
    const { result } = renderHook(() => useLobbyDecor())
    expect(result.current).toEqual({ rug: "rug_woven" })
    act(() => previewItem("pet_cat"))
    expect(result.current).toEqual({ rug: "rug_woven", pet: "pet_cat" })
    act(() => previewItem(null))
    expect(result.current).toEqual({ rug: "rug_woven" })
  })

  it("forgets everything when the member's data is wiped", async () => {
    server.loadLobbyFn.mockResolvedValue({ ok: true, state: state() })
    await refreshShop()
    await clearLocalData()
    expect(shopStateForTests()).toEqual({
      status: "loading",
      state: null,
      preview: null,
    })
    expect(await localDb().meta.get("lobbyShop")).toBeUndefined()
  })
})
```

Bila `toHaveBeenCalledBefore` tidak tersedia di versi Vitest proyek, bandingkan `flush.mock.invocationCallOrder[0] < server.loadLobbyFn.mock.invocationCallOrder[0]`.

- [ ] **Step 9: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/shop/shop-client.test.ts`
Expected: FAIL, modul `./shop-client` tidak ada.

- [ ] **Step 10: Tulis klien**

`src/lib/shop/shop-client.ts`:

```ts
import { useEffect, useMemo, useSyncExternalStore } from "react"
import type { ActionResult } from "@/lib/action-result"
import { habitSync } from "@/lib/habit/habit-client"
import { onMemberDataWiped } from "@/lib/local/device"
import { loadShopCache, saveShopCache } from "@/lib/local/shop-cache"
import {
  buyLobbyItemFn,
  loadLobbyFn,
  placeLobbyItemFn,
} from "@/server/shop"
import { type SlotId, itemOf } from "./catalog"
import type { LobbyState, Placements, ShopView } from "./types"

const EMPTY: ShopView = { status: "loading", state: null, preview: null }
let view: ShopView = EMPTY
const listeners = new Set<() => void>()

function setView(next: Partial<ShopView>) {
  view = { ...view, ...next }
  for (const listener of listeners) listener()
}

/** For tests: the state the hooks read. */
export const shopStateForTests = (): ShopView => view

let cacheRead: Promise<void> | null = null
/** Bumped by every refresh and every wipe; an older refresh drops its answer. */
let refreshSeq = 0

onMemberDataWiped(() => {
  refreshSeq++
  cacheRead = null
  setView(EMPTY)
})

/** This device's last state, once per tab, so the lobby shows it offline. */
function readCache(): Promise<void> {
  cacheRead ??= loadShopCache()
    .then((cache) => {
      // A refresh that finished first already has the newer answer.
      setView({ state: view.state ?? cache })
    })
    .catch((error: unknown) => {
      cacheRead = null
      console.error("reading the lobby shop on this device failed", error)
    })
  return cacheRead
}

async function keep(state: LobbyState, seq: number) {
  if (seq !== refreshSeq) return
  await saveShopCache(state)
  if (seq !== refreshSeq) return
  setView({ state, status: "ready" })
}

/**
 * Sends the waiting reading time, so its minutes count, then loads the
 * balance and the items (plan 3C, decision 9). Never rejects.
 */
export async function refreshShop(): Promise<void> {
  const seq = ++refreshSeq
  try {
    await readCache()
    await habitSync().flush()
    const answer = await loadLobbyFn()
    if (seq !== refreshSeq) return
    if (!answer.ok) {
      console.error("loading the lobby shop was refused", answer.code)
      setView({ status: "failed" })
      return
    }
    await keep(answer.state, seq)
  } catch (error) {
    if (seq !== refreshSeq) return
    console.error("refreshing the lobby shop failed", error)
    setView({ status: "failed" })
  }
}

/** Buys an item; the server places it. "owned" counts as bought (spec 3C §6.4). */
export async function buyItem(itemId: string): Promise<ActionResult> {
  let result: ActionResult
  try {
    result = await buyLobbyItemFn({ data: { itemId } })
  } catch {
    return { ok: false, code: "unknown" }
  }
  if (result.ok || result.code === "owned" || result.code === "not_enough") {
    setView({ preview: null })
    await refreshShop()
  }
  return !result.ok && result.code === "owned" ? { ok: true } : result
}

/** Places an owned item, or takes the slot's item off: shown at once. */
export async function placeItem(
  slot: SlotId,
  itemId: string | null
): Promise<ActionResult> {
  const before = view.state
  if (!before) return { ok: false, code: "offline" }
  const placed: Placements = { ...before.placed }
  if (itemId) placed[slot] = itemId
  else delete placed[slot]
  setView({ state: { ...before, placed }, preview: null })
  let result: ActionResult
  try {
    result = await placeLobbyItemFn({ data: { slot, itemId } })
  } catch {
    result = { ok: false, code: "unknown" }
  }
  if (!result.ok) {
    // Only the slot goes back: a refresh may have landed meanwhile.
    const now = view.state
    if (now) {
      const back: Placements = { ...now.placed }
      const was = before.placed[slot]
      if (was) back[slot] = was
      else delete back[slot]
      setView({ state: { ...now, placed: back } })
    }
    return result
  }
  if (view.state) await saveShopCache(view.state)
  return result
}

/** Tries an item on in its slot, for the 3D preview; null ends it. */
export function previewItem(itemId: string | null): void {
  if (view.preview === itemId) return
  setView({ preview: itemId })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The shop for the panel. */
export function useShop(): ShopView {
  const snapshot = useSyncExternalStore(subscribe, () => view, () => EMPTY)
  useEffect(() => {
    void readCache()
  }, [])
  return snapshot
}

/** What the lobby shows in each slot: the items placed, and one tried on. */
export function useLobbyDecor(): Placements {
  const snapshot = useShop()
  return useMemo(() => {
    const placed: Placements = { ...snapshot.state?.placed }
    const tried = snapshot.preview ? itemOf(snapshot.preview) : undefined
    if (tried) placed[tried.slot] = tried.id
    return placed
  }, [snapshot])
}
```

- [ ] **Step 11: Jalankan, pastikan lulus**

Run: `npx vitest run src/lib/shop src/lib/local/shop-cache.test.ts`
Expected: PASS.

- [ ] **Step 12: Muat ulang di layout lobi**

Di `src/routes/_member/_lobi.tsx`: impor `refreshShop` dari `@/lib/shop/shop-client` dan tambahkan `useQueueFlush(user.id, refreshShop)` tepat setelah baris `useQueueFlush(user.id, refreshHabit)`, dengan komentar `// The shop's balance and items (plan 3C, decision 9).`

- [ ] **Step 13: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npx vitest run src/lib src/routes`
Expected: bersih, semua PASS.

```bash
git add src/lib/shop src/lib/local/shop-cache.ts src/lib/local/shop-cache.test.ts src/server/shop.ts src/lib/book-messages.ts src/routes/_member/_lobi.tsx
git commit -m "feat(shop): load, buy and place lobby items, kept on the device"
```

---

### Task 3: Dekorasi 3D dan kios

**Files:**
- Modify: `src/components/lobby/scene/layout.ts` (`DECOR_SLOTS`, `KIOSK`, `PREVIEW_SHIFT`, `HotspotId` + `"toko"`, `HOTSPOT_SPOTS`)
- Modify: `src/components/lobby/scene/layout.test.ts`
- Create: `src/components/lobby/scene/decor.ts`
- Create: `src/components/lobby/scene/decor.test.ts`
- Modify: `src/components/lobby/scene/stage.ts` (`setDecor`, kios)
- Modify: `src/components/lobby/LobbyCanvas.tsx`, `LobbyCanvas.test.tsx`
- Modify: `src/components/lobby/LobbyScene.tsx`, `LobbyScene.test.tsx` (`decor`, `showDecor`)
- Modify: `src/components/lobby/lobby-data.ts`, `lobby-data.test.ts` (label "Toko lobi")
- Modify: `src/components/lobby/LibraryMap.tsx`, `LibraryMap.test.tsx`, `src/styles.css` (tanda peta `toko`)
- Modify: `src/components/lobby/HotspotLayer.test.tsx` (hotspot terakhir "Toko lobi")
- Modify: `src/components/lobby/LobbyStage.tsx` (`decor`, `toko` → `/shop`, kamera pratinjau)

**Interfaces:**
- Consumes: `SlotId`, `SLOT_IDS`, `SHOP_ITEMS`, `itemOf` (Task 1); `Placements`, `useLobbyDecor`, `useShop` (Task 2).
- Produces:
  - `DECOR_SLOTS: Record<SlotId, { at: Point3; turn: number; flat: boolean; focus: Point3 }>`, `KIOSK: Point2`, `PREVIEW_SHIFT = 0.16` di `layout.ts`
  - `buildDecor(scene: THREE.Scene, onChange: () => void): Decor` dengan `Decor = { set: (placed: Placements) => void; dispose: () => void }`, `buildKiosk(kit: Kit): void`, `DECOR_BUILDERS: Record<string, (part: Part) => void>` di `decor.ts`
  - `Stage.setDecor(placed: Placements)`
  - `LobbySceneHandle.showDecor(slot: SlotId)`; prop `decor?: Placements` di `LobbyScene` dan `decor: Placements` di `LobbyCanvas`
  - hotspot `"toko"`

- [ ] **Step 1: Tes tata letak yang gagal**

Di `src/components/lobby/scene/layout.test.ts`:
- impor `DECOR_SLOTS`, `KIOSK`, `LOUNGES` dan `SLOT_IDS` dari `@/lib/shop/catalog`;
- tes urutan tab: tambahkan `"toko"` setelah `"tanaman"`;
- tambahkan:

```ts
  it("gives every shop slot a place, and keeps standing items clear", () => {
    const distance = (a: Point2, b: Point2) =>
      Math.hypot(a[0] - b[0], a[1] - b[1])
    expect(Object.keys(DECOR_SLOTS).sort()).toEqual([...SLOT_IDS].sort())
    const standing: Array<[string, Point2]> = [
      ...Object.entries(DECOR_SLOTS)
        .filter(([, slot]) => !slot.flat)
        .map(([id, { at }]): [string, Point2] => [id, [at[0], at[2]]]),
      ["kiosk", KIOSK],
    ]
    for (const [id, at] of standing) {
      expect(onFloor(at), id).toBe(true)
      expect(towerClearance(at), id).toBeGreaterThan(1)
      expect(distance(at, PLANT), id).toBeGreaterThan(2)
      expect(distance(at, SHOWCASE), id).toBeGreaterThan(2.5)
      for (const { at: seat } of READERS) {
        expect(distance(at, seat), id).toBeGreaterThan(1.5)
      }
      for (const { at: lounge } of LOUNGES) {
        expect(distance(at, lounge), id).toBeGreaterThan(2)
      }
      for (const [index, { points }] of WALKER_ROUTES.entries()) {
        points.forEach(([x, z], i) => {
          const [nx, nz] = points[(i + 1) % points.length]
          for (let t = 0; t <= 1; t += 0.01) {
            const on: Point2 = [x + (nx - x) * t, z + (nz - z) * t]
            expect(distance(at, on), `${id} route ${index}`).toBeGreaterThan(1.5)
          }
        })
      }
    }
  })
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/components/lobby/scene/layout.test.ts`
Expected: FAIL, `DECOR_SLOTS` tidak ada dan urutan tab tanpa `toko`.

- [ ] **Step 3: Tambahkan tata letak**

Di `src/components/lobby/scene/layout.ts`, impor `type SlotId` dari `@/lib/shop/catalog`, lalu setelah blok `PLANT_SHAPES`:

```ts
/**
 * The shop's slots (spec 3C §4, plan 3C decision 10). `at`: the item's
 * origin, on the floor, the wall or under the ceiling; `turn`: its turn
 * about Y (items are built facing +Z); `flat`: lies or hangs out of the
 * walkers' way; `focus`: where the camera looks for a preview.
 */
export const DECOR_SLOTS: Record<
  SlotId,
  { at: Point3; turn: number; flat: boolean; focus: Point3 }
> = {
  rug: { at: [19.5, 0, 26], turn: 0, flat: true, focus: [19.5, 0.5, 26] },
  lamp: { at: [14.6, 0, 26.4], turn: 0, flat: false, focus: [14.6, 1.5, 26.4] },
  seat: { at: [31.5, 0, 3.2], turn: Math.PI, flat: false, focus: [31.5, 0.8, 3.2] },
  wall: { at: [0.1, 6, 30], turn: Math.PI / 2, flat: true, focus: [0.1, 7, 30] },
  pet: { at: [30.5, 0, 22], turn: -Math.PI / 4, flat: false, focus: [30.5, 0.6, 22] },
  ceiling: { at: [22, 9.5, 19], turn: 0, flat: true, focus: [22, 9.5, 19] },
}

/** The shop's kiosk (spec 3C §6.2): open floor near the front, clear of walkers. */
export const KIOSK: Point2 = [24.6, 31.6]

/** How far right the camera moves past a slot, so it shows beside the shop panel. */
export const PREVIEW_SHIFT = 0.16
```

Tambahkan `| "toko"` ke `HotspotId`, perbarui komentar urutan tab ("…, habit plant, shop kiosk"), dan tambahkan entri terakhir di `HOTSPOT_SPOTS`:

```ts
  { id: "toko", label: [24.6, 2.6, 31.6], stand: [23, 30.2] },
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run src/components/lobby/scene/layout.test.ts`
Expected: PASS. Bila tes jarak gagal untuk satu slot, geser slot itu (bukan batasnya) dan catat koordinat barunya di laporan task.

- [ ] **Step 5: Tes dekorasi yang gagal**

`src/components/lobby/scene/decor.test.ts`:

```ts
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { SHOP_ITEMS } from "@/lib/shop/catalog"
import { DECOR_BUILDERS, buildDecor } from "./decor"

const meshes = (root: THREE.Object3D) => {
  let count = 0
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) count++
  })
  return count
}

describe("lobby decor", () => {
  it("has a builder for every item", () => {
    expect(Object.keys(DECOR_BUILDERS).sort()).toEqual(
      SHOP_ITEMS.map(({ id }) => id).sort()
    )
  })

  it("builds each item in its slot, and asks to draw again", () => {
    for (const { id, slot } of SHOP_ITEMS) {
      const scene = new THREE.Scene()
      const onChange = vi.fn()
      const decor = buildDecor(scene, onChange)
      decor.set({ [slot]: id })
      expect(meshes(scene), id).toBeGreaterThan(0)
      expect(onChange).toHaveBeenCalledTimes(1)
      decor.dispose()
      expect(meshes(scene), id).toBe(0)
    }
  })

  it("rebuilds only the slots that changed", () => {
    const scene = new THREE.Scene()
    const onChange = vi.fn()
    const decor = buildDecor(scene, onChange)
    decor.set({ rug: "rug_woven", pet: "pet_cat" })
    const rug = scene.getObjectByName("decor-rug")?.children[0]
    decor.set({ rug: "rug_woven", pet: "pet_bird" })
    expect(scene.getObjectByName("decor-rug")?.children[0]).toBe(rug)
    decor.set({ rug: "rug_woven", pet: "pet_bird" })
    expect(onChange).toHaveBeenCalledTimes(2)
    decor.set({})
    expect(meshes(scene)).toBe(0)
  })

  it("skips an id it does not know", () => {
    const scene = new THREE.Scene()
    const decor = buildDecor(scene, vi.fn())
    decor.set({ rug: "rug_gold" })
    expect(meshes(scene)).toBe(0)
  })

  it("frees every geometry and material it made", () => {
    const scene = new THREE.Scene()
    const decor = buildDecor(scene, vi.fn())
    decor.set({ rug: "rug_pattern", lamp: "lamp_arc" })
    const geometries: Array<THREE.BufferGeometry> = []
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) geometries.push(object.geometry)
    })
    const disposed = geometries.map((geometry) => vi.spyOn(geometry, "dispose"))
    decor.set({})
    for (const spy of disposed) expect(spy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Jalankan, pastikan gagal**

Run: `npx vitest run src/components/lobby/scene/decor.test.ts`
Expected: FAIL, modul `./decor` tidak ada.

- [ ] **Step 7: Tulis dekorasi**

`src/components/lobby/scene/decor.ts`. Ukuran dalam meter, dibangun menghadap +Z di sekitar titik asal slot; kios memakai `kit` karena tidak pernah dibuang.

```ts
import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { SLOT_IDS, type SlotId } from "@/lib/shop/catalog"
import type { Placements } from "@/lib/shop/types"
import type { Kit } from "./kit"
import { DECOR_SLOTS, KIOSK } from "./layout"

/** What a builder draws with: shapes in the slot's group, in its own paint. */
export type Part = {
  /** A rounded box standing on y, centred on x and z. */
  box: (w: number, h: number, d: number, color: string, x: number, y: number, z: number, r?: number) => THREE.Mesh
  /** A cylinder standing on y. */
  rod: (radius: number, h: number, color: string, x: number, y: number, z: number, top?: number) => THREE.Mesh
  ball: (radius: number, color: string, x: number, y: number, z: number) => THREE.Mesh
  /** A flat disc lying on y. */
  disc: (radius: number, color: string, x: number, y: number, z: number) => THREE.Mesh
  glow: (color: string) => THREE.Material
  /** Adds a mesh built by hand; it is freed with the slot, material included. */
  add: (object: THREE.Mesh) => void
}

const WOOD = "#8a5a36"
const DARK = "#3b2a1e"
const BRASS = "#c9a24a"

/** One builder per shop item (spec 3C §4); the ids match the catalogue. */
export const DECOR_BUILDERS: Record<string, (part: Part) => void> = {
  rug_woven: (p) => {
    p.box(5.2, 0.02, 3.4, "#c8a77a", 0, 0, 0, 0.01)
    for (let i = -2; i <= 2; i++) p.box(5.0, 0.025, 0.08, "#a07c52", 0, 0, i * 0.6, 0.01)
  },
  rug_round: (p) => {
    p.disc(2.4, "#7c9cb5", 0, 0.01, 0)
    p.disc(1.7, "#e6d3b0", 0, 0.015, 0)
    p.disc(0.9, "#7c9cb5", 0, 0.02, 0)
  },
  rug_pattern: (p) => {
    p.box(5.6, 0.02, 3.8, "#8c2f39", 0, 0, 0, 0.01)
    p.box(4.8, 0.025, 3.0, "#e0b45c", 0, 0, 0, 0.01)
    p.box(4.2, 0.03, 2.4, "#8c2f39", 0, 0, 0, 0.01)
    p.disc(0.8, "#1f4e5f", 0, 0.035, 0)
  },
  lamp_floor: (p) => {
    p.disc(0.25, DARK, 0, 0, 0)
    p.rod(0.03, 1.6, DARK, 0, 0, 0)
    p.rod(0.32, 0.4, "#f3e2c0", 0, 1.55, 0, 0.2).material = p.glow("#ffe2a8")
  },
  lamp_arc: (p) => {
    p.disc(0.3, DARK, 0, 0, 0)
    p.rod(0.03, 2.2, BRASS, 0, 0, 0)
    p.box(1.3, 0.05, 0.05, BRASS, 0.65, 2.15, 0, 0.02)
    p.rod(0.06, 0.25, BRASS, 1.3, 1.95, 0, 0.25)
    p.ball(0.12, "#ffe2a8", 1.3, 1.9, 0).material = p.glow("#ffe2a8")
  },
  lamp_lantern: (p) => {
    p.disc(0.25, DARK, 0, 0, 0)
    p.rod(0.03, 2.4, DARK, 0, 0, 0)
    p.box(0.6, 0.04, 0.04, DARK, 0.3, 2.36, 0, 0.01)
    p.rod(0.01, 0.3, DARK, 0.58, 2.06, 0)
    p.box(0.3, 0.42, 0.3, "#d2462e", 0.58, 1.64, 0, 0.08)
    p.ball(0.1, "#ffd27a", 0.58, 1.85, 0).material = p.glow("#ffc35c")
  },
  seat_beanbag: (p) => {
    p.ball(0.55, "#d98c3f", 0, 0.4, 0).scale.set(1, 0.7, 1)
    p.ball(0.4, "#e39c50", 0, 0.75, -0.25).scale.set(1, 0.8, 0.7)
  },
  seat_armchair: (p) => {
    p.box(1.0, 0.45, 0.9, "#5a7d6a", 0, 0, 0, 0.08)
    p.box(1.0, 0.7, 0.2, "#4d6d5c", 0, 0.45, -0.35, 0.08)
    p.box(0.18, 0.3, 0.9, "#4d6d5c", -0.45, 0.45, 0, 0.06)
    p.box(0.18, 0.3, 0.9, "#4d6d5c", 0.45, 0.45, 0, 0.06)
    p.box(0.8, 0.12, 0.7, "#e8dcc4", 0, 0.45, 0.05, 0.05)
  },
  seat_sofa: (p) => {
    p.box(2.4, 0.45, 0.95, "#3f5d8a", 0, 0, 0, 0.08)
    p.box(2.4, 0.65, 0.22, "#35507a", 0, 0.45, -0.37, 0.08)
    p.box(0.22, 0.3, 0.95, "#35507a", -1.1, 0.45, 0, 0.06)
    p.box(0.22, 0.3, 0.95, "#35507a", 1.1, 0.45, 0, 0.06)
    p.box(0.45, 0.38, 0.14, "#e0b45c", -0.6, 0.48, -0.2, 0.06)
    p.box(0.45, 0.38, 0.14, "#d26f5a", 0.6, 0.48, -0.2, 0.06)
  },
  wall_map: (p) => {
    p.box(3.2, 2.0, 0.06, WOOD, 0, 0, 0, 0.02)
    p.box(3.0, 1.8, 0.07, "#cfe3e8", 0, 0.1, 0.01, 0.01)
    p.box(0.9, 0.7, 0.08, "#9cc58b", -0.8, 0.8, 0.02, 0.1)
    p.box(0.7, 0.9, 0.08, "#9cc58b", 0.3, 0.4, 0.02, 0.1)
    p.box(0.8, 0.5, 0.08, "#9cc58b", 1.0, 1.2, 0.02, 0.1)
  },
  wall_painting: (p) => {
    p.box(2.6, 1.9, 0.08, BRASS, 0, 0, 0, 0.03)
    p.box(2.3, 1.6, 0.09, "#f4c27a", 0, 0.15, 0.01, 0.01)
    p.box(2.3, 0.6, 0.1, "#4f7a3a", 0, 0.15, 0.02, 0.01)
    p.ball(0.25, "#e8743b", 0.6, 1.25, 0.06)
  },
  wall_clock: (p) => {
    p.rod(0.9, 0.1, WOOD, 0, 0.9, 0).rotation.x = Math.PI / 2
    p.rod(0.8, 0.11, "#f6efe0", 0, 0.9, 0.01).rotation.x = Math.PI / 2
    p.box(0.06, 0.55, 0.04, DARK, 0, 1.15, 0.08, 0.01)
    p.box(0.4, 0.06, 0.04, DARK, 0.18, 0.9, 0.08, 0.01)
  },
  pet_cat: (p) => {
    p.disc(0.55, "#b5533c", 0, 0.01, 0)
    p.ball(0.32, "#e3a35b", 0, 0.2, 0).scale.set(1, 0.6, 0.8)
    p.ball(0.16, "#e3a35b", 0.3, 0.28, 0.08)
    p.ball(0.05, "#e3a35b", 0.36, 0.42, 0.03)
    p.ball(0.05, "#e3a35b", 0.36, 0.42, 0.14)
    p.rod(0.04, 0.5, "#d18f48", -0.2, 0.08, 0.28).rotation.z = Math.PI / 2
  },
  pet_bird: (p) => {
    p.rod(0.04, 1.3, BRASS, 0, 0, 0)
    p.disc(0.35, BRASS, 0, 1.3, 0)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      p.rod(0.012, 0.6, BRASS, Math.cos(a) * 0.33, 1.3, Math.sin(a) * 0.33)
    }
    p.ball(0.36, BRASS, 0, 1.9, 0).scale.set(1, 0.3, 1)
    p.ball(0.1, "#4fa3d1", 0, 1.5, 0)
    p.ball(0.05, "#f2c14e", 0.08, 1.56, 0)
  },
  pet_aquarium: (p) => {
    p.box(1.4, 0.7, 0.6, WOOD, 0, 0, 0, 0.04)
    const glass = p.box(1.3, 0.7, 0.5, "#9fd6e8", 0, 0.7, 0, 0.02)
    glass.material = new THREE.MeshStandardMaterial({
      color: "#9fd6e8",
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
    })
    p.box(1.25, 0.08, 0.45, "#e6d3a3", 0, 0.7, 0, 0.01)
    p.ball(0.06, "#f28c38", -0.3, 1.05, 0.05).scale.set(1.6, 1, 0.6)
    p.ball(0.05, "#f2c14e", 0.25, 1.15, -0.05).scale.set(1.6, 1, 0.6)
    p.rod(0.02, 0.35, "#4f7a3a", 0.45, 0.78, 0.1)
  },
  ceiling_lights: (p) => {
    for (let i = 0; i < 14; i++) {
      const t = i / 13
      const x = -5 + t * 10
      const y = -Math.sin(t * Math.PI) * 1.2
      p.ball(0.09, "#ffe2a8", x, y, 0).material = p.glow(i % 2 ? "#ffd27a" : "#ffb38a")
    }
  },
  ceiling_books: (p) => {
    const colors = ["#c0392b", "#2e86ab", "#f2c14e", "#4f7a3a", "#8e5ea2", "#e8743b"]
    colors.forEach((color, i) => {
      const a = (i / colors.length) * Math.PI * 2
      const book = p.box(0.5, 0.08, 0.36, color, Math.cos(a) * 2, Math.sin(i * 1.7) * 0.6, Math.sin(a) * 2, 0.02)
      book.rotation.set(0.3, a, Math.sin(i) * 0.5)
    })
  },
  ceiling_globe: (p) => {
    p.rod(0.015, 1.5, DARK, 0, 0, 0)
    p.ball(0.9, "#3d7ea6", 0, -0.9, 0)
    p.box(0.6, 0.4, 0.2, "#9cc58b", 0.55, -0.7, 0.4, 0.1)
    p.box(0.5, 0.5, 0.2, "#9cc58b", -0.4, -1.1, 0.6, 0.1)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.03, 8, 48),
      new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.6, roughness: 0.4 })
    )
    ring.position.y = -0.9
    ring.rotation.x = Math.PI / 2.4
    p.add(ring)
  },
}

export type Decor = {
  /** Shows these items; slots that did not change stay as they are. */
  set: (placed: Placements) => void
  dispose: () => void
}

/** Frees what a slot's group holds: every geometry, and materials made just for it. */
function clearGroup(group: THREE.Group, shared: Set<THREE.Material>) {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    const materials: Array<THREE.Material> = Array.isArray(object.material)
      ? object.material
      : [object.material]
    for (const material of materials) {
      if (!shared.has(material)) material.dispose()
    }
  })
  group.clear()
}

/**
 * The shop's items in the lobby (spec 3C §6.3). Paint of its own, not the
 * kit's shared materials, so changing an item frees what it used (plan 3C,
 * decision 7). onChange asks the stage to draw again.
 */
export function buildDecor(scene: THREE.Scene, onChange: () => void): Decor {
  const paints = new Map<string, THREE.MeshStandardMaterial>()
  const shared = new Set<THREE.Material>()
  const paint = (color: string, glow = false) => {
    const key = `${color}${glow ? "*" : ""}`
    let material = paints.get(key)
    if (!material) {
      material = new THREE.MeshStandardMaterial(
        glow
          ? { color, emissive: color, emissiveIntensity: 1.4, roughness: 0.4 }
          : { color, roughness: 0.75 }
      )
      paints.set(key, material)
      shared.add(material)
    }
    return material
  }

  const groups = new Map<SlotId, THREE.Group>()
  const shown = new Map<SlotId, string>()
  for (const slot of SLOT_IDS) {
    const group = new THREE.Group()
    group.name = `decor-${slot}`
    const { at, turn } = DECOR_SLOTS[slot]
    group.position.set(...at)
    group.rotation.y = turn
    scene.add(group)
    groups.set(slot, group)
  }

  const partFor = (group: THREE.Group): Part => {
    const add = (geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, paint(color))
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
      return mesh
    }
    return {
      box: (w, h, d, color, x, y, z, r = 0.04) =>
        add(
          new RoundedBoxGeometry(
            w,
            h,
            d,
            2,
            Math.min(r, w / 2.01, h / 2.01, d / 2.01)
          ),
          color,
          x,
          y + h / 2,
          z
        ),
      rod: (radius, h, color, x, y, z, top = radius) =>
        add(new THREE.CylinderGeometry(top, radius, h, 16), color, x, y + h / 2, z),
      ball: (radius, color, x, y, z) =>
        add(new THREE.SphereGeometry(radius, 16, 12), color, x, y, z),
      disc: (radius, color, x, y, z) => {
        const mesh = add(new THREE.CircleGeometry(radius, 32), color, x, y, z)
        mesh.rotation.x = -Math.PI / 2
        return mesh
      },
      glow: (color) => paint(color, true),
      add: (object) => {
        object.castShadow = true
        group.add(object)
      },
    }
  }

  return {
    set(placed) {
      let changed = false
      for (const slot of SLOT_IDS) {
        const next = placed[slot]
        const build = next ? DECOR_BUILDERS[next] : undefined
        const wanted = build ? next : undefined
        if (shown.get(slot) === wanted) continue
        changed = true
        const group = groups.get(slot)
        if (!group) continue
        clearGroup(group, shared)
        if (wanted && build) {
          build(partFor(group))
          shown.set(slot, wanted)
        } else {
          shown.delete(slot)
        }
      }
      if (changed) onChange()
    },
    dispose() {
      for (const group of groups.values()) {
        clearGroup(group, shared)
        group.removeFromParent()
      }
      for (const material of paints.values()) material.dispose()
      paints.clear()
    },
  }
}

/** The shop's kiosk (spec 3C §6.2): a small stall with an awning and a coin. */
export function buildKiosk(kit: Kit): void {
  const [x, z] = KIOSK
  kit.block(1.4, 1.0, 0.7, "#8a5a36", x, 0, z, { r: 0.05 })
  kit.block(1.5, 0.06, 0.8, "#c9a24a", x, 1.0, z, { r: 0.02 })
  kit.block(0.06, 1.2, 0.06, "#3b2a1e", x - 0.68, 1.06, z + 0.32)
  kit.block(0.06, 1.2, 0.06, "#3b2a1e", x + 0.68, 1.06, z + 0.32)
  kit.block(1.7, 0.12, 0.9, "#d2462e", x, 2.26, z + 0.05, { r: 0.04 })
  kit.mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 24), kit.mat("#f2c14e", { metalness: 0.6, roughness: 0.3 }), x, 1.3, z, {}).rotation.x = Math.PI / 2
}
```

Catatan untuk implementer:
- Mesh buatan tangan (cincin `ceiling_globe`) masuk lewat `p.add`, bukan ke `scene` langsung, supaya ikut dibuang dengan grupnya. Material cincin dan kaca akuarium bukan milik `paints`, jadi `clearGroup` membuangnya; material `paints` dibuang di `dispose()`.
- `LobbyStage.tsx` butuh impor `useEffect`, `itemOf` (`@/lib/shop/catalog`), `useLobbyDecor` dan `useShop` (`@/lib/shop/shop-client`).
- Bentuk, warna, dan ukuran boleh disesuaikan setelah screenshot Step 13, selama tiap builder tetap ada dan tes lulus.

- [ ] **Step 8: Jalankan, pastikan lulus**

Run: `npx vitest run src/components/lobby/scene/decor.test.ts`
Expected: PASS, 5 tes.

- [ ] **Step 9: Pasang di stage**

Di `src/components/lobby/scene/stage.ts`:
- impor `buildDecor`, `buildKiosk` dari `./decor` dan `type Placements` dari `@/lib/shop/types`;
- di tipe `Stage`, setelah `setPlant`: `/** The shop's items in their slots (spec 3C §6.3). */ setDecor: (placed: Placements) => void`;
- setelah `const plant = buildPlant(...)`: `buildKiosk(kit)` dan `const decor = buildDecor(scene, () => requestRender())`;
- di objek yang dikembalikan: `setDecor(placed) { decor.set(placed) },`;
- di `dispose()`, sebelum `disposeTree(scene)`: `decor.dispose()`.

- [ ] **Step 10: Canvas dan scene**

`LobbyCanvas.tsx`: prop `decor: Placements` (komentar `/** The shop's items, placed or tried on. */`), `decorRef`, `stage.setDecor(decorRef.current)` setelah `stage.setPlant(...)` di pembuatan stage, dan effect `[decor]` yang memanggil `stageRef.current?.setDecor(decor)`. Tambahkan `setDecor: vi.fn()` ke stage tiruan di `LobbyCanvas.test.tsx` dan `LobbyScene.test.tsx`, plus tes di `LobbyCanvas.test.tsx` seperti tes tanaman:

```tsx
  it("passes the shop's items to the stage, at start and on change", async () => {
    const { rerender } = render(canvas({ decor: { rug: "rug_woven" } }))
    await waitFor(() =>
      expect(stage.setDecor).toHaveBeenCalledWith({ rug: "rug_woven" })
    )
    rerender(canvas({ decor: { rug: "rug_round", pet: "pet_cat" } }))
    expect(stage.setDecor).toHaveBeenLastCalledWith({
      rug: "rug_round",
      pet: "pet_cat",
    })
  })
```

(Sesuaikan `canvas(...)` dengan cara file tes itu merender `LobbyCanvas`; tes tanaman di baris ±58–85 adalah contohnya. Tambahkan `decor={{}}` ke setiap render yang ada.)

`LobbyScene.tsx`: prop `decor = {}` (tipe `Placements`) diteruskan ke `LobbyCanvas`; `LobbySceneHandle` mendapat `showDecor: (slot: SlotId) => void`:

```ts
    showDecor: (slot) =>
      moveCamera((current) =>
        panBy(
          centerOn(current.view, DECOR_SLOTS[slot].focus),
          PREVIEW_SHIFT,
          0,
          current.viewport
        )
      ),
```

Tambahkan tes di `LobbyScene.test.tsx`, mengikuti tes `showSpot` yang ada: setelah stage siap, `ref.current.showDecor("pet")` memanggil `stage.setView` dengan target yang berbeda dari `centerOn(view, DECOR_SLOTS.pet.focus).target` (karena digeser `PREVIEW_SHIFT`).

- [ ] **Step 11: Hotspot "Toko lobi"**

- `lobby-data.ts`: `if (id === "toko") return { ...plain, label: "Toko lobi" }` setelah baris `tanaman`. Di `lobby-data.test.ts`, tambahkan harapan label `toko` → "Toko lobi" di tes yang memeriksa label tetap.
- `LibraryMap.tsx`: `| "toko"` di `MapKind`, `["toko", "Toko lobi"]` di `LEGEND` sebelum `"anda"`. `LibraryMap.test.tsx`: string legenda menjadi `"Rak bukuMeja BacaMeja AdminTroli Buku BaruKosakataSudah dibacaKebiasaan bacaToko lobiPosisi Anda"`, plus `expect(kindOf("Toko lobi di peta")).toBe("toko")` mengikuti baris tanaman.
- `src/styles.css`, setelah aturan `tanaman` di sekitar baris 447:

```css
  .lobby-map-spot[data-kind="toko"],
  .lobby-map-mark[data-kind="toko"] {
    background: #f2a65a;
  }
```

- `HotspotLayer.test.tsx`: tes "starts at the reading table and ends at the habit plant" menjadi "… ends at the shop kiosk", dengan `expect(buttons.at(-1)).toHaveAccessibleName("Toko lobi")`.
- `LobbyStage.tsx`:
  - di `activate`, setelah cabang `tanaman`: `} else if (id === "toko") { void navigate({ to: "/shop" })`. Rute `/shop` baru ada di Task 4: sampai saat itu typecheck akan menolak `to: "/shop"`; tulis cabang ini di Task 4 Step 6, bukan di sini;
  - `const decor = useLobbyDecor()` dan `const shop = useShop()`, lalu `decor={decor}` ke `LobbyScene`;
  - pratinjau menggeser kamera, hanya di layar lebar:

```tsx
  // A preview from the shop brings its slot into view beside the panel (plan 3C, decision 5).
  const previewSlot = shop.preview ? (itemOf(shop.preview)?.slot ?? null) : null
  useEffect(() => {
    if (previewSlot && wide) sceneRef.current?.showDecor(previewSlot)
  }, [previewSlot, wide])
```

- [ ] **Step 12: Jalankan tes lobi**

Run: `npx vitest run src/components/lobby`
Expected: PASS.

- [ ] **Step 13: Periksa letak lewat harness**

Pasang semua slot sementara untuk screenshot: di `scripts/lobby-harness/main.ts`, setelah `createStage(...)`, tambahkan (akan dirapikan di Task 5):

```ts
const decorParam = new URLSearchParams(window.location.search).get("decor")
if (decorParam === "all") {
  stage.setDecor({
    rug: "rug_pattern",
    lamp: "lamp_arc",
    seat: "seat_sofa",
    wall: "wall_painting",
    pet: "pet_cat",
    ceiling: "ceiling_lights",
  })
}
```

dan di `render()` di `scripts/lobby-harness.mjs`, terima query tambahan (`render(viewport, query = "mode=still")`, `page.goto(\`${PAGE}?${query}\`)`); `shot` memakai `"mode=still&decor=all"` bila argumen ketiga `all` diberikan.

Run: `node scripts/lobby-harness.mjs shot .superpowers/shots/3c-decor.png all`
Expected: file PNG ada. Buka dan periksa: keenam barang dan kios terlihat utuh di pandangan awal atau di tepi yang mudah dijangkau; tidak menembus meja baca, rak, kaca, atau sofa; tidak menutupi label hotspot lain. Bila tidak, geser `DECOR_SLOTS`/`KIOSK` dan ulangi Step 4 dan Step 13. Catat koordinat akhirnya di laporan task.

- [ ] **Step 14: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npx vitest run src/components/lobby src/lib`
Expected: bersih, PASS.

```bash
git add src/components/lobby src/styles.css scripts/lobby-harness.mjs scripts/lobby-harness/main.ts
git commit -m "feat(lobby): the shop's items in six slots, a kiosk to open the shop, and a camera for previews"
```

---

### Task 4: Panel "Toko lobi"

**Files:**
- Create: `src/components/lobby/ShopPanel.tsx`
- Create: `src/components/lobby/ShopPanel.test.tsx`
- Create: `src/routes/_member/_lobi/shop.tsx`
- Modify: `src/components/lobby/LobbyPopup.tsx` (`"/shop"` di `POPUP_PATHS`, prop `side`)
- Modify: `src/components/member/MemberShell.tsx` (`"/shop"` di `OVER_LOBBY`)
- Modify: `src/components/lobby/LobbyStage.tsx` (cabang `toko`)
- Modify: `src/styles.css` (`.lobby-popup[data-side]`, `.shop-*`)
- Modify: `src/routes/privacy.tsx`
- Modify: `src/routeTree.gen.ts` (dibuat ulang)

**Interfaces:**
- Consumes: `SLOTS`, `SHOP_ITEMS`, `itemOf` (Task 1); `ShopView`, `useShop`, `refreshShop`, `buyItem`, `placeItem`, `previewItem` (Task 2); `bookMessage`.
- Produces: `ShopPanel` dengan props `{ view: ShopView; offline: boolean; onRetry: () => void; onBuy: (itemId: string) => Promise<ActionResult>; onPlace: (slot: SlotId, itemId: string | null) => Promise<ActionResult>; onPreview: (itemId: string | null) => void }`; rute `/shop`.

- [ ] **Step 1: Tes panel yang gagal**

`src/components/lobby/ShopPanel.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ShopView } from "@/lib/shop/types"
import { ShopPanel } from "./ShopPanel"

const ready = (changes: Partial<ShopView["state"] & object> = {}): ShopView => ({
  status: "ready",
  preview: null,
  state: {
    earned: 310,
    spent: 60,
    balance: 250,
    owned: ["rug_woven", "rug_round"],
    placed: { rug: "rug_woven" },
    ...changes,
  },
})

const panel = (props: Partial<Parameters<typeof ShopPanel>[0]> = {}) => {
  const handlers = {
    onRetry: vi.fn(),
    onBuy: vi.fn(() => Promise.resolve({ ok: true as const })),
    onPlace: vi.fn(() => Promise.resolve({ ok: true as const })),
    onPreview: vi.fn(),
  }
  render(<ShopPanel view={ready()} offline={false} {...handlers} {...props} />)
  return { ...handlers, ...props }
}

const item = (name: string) => screen.getByRole("listitem", { name })

describe("ShopPanel", () => {
  it("shows the balance and how coins are earned", () => {
    panel()
    expect(screen.getByRole("heading", { name: "Toko lobi" })).toBeVisible()
    // The cat costs 250 too: the balance is the one in .shop-balance.
    expect(screen.getByText("250 koin", { selector: ".shop-balance" })).toBeVisible()
    expect(
      screen.getByText(
        "1 koin per menit baca, +50 per buku selesai (dibaca minimal 1 jam)"
      )
    ).toBeVisible()
  })

  it("groups the items by slot, with their prices", () => {
    panel()
    expect(screen.getAllByRole("region")).toHaveLength(6)
    const pet = screen.getByRole("region", { name: "Teman" })
    expect(within(pet).getAllByRole("listitem")).toHaveLength(3)
    expect(within(item("Kucing tidur")).getByText("250 koin")).toBeVisible()
  })

  it("says which item is placed, which can be placed, and which can be bought", () => {
    panel()
    expect(within(item("Karpet anyaman")).getByText("Terpasang")).toBeVisible()
    expect(within(item("Karpet anyaman")).getByRole("button", { name: "Lepas" })).toBeEnabled()
    expect(within(item("Karpet bundar")).getByRole("button", { name: "Pasang" })).toBeEnabled()
    expect(within(item("Kucing tidur")).getByRole("button", { name: "Beli" })).toBeEnabled()
  })

  it("says how many coins are missing", () => {
    panel()
    const sofa = item("Sofa jendela")
    expect(within(sofa).getByRole("button", { name: "Beli" })).toBeDisabled()
    expect(within(sofa).getByText("Kurang 150 koin")).toBeVisible()
  })

  it("asks before buying, then buys", async () => {
    const { onBuy } = panel()
    fireEvent.click(within(item("Kucing tidur")).getByRole("button", { name: "Beli" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Beli Kucing tidur seharga 250 koin?")).toBeVisible()
    fireEvent.click(within(dialog).getByRole("button", { name: "Beli" }))
    await waitFor(() => expect(onBuy).toHaveBeenCalledWith("pet_cat"))
  })

  it("buys nothing when the question is turned down", async () => {
    const { onBuy } = panel()
    fireEvent.click(within(item("Kucing tidur")).getByRole("button", { name: "Beli" }))
    fireEvent.click(await screen.findByRole("button", { name: "Batal" }))
    expect(onBuy).not.toHaveBeenCalled()
  })

  it("says the coins ran short when another device spent them", async () => {
    panel({ onBuy: vi.fn(() => Promise.resolve({ ok: false as const, code: "not_enough" })) })
    fireEvent.click(within(item("Kucing tidur")).getByRole("button", { name: "Beli" }))
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Beli" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Koinmu belum cukup.")
  })

  it("places and takes off", async () => {
    const { onPlace } = panel()
    fireEvent.click(within(item("Karpet bundar")).getByRole("button", { name: "Pasang" }))
    await waitFor(() => expect(onPlace).toHaveBeenCalledWith("rug", "rug_round"))
    fireEvent.click(within(item("Karpet anyaman")).getByRole("button", { name: "Lepas" }))
    await waitFor(() => expect(onPlace).toHaveBeenLastCalledWith("rug", null))
  })

  it("tries an item on in the lobby", () => {
    const { onPreview } = panel()
    fireEvent.click(within(item("Kucing tidur")).getByRole("button", { name: "Lihat di lobi" }))
    expect(onPreview).toHaveBeenCalledWith("pet_cat")
  })

  it("asks to read when there are no coins", () => {
    panel({ view: ready({ earned: 0, spent: 0, balance: 0, owned: [], placed: {} }) })
    expect(screen.getByText("Baca untuk mendapat koin")).toBeVisible()
  })

  it("locks every button offline", () => {
    panel({ offline: true })
    expect(screen.getAllByText("Perlu koneksi internet").length).toBeGreaterThan(0)
    for (const name of ["Beli", "Pasang", "Lepas"]) {
      for (const button of screen.queryAllByRole("button", { name })) {
        expect(button).toBeDisabled()
      }
    }
  })

  it("loads, and offers to try again when loading failed without a copy", () => {
    const { onRetry } = panel({ view: { status: "failed", state: null, preview: null } })
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }))
    expect(onRetry).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/components/lobby/ShopPanel.test.tsx`
Expected: FAIL, modul `./ShopPanel` tidak ada.

- [ ] **Step 3: Tulis panel**

`src/components/lobby/ShopPanel.tsx`:

```tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ActionResult } from "@/lib/action-result"
import { bookMessage } from "@/lib/book-messages"
import { SHOP_ITEMS, SLOTS, type ShopItem, type SlotId } from "@/lib/shop/catalog"
import type { ShopView } from "@/lib/shop/types"

const OFFLINE_NOTE = "Perlu koneksi internet"
const coins = (n: number) => `${n.toLocaleString("id-ID")} koin`

/** The lobby shop (spec 3C §6.2): the balance, then six slots of items. */
export function ShopPanel({
  view,
  offline,
  onRetry,
  onBuy,
  onPlace,
  onPreview,
}: {
  view: ShopView
  offline: boolean
  onRetry: () => void
  onBuy: (itemId: string) => Promise<ActionResult>
  onPlace: (slot: SlotId, itemId: string | null) => Promise<ActionResult>
  onPreview: (itemId: string | null) => void
}) {
  const [asking, setAsking] = useState<ShopItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { state } = view

  if (!state) {
    return (
      <div className="shop-panel">
        <h1 className="font-heading text-2xl">Toko lobi</h1>
        {view.status === "failed" ? (
          <>
            <p className="text-sm">Toko lobi belum bisa dimuat.</p>
            <Button onClick={onRetry}>Coba lagi</Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        )}
      </div>
    )
  }

  async function act(run: () => Promise<ActionResult>) {
    setError(null)
    setBusy(true)
    try {
      const result = await run()
      if (!result.ok) setError(bookMessage(result.code))
    } finally {
      setBusy(false)
    }
  }

  const locked = offline || busy
  return (
    <div className="shop-panel">
      <header className="shop-head">
        <h1 className="font-heading text-2xl">Toko lobi</h1>
        <p className="shop-balance">{coins(state.balance)}</p>
        <p className="text-sm text-muted-foreground">
          1 koin per menit baca, +50 per buku selesai (dibaca minimal 1 jam)
        </p>
        {state.balance === 0 && state.owned.length === 0 && (
          <p className="text-sm">Baca untuk mendapat koin</p>
        )}
        {offline && <p className="text-sm">{OFFLINE_NOTE}</p>}
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
      </header>
      {SLOTS.map((slot) => (
        <section key={slot.id} aria-label={slot.name} className="shop-slot">
          <h2 className="font-heading text-lg">{slot.name}</h2>
          <ul className="shop-items">
            {SHOP_ITEMS.filter((item) => item.slot === slot.id).map((item) => {
              const owned = state.owned.includes(item.id)
              const placed = state.placed[slot.id] === item.id
              const short = item.price - state.balance
              return (
                <li key={item.id} aria-label={item.name} className="shop-item">
                  <img
                    src={`/lobby/shop/${item.id}.webp`}
                    alt=""
                    width={480}
                    height={360}
                    loading="lazy"
                    className="shop-thumb"
                  />
                  <div className="shop-item-body">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{coins(item.price)}</p>
                    <div className="shop-actions">
                      {placed ? (
                        <>
                          <span className="text-sm">Terpasang</span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={locked}
                            onClick={() => void act(() => onPlace(slot.id, null))}
                          >
                            Lepas
                          </Button>
                        </>
                      ) : owned ? (
                        <Button
                          size="sm"
                          disabled={locked}
                          onClick={() => void act(() => onPlace(slot.id, item.id))}
                        >
                          Pasang
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            disabled={locked || short > 0}
                            onClick={() => setAsking(item)}
                          >
                            Beli
                          </Button>
                          {short > 0 && (
                            <span className="text-sm text-muted-foreground">
                              Kurang {coins(short)}
                            </span>
                          )}
                        </>
                      )}
                      {!placed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="hidden lg:inline-flex"
                          aria-pressed={view.preview === item.id}
                          onClick={() =>
                            onPreview(view.preview === item.id ? null : item.id)
                          }
                        >
                          Lihat di lobi
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <Dialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open) setAsking(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Beli barang</DialogTitle>
            <DialogDescription>
              {asking && `Beli ${asking.name} seharga ${coins(asking.price)}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsking(null)}>
              Batal
            </Button>
            <Button
              disabled={locked}
              onClick={() => {
                const item = asking
                setAsking(null)
                if (item) void act(() => onBuy(item.id))
              }}
            >
              Beli
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

Catatan: kalimat dialog memakai `coins(...)` sehingga berbunyi "Beli Kucing tidur seharga 250 koin?" sesuai spec. Untuk harga ≥ 1000 tidak ada barang, jadi format ribuan tidak memengaruhi teks yang diuji.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run src/components/lobby/ShopPanel.test.tsx`
Expected: PASS, 12 tes.

- [ ] **Step 5: Popup sisi kanan**

- `LobbyPopup.tsx`: tambahkan `"/shop"` ke `POPUP_PATHS` dan perbarui komentar daftar halaman; prop baru `side?: boolean` (komentar `/** On desktop: a narrow panel on the right, the lobby clear beside it (plan 3C, decision 4). */`), yang menaruh `data-side=""` pada `<div className="lobby-popup-backdrop">` dan `<main className="lobby-popup">` bila benar.
- `MemberShell.tsx`: tambahkan `"/shop"` ke `OVER_LOBBY`.
- `src/styles.css`, di blok `@media (min-width: 1024px)` yang sama dengan `.lobby-popup` (sekitar baris 1432–1458), setelah aturan `.lobby-popup`:

```css
    /* The shop: the lobby stays in sight for the preview (plan 3C, decision 4). */
    .lobby-popup-backdrop[data-side] {
      background: transparent;
      backdrop-filter: none;
    }
    .lobby-popup[data-side] {
      left: auto;
      width: min(28rem, 40vw);
    }
```

dan di luar media query, di dekat aturan `.habit-panel`:

```css
  .shop-panel {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .shop-balance {
    font-size: 1.75rem;
    font-weight: 600;
  }
  .shop-slot {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .shop-items {
    display: grid;
    gap: 0.75rem;
  }
  .shop-item {
    display: grid;
    gap: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 0.5rem;
  }
  /* Phones: the lobby is hidden, so the picture is the preview (spec 3C §6.3). */
  .shop-thumb {
    width: 100%;
    height: auto;
    border-radius: 0.5rem;
    background: var(--muted);
  }
  .shop-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  @media (min-width: 1024px) {
    .shop-item {
      grid-template-columns: 6rem 1fr;
    }
  }
```

- [ ] **Step 6: Rute `/shop` dan hotspot**

`src/routes/_member/_lobi/shop.tsx`:

```tsx
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useEffect } from "react"
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
import { ShopPanel } from "@/components/lobby/ShopPanel"
import {
  buyItem,
  placeItem,
  previewItem,
  refreshShop,
  useShop,
} from "@/lib/shop/shop-client"

const lobi = getRouteApi("/_member/_lobi")

export const Route = createFileRoute("/_member/_lobi/shop")({
  head: () => ({ meta: [{ title: "Toko lobi — Glosa" }] }),
  component: ShopPage,
})

/** Toko lobi over the lobby (spec 3C §6.2). */
function ShopPage() {
  const { offline } = lobi.useLoaderData()
  const shop = useShop()
  // The newest balance on every visit; closing ends a preview (spec 3C §6.3).
  useEffect(() => {
    void refreshShop()
    return () => previewItem(null)
  }, [])
  return (
    <LobbyPopup label="Toko lobi" side>
      <ShopPanel
        view={shop}
        offline={offline}
        onRetry={() => void refreshShop()}
        onBuy={buyItem}
        onPlace={placeItem}
        onPreview={previewItem}
      />
    </LobbyPopup>
  )
}
```

Di `LobbyStage.tsx`, di `activate`, setelah cabang `tanaman`:

```tsx
    } else if (id === "toko") {
      void navigate({ to: "/shop" })
```

Buat ulang route tree: jalankan `npx vite build` (atau dev server sebentar) dan pastikan `src/routeTree.gen.ts` memuat `/_member/_lobi/shop` dan blok `declare module '@tanstack/react-start' { interface Register … }` masih ada (bandingkan dengan `git diff src/routeTree.gen.ts`).

- [ ] **Step 7: Privasi**

Di `src/routes/privacy.tsx`, setelah `<li>` "Waktu membaca: …":

```tsx
        <li>
          Toko lobi: barang lobi yang kamu beli dan pasang, serta koin dari
          bacaanmu. Data ini tidak dibagikan dan ikut terhapus saat akunmu
          dihapus.
        </li>
```

- [ ] **Step 8: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: bersih, semua PASS (termasuk tes `LobbyPopup` dan `MemberShell` yang ada).

```bash
git add src/components/lobby src/components/member/MemberShell.tsx src/routes src/routeTree.gen.ts src/styles.css
git commit -m "feat(shop): Toko lobi over the lobby, with a 3D preview beside it on desktop"
```

---

### Task 5: Gambar kecil dan gambar diam

**Files:**
- Modify: `scripts/lobby-harness/main.ts` (`?decor=<id>|all`, kamera di slot)
- Modify: `scripts/lobby-harness.mjs` (perintah `thumbs`)
- Create: `public/lobby/shop/*.webp` (18 file)
- Modify: `public/lobby/lobby-still*.{avif,webp}` (kios kini tampak)

**Interfaces:**
- Consumes: `SHOP_ITEMS`, `itemOf` (Task 1); `DECOR_SLOTS`, `Stage.setDecor` (Task 3); `centerOn`, `MAX_ZOOM`.
- Produces: `/lobby/shop/<id>.webp` untuk `ShopPanel`.

- [ ] **Step 1: Harness memasang satu barang**

Di `scripts/lobby-harness/main.ts`, ganti blok sementara dari Task 3 Step 13 dengan:

```ts
// ?decor=all: one item in every slot, to check where they stand.
// ?decor=<id>: that item alone, the camera close on its slot (the shop's pictures).
const decorParam = new URLSearchParams(window.location.search).get("decor")
if (decorParam === "all") {
  stage.setDecor({
    rug: "rug_pattern",
    lamp: "lamp_arc",
    seat: "seat_sofa",
    wall: "wall_painting",
    pet: "pet_cat",
    ceiling: "ceiling_lights",
  })
} else if (decorParam) {
  const item = itemOf(decorParam)
  if (!item) throw new Error(`No shop item ${decorParam}`)
  stage.setDecor({ [item.slot]: item.id })
  const view = startView({ width: host.clientWidth, height: host.clientHeight })
  stage.setView({
    ...centerOn(view, DECOR_SLOTS[item.slot].focus),
    zoom: MAX_ZOOM,
  })
}
```

dengan impor `itemOf` dari `@/lib/shop/catalog`, `DECOR_SLOTS` dari layout, `centerOn` dan `MAX_ZOOM` dari projection.

- [ ] **Step 2: Perintah `thumbs`**

Di `scripts/lobby-harness.mjs`, perbarui komentar penggunaan (`node scripts/lobby-harness.mjs thumbs   public/lobby/shop/<id>.webp`) dan tambahkan:

```js
const THUMB = { width: 480, height: 360 }
const THUMB_MAX_BYTES = 60 * 1024

async function thumbs() {
  const { SHOP_ITEMS } = await server.ssrLoadModule("/src/lib/shop/catalog.ts")
  mkdirSync("public/lobby/shop", { recursive: true })
  for (const { id } of SHOP_ITEMS) {
    const png = await render(THUMB, `mode=still&decor=${id}`)
    const file = `public/lobby/shop/${id}.webp`
    const out = await sharp(png).webp({ quality: 75 }).toFile(file)
    console.log(`${file}: ${Math.round(out.size / 1024)} kB`)
    if (out.size > THUMB_MAX_BYTES) throw new Error(`${file} is over 60 kB`)
  }
}
```

dan cabang `else if (command === "thumbs") await thumbs()`. Pastikan `render(viewport, query)` dari Task 3 Step 13 dipakai dan `still()` memanggil `render(STILL)` dengan query bawaan `mode=still`.

- [ ] **Step 3: Render gambar kecil**

Run: `node scripts/lobby-harness.mjs thumbs`
Expected: 18 baris `public/lobby/shop/<id>.webp: N kB`, tiap file ≤ 60 kB. Buka beberapa (minimal satu per slot): barangnya terlihat jelas di tengah. Bila sebuah barang terpotong atau terlalu kecil, sesuaikan `focus` slot itu di `DECOR_SLOTS` (lalu jalankan ulang tes layout dan `thumbs`).

- [ ] **Step 4: Render ulang gambar diam**

Run: `node scripts/lobby-harness.mjs still`
Expected: `lobby-still: avif ≤ 250 kB`; kios tampak di gambar diam. Gambar diam tidak memuat barang toko (spec 3C §6.3).

- [ ] **Step 5: Commit**

```bash
git add scripts public/lobby
git commit -m "feat(shop): a picture of every lobby item, and the still lobby with its kiosk"
```

---

### Task 6: E2E dan verifikasi akhir

**Files:**
- Create: `e2e/helpers/shop.ts`
- Create: `e2e/shop.spec.ts`

**Interfaces:**
- Consumes: `seedReadingTime`, `todayInZone` dari `e2e/helpers/habit.ts`; `admin` dari `e2e/helpers/members.ts`; `seedBook`, pola masuk dan `hydrated` seperti `e2e/habit.spec.ts`.

- [ ] **Step 1: Helper**

`e2e/helpers/shop.ts`:

```ts
import { admin } from "./members"

/** The items placed for the member, as the server has them. */
export async function placedItems(
  userId: string
): Promise<Record<string, string>> {
  const { data, error } = await admin()
    .from("lobby_placements")
    .select("slot, item_id")
    .eq("user_id", userId)
  if (error) throw error
  return Object.fromEntries(data.map((row) => [row.slot, row.item_id]))
}
```

- [ ] **Step 2: Tulis spec**

`e2e/shop.spec.ts`. Salin impor dan blok `test.use(...)` (zona waktu `HABIT_ZONE`) serta fungsi `hydrated` dari bagian atas `e2e/habit.spec.ts`; jangan menulis ulang helper masuk.

```ts
test("reading pays for a rug that then lies in the lobby", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId)
  await seedReadingTime(userId, bookId, todayInZone(), 3600) // 60 coins

  await page.goto("/lobby")
  await hydrated(page)
  const scene = page.getByRole("region", { name: "Adegan lobi" })
  await scene.getByRole("button", { name: "Toko lobi" }).press("Enter")
  await expect(page).toHaveURL(/\/shop$/)
  await expect(page.getByRole("heading", { name: "Toko lobi" })).toBeVisible()
  await expect(page.getByText("60 koin", { exact: true }).first()).toBeVisible()

  const round = page.getByRole("listitem", { name: "Karpet bundar" })
  await expect(round.getByRole("button", { name: "Beli" })).toBeDisabled()
  await expect(round.getByText("Kurang 60 koin")).toBeVisible()

  const woven = page.getByRole("listitem", { name: "Karpet anyaman" })
  await woven.getByRole("button", { name: "Beli" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Beli Karpet anyaman seharga 60 koin?")).toBeVisible()
  await dialog.getByRole("button", { name: "Beli" }).click()
  await expect(woven.getByText("Terpasang")).toBeVisible()
  await expect(page.getByText("0 koin", { exact: true })).toBeVisible()
  expect(await placedItems(userId)).toEqual({ rug: "rug_woven" })

  await woven.getByRole("button", { name: "Lepas" }).click()
  await expect(woven.getByRole("button", { name: "Pasang" })).toBeVisible()
  await expect.poll(() => placedItems(userId)).toEqual({})
})

test("a member who has not read yet is asked to read", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto("/shop")
  await expect(page.getByText("Baca untuk mendapat koin")).toBeVisible()
  await expect(
    page.getByRole("listitem", { name: "Karpet anyaman" }).getByRole("button", { name: "Beli" })
  ).toBeDisabled()
})
```

Catatan: angka "60 koin" juga muncul sebagai harga Karpet anyaman, jadi saldo dicari dengan `.first()` atau lewat kelas `.shop-balance` (`page.locator(".shop-balance")`); pilih yang stabil di kedua project dan pakai cara yang sama untuk "0 koin".

- [ ] **Step 3: Jalankan E2E toko**

Run (cek port 3000 dulu, lihat Global Constraints): `npx playwright test e2e/shop.spec.ts --workers=2`
Expected: 4 passed (2 tes × desktop dan mobile).

- [ ] **Step 4: Verifikasi penuh**

Run:
- `npm run typecheck && npm run lint && npm run check`
- `npm test`
- `npx vitest run --config vitest.db.config.ts tests/db/shop.test.ts tests/db/habit.test.ts tests/db/collections.test.ts`
- `npx playwright test --workers=2`

Expected: bersih; unit dan DB PASS; E2E penuh tanpa kegagalan baru (kegagalan tunggal dijalankan ulang sendirian dulu). Catat angkanya di laporan task.

- [ ] **Step 5: Commit**

```bash
git add e2e/shop.spec.ts e2e/helpers/shop.ts
git commit -m "test(e2e): buying, placing and taking off a lobby item, and an empty purse"
```

- [ ] **Step 6: Daftar periksa pemilik setelah deploy** (tidak dikerjakan agen; masuk laporan akhir)

1. Baca beberapa menit, buka Toko lobi: saldo naik sesuai menit.
2. Tandai selesai buku yang sudah dibaca ≥ 1 jam: saldo naik 50, sekali saja.
3. Desktop: "Lihat di lobi" memasang barang sementara dan kamera bergeser ke slotnya di samping panel; menutup panel mengembalikan lobi.
4. Beli, pasang, lepas di HP dan desktop; barang tetap tampil setelah muat ulang dan saat offline.
5. Gambar diam (perangkat tanpa WebGL) menampilkan kios, tanpa barang toko.
