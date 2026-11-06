import { z } from "zod"
import { DAILY_GOALS, MAX_READING_TIME_BATCH, WHOLE_DAY_SECONDS } from "./types"

const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const DailyGoalSchema = z.literal(DAILY_GOALS).nullable()

export const ReadingTimeEntrySchema = z.object({
  day: DaySchema,
  bookId: z.uuid(),
  seconds: z.number().int().min(0).max(WHOLE_DAY_SECONDS),
  goalMinutes: DailyGoalSchema,
})

export const RecordReadingTimeSchema = z.object({
  deviceId: z.uuid(),
  entries: z.array(ReadingTimeEntrySchema).min(1).max(MAX_READING_TIME_BATCH),
})

export const GoalsSchema = z.object({
  dailyGoalMinutes: DailyGoalSchema,
  yearlyGoalBooks: z.number().int().min(1).max(365).nullable(),
})
