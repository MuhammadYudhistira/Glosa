import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { useEffect } from "react"
import { resolveUser } from "@/lib/current-user"
import { claimLocalData } from "@/lib/local/device"
import { useProgressFlush } from "@/lib/progress-sync-client"
import { memberRedirect } from "@/lib/redirects"

export const Route = createFileRoute("/_member")({
  beforeLoad: async ({ context, location }) => {
    const user = await resolveUser(context.user)
    const target = memberRedirect(user, location.pathname)
    if (target || !user) throw redirect({ href: target ?? "/login" })
    return { user }
  },
  component: MemberLayout,
})

function MemberLayout() {
  const { user } = Route.useRouteContext()

  // Another member's copies on this device go before this member's are used.
  useEffect(() => {
    claimLocalData(user.id).catch((error: unknown) =>
      console.error("claiming this device failed", error)
    )
  }, [user.id])
  useProgressFlush()

  return <Outlet />
}
