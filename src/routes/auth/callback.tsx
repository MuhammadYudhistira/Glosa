import { createFileRoute, redirect } from "@tanstack/react-router"
import { LinkFailed } from "@/components/auth/LinkFailed"
import { exchangeCodeFn } from "@/server/auth"

type CallbackSearch = { code: string; error: string }

export const Route = createFileRoute("/auth/callback")({
  // A cancelled OAuth consent comes back as ?error=access_denied&error_code=...
  validateSearch: (search: Record<string, unknown>): CallbackSearch => {
    const error =
      typeof search.error_code === "string" && search.error_code
        ? search.error_code
        : typeof search.error === "string"
          ? search.error
          : ""
    return {
      code: typeof search.code === "string" ? search.code : "",
      error,
    }
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (deps.error) return { ok: false as const, code: deps.error }
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
