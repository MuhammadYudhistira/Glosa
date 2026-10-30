import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/server/database.types"
import { logServerError } from "@/server/monitoring"
import { runSweep, summarize } from "./run-sweep"
import { purgeTombstones } from "./tombstones"

/**
 * One sweep round and its audit log. The `{sweep, plan}` line is written right
 * after `runSweep`, before the tombstone purge: a real round has already
 * deleted objects and accounts by then, so a failing purge must not lose that
 * record. Returns the process exit code.
 */
export async function runRound(options: {
  admin: SupabaseClient<Database>
  dryRun: boolean
  limits: { objects: number; users: number }
  log: (line: string) => void
  heartbeat: (message: string) => Promise<void>
}): Promise<number> {
  const { admin, dryRun, limits, log, heartbeat } = options
  const result = await runSweep({ admin, dryRun, limits })
  const summary = summarize(result)
  log(JSON.stringify({ sweep: summary, plan: result.plan }))
  if (result.status === "too_many") {
    // The round stops here: the tombstone purge is skipped too.
    logServerError(
      "sweep stopped: too many deletions",
      new Error(
        `sweep would delete ${summary.objects} objects and ${summary.users} accounts`
      )
    )
    return 1
  }
  // Deleted annotations are already gone for the member: the round's limits do not apply.
  let tombstones: number
  try {
    tombstones = await purgeTombstones({ admin, dryRun })
  } catch (error) {
    logServerError("tombstone purge failed", error)
    return 1
  }
  log(JSON.stringify({ tombstones }))
  await heartbeat(
    `${summary.status}: ${summary.books} books, ${summary.objects} objects, ${summary.users} accounts, ${tombstones} tombstones`
  )
  return 0
}
