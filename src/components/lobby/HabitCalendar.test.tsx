import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { calendarCells } from "@/lib/reading-habit"
import { HabitCalendar } from "./HabitCalendar"

describe("HabitCalendar", () => {
  it("labels each day with its minutes, and leaves the days ahead out", () => {
    const weeks = calendarCells(
      [{ day: "2026-11-04", seconds: 23 * 60 + 10, goalMinutes: null }],
      "2026-11-06",
      null
    )
    render(<HabitCalendar weeks={weeks} />)
    expect(screen.getByLabelText("Rabu, 4 November: 23 menit")).toHaveAttribute(
      "data-state",
      "read"
    )
    expect(screen.getByLabelText("Jumat, 6 November: 0 menit")).toHaveAttribute(
      "data-state",
      "none"
    )
    expect(screen.queryByLabelText(/Sabtu, 7 November/)).toBeNull()
    expect(screen.getAllByRole("listitem")).toHaveLength(33)
  })
})
