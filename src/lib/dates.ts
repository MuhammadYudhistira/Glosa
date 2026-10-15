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
