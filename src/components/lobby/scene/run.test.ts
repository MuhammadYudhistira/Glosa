import { describe, expect, it } from "vitest"
import { ACTIVITY_SECONDS } from "./activities"
import { RUN_START, finishRun, stepRun } from "./run"

describe("stepRun", () => {
  it("waits while Anda walks, then acts for the activity's time", () => {
    let run = stepRun(RUN_START, 0.5, true)
    expect(run).toEqual({ phase: "walk", t: 0 })
    run = stepRun(run, 0.016, false)
    expect(run.phase).toBe("act")
    run = stepRun(run, ACTIVITY_SECONDS / 2, false)
    expect(run.phase).toBe("act")
    run = stepRun(run, ACTIVITY_SECONDS, false)
    expect(run).toEqual({ phase: "done", t: ACTIVITY_SECONDS })
  })
  it("treats a non-finite step as 0 and still completes", () => {
    let run = stepRun({ phase: "act", t: 0 }, Number.NaN, false)
    expect(run).toEqual({ phase: "act", t: 0 })
    run = stepRun(run, Number.POSITIVE_INFINITY, false)
    expect(run).toEqual({ phase: "act", t: 0 })
    run = stepRun(run, ACTIVITY_SECONDS, false)
    expect(run.phase).toBe("done")
  })
  it("stays done", () => {
    expect(stepRun(finishRun(), 1, true)).toEqual(finishRun())
  })
})
