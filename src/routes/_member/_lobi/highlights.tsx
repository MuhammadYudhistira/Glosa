import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { HighlightsPanel } from "@/components/lobby/HighlightsPanel"
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
import { useHighlights } from "@/lib/annotations/highlights-client"
import {
  HIGHLIGHT_COLORS,
  type HighlightColor,
  MAX_HIGHLIGHTS,
} from "@/lib/annotations/types"
import { useOnline } from "@/lib/use-online"

const lobi = getRouteApi("/_member/_lobi")

export const Route = createFileRoute("/_member/_lobi/highlights")({
  validateSearch: (
    search: Record<string, unknown>
  ): { buku?: string; warna?: HighlightColor } => ({
    buku: typeof search.buku === "string" ? search.buku : undefined,
    warna: HIGHLIGHT_COLORS.find((color) => color === search.warna),
  }),
  head: () => ({ meta: [{ title: "Sorotan & catatan — Glosa" }] }),
  component: HighlightsPage,
})

/** Sorotan & catatan over the lobby: every highlight of the member (spec 3F §3.2). */
function HighlightsPage() {
  const { books, offline } = lobi.useLoaderData()
  const online = useOnline()
  const { state, retry } = useHighlights(MAX_HIGHLIGHTS, online && !offline)
  return (
    <LobbyPopup label="Sorotan & catatan" className="lg:max-w-2xl">
      <HighlightsPanel state={state} books={books} onRetry={retry} />
    </LobbyPopup>
  )
}
