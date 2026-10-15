import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { memberRedirect } from "@/lib/redirects"

export const Route = createFileRoute("/_member")({
  beforeLoad: ({ context, location }) => {
    const target = memberRedirect(context.user, location.pathname)
    if (target || !context.user) throw redirect({ href: target ?? "/login" })
    return { user: context.user }
  },
  component: Outlet,
})
