import { ACTIVITY_SECONDS } from "./activities"

/** One hotspot tap: the walk, then the activity (spec 3F §4A.1). `t`: seconds spent acting. */
export type Run = { phase: "walk" | "act" | "done"; t: number }
export const RUN_START: Run = { phase: "walk", t: 0 }
export const finishRun = (): Run => ({ phase: "done", t: ACTIVITY_SECONDS })

export function stepRun(run: Run, dt: number, walking: boolean): Run {
  if (run.phase === "done") return run
  if (run.phase === "walk") return walking ? run : { phase: "act", t: 0 }
  const t = run.t + dt
  return t >= ACTIVITY_SECONDS ? finishRun() : { phase: "act", t }
}
