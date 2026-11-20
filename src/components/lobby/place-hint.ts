import { useCallback, useEffect, useState } from "react"
import { PLACE_HINT_KEY } from "@/lib/local/keys"

export function readPlaceHintSeen(): boolean {
  try {
    return localStorage.getItem(PLACE_HINT_KEY) !== null
  } catch {
    // No storage: the hint may show again.
    return false
  }
}

export function rememberPlaceHint(): void {
  try {
    localStorage.setItem(PLACE_HINT_KEY, "1")
  } catch {
    // Storage can be off (private windows): the hint may show again.
  }
}

/**
 * The hint's life in the lobby (spec 3G §3.4): it shows once per device,
 * when the live room first shows, and the first tap, cursor or card makes it
 * unnecessary. `end` is also its timer's end.
 */
export function usePlaceHint({
  live,
  popup,
  picked,
}: {
  /** The live 3D room is on screen. */
  live: boolean
  popup: boolean
  /** A place is chosen or under the cursor. */
  picked: boolean
}): { shown: boolean; end: () => void } {
  const [hint, setHint] = useState<"idle" | "shown" | "done">("idle")
  useEffect(() => {
    if (hint === "idle" && live && !popup && !readPlaceHintSeen()) {
      setHint("shown")
    }
  }, [hint, live, popup])
  const end = useCallback(() => {
    setHint("done")
    rememberPlaceHint()
  }, [])
  useEffect(() => {
    if (hint === "shown" && picked) end()
  }, [hint, picked, end])
  return { shown: hint === "shown", end }
}
