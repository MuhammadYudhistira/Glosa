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
