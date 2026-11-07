import { useServerFn } from "@tanstack/react-start"
import { useEffect, useState } from "react"
import { loadRecapFn } from "@/server/recap"
import type { RecapData } from "./types"

export type RecapState =
  | { status: "loading" }
  | { status: "ready"; recap: RecapData }
  | { status: "unavailable" }

/**
 * The recap of a period from the server (spec 3E §5), asked for again when the
 * period changes. Nothing is kept on the device. Not asked while `enabled` is false.
 */
export function useRecap(
  range: { from: string; to: string },
  enabled: boolean
): { state: RecapState; retry: () => void } {
  const load = useServerFn(loadRecapFn)
  const key = `${range.from} ${range.to}`
  const [attempt, setAttempt] = useState(0)
  const [answer, setAnswer] = useState<{
    key: string
    state: RecapState
  } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let live = true
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const ask = (zone: string) =>
      load({ data: { from: range.from, to: range.to, timeZone: zone } })
    // A zone Postgres does not know is refused as invalid: try UTC once.
    ask(timeZone)
      .then((result) =>
        !result.ok && result.code === "recap_invalid" && timeZone !== "UTC"
          ? ask("UTC")
          : result
      )
      .then((result) => {
        if (!live) return
        setAnswer({
          key,
          state: result.ok
            ? { status: "ready", recap: result.recap }
            : { status: "unavailable" },
        })
      })
      .catch(() => live && setAnswer({ key, state: { status: "unavailable" } }))
    return () => {
      live = false
    }
  }, [key, enabled, attempt, load, range.from, range.to])

  const state: RecapState =
    answer && answer.key === key ? answer.state : { status: "loading" }
  return {
    state,
    retry: () => {
      setAnswer(null)
      setAttempt((value) => value + 1)
    },
  }
}
