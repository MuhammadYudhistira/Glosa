import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/register")({
  component: () => (
    <main>
      <h1>Formulir Anggota</h1>
    </main>
  ),
})
