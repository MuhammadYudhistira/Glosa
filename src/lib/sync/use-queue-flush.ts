import { useEffect } from "react"
import { claimLocalData } from "@/lib/local/device"

/**
 * Sends a queue's waiting changes when the app opens and when the connection
 * comes back (spec 2 §7). It waits for this device to be the member's first:
 * otherwise the previous member's queue could be sent under the new session.
 * `flush` must keep the same identity (a module-level function).
 */
export function useQueueFlush(
  userId: string,
  flush: () => Promise<void>
): void {
  useEffect(() => {
    let live = true
    const onOnline = () => void flush()
    claimLocalData(userId)
      .then(() => {
        if (!live) return
        void flush()
        window.addEventListener("online", onOnline)
      })
      .catch((error: unknown) =>
        console.error("claiming this device failed", error)
      )
    return () => {
      live = false
      window.removeEventListener("online", onOnline)
    }
  }, [userId, flush])
}
