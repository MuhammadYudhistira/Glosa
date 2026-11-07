import type { HabitDay } from "@/lib/habit/types"

/** What the server answers for a period (spec 3E §6.2). */
export type RecapData = {
  days: Array<HabitDay>
  books: Array<{ id: string; finishedAt: string }>
  lookedUp: number
  saved: number
  topMeeting: { headword: string; meetings: number } | null
  firstDay: string | null
}
