import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_member/_lobi/lobby")({
  // Keep the value as the number 1 so the URL stays `?kembali=1` after validation.
  validateSearch: (search: Record<string, unknown>): { kembali?: 1 } => ({
    kembali: search.kembali === 1 || search.kembali === "1" ? 1 : undefined,
  }),
  head: () => ({ meta: [{ title: "Lobi — Glosa" }] }),
  // The layout draws the lobby (LobbyStage); nothing goes over it here.
  component: () => null,
})
