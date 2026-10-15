import { createFileRoute, redirect } from "@tanstack/react-router"
import { LinkFailed } from "@/components/auth/LinkFailed"
import { type ConfirmType, verifyOtpFn } from "@/server/auth"

const CONFIRM_TYPES: Array<ConfirmType> = [
  "email",
  "signup",
  "magiclink",
  "recovery",
]

type ConfirmSearch = { token_hash: string; type: ConfirmType }

export const Route = createFileRoute("/auth/confirm")({
  validateSearch: (search: Record<string, unknown>): ConfirmSearch => ({
    token_hash: typeof search.token_hash === "string" ? search.token_hash : "",
    type: CONFIRM_TYPES.find((type) => type === search.type) ?? "email",
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const result = await verifyOtpFn({
      data: { tokenHash: deps.token_hash, type: deps.type },
    })
    if (result.ok) {
      throw redirect({
        href: deps.type === "recovery" ? "/reset-password" : "/welcome",
      })
    }
    return result
  },
  component: ConfirmFailed,
})

function ConfirmFailed() {
  const result = Route.useLoaderData()
  return <LinkFailed code={result.code} />
}
