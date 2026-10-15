import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_member/lobby")({
  component: () => (
    <main>
      <h1>Lobi</h1>
    </main>
  ),
})
