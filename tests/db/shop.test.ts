import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  COINS_PER_BOOK,
  DAILY_COIN_CAP,
  MIN_BOOK_SECONDS,
  SHOP_ITEMS,
} from "@/lib/shop/catalog"
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
  ani: `db-shop-ani-${run}@glosa.test`,
  budi: `db-shop-budi-${run}@glosa.test`,
  cita: `db-shop-cita-${run}@glosa.test`,
  dora: `db-shop-dora-${run}@glosa.test`,
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
async function seed(
  userId: string,
  bookId: string,
  day: string,
  seconds: number
) {
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
  const ids = { ani: "", budi: "", cita: "", dora: "" }
  const books = { ani: "", budi: "", budi2: "", cita: "" }
  let ani: Client
  let budi: Client
  let cita: Client

  beforeAll(async () => {
    ids.ani = (await createTestMember({ email: emails.ani })).id
    ids.budi = (await createTestMember({ email: emails.budi })).id
    ids.cita = (await createTestMember({ email: emails.cita })).id
    ids.dora = (await createTestMember({ email: emails.dora })).id
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

  it("pays a coin per whole minute, at most the daily cap, over every device", async () => {
    await seed(ids.ani, books.ani, "2026-01-01", 59)
    await seed(ids.ani, books.ani, "2026-01-01", 62) // same day: 121 s = 2
    await seed(ids.ani, books.ani, "2026-01-02", 20_000) // capped
    await seed(ids.ani, books.ani, "2026-01-03", 599) // 9
    expect((await state(ani)).earned).toBe(2 + DAILY_COIN_CAP + 9)
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
    await seed(ids.budi, books.budi, "2026-01-01", MIN_BOOK_SECONDS - 1)
    // 59 minutes: no bonus yet.
    expect((await state(budi)).earned).toBe(59)
    await seed(ids.budi, books.budi, "2026-01-02", 1) // the last second arrives
    expect((await state(budi)).earned).toBe(59 + COINS_PER_BOOK)
    expect((await state(budi)).earned).toBe(59 + COINS_PER_BOOK) // once
    await finish(books.budi, null)
    expect((await state(budi)).earned).toBe(59 + COINS_PER_BOOK)
    await adminClient().from("books").delete().eq("id", books.budi)
    expect((await state(budi)).earned).toBe(59 + COINS_PER_BOOK)
    // Read an hour but not finished: no bonus.
    await seed(ids.budi, books.budi2, "2026-01-03", MIN_BOOK_SECONDS)
    expect((await state(budi)).earned).toBe(59 + COINS_PER_BOOK + 60)
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
      [
        "lobby_placements",
        { user_id: ids.ani, slot: "rug", item_id: "rug_round" },
      ],
      ["coin_awards", { user_id: ids.ani, book_id: randomUUID(), coins: 50 }],
      ["coin_grants", { user_id: ids.ani, coins: 1000, reason: "me" }],
      ["lobby_items", { id: "free", slot: "rug", price: 1 }],
    ] as const) {
      const { error } = await ani.from(table).insert(row as never)
      expect(error, table).not.toBeNull()
    }
    const { data } = await budi.from("lobby_purchases").select("item_id")
    expect(data).toEqual([])
    const { error } = await ani.rpc(
      "award_book_coins" as never,
      {
        p_user_id: ids.ani,
      } as never
    )
    expect(error).not.toBeNull()
    const totals = await ani.rpc(
      "coin_totals" as never,
      { p_user_id: ids.ani } as never
    )
    expect(totals.error).not.toBeNull()
  })

  it("deletes the shop rows with the account", async () => {
    const book = await newTestBook(ids.dora)
    await seed(ids.dora, book, "2026-01-01", 120 * 60)
    await adminClient()
      .from("books")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", book)
    await seed(ids.dora, book, "2026-01-02", MIN_BOOK_SECONDS)
    const { error: grant } = await adminClient()
      .from("coin_grants")
      .insert({ user_id: ids.dora, coins: 5, reason: "test" })
    if (grant) throw grant
    const dora = await signedInClient(emails.dora)
    expect(await buy(dora, "rug_woven")).toBe("ok") // also awards the book
    const rows = async () => {
      const counts: Record<string, number> = {}
      for (const table of [
        "lobby_purchases",
        "lobby_placements",
        "coin_awards",
        "coin_grants",
      ] as const) {
        const { count, error } = await adminClient()
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("user_id", ids.dora)
        if (error) throw error
        counts[table] = count ?? 0
      }
      return counts
    }
    expect(Object.values(await rows()).every((n) => n > 0)).toBe(true)
    const { error } = await adminClient().auth.admin.deleteUser(ids.dora)
    expect(error).toBeNull()
    forgetTestMember(ids.dora)
    expect(await rows()).toEqual({
      lobby_purchases: 0,
      lobby_placements: 0,
      coin_awards: 0,
      coin_grants: 0,
    })
  })
})
