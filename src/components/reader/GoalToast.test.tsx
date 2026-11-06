import { act, render, renderHook, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HABIT_TOAST_KEY } from "@/lib/local/keys"
import { GoalToast, useGoalToast } from "./GoalToast"

const TODAY = "2026-11-06"
type Props = Parameters<typeof useGoalToast>[0]
const base: Props = {
  done: false,
  hasGoal: true,
  today: TODAY,
  settled: true,
  barsShown: true,
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useGoalToast", () => {
  it("shows once when the goal is reached during the visit", () => {
    const { result, rerender } = renderHook(
      (props: Props) => useGoalToast(props),
      {
        initialProps: base,
      }
    )
    expect(result.current).toBe(false)
    rerender({ ...base, done: true })
    expect(result.current).toBe(true)
    expect(localStorage.getItem(HABIT_TOAST_KEY)).toBe(TODAY)
    act(() => {
      vi.advanceTimersByTime(6_000)
    })
    expect(result.current).toBe(false)
  })

  it("stays quiet when the goal was reached before the reader opened", () => {
    const { result, rerender } = renderHook(
      (props: Props) => useGoalToast(props),
      {
        initialProps: { ...base, done: true },
      }
    )
    rerender({ ...base, done: true, barsShown: true })
    expect(result.current).toBe(false)
  })

  it("stays quiet without a goal, and once already shown today", () => {
    const { result, rerender } = renderHook(
      (props: Props) => useGoalToast(props),
      {
        initialProps: { ...base, hasGoal: false },
      }
    )
    rerender({ ...base, hasGoal: false, done: true })
    expect(result.current).toBe(false)

    localStorage.setItem(HABIT_TOAST_KEY, TODAY)
    const second = renderHook((props: Props) => useGoalToast(props), {
      initialProps: base,
    })
    second.rerender({ ...base, done: true })
    expect(second.result.current).toBe(false)
  })

  it("waits while the bars are hidden", () => {
    const { result, rerender } = renderHook(
      (props: Props) => useGoalToast(props),
      {
        initialProps: { ...base, barsShown: false },
      }
    )
    rerender({ ...base, done: true, barsShown: false })
    expect(result.current).toBe(false)
    rerender({ ...base, done: true, barsShown: true })
    expect(result.current).toBe(true)
  })

  it("waits until the day's numbers settled before judging the start", () => {
    const { result, rerender } = renderHook(
      (props: Props) => useGoalToast(props),
      {
        initialProps: { ...base, settled: false },
      }
    )
    rerender({ ...base, done: false })
    rerender({ ...base, done: true })
    expect(result.current).toBe(true)
  })
})

describe("GoalToast", () => {
  it("says the goal is reached", () => {
    render(<GoalToast />)
    expect(screen.getByRole("status")).toHaveTextContent(
      "Target hari ini tercapai. Selamat membaca terus."
    )
  })
})
