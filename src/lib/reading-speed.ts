/**
 * How fast this member reads, against foliate's own estimate (spec 2 §6.7).
 * foliate counts 1,600 characters of a section's file as a minute; a page
 * took `actual` minutes where foliate expected `expected` (plan 2C,
 * decision 7).
 */
export type SpeedSample = { expected: number; actual: number }

/** When a place showed, and foliate's minutes left in the book from it. */
export type SpeedMark = { at: number; minutesLeft: number }

/** Pages read faster or slower than this were skimmed or left open. */
export const PAGE_MS = { min: 5_000, max: 600_000 } as const
/** The moving average spans this many pages. */
export const SPEED_SAMPLES = 50
/** foliate's own speed counts until this many pages are measured. */
export const MIN_SPEED_SAMPLES = 10

const MINUTE_MS = 60_000

/** The page read between two marks, or null when it says nothing of speed. */
export function pageSample(from: SpeedMark, to: SpeedMark): SpeedSample | null {
  const expected = from.minutesLeft - to.minutesLeft
  const ms = to.at - from.at
  // Backwards, the same place, or read too fast or too slowly to count.
  if (!(expected > 0) || ms < PAGE_MS.min || ms > PAGE_MS.max) return null
  return { expected, actual: ms / MINUTE_MS }
}

export function addSample(
  samples: ReadonlyArray<SpeedSample>,
  sample: SpeedSample
): Array<SpeedSample> {
  return [...samples, sample].slice(-SPEED_SAMPLES)
}

/**
 * The member's minutes per minute of foliate's: above 1 reads slower. 1
 * until enough pages are measured.
 */
export function speedRatio(samples: ReadonlyArray<SpeedSample>): number {
  if (samples.length < MIN_SPEED_SAMPLES) return 1
  let expected = 0
  let actual = 0
  for (const sample of samples) {
    expected += sample.expected
    actual += sample.actual
  }
  return expected > 0 ? actual / expected : 1
}

/** "<1 mnt", "±8 mnt", "±1 j 20 mnt" (plan 2C, decision 8). */
export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes)
  if (rounded < 1) return "<1 mnt"
  if (rounded < 60) return `±${rounded} mnt`
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  return rest === 0 ? `±${hours} j` : `±${hours} j ${rest} mnt`
}

const isSample = (value: unknown): value is SpeedSample => {
  if (typeof value !== "object" || value === null) return false
  const { expected, actual } = value as Record<string, unknown>
  return (
    typeof expected === "number" &&
    typeof actual === "number" &&
    Number.isFinite(expected) &&
    Number.isFinite(actual) &&
    expected > 0 &&
    actual > 0
  )
}

/** The valid samples of a stored value, the newest ones: it may be old or broken. */
export function parseSamples(value: unknown): Array<SpeedSample> {
  return Array.isArray(value)
    ? value.filter(isSample).slice(-SPEED_SAMPLES)
    : []
}
