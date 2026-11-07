export const MONTH_NAMES: ReadonlyArray<string> = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
]

/** A month or a year of the recap (spec 3E §5.1). */
export type Period =
  | { kind: "month"; year: number; month: number }
  | { kind: "year"; year: number }

const pad = (value: number) => String(value).padStart(2, "0")

/** The `?periode=` value: "2026-10" or "2026". */
export const periodKey = (period: Period): string =>
  period.kind === "year"
    ? String(period.year)
    : `${period.year}-${pad(period.month)}`

export function currentPeriod(today: string): Period {
  return {
    kind: "month",
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }
}

/** The period asked for; anything unknown or in the future is this month. */
export function parsePeriod(raw: unknown, today: string): Period {
  const now = currentPeriod(today)
  if (typeof raw !== "string") return now
  const year = Number(today.slice(0, 4))
  const month = /^(\d{4})-(\d{2})$/.exec(raw)
  if (month) {
    const found: Period = {
      kind: "month",
      year: Number(month[1]),
      month: Number(month[2]),
    }
    const ok =
      found.month >= 1 &&
      found.month <= 12 &&
      found.year >= 2000 &&
      periodKey(found) <= periodKey(now)
    return ok ? found : now
  }
  if (/^\d{4}$/.test(raw)) {
    const found = Number(raw)
    return found >= 2000 && found <= year ? { kind: "year", year: found } : now
  }
  return now
}

/** The first and last local day of the period. */
export function periodRange(period: Period): { from: string; to: string } {
  if (period.kind === "year") {
    return { from: `${period.year}-01-01`, to: `${period.year}-12-31` }
  }
  const last = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate()
  const head = `${period.year}-${pad(period.month)}`
  return { from: `${head}-01`, to: `${head}-${pad(last)}` }
}

/** The period is not over yet: "sejauh ini". */
export function isOngoing(period: Period, today: string): boolean {
  return periodRange(period).to >= today
}

export function periodLabel(period: Period): string {
  return period.kind === "year"
    ? String(period.year)
    : `${MONTH_NAMES[period.month - 1]} ${period.year}`
}

/** Periods from the one of `firstDay` to now, newest first; only now without a first day. */
export function periodList(
  kind: "month" | "year",
  firstDay: string | null,
  today: string
): Array<Period> {
  const nowYear = Number(today.slice(0, 4))
  const nowMonth = Number(today.slice(5, 7))
  const startYear = firstDay ? Number(firstDay.slice(0, 4)) : nowYear
  const startMonth = firstDay ? Number(firstDay.slice(5, 7)) : nowMonth
  const list: Array<Period> = []
  if (kind === "year") {
    for (let year = nowYear; year >= Math.min(startYear, nowYear); year -= 1) {
      list.push({ kind: "year", year })
    }
    return list
  }
  let year = nowYear
  let month = nowMonth
  const first = startYear * 12 + startMonth
  while (year * 12 + month >= Math.min(first, nowYear * 12 + nowMonth)) {
    list.push({ kind: "month", year, month })
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  return list
}
