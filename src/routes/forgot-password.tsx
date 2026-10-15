import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/forgot-password")({
  component: () => (
    <main>
      <h1>Lupa Kata Sandi</h1>
    </main>
  ),
})
