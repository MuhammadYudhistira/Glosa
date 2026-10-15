import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/terms")({
  component: () => (
    <main>
      <h1>Syarat Layanan</h1>
    </main>
  ),
})
