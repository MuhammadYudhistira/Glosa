import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_member/settings")({
  component: () => (
    <main>
      <h1>Pengaturan</h1>
    </main>
  ),
})
