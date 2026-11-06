import {
  Outlet,
  createFileRoute,
  useChildMatches,
} from "@tanstack/react-router"
import { isPopupPath } from "@/components/lobby/LobbyPopup"
import { LobbyStage } from "@/components/lobby/LobbyStage"
import { ShelfLoadError } from "@/components/shelf/ShelfLoadError"
import { useShelfSnapshot } from "@/components/shelf/useShelfSnapshot"
import { refreshHabit } from "@/lib/habit/habit-client"
import { refreshShop } from "@/lib/shop/shop-client"
import { loadShelf } from "@/lib/shelf-loader"
import { useQueueFlush } from "@/lib/sync/use-queue-flush"

export const Route = createFileRoute("/_member/_lobi")({
  // One shelf for the lobby and the pages over it, so all three open
  // offline too (spec 1D §3.2, spec 1F §3).
  loader: ({ context }) => loadShelf(context.user.id),
  // Filtering happens in the browser; reload only on invalidate or after a minute.
  staleTime: 60_000,
  errorComponent: ShelfLoadError,
  component: LobiLayout,
})

/** The lobby stays mounted under Rak Saya and Pengaturan (spec 1F §3). */
function LobiLayout() {
  const { books, usage, collections, offline } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  // From the child matches, which the Outlet renders from too: the scene
  // stops being inert in the same commit that removes the popup, so the
  // popup can give the focus back to a hotspot in it.
  const popup = useChildMatches({
    select: (matches) => matches.some((match) => isPopupPath(match.pathname)),
  })
  useShelfSnapshot(user.id, books, usage, collections, offline)
  // The reading habit for the plant, the panel and the member card (plan 3B, decision 10).
  useQueueFlush(user.id, refreshHabit)
  // The shop's balance and items (plan 3C, decision 9).
  useQueueFlush(user.id, refreshShop)

  return (
    <>
      <LobbyStage
        user={user}
        books={books}
        usage={usage}
        collections={collections}
        offline={offline}
        popup={popup}
      />
      <Outlet />
    </>
  )
}
