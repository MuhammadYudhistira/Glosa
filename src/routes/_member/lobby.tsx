import { Link, createFileRoute } from "@tanstack/react-router"
import { MembershipCard } from "@/components/member/MembershipCard"
import { buttonVariants } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"

export const Route = createFileRoute("/_member/lobby")({
  // Keep the value as the number 1 so the URL stays `?kembali=1` after validation.
  validateSearch: (search: Record<string, unknown>): { kembali?: 1 } => ({
    kembali: search.kembali === 1 || search.kembali === "1" ? 1 : undefined,
  }),
  head: () => ({ meta: [{ title: "Lobi — Glosa" }] }),
  component: LobbyPage,
})

function LobbyPage() {
  const { user } = Route.useRouteContext()
  const { kembali } = Route.useSearch()
  const linkClass = buttonVariants({ variant: "outline", size: "block" })

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-8">
      {kembali === 1 && (
        <output className="block rounded-lg border bg-panel px-4 py-2 text-sm">
          Selamat datang kembali, {user.displayName}!
        </output>
      )}
      <h1 className="font-heading text-3xl font-bold">Lobi</h1>
      <Panel className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
        <MembershipCard member={user} />
        <div className="flex w-full flex-col gap-2.5 sm:max-w-48">
          <Link to="/settings" className={linkClass}>
            Pengaturan
          </Link>
          <Link to="/logout" className={linkClass}>
            Keluar
          </Link>
        </div>
      </Panel>
    </main>
  )
}
