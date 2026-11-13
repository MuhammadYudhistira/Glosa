import { useServerFn } from "@tanstack/react-start"
import { useCallback, useEffect, useState } from "react"
import { listHighlightsFn } from "@/server/annotations"
import type { Highlight } from "./types"

export type HighlightsState =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "failed" }
  | { status: "ready"; highlights: Array<Highlight> }

/**
 * The member's newest highlights from the server (spec 3F §3.2). Nothing is
 * kept on the device; while offline the server is not asked.
 */
export function useHighlights(
  limit: number,
  online: boolean
): { state: HighlightsState; retry: () => void } {
  const load = useServerFn(listHighlightsFn)
  const [attempt, setAttempt] = useState(0)
  const [answer, setAnswer] = useState<{
    key: string
    state: HighlightsState
  } | null>(null)
  const key = `${limit} ${attempt}`

  useEffect(() => {
    if (!online) return
    let live = true
    load({ data: { limit } })
      .then((result) => {
        if (!live) return
        if (!result.ok) console.error("highlights refused", result.code)
        setAnswer({
          key,
          state: result.ok
            ? { status: "ready", highlights: result.highlights }
            : { status: "failed" },
        })
      })
      .catch((error: unknown) => {
        if (!live) return
        console.error("highlights could not be loaded", error)
        setAnswer({ key, state: { status: "failed" } })
      })
    return () => {
      live = false
    }
  }, [limit, online, key, load])

  const state: HighlightsState = !online
    ? { status: "offline" }
    : answer && answer.key === key
      ? answer.state
      : { status: "loading" }
  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  return { state, retry }
}
