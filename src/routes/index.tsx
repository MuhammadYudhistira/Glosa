import { createFileRoute, redirect } from "@tanstack/react-router"
import { guestRedirect } from "@/lib/redirects"

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  component: () => (
    <main>
      <h1>Selamat datang di Glosa</h1>
    </main>
  ),
})
