import { randomUUID } from "node:crypto"
import { admin } from "./members"

/** The time zone the habit tests run the browser in. */
export const HABIT_ZONE = "Asia/Jakarta"

/** Today in the test browser's zone, as YYYY-MM-DD. */
export function todayInZone(zone = HABIT_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** A day of reading from another device, written straight to the table. */
export async function seedReadingTime(
  userId: string,
  bookId: string,
  day: string,
  seconds: number,
  goalMinutes: number | null = null
): Promise<void> {
  const { error } = await admin().from("reading_time").insert({
    user_id: userId,
    day,
    device_id: randomUUID(),
    book_id: bookId,
    seconds,
    goal_minutes: goalMinutes,
  })
  if (error) throw error
}

export async function setDailyGoal(
  userId: string,
  minutes: number | null
): Promise<void> {
  const { error } = await admin()
    .from("profiles")
    .update({ daily_goal_minutes: minutes })
    .eq("id", userId)
  if (error) throw error
}

/** Every second the server has for the member that day. */
export async function storedSeconds(
  userId: string,
  day: string
): Promise<number> {
  const { data, error } = await admin()
    .from("reading_time")
    .select("seconds")
    .eq("user_id", userId)
    .eq("day", day)
  if (error) throw error
  return data.reduce((sum, row) => sum + row.seconds, 0)
}
