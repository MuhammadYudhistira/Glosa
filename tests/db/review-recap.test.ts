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
  fail(
    (await admin.from("books").update({ finished_at: at }).eq("id", bookId))
      .error
  )
}
async function readTime(
  userId: string,
  bookId: string,
  day: string,
  seconds: number
) {
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
    const save = (
      client: Client,
      book: string,
      rating: number,
      difficulty: string | null = null,
      note: string | null = null
    ) =>
      rpc(client, "save_review", {
        p_book_id: book,
        p_rating: rating,
        p_difficulty: difficulty,
        p_note: note,
      })

    it("saves, changes and reads back a review of a finished book", async () => {
      expect(await save(ani, books.done, 4, "hard", "  Bagus.  ")).toBe("ok")
      expect(await save(ani, books.done, 5, null, "")).toBe("ok")
      const { data } = await ani
        .from("book_reviews")
        .select("rating, difficulty, note")
        .eq("book_id", books.done)
      expect(data).toEqual([{ rating: 5, difficulty: null, note: null }])
    })

    it("keeps a trimmed note and refuses what breaks the rules", async () => {
      expect(await save(ani, books.done, 3, "easy", "  Bagus.  ")).toBe("ok")
      const { data } = await ani
        .from("book_reviews")
        .select("note")
        .eq("book_id", books.done)
        .single()
      expect(data?.note).toBe("Bagus.")
      expect(await save(ani, books.done, 0)).toBe("invalid")
      expect(await save(ani, books.done, 6)).toBe("invalid")
      expect(await save(ani, books.done, 3, "tough")).toBe("invalid")
      expect(await save(ani, books.done, 3, null, "x".repeat(2001))).toBe(
        "invalid"
      )
      expect(await save(ani, books.done, 3, null, "x".repeat(2000))).toBe("ok")
    })

    it("answers not_finished and not_found, and never lets one member touch another's", async () => {
      expect(await save(ani, books.open, 4)).toBe("not_finished")
      expect(await save(ani, books.other, 4)).toBe("not_found")
      expect(await save(ani, randomUUID(), 4)).toBe("not_found")
      expect(await rpc(ani, "delete_review", { p_book_id: books.other })).toBe(
        "not_found"
      )
      expect(await save(budi, books.other, 2)).toBe("ok")
      const { data } = await ani.from("book_reviews").select("book_id")
      expect(data?.map((row) => row.book_id)).toEqual([books.done])
      const direct = await ani
        .from("book_reviews")
        .insert({ book_id: books.second, user_id: ids.ani, rating: 1 })
      expect(direct.error).not.toBeNull()
    })

    it("deletes a review, also when there is none", async () => {
      expect(await rpc(ani, "delete_review", { p_book_id: books.done })).toBe(
        "ok"
      )
      expect(await rpc(ani, "delete_review", { p_book_id: books.done })).toBe(
        "ok"
      )
      const { data } = await ani.from("book_reviews").select("book_id")
      expect(data).toEqual([])
    })

    it("goes with the book and with the account", async () => {
      const mine = await newTestBook(ids.ani)
      await finish(mine)
      expect(await save(ani, mine, 4)).toBe("ok")
      fail((await admin.from("books").delete().eq("id", mine)).error)
      const gone = await admin
        .from("book_reviews")
        .select("book_id")
        .eq("book_id", mine)
      expect(gone.data).toEqual([])

      const cici = (
        await createTestMember({ email: `db-review-gone-${run}@glosa.test` })
      ).id
      const theirs = await newTestBook(cici)
      await finish(theirs)
      const client = await signedInClient(`db-review-gone-${run}@glosa.test`)
      expect(await save(client, theirs, 3)).toBe("ok")
      fail((await admin.auth.admin.deleteUser(cici)).error)
      forgetTestMember(cici)
      const after = await admin
        .from("book_reviews")
        .select("book_id")
        .eq("book_id", theirs)
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

      const summary = (await rpc(ani, "book_finish_summary", {
        p_book_id: books.done,
      })) as {
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
      expect(summary.words).toEqual(
        saved.slice(0, 12).map((word) => word.headword)
      )
      // 3,900 s is over the hour that earns the bonus (3C).
      expect(summary.coins).toBe(50)
      expect(Date.parse(summary.finished_at)).toBe(
        Date.parse("2026-10-20T10:00:00Z")
      )
      expect(summary.review).toBeNull()
    })

    it("has no coins under an hour, carries the review, and is null for another member's book", async () => {
      expect(
        await rpc(ani, "save_review", {
          p_book_id: books.done,
          p_rating: 4,
          p_difficulty: "easy",
          p_note: "ok",
        })
      ).toBe("ok")
      const again = (await rpc(ani, "book_finish_summary", {
        p_book_id: books.done,
      })) as { review: { rating: number; difficulty: string } }
      expect(again.review).toMatchObject({ rating: 4, difficulty: "easy" })
      const second = (await rpc(ani, "book_finish_summary", {
        p_book_id: books.second,
      })) as { coins: number; seconds: number }
      expect(second).toMatchObject({ coins: 0, seconds: 0 })
      expect(
        await rpc(ani, "book_finish_summary", { p_book_id: books.other })
      ).toBeNull()
    })
  })

  describe("reading_recap", () => {
    const recap = (
      client: Client,
      from: string,
      to: string,
      tz = "Asia/Jakarta"
    ) =>
      rpc(client, "reading_recap", {
        p_from: from,
        p_to: to,
        p_tz: tz,
      }) as Promise<{
        days: Array<{
          day: string
          seconds: number
          goal_minutes: number | null
        }>
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
      expect(utc.books.map((book) => book.id)).toEqual([
        books.second,
        books.done,
      ])
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
            {
              user_id: ids.ani,
              book_id: books.second,
              word: "alpha",
              taps: 1,
              first_at: "2026-12-05T00:00:00Z",
            },
            {
              user_id: ids.ani,
              book_id: books.second,
              word: "delta",
              taps: 1,
              first_at: "2026-12-05T00:00:00Z",
            },
          ])
        ).error
      )
      fail(
        (
          await admin
            .from("word_lookups")
            .update({ first_at: "2026-10-20T03:00:00Z" })
            .eq("user_id", ids.ani)
            .eq("book_id", books.done)
        ).error
      )
      const december = await recap(ani, "2026-12-01", "2026-12-31", "UTC")
      // alpha was first tapped in October, so only delta is new in December.
      expect(december.looked_up).toBe(1)
      const october = await recap(ani, "2026-10-01", "2026-10-31", "UTC")
      expect(october.looked_up).toBe(2)
      expect(october.saved).toBe(14)
      expect((await recap(ani, "2026-11-01", "2026-11-30", "UTC")).saved).toBe(
        0
      )
    })

    it("finds the word met most in the period, ties by alphabet, met_at kept when the count grows", async () => {
      fail(
        (
          await admin.from("saved_words").insert([
            {
              user_id: ids.ani,
              headword: "berry",
              meanings: ["a"],
              sentence: "",
            },
            {
              user_id: ids.ani,
              headword: "apple",
              meanings: ["a"],
              sentence: "",
            },
          ])
        ).error
      )
      const meet = (
        headword: string,
        section: number,
        count: number,
        met_at: string
      ) => ({
        user_id: ids.ani,
        headword,
        book_id: books.open,
        section,
        count,
        met_at,
      })
      fail(
        (
          await admin
            .from("word_meetings")
            .insert([
              meet("berry", 1, 2, "2026-09-10T00:00:00Z"),
              meet("berry", 2, 1, "2026-09-11T00:00:00Z"),
              meet("apple", 1, 3, "2026-09-12T00:00:00Z"),
              meet("apple", 2, 9, "2026-08-01T00:00:00Z"),
            ])
        ).error
      )
      const september = await recap(ani, "2026-09-01", "2026-09-30", "UTC")
      expect(september.top_meeting).toEqual({ headword: "apple", meetings: 3 })
      fail(
        (
          await admin
            .from("word_meetings")
            .update({ count: 4 })
            .eq("user_id", ids.ani)
            .eq("headword", "berry")
            .eq("section", 1)
        ).error
      )
      expect(
        (await recap(ani, "2026-09-01", "2026-09-30", "UTC")).top_meeting
      ).toEqual({ headword: "berry", meetings: 5 })
      fail(
        (
          await admin
            .from("word_meetings")
            .update({ count: 2 })
            .eq("user_id", ids.ani)
            .eq("headword", "berry")
            .eq("section", 1)
        ).error
      )
      // Back to 2 + 1 = 3 for berry: a tie with apple, and the alphabet decides.
      expect(
        (await recap(ani, "2026-09-01", "2026-09-30", "UTC")).top_meeting
      ).toEqual({ headword: "apple", meetings: 3 })
      expect(
        (await recap(ani, "2026-07-01", "2026-07-31", "UTC")).top_meeting
      ).toBeNull()

      // record_meetings raises a count without touching met_at.
      const before = await admin
        .from("word_meetings")
        .select("met_at")
        .eq("user_id", ids.ani)
        .eq("headword", "berry")
        .eq("section", 1)
        .single()
      await rpc(ani, "record_meetings", {
        p_entries: [
          { headword: "berry", book_id: books.open, section: 1, count: 6 },
        ],
      })
      const after = await admin
        .from("word_meetings")
        .select("met_at, count")
        .eq("user_id", ids.ani)
        .eq("headword", "berry")
        .eq("section", 1)
        .single()
      expect(after.data?.met_at).toBe(before.data?.met_at)
    })

    it("refuses a long range, a backwards range and an unknown zone, and only reads the member's own", async () => {
      await expect(
        recap(ani, "2025-01-01", "2026-12-31")
      ).rejects.toMatchObject({ message: "invalid" })
      await expect(
        recap(ani, "2026-10-31", "2026-10-01")
      ).rejects.toMatchObject({ message: "invalid" })
      await expect(
        recap(ani, "2026-10-01", "2026-10-31", "Mars/Olympus")
      ).rejects.toMatchObject({ message: "invalid" })
      await expect(
        recap(ani, "2026-01-01", "2027-01-01")
      ).resolves.toBeDefined()
      const other = await recap(budi, "2026-01-01", "2026-12-31")
      expect(other.books.map((book) => book.id)).toEqual([books.other])
      expect(other.days).toEqual([])
      expect(other.first_day).toBeNull()
    })
  })
})
