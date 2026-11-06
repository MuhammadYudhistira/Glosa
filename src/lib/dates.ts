const LONG_DATE = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
})

export function formatLongDate(date: Date): string {
  return LONG_DATE.format(date)
}

const pad = (value: number) => String(value).padStart(2, "0")

/** The device's local date at `ms`, as YYYY-MM-DD (spec 3B §2). */
export function localDay(ms: number = Date.now()): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** When the local day after the one at `ms` starts. */
export function nextDayAt(ms: number): number {
  const date = new Date(ms)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1
  ).getTime()
}

const DAY_MS = 86_400_000
/** A YYYY-MM-DD day as UTC midnight: day arithmetic without time zones. */
const utcOf = (day: string) => {
  const [year, month, date] = day.split("-").map(Number)
  return Date.UTC(year, month - 1, date)
}
const dayOfUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function addDays(day: string, count: number): string {
  return dayOfUtc(utcOf(day) + count * DAY_MS)
}

/** The Monday of the day's week: weeks run Monday to Sunday (spec 3B §3.3). */
export function mondayOf(day: string): string {
  const weekday = (new Date(utcOf(day)).getUTCDay() + 6) % 7
  return addDays(day, -weekday)
}

const DAY_LABEL = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
})

/** "Rabu, 4 November". */
export function formatDayLabel(day: string): string {
  return DAY_LABEL.format(new Date(utcOf(day)))
}
