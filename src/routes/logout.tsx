import { createFileRoute } from "@tanstack/react-router"
import { leaveDevice } from "@/lib/progress-sync-client"
import { signOutFn } from "@/server/auth"

export const Route = createFileRoute("/logout")({
  preload: false,
  loader: async () => {
    // A server render (the URL typed directly) has no device data to clear.
    if (!import.meta.env.SSR) {
      await leaveDevice().catch((error: unknown) =>
        console.error("clearing this device failed", error)
      )
    }
    return signOutFn()
  },
})
