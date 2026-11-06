import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HabitRing } from "./HabitRing"

describe("HabitRing", () => {
  it("says the minutes against the goal", () => {
    render(<HabitRing seconds={12 * 60 + 40} goalSeconds={1200} hasGoal />)
    expect(
      screen.getByRole("img", { name: "12 dari 20 menit hari ini" })
    ).toBeInTheDocument()
  })

  it("says only the minutes without a goal", () => {
    render(<HabitRing seconds={90} goalSeconds={300} hasGoal={false} />)
    expect(
      screen.getByRole("img", { name: "1 menit hari ini" })
    ).toBeInTheDocument()
  })
})
