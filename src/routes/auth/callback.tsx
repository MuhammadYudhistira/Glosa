import { createFileRoute, redirect } from "@tanstack/react-router"
import { LinkFailed } from "@/components/auth/LinkFailed"
import { exchangeCodeFn } from "@/server/auth"

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): { code: string } => ({
    code: typeof search.code === "string" ? search.code : "",
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const result = await exchangeCodeFn({ data: { code: deps.code } })
    // The _member guard sends already-onboarded members on to the lobby.
    if (result.ok) throw redirect({ href: "/welcome" })
    return result
  },
  component: CallbackFailed,
})

function CallbackFailed() {
  const result = Route.useLoaderData()
  return <LinkFailed code={result.code} />
}
