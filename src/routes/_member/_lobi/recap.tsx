import {
  createFileRoute,
  getRouteApi,
  useNavigate,
} from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
import { RecapPanel } from "@/components/lobby/RecapPanel"
import { useReadingHabit } from "@/lib/habit/habit-client"
import { parsePeriod, periodKey, periodRange } from "@/lib/recap/period"
import { useRecap } from "@/lib/recap/recap-client"
import { useOnline } from "@/lib/use-online"

const lobi = getRouteApi("/_member/_lobi")

export const Route = createFileRoute("/_member/_lobi/recap")({
  validateSearch: (search: Record<string, unknown>) => ({
    periode: typeof search.periode === "string" ? search.periode : undefined,
  }),
  head: () => ({ meta: [{ title: "Kilas balik — Glosa" }] }),
  component: RecapPage,
})

/** Kilas balik over the lobby: one month or year of reading (spec 3E §5). */
function RecapPage() {
  const { books, offline } = lobi.useLoaderData()
  const { periode } = Route.useSearch()
  const navigate = useNavigate()
  const online = useOnline()
  const { today } = useReadingHabit()
  const period = parsePeriod(periode, today)
  const { state, retry } = useRecap(periodRange(period), online && !offline)
  // The first reading day arrives with each answer; the list keeps the last one.
  const [firstDay, setFirstDay] = useState<string | null>(null)
  useEffect(() => {
    if (state.status === "ready" && state.recap.firstDay) {
      setFirstDay(state.recap.firstDay)
    }
  }, [state])
  return (
    <LobbyPopup label="Kilas balik" className="lg:max-w-2xl">
      <RecapPanel
        period={period}
        today={today}
        firstDay={firstDay}
        state={state}
        offline={offline || !online}
        books={books}
        onPick={(key) =>
          void navigate({
            to: "/recap",
            search: {
              periode:
                key === periodKey(parsePeriod(undefined, today))
                  ? undefined
                  : key,
            },
          })
        }
        onRetry={retry}
      />
    </LobbyPopup>
  )
}
