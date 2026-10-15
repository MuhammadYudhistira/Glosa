import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/logout")({
  component: () => (
    <main>
      <h1>Keluar</h1>
    </main>
  ),
})
