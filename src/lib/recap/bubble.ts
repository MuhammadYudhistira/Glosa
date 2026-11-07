import type { HabitDay } from "@/lib/habit/types"
import { RECAP_BUBBLE_KEY } from "@/lib/local/keys"
import { MONTH_NAMES, type Period, periodKey, periodRange } from "./period"

export type RecapBubble = { key: string; label: string }

/**
 * "Kilas balik … sudah siap" on days 1-7 of a month (spec 3E §5.4): last
 * month's, or last year's in January. Not when it was shown before, when the
 * habit cache is missing, or when nothing was read in that period.
 */
export function recapBubbleFor(
  today: string,
  days: ReadonlyArray<HabitDay> | null,
  shown: ReadonlyArray<string>
): RecapBubble | null {
  if (!days || Number(today.slice(8, 10)) > 7) return null
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const yearly = month === 1
  const period: Period = yearly
    ? { kind: "year", year: year - 1 }
    : { kind: "month", year, month: month - 1 }
  const key = periodKey(period)
  if (shown.includes(key)) return null
  const { from, to } = periodRange(period)
  if (!days.some((d) => d.day >= from && d.day <= to && d.seconds > 0)) {
    return null
  }
  return {
    key,
    label: yearly
      ? `Kilas balik ${year - 1} sudah siap`
      : `Kilas balik ${MONTH_NAMES[month - 2]} sudah siap`,
  }
}

export function readShownBubbles(): Array<string> {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(RECAP_BUBBLE_KEY) ?? "[]"
    )
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

export function rememberBubble(key: string): void {
  try {
    const shown = readShownBubbles()
    if (shown.includes(key)) return
    localStorage.setItem(RECAP_BUBBLE_KEY, JSON.stringify([...shown, key]))
  } catch {
    // No storage: the bubble may show again on another visit.
  }
}
