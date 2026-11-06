import { useEffect, useRef, useState } from "react"
import { HABIT_TOAST_KEY } from "@/lib/local/keys"

const SHOWN_MS = 6_000

function shownToday(today: string): boolean {
  try {
    return localStorage.getItem(HABIT_TOAST_KEY) === today
  } catch {
    return false
  }
}

function markShown(today: string) {
  try {
    localStorage.setItem(HABIT_TOAST_KEY, today)
  } catch {
    // No localStorage: it may show again on another visit.
  }
}

/**
 * Whether the "goal reached" note shows (spec 3B §4.3, plan 3B decision 9):
 * once a day, only with a goal, only when reached during this visit, and
 * only while the bars show. `settled`: the day's numbers are known, so the
 * state at the start can be judged.
 */
export function useGoalToast({
  done,
  hasGoal,
  today,
  settled,
  barsShown,
}: {
  done: boolean
  hasGoal: boolean
  today: string
  settled: boolean
  barsShown: boolean
}): boolean {
  // Whether the goal was already reached when the numbers first settled.
  const [doneAtStart, setDoneAtStart] = useState<boolean | null>(null)
  if (settled && doneAtStart === null) setDoneAtStart(done)
  const [due, setDue] = useState(false)
  const [over, setOver] = useState(false)
  if (
    !due &&
    !over &&
    doneAtStart === false &&
    done &&
    hasGoal &&
    !shownToday(today)
  ) {
    setDue(true)
  }
  const shown = due && !over && barsShown
  const marked = useRef(false)

  useEffect(() => {
    if (!shown) return
    if (!marked.current) {
      marked.current = true
      markShown(today)
    }
    const timer = setTimeout(() => setOver(true), SHOWN_MS)
    return () => clearTimeout(timer)
  }, [shown, today])

  return shown
}

export function GoalToast() {
  return (
    <output className="reader-note habit-toast">
      Target hari ini tercapai. Selamat membaca terus.
    </output>
  )
}
