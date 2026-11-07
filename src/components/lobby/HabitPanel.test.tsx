import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { type HabitState, habitView } from "@/lib/habit/habit-view"
import { HabitPanel } from "./HabitPanel"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}))

const TODAY = "2026-11-06"
const goals = { dailyGoalMinutes: 20 as const, yearlyGoalBooks: 12 }
const ready = (changes: Partial<HabitState> = {}) =>
  habitView(
    {
      cache: {
        days: [
          { day: "2026-11-05", seconds: 1500, goalMinutes: 20 },
          { day: TODAY, seconds: 12 * 60, goalMinutes: 20 },
        ],
        goals,
        sentAtFetch: {},
      },
      local: {},
      status: "ready",
      ...changes,
    },
    TODAY
  )

const panel = (props: Partial<Parameters<typeof HabitPanel>[0]> = {}) =>
  render(
    <HabitPanel
      view={ready()}
      finishedThisYear={4}
      offline={false}
      onRetry={vi.fn()}
      onSaveGoals={vi.fn(() => Promise.resolve({ ok: true as const }))}
      {...props}
    />
  )

describe("HabitPanel", () => {
  it("links to the Kilas balik page", () => {
    panel()
    expect(screen.getByText("Kilas balik").closest("a")).toHaveAttribute(
      "to",
      "/recap"
    )
  })

  it("shows the streak, today and this year against the goals", () => {
    panel()
    expect(
      screen.getByRole("heading", { name: "Kebiasaan baca" })
    ).toBeInTheDocument()
    expect(screen.getByText("hari membaca beruntun")).toBeInTheDocument()
    expect(screen.getByText(/Rekor 1/)).toBeInTheDocument()
    expect(screen.getByText(/Jeda tersisa minggu ini: 2/)).toBeInTheDocument()
    expect(screen.getByText("12 / 20 menit")).toBeInTheDocument()
    expect(screen.getByText("4 / 12 buku selesai")).toBeInTheDocument()
    expect(screen.getByText("Tanaman: Tunas")).toBeInTheDocument()
  })

  it("invites a new member to plant the first sprout", () => {
    panel({
      view: habitView(
        {
          cache: {
            days: [],
            goals: { dailyGoalMinutes: null, yearlyGoalBooks: null },
            sentAtFetch: {},
          },
          local: {},
          status: "ready",
        },
        TODAY
      ),
      finishedThisYear: 0,
    })
    expect(
      screen.getByText("Baca 5 menit hari ini untuk menanam tunas pertama")
    ).toBeInTheDocument()
    expect(screen.getByText(/Pasang target harian/)).toBeInTheDocument()
    expect(screen.getByText("0 buku selesai tahun ini")).toBeInTheDocument()
  })

  it("says to start again after a streak ended", () => {
    panel({
      view: habitView(
        {
          cache: {
            days: [{ day: "2026-10-01", seconds: 900, goalMinutes: null }],
            goals: { dailyGoalMinutes: null, yearlyGoalBooks: null },
            sentAtFetch: {},
          },
          local: {},
          status: "ready",
        },
        TODAY
      ),
    })
    expect(screen.getByText("Mulai lagi hari ini")).toBeInTheDocument()
  })

  it("saves the daily goal at once, and puts it back when that fails", async () => {
    const onSaveGoals = vi.fn(() =>
      Promise.resolve({ ok: false as const, code: "unknown" })
    )
    panel({ onSaveGoals })
    const select = screen.getByLabelText("Target menit per hari")
    fireEvent.change(select, { target: { value: "30" } })
    expect(onSaveGoals).toHaveBeenCalledWith({
      dailyGoalMinutes: 30,
      yearlyGoalBooks: 12,
    })
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Ada yang tidak beres."
      )
    )
    // The store reverts the goal, so the view still holds the old one.
    expect(select).toHaveValue("20")
  })

  it("clears the number error when the field is set right again", () => {
    panel()
    const field = screen.getByLabelText("Target buku per tahun")
    fireEvent.change(field, { target: { value: "400" } })
    fireEvent.blur(field)
    expect(screen.getByRole("alert")).toBeInTheDocument()
    fireEvent.change(field, { target: { value: "12" } })
    fireEvent.blur(field)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("clears the number error when the field is emptied with no goal", () => {
    panel({
      view: ready({
        cache: {
          days: [],
          goals: { dailyGoalMinutes: 20, yearlyGoalBooks: null },
          sentAtFetch: {},
        },
      }),
    })
    const field = screen.getByLabelText("Target buku per tahun")
    fireEvent.change(field, { target: { value: "0" } })
    fireEvent.blur(field)
    expect(screen.getByRole("alert")).toBeInTheDocument()
    fireEvent.change(field, { target: { value: "" } })
    fireEvent.blur(field)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("saves the yearly goal when the field is left, and checks it", async () => {
    const onSaveGoals = vi.fn(() => Promise.resolve({ ok: true as const }))
    panel({ onSaveGoals })
    const field = screen.getByLabelText("Target buku per tahun")
    fireEvent.change(field, { target: { value: "400" } })
    fireEvent.blur(field)
    expect(screen.getByRole("alert")).toHaveTextContent("Isi angka 1–365.")
    expect(onSaveGoals).not.toHaveBeenCalled()
    fireEvent.change(field, { target: { value: "" } })
    await act(async () => {
      fireEvent.blur(field)
    })
    expect(onSaveGoals).toHaveBeenCalledWith({
      dailyGoalMinutes: 20,
      yearlyGoalBooks: null,
    })
  })

  it("keeps the goals still offline", () => {
    panel({ offline: true })
    expect(screen.getByLabelText("Target menit per hari")).toBeDisabled()
    expect(screen.getByLabelText("Target buku per tahun")).toBeDisabled()
    expect(
      screen.getByText("Target bisa diubah saat online.")
    ).toBeInTheDocument()
  })

  it("says the numbers may be old, and offers a retry without any", () => {
    const { unmount } = panel({ view: ready({ status: "failed" }) })
    expect(screen.getByText("Data mungkin belum terbaru")).toBeInTheDocument()
    unmount()
    const onRetry = vi.fn()
    panel({
      onRetry,
      view: habitView({ cache: null, local: {}, status: "failed" }, TODAY),
    })
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
