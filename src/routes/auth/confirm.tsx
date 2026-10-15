import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/auth/confirm")({
  component: () => (
    <main>
      <h1>Memproses…</h1>
    </main>
  ),
})
