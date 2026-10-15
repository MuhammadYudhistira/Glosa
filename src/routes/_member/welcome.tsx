import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_member/welcome")({
  component: () => (
    <main>
      <h1>Kartu Anggota</h1>
    </main>
  ),
})
