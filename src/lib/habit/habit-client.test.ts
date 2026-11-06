// @vitest-environment node
import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { localDay } from "@/lib/dates"
import type * as ClientModule from "./habit-client"
import type * as ViewModule from "./habit-view"
import type { HabitGoals } from "./types"

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

  it("keeps saved goals over a refresh fetched before the save landed", async () => {
    const old: HabitGoals = { dailyGoalMinutes: 10, yearlyGoalBooks: null }
    const saved: HabitGoals = { dailyGoalMinutes: 30, yearlyGoalBooks: 12 }
    mocks.loadHabitFn.mockResolvedValueOnce({ ok: true, days: [], goals: old })
    await client.refreshHabit()
    let resolveLoad: (value: unknown) => void = () => undefined
    mocks.loadHabitFn.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLoad = resolve
      })
    )
    const refresh = client.refreshHabit()
    await vi.waitFor(() => expect(mocks.loadHabitFn).toHaveBeenCalledTimes(2))
    mocks.updateGoalsFn.mockResolvedValueOnce({ ok: true })
    await client.saveGoals(saved)
    resolveLoad({ ok: true, days: [], goals: old })
    await refresh
    expect(current().goals).toEqual(saved)
    const device = await import("@/lib/local/reading-time")
    expect((await device.loadHabitCache())?.goals).toEqual(saved)
  })

  it("ignores an older refresh that resolves after a newer one", async () => {
    const resolvers: Array<(value: unknown) => void> = []
    mocks.loadHabitFn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve)
        })
    )
    const first = client.refreshHabit()
    await vi.waitFor(() => expect(resolvers).toHaveLength(1))
    const second = client.refreshHabit()
    await vi.waitFor(() => expect(resolvers).toHaveLength(2))
    const goals = (minutes: 5 | 15): HabitGoals => ({
      dailyGoalMinutes: minutes,
      yearlyGoalBooks: null,
    })
    resolvers[1]?.({ ok: true, days: [], goals: goals(15) })
    await second
    resolvers[0]?.({ ok: true, days: [], goals: goals(5) })
    await first
    expect(current().goals).toEqual(goals(15))
  })

  it("logs the code when the server refuses a refresh", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    mocks.loadHabitFn.mockResolvedValueOnce({ ok: false, code: "unknown" })
    await client.refreshHabit()
    expect(error).toHaveBeenCalledWith(expect.any(String), "unknown")
    error.mockRestore()
  })

  it("forgets the previous member when the device is wiped", async () => {
    mocks.loadHabitFn.mockResolvedValueOnce({
      ok: true,
      days: [{ day: TODAY, seconds: 400, goalMinutes: null }],
      goals: { dailyGoalMinutes: 5, yearlyGoalBooks: null },
    })
    await client.refreshHabit()
    expect(client.habitStateForTests().cache).not.toBeNull()
    const device = await import("@/lib/local/device")
    await device.clearLocalData()
    expect(client.habitStateForTests()).toEqual({
      cache: null,
      local: {},
      status: "loading",
    })
  })

  it("tries reading the device copy again after a failure", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const store = await import("@/lib/local/reading-time")
    const spy = vi
      .spyOn(store, "loadHabitCache")
      .mockRejectedValueOnce(new Error("idb"))
    await client.recordReadingTime(BOOK, [{ day: TODAY, ms: 1_000 }])
    await client.recordReadingTime(BOOK, [{ day: TODAY, ms: 1_000 }])
    expect(spy).toHaveBeenCalledTimes(2)
    error.mockRestore()
    spy.mockRestore()
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
