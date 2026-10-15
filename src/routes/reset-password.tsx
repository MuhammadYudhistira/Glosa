import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/reset-password")({
  component: () => (
    <main>
      <h1>Kata Sandi Baru</h1>
    </main>
  ),
})
