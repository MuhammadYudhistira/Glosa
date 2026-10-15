import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/login")({
  component: () => (
    <main>
      <h1>Buku Tamu</h1>
    </main>
  ),
})
