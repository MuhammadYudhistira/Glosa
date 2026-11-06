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
      {
        day: utcDay(),
        device_id: phone,
        book_id: books.budi,
        seconds: 60,
        goal_minutes: null,
      },
    ])
    // Nothing reached Ani's rows.
    expect((await rowsOf(ids.ani)).every((row) => row.seconds !== 60)).toBe(
      true
    )
  })

  it("answers a broken entry with invalid, alone", async () => {
    expect(
      await record(budi, [
        {
          day: "kemarin",
          device_id: phone,
          book_id: books.budi,
          seconds: 5,
          goal_minutes: null,
        },
        {
          day: utcDay(),
          device_id: phone,
          book_id: books.budi,
          seconds: 90_000,
          goal_minutes: null,
        },
        {
          day: utcDay(),
          device_id: phone,
          book_id: books.budi,
          seconds: 5,
          goal_minutes: 7,
        },
        {
          day: utcDay(),
          device_id: laptop,
          book_id: books.budi,
          seconds: 30,
          goal_minutes: 5,
        },
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
    expect(new Set(data?.map((row) => row.user_id))).toEqual(
      new Set([ids.budi])
    )
    expect((await days(cita)).length).toBe(0)
  })

  it("keeps the days read when the book is deleted", async () => {
    await record(cita, [
      {
        day: utcDay(),
        device_id: phone,
        book_id: books.cita,
        seconds: 400,
        goal_minutes: null,
      },
    ])
    const { error } = await adminClient()
      .from("books")
      .delete()
      .eq("id", books.cita)
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
    const goals = (patch: {
      daily_goal_minutes?: number | null
      yearly_goal_books?: number | null
    }) => budi.from("profiles").update(patch).eq("id", ids.budi)
    expect(
      (await goals({ daily_goal_minutes: 20, yearly_goal_books: 12 })).error
    ).toBeNull()
    expect((await goals({ daily_goal_minutes: 7 })).error).not.toBeNull()
    expect((await goals({ yearly_goal_books: 0 })).error).not.toBeNull()
    expect((await goals({ yearly_goal_books: 366 })).error).not.toBeNull()
    expect(
      (await goals({ daily_goal_minutes: null, yearly_goal_books: null })).error
    ).toBeNull()
  })

  it("gives a saved daily goal to today's rows only", async () => {
    const entry = (day: string, book: string, goal: number | null): Entry => ({
      day,
      device_id: phone,
      book_id: book,
      seconds: 120,
      goal_minutes: goal,
    })
    await record(ani, [
      entry(utcDay(0), books.ani, 10),
      entry(utcDay(-1), books.ani, 10),
    ])
    await record(budi, [entry(utcDay(0), books.budi, 10)])

    const saved = await ani.rpc("set_reading_goals", {
      p_daily: 30,
      p_yearly: 12,
      p_today: utcDay(0),
    })
    expect(saved).toMatchObject({ data: "ok", error: null })
    const goalOf = async (id: string, book: string, day: string) =>
      (await rowsOf(id)).find(
        (row) =>
          row.day === day && row.book_id === book && row.device_id === phone
      )?.goal_minutes
    expect(await goalOf(ids.ani, books.ani, utcDay(0))).toBe(30)
    expect(await goalOf(ids.ani, books.ani, utcDay(-1))).toBe(10)
    expect(await goalOf(ids.budi, books.budi, utcDay(0))).toBe(10)
    const profile = await adminClient()
      .from("profiles")
      .select("daily_goal_minutes, yearly_goal_books")
      .eq("id", ids.ani)
      .single()
    expect(profile.data).toEqual({
      daily_goal_minutes: 30,
      yearly_goal_books: 12,
    })
  })

  it("answers invalid, changing nothing, for a bad day or goal", async () => {
    const set = async (
      daily: number | null,
      yearly: number | null,
      day: string
    ) =>
      (
        await ani.rpc("set_reading_goals", {
          p_daily: daily as number,
          p_yearly: yearly as number,
          p_today: day,
        })
      ).data
    expect(await set(5, 1, utcDay(-3))).toBe("invalid")
    expect(await set(5, 1, utcDay(2))).toBe("invalid")
    expect(await set(7, 1, utcDay(0))).toBe("invalid")
    expect(await set(5, 0, utcDay(0))).toBe("invalid")
    expect(await set(5, 366, utcDay(0))).toBe("invalid")
    const row = (await rowsOf(ids.ani)).find((r) => r.day === utcDay(0))
    expect(row?.goal_minutes).toBe(30)
    expect(await set(null, null, utcDay(0))).toBe("ok")
    expect(
      (await rowsOf(ids.ani)).find((r) => r.day === utcDay(0))?.goal_minutes
    ).toBeNull()
  })

  it("refuses a caller without a session", async () => {
    const { anonClient } = await import("./helpers")
    const { error } = await anonClient().rpc("record_reading_time", {
      p_entries: [],
    })
    expect(error).not.toBeNull()
  })
})
