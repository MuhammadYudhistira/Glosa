import { useEffect, useState } from "react"
import { type LookupOutcome, lookUp } from "@/lib/words/lookup"

/** `slow`: still loading after SKELETON_DELAY_MS, so the skeleton shows (spec 2 §6.3). */
export type WordLookupState = { kind: "loading"; slow: boolean } | LookupOutcome

const SKELETON_DELAY_MS = 150

/** The meanings of the tapped word, looked up again when it changes or on retry. */
export function useWordLookup(
  word: string | null,
  next: ReadonlyArray<string>
): { state: WordLookupState; retry: () => void } {
  const nextKey = next.join(" ")
  const [attempt, setAttempt] = useState(0)
  const key = word === null ? null : `${word} ${nextKey}#${attempt}`
  const [done, setDone] = useState<{
    key: string
    outcome: LookupOutcome
  } | null>(null)
  const [slowKey, setSlowKey] = useState<string | null>(null)

  useEffect(() => {
    if (word === null || key === null) return
    let live = true
    const timer = setTimeout(() => {
      if (live) setSlowKey(key)
    }, SKELETON_DELAY_MS)
    lookUp(word, nextKey ? nextKey.split(" ") : [])
      .catch((): LookupOutcome => ({ kind: "failed" }))
      .then((outcome) => {
        if (live) setDone({ key, outcome })
      })
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [word, nextKey, key])

  const outcome = done?.key === key ? done.outcome : null
  return {
    state: outcome ?? { kind: "loading", slow: slowKey === key },
    retry: () => setAttempt((count) => count + 1),
  }
}
