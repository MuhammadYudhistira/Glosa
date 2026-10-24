import { useEffect, useSyncExternalStore } from "react"
import { saveProgressFn } from "@/server/reading"
import { clearLocalData } from "./local/device"
import { localPositionStore } from "./local/positions"
import {
  type ProgressSync,
  type SyncStatus,
  createProgressSync,
} from "./progress-sync"
import { wordSync } from "./words/word-sync-client"

const keepaliveFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, keepalive: true })

let engine: ProgressSync | null = null

/** The one progress sync of this tab (browser only). */
export function progressSync(): ProgressSync {
  engine ??= createProgressSync({
    store: localPositionStore,
    isOnline: () => navigator.onLine,
    send: (entries, { keepalive }) =>
      saveProgressFn({
        data: { entries },
        fetch: keepalive ? keepaliveFetch : undefined,
      }),
  })
  return engine
}

/**
 * Sends waiting positions when the app opens, when the connection comes back,
 * and when the page is hidden or left (spec §10 steps 2–3).
 */
export function useProgressFlush(): void {
  useEffect(() => {
    const sync = progressSync()
    void sync.flush()
    const onOnline = () => void sync.flush()
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void sync.flush({ keepalive: true })
      }
    }
    const onPageHide = () => void sync.flush({ keepalive: true })
    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [])
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => progressSync().subscribe(listener),
    () => progressSync().status(),
    () => "synced"
  )
}

const LEAVE_FLUSH_MS = 3_000

/**
 * Before signing out: send the positions and word changes still waiting (for
 * a few seconds at most), then wipe this device's copies (plan 1C, decision 6).
 */
export async function leaveDevice(): Promise<void> {
  await Promise.race([
    Promise.all([progressSync().flush(), wordSync().flush()]).catch(
      () => undefined
    ),
    new Promise((resolve) => setTimeout(resolve, LEAVE_FLUSH_MS)),
  ])
  await clearLocalData()
  // A refusal notice belongs to this member, not to the next one.
  wordSync().dismissRejection()
}
