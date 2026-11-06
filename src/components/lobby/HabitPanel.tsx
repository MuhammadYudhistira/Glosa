import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ActionResult } from "@/lib/action-result"
import { bookMessage } from "@/lib/book-messages"
import type { HabitView } from "@/lib/habit/habit-view"
import { DAILY_GOALS, type DailyGoal, type HabitGoals } from "@/lib/habit/types"
import { PLANT_STAGE_LABELS, calendarCells } from "@/lib/reading-habit"
import { HabitCalendar } from "./HabitCalendar"

const BOOKS_INVALID = "Isi angka 1–365."

/** Streak, today, this year, five weeks and the goals (spec 3B §4.2). */
export function HabitPanel({
  view,
  finishedThisYear,
  offline,
  onRetry,
  onSaveGoals,
}: {
  view: HabitView
  finishedThisYear: number
  offline: boolean
  onRetry: () => void
  onSaveGoals: (goals: HabitGoals) => Promise<ActionResult>
}) {
  const { summary, goals } = view
  const [error, setError] = useState<string | null>(null)
  const [booksDraft, setBooksDraft] = useState<string | null>(null)
  const booksText = booksDraft ?? goals.yearlyGoalBooks?.toString() ?? ""
  const locked = offline || !view.canEditGoals

  if (view.status === "loading") {
    return (
      <div className="habit-panel">
        <h1 className="font-heading text-2xl">Kebiasaan baca</h1>
        <p className="text-sm text-muted-foreground">Memuat…</p>
      </div>
    )
  }
  if (view.status === "failed") {
    return (
      <div className="habit-panel">
        <h1 className="font-heading text-2xl">Kebiasaan baca</h1>
        <p className="text-sm">Kebiasaan baca belum bisa dimuat.</p>
        <Button onClick={onRetry}>Coba lagi</Button>
      </div>
    )
  }

  async function save(next: HabitGoals) {
    setError(null)
    const result = await onSaveGoals(next)
    if (!result.ok) setError(bookMessage(result.code))
  }

  function saveBooks() {
    const text = booksText.trim()
    if (text === "") {
      setBooksDraft(null)
      if (goals.yearlyGoalBooks !== null) {
        void save({ ...goals, yearlyGoalBooks: null })
      } else {
        setError(null)
      }
      return
    }
    const value = Number(text)
    if (!Number.isInteger(value) || value < 1 || value > 365) {
      setError(BOOKS_INVALID)
      return
    }
    setBooksDraft(null)
    if (value !== goals.yearlyGoalBooks) {
      void save({ ...goals, yearlyGoalBooks: value })
    } else {
      setError(null)
    }
  }

  const todayMinutes = Math.floor(summary.todaySeconds / 60)
  const goalMinutes = Math.round(summary.todayGoalSeconds / 60)

  return (
    <div className="habit-panel">
      <h1 className="font-heading text-2xl">Kebiasaan baca</h1>
      {view.status === "stale" && (
        <p className="text-xs text-muted-foreground">
          Data mungkin belum terbaru
        </p>
      )}

      <section aria-label="Streak" className="habit-section">
        {summary.streak > 0 ? (
          <p className="habit-streak">
            <span className="habit-streak-number">{summary.streak}</span>
            <span>hari membaca beruntun</span>
          </p>
        ) : (
          <p className="habit-streak-empty">
            {summary.hasHistory
              ? "Mulai lagi hari ini"
              : `Baca ${goalMinutes} menit hari ini untuk menanam tunas pertama`}
          </p>
        )}
        {summary.hasHistory && (
          <p className="text-sm text-muted-foreground">
            Rekor {summary.record} · Jeda tersisa minggu ini: {summary.gapsLeft}
          </p>
        )}
        <p className="text-sm">Tanaman: {PLANT_STAGE_LABELS[summary.stage]}</p>
      </section>

      <section aria-label="Hari ini" className="habit-section">
        <h2 className="habit-heading">Hari ini</h2>
        <progress
          className="habit-bar"
          aria-label="Menit hari ini"
          value={Math.min(summary.todaySeconds, summary.todayGoalSeconds)}
          max={summary.todayGoalSeconds}
        />
        <p className="text-sm">
          {goals.dailyGoalMinutes === null
            ? `${todayMinutes} menit hari ini · Pasang target harian`
            : `${todayMinutes} / ${goals.dailyGoalMinutes} menit`}
        </p>
      </section>

      <section aria-label="Tahun ini" className="habit-section">
        <h2 className="habit-heading">Tahun ini</h2>
        <p className="text-sm">
          {goals.yearlyGoalBooks === null
            ? `${finishedThisYear} buku selesai tahun ini`
            : `${finishedThisYear} / ${goals.yearlyGoalBooks} buku selesai`}
        </p>
        <Link
          to="/shelf"
          search={{ koleksi: "selesai" }}
          className="text-sm underline"
        >
          Lihat Sudah dibaca
        </Link>
      </section>

      <section aria-label="Lima minggu terakhir" className="habit-section">
        <h2 className="habit-heading">Lima minggu terakhir</h2>
        <HabitCalendar
          weeks={calendarCells(view.days, view.today, goals.dailyGoalMinutes)}
        />
      </section>

      <section aria-label="Atur target" className="habit-section">
        <h2 className="habit-heading">Atur target</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor="habit-daily">Target menit per hari</Label>
            <select
              id="habit-daily"
              className="habit-select"
              disabled={locked}
              value={goals.dailyGoalMinutes ?? ""}
              onChange={(event) => {
                const value = event.target.value
                void save({
                  ...goals,
                  dailyGoalMinutes:
                    value === "" ? null : (Number(value) as DailyGoal),
                })
              }}
            >
              <option value="">Tanpa target</option>
              {DAILY_GOALS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} menit
                </option>
              ))}
            </select>
          </div>
          <form
            className="grid gap-1"
            onSubmit={(event) => {
              event.preventDefault()
              saveBooks()
            }}
          >
            <Label htmlFor="habit-yearly">Target buku per tahun</Label>
            <Input
              id="habit-yearly"
              inputMode="numeric"
              placeholder="Tanpa target"
              disabled={locked}
              value={booksText}
              onChange={(event) => setBooksDraft(event.target.value)}
              onBlur={saveBooks}
            />
          </form>
        </div>
        {offline && (
          <p className="text-xs text-muted-foreground">
            Target bisa diubah saat online.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
