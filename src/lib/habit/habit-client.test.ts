// @vitest-environment node
import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { localDay } from "@/lib/dates"
import type * as ClientModule from "./habit-client"
import type * as ViewModule from "./habit-view"

const mocks = vi.hoisted(() => ({
  recordReadingTimeFn: vi.fn(),
  loadHabitFn: vi.fn(),
  updateGoalsFn: vi.fn(),
}))
vi.mock("@/server/habit", () => mocks)

const BOOK = "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e"
const TODAY = localDay()
let client: typeof ClientModule
let view: typeof ViewModule

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
    expect(current().goals).toEqual({
      dailyGoalMinutes: 30,
      yearlyGoalBooks: 12,
    })
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
