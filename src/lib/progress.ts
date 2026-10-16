import { z } from "zod"
import type { Position } from "./reader-types"

export const MAX_PROGRESS_BATCH = 50
export const MAX_CFI_LENGTH = 2000
/** Positions closer than this many percentage points count as the same place (spec §10). */
export const JUMP_THRESHOLD = 1

export const ProgressEntrySchema = z.object({
  bookId: z.uuid(),
  cfi: z.string().min(1).max(MAX_CFI_LENGTH),
  percentage: z.number().min(0).max(100),
  updatedAt: z.iso.datetime({ offset: true }),
})

/** foliate's 0–1 fraction as a percentage with two decimals, within 0–100. */
export function toPercentage(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0
  return Math.round(Math.min(Math.max(fraction, 0), 1) * 10_000) / 100
}

export function formatPercent(percentage: number): string {
  return `${Math.floor(percentage)}%`
}

const time = (position: Position) => Date.parse(position.updatedAt)

/**
 * The server position worth offering when a book opens (spec §10 step 5): it
 * must be newer than this device's position and more than one percentage point
 * away. A device without a position counts as 0% from the beginning of time, so
 * a new device is offered the other device's place (plan 1C, decision 9).
 */
export function jumpOffer(
  local: Position | null,
  server: Position | null
): Position | null {
  if (!server) return null
  const localTime = local ? time(local) : Number.NEGATIVE_INFINITY
  if (!(time(server) > localTime)) return null
  const localPercentage = local?.percentage ?? 0
  return Math.abs(server.percentage - localPercentage) > JUMP_THRESHOLD
    ? server
    : null
}
