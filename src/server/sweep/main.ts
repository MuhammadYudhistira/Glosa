import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/server/database.types"
import { flushServerErrors, logServerError } from "@/server/monitoring"
import { SWEEP_LIMITS, runSweep, summarize } from "./run-sweep"

// Entry of the sweep container (spec 1E §6): one round, then exit. The
// container's shell loop runs it again an hour later.

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

/** SWEEP_MAX_DELETIONS raises both limits for one supervised run. */
function limitsFromEnv() {
  const max = Number(process.env.SWEEP_MAX_DELETIONS)
  return Number.isInteger(max) && max > 0
    ? { objects: max, users: max }
    : SWEEP_LIMITS
}

/** Tells Uptime Kuma the round succeeded; Kuma alerts when pushes stop. */
async function sendHeartbeat(message: string) {
  const pushUrl = process.env.KUMA_PUSH_URL
  if (!pushUrl) return
  const url = new URL(pushUrl)
  url.searchParams.set("status", "up")
  url.searchParams.set("msg", message)
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) console.error(`heartbeat answered ${response.status}`)
  } catch (error) {
    console.error("heartbeat failed", error)
  }
}

async function main(): Promise<number> {
  try {
    const admin = createClient<Database>(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SECRET_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const result = await runSweep({
      admin,
      dryRun: process.env.SWEEP_DRY_RUN === "1",
      limits: limitsFromEnv(),
    })
    const summary = summarize(result)
    console.log(JSON.stringify({ sweep: summary, plan: result.plan }))
    if (result.status === "too_many") {
      logServerError(
        "sweep stopped: too many deletions",
        new Error(
          `sweep would delete ${summary.objects} objects and ${summary.users} accounts`
        )
      )
      return 1
    }
    await sendHeartbeat(
      `${summary.status}: ${summary.books} books, ${summary.objects} objects, ${summary.users} accounts`
    )
    return 0
  } catch (error) {
    logServerError("sweep failed", error)
    return 1
  }
}

const code = await main()
await flushServerErrors()
process.exit(code)
