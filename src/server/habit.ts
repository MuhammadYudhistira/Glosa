import { createServerFn } from "@tanstack/react-start"
import type { ActionResult } from "@/lib/action-result"
import { screenEntries } from "@/lib/habit/screen-entries"
import { GoalsWithDaySchema, RecordEnvelopeSchema } from "@/lib/habit/schemas"
import type {
  DailyGoal,
  HabitAnswer,
  HabitDay,
  HabitGoals,
  ReadingTimeEntry,
} from "@/lib/habit/types"
import type { QueueAnswer, QueueResult } from "@/lib/sync/queue-sync"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })
/** PostgREST answers at most this many rows at once. */
const PAGE = 1000

/**
 * Stores a device's running totals (spec 3B §5.2), one answer per entry.
 * Sent with keepalive by the queue, so it may outlive the page.
 */
export const recordReadingTimeFn = createServerFn({ method: "POST" })
  .validator((data: { deviceId: string; entries: Array<ReadingTimeEntry> }) =>
    RecordEnvelopeSchema.parse(data)
  )
  .handler(async ({ data }): Promise<QueueAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const { valid, merge } = screenEntries(data.entries)
    if (valid.length === 0) {
      return { ok: true, results: merge([]) }
    }
    const { data: results, error } = await supabase.rpc("record_reading_time", {
      p_entries: valid.map((entry) => ({
        day: entry.day,
        device_id: data.deviceId,
        book_id: entry.bookId,
        seconds: entry.seconds,
        goal_minutes: entry.goalMinutes,
      })),
    })
    if (error) {
      if (error.message === "not_authenticated") {
        return fail("not_authenticated")
      }
      logServerError("record_reading_time failed", error)
      return fail("unknown")
    }
    return { ok: true, results: merge(results as Array<QueueResult>) }
  })

/** Every day read and the member's goals (spec 3B §5.2, §5.3). */
export const loadHabitFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<HabitAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    const profile = await supabase
      .from("profiles")
      .select("daily_goal_minutes, yearly_goal_books")
      .eq("id", user.id)
      .single()
    if (profile.error) {
      logServerError("reading goals lookup failed", profile.error)
      return fail("unknown")
    }

    const days: Array<HabitDay> = []
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await supabase
        .rpc("reading_days")
        .range(from, from + PAGE - 1)
      if (error) {
        logServerError("reading_days failed", error)
        return fail("unknown")
      }
      for (const row of rows) {
        days.push({
          day: row.day,
          seconds: row.seconds,
          goalMinutes: row.goal_minutes,
        })
      }
      if (rows.length < PAGE) break
    }
    const goals: HabitGoals = {
      dailyGoalMinutes: profile.data.daily_goal_minutes as DailyGoal | null,
      yearlyGoalBooks: profile.data.yearly_goal_books,
    }
    return { ok: true, days, goals }
  }
)

/** Sets both goals at once; null is no goal (spec 3B §3.4). */
export const updateGoalsFn = createServerFn({ method: "POST" })
  .validator((data: HabitGoals & { today: string }) =>
    GoalsWithDaySchema.parse(data)
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")

    // The goals, and today's rows with them (spec 3B §3.2): one call.
    const { data: answer, error } = await supabase.rpc("set_reading_goals", {
      p_daily: data.dailyGoalMinutes as number,
      p_yearly: data.yearlyGoalBooks as number,
      p_today: data.today,
    })
    if (error) {
      logServerError("saving reading goals failed", error)
      return fail("unknown")
    }
    return answer === "ok" ? { ok: true } : fail("unknown")
  })
