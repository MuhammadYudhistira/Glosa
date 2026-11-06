import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { HabitPanel } from "@/components/lobby/HabitPanel"
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
import {
  refreshHabit,
  saveGoals,
  useReadingHabit,
} from "@/lib/habit/habit-client"
import { booksThisYear } from "@/lib/reading-habit"

const lobi = getRouteApi("/_member/_lobi")

export const Route = createFileRoute("/_member/_lobi/habits")({
  head: () => ({ meta: [{ title: "Kebiasaan baca — Glosa" }] }),
  component: HabitsPage,
})

/** Kebiasaan baca over the lobby (spec 3B §4.2, plan 3B decision 4). */
function HabitsPage() {
  const { books, offline } = lobi.useLoaderData()
  const habit = useReadingHabit()
  return (
    <LobbyPopup label="Kebiasaan baca" className="lg:max-w-2xl">
      <HabitPanel
        view={habit}
        finishedThisYear={booksThisYear(books, habit.today)}
        offline={offline}
        onRetry={() => void refreshHabit()}
        onSaveGoals={saveGoals}
      />
    </LobbyPopup>
  )
}
