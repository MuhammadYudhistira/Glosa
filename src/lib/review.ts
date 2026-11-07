import { z } from "zod"

export const DIFFICULTIES = ["easy", "medium", "hard"] as const
export type Difficulty = (typeof DIFFICULTIES)[number]
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Mudah",
  medium: "Sedang",
  hard: "Sulit",
}
export const RATINGS = [1, 2, 3, 4, 5] as const
/** The longest note, and where the counter starts to show (spec 3E §4.1). */
export const MAX_NOTE = 2000
export const NOTE_COUNTER_FROM = 1800

/** A member's private review of a finished book (spec 3E §4). */
export type BookReview = {
  rating: number
  difficulty: Difficulty | null
  note: string | null
  updatedAt: string
}

/** The numbers of the finished-book card (spec 3E §3.2). */
export type FinishSummary = {
  seconds: number
  days: number
  lookedUp: number
  saved: number
  /** The first saved words of the book, at most 12. */
  words: Array<string>
  coins: number
  finishedAt: string | null
  review: BookReview | null
}

const ReviewRow = z.object({
  rating: z.number().int().min(1).max(5),
  difficulty: z.enum(DIFFICULTIES).nullable(),
  note: z.string().nullable(),
  updated_at: z.string(),
})

/** The review in a database row; PostgREST may nest it as one object or a one-item array. */
export function reviewOf(raw: unknown): BookReview | null {
  const parsed = ReviewRow.safeParse(Array.isArray(raw) ? raw[0] : raw)
  if (!parsed.success) return null
  const { rating, difficulty, note, updated_at } = parsed.data
  return { rating, difficulty, note, updatedAt: updated_at }
}

const SummaryRow = z.object({
  seconds: z.number(),
  days: z.number(),
  looked_up: z.number(),
  saved: z.number(),
  words: z.array(z.string()),
  coins: z.number(),
  finished_at: z.string().nullable(),
  review: z.unknown(),
})

export function parseFinishSummary(raw: unknown): FinishSummary | null {
  const parsed = SummaryRow.safeParse(raw)
  if (!parsed.success) return null
  const row = parsed.data
  return {
    seconds: row.seconds,
    days: row.days,
    lookedUp: row.looked_up,
    saved: row.saved,
    words: row.words,
    coins: row.coins,
    finishedAt: row.finished_at,
    review: reviewOf(row.review),
  }
}
