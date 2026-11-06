import { formatDayLabel } from "@/lib/dates"
import type { CalendarCell } from "@/lib/reading-habit"

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]

/** Five weeks, Monday first, this week at the bottom (spec 3B §4.2). */
export function HabitCalendar({
  weeks,
}: {
  weeks: ReadonlyArray<ReadonlyArray<CalendarCell>>
}) {
  return (
    <div className="habit-calendar">
      <div aria-hidden="true" className="habit-calendar-row">
        {WEEKDAYS.map((name) => (
          <span key={name} className="habit-calendar-weekday">
            {name}
          </span>
        ))}
      </div>
      <ol aria-label="Kalender lima minggu" className="habit-calendar-days">
        {weeks
          .flat()
          .map((cell) =>
            cell.state === "future" ? (
              <li
                key={cell.day}
                aria-hidden="true"
                className="habit-calendar-day"
                data-state="future"
              />
            ) : (
              <li
                key={cell.day}
                aria-label={`${formatDayLabel(cell.day)}: ${Math.floor(cell.seconds / 60)} menit`}
                title={`${formatDayLabel(cell.day)}: ${Math.floor(cell.seconds / 60)} menit`}
                className="habit-calendar-day"
                data-state={cell.state}
              />
            )
          )}
      </ol>
    </div>
  )
}
