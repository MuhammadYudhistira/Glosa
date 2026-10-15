import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/privacy")({
  component: () => (
    <main>
      <h1>Kebijakan Privasi</h1>
    </main>
  ),
})
