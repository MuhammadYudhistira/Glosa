import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/auth/callback")({
  component: () => (
    <main>
      <h1>Memproses…</h1>
    </main>
  ),
})
