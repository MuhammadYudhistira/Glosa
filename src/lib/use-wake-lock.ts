import { useEffect } from "react"

/**
 * Keeps the screen on while `active` and the tab shows (spec 2 §6.7). The
 * lock goes when the tab hides and is asked for again when it shows. A
 * browser without Wake Lock, or one that refuses (low battery, a setting),
 * lets the screen sleep as usual, and nothing is said.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return
    let live = true
    let asking = false
    let lock: WakeLockSentinel | null = null

    const release = () => {
      const held = lock
      lock = null
      held?.release().catch(() => undefined)
    }
    const request = () => {
      if (asking || lock || document.visibilityState !== "visible") return
      asking = true
      navigator.wakeLock
        .request("screen")
        .then(
          (sentinel) => {
            if (!live || document.visibilityState !== "visible") {
              sentinel.release().catch(() => undefined)
              return
            }
            lock = sentinel
            // The browser may let go by itself (the tab hid, the battery is low).
            sentinel.addEventListener("release", () => {
              if (lock === sentinel) lock = null
            })
          },
          // Refused: the screen sleeps as usual, without a word (plan 2C, decision 11).
          () => undefined
        )
        .finally(() => {
          asking = false
        })
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") request()
      else release()
    }

    request()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      live = false
      document.removeEventListener("visibilitychange", onVisibility)
      release()
    }
  }, [active])
}
