import { beforeEach, describe, expect, it, vi } from "vitest"
import { runRound } from "./round"

const mocks = vi.hoisted(() => ({
  runSweep: vi.fn(),
  purgeTombstones: vi.fn(),
  logServerError: vi.fn(),
}))
const { runSweep, purgeTombstones, logServerError } = mocks

vi.mock("./run-sweep", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runSweep: mocks.runSweep,
}))
vi.mock("./tombstones", () => ({ purgeTombstones: mocks.purgeTombstones }))
vi.mock("@/server/monitoring", () => ({
  logServerError: mocks.logServerError,
}))

const emptyPlan = {
  pendingBooks: [],
  objects: [],
  users: [],
}

function round(dryRun = false) {
  const lines: Array<unknown> = []
  const heartbeat = vi.fn(async () => {})
  const done = runRound({
    admin: {} as never,
    dryRun,
    limits: { objects: 50, users: 5 },
    log: (line) => lines.push(JSON.parse(line)),
    heartbeat,
  })
  return { lines, heartbeat, done }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("runRound", () => {
  it("logs the sweep line before the purge and the tombstone count after it", async () => {
    runSweep.mockResolvedValue({ status: "done", plan: emptyPlan })
    purgeTombstones.mockResolvedValue(3)
    const { lines, heartbeat, done } = round()
    expect(await done).toBe(0)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ sweep: { status: "done" } })
    expect(lines[0]).toHaveProperty("plan")
    expect(lines[1]).toEqual({ tombstones: 3 })
    expect(heartbeat).toHaveBeenCalledWith(
      "done: 0 books, 0 objects, 0 accounts, 3 tombstones"
    )
  })

  it("still logs the sweep line when the purge throws, and sends no heartbeat", async () => {
    runSweep.mockResolvedValue({ status: "done", plan: emptyPlan })
    purgeTombstones.mockRejectedValue(new Error("boom"))
    const { lines, heartbeat, done } = round()
    expect(await done).toBe(1)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ sweep: { status: "done" } })
    expect(logServerError).toHaveBeenCalledWith(
      "tombstone purge failed",
      expect.any(Error)
    )
    expect(heartbeat).not.toHaveBeenCalled()
  })

  it("skips the purge when the sweep stops with too_many", async () => {
    runSweep.mockResolvedValue({ status: "too_many", plan: emptyPlan })
    const { lines, heartbeat, done } = round()
    expect(await done).toBe(1)
    expect(purgeTombstones).not.toHaveBeenCalled()
    expect(lines).toHaveLength(1)
    expect(heartbeat).not.toHaveBeenCalled()
  })
})
