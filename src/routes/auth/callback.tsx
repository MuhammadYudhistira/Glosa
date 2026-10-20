import { createFileRoute, redirect } from "@tanstack/react-router"
import { LinkFailed } from "@/components/auth/LinkFailed"
import { oauthCallbackError } from "@/lib/auth-messages"
import { exchangeCodeFn } from "@/server/auth"

type CallbackSearch = { code: string; error: string }

export const Route = createFileRoute("/auth/callback")({
  // A cancelled consent or a sign-up refused by the closed-trial hook comes
  // back as ?error=…&error_code=…&error_description=…
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    code: typeof search.code === "string" ? search.code : "",
    error: oauthCallbackError(search),
  }),
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
