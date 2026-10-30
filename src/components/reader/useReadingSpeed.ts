import { useCallback, useEffect, useRef, useState } from "react"
import { loadSpeedSamples, saveSpeedSamples } from "@/lib/local/reading-speed"
import {
  SPEED_SAMPLES,
  type SpeedMark,
  type SpeedSample,
  addSample,
  pageSample,
  speedRatio,
} from "@/lib/reading-speed"
import type { ReaderLocation } from "./ReaderView"

/**
 * This member's reading speed on this device (spec 2 §6.7). Each page turned
 * is measured from the moment it showed; a jump, a new layout or a hidden
 * tab starts the measure again (plan 2C, decision 7).
 */
export function useReadingSpeed(): {
  ratio: number
  record: (location: ReaderLocation) => void
} {
  const samples = useRef<ReadonlyArray<SpeedSample>>([])
  const mark = useRef<(SpeedMark & { cfi: string }) | null>(null)
  const [ratio, setRatio] = useState(1)

  const keep = useCallback((next: ReadonlyArray<SpeedSample>) => {
    samples.current = next
    setRatio(speedRatio(next))
  }, [])

  useEffect(() => {
    let live = true
    loadSpeedSamples()
      .then((stored) => {
        // Pages measured while the stored ones loaded come after them.
        if (live) keep([...stored, ...samples.current].slice(-SPEED_SAMPLES))
      })
      .catch((error: unknown) =>
        console.error("reading the reading speed failed", error)
      )
    // A hidden tab is not reading: the page showing then is not measured.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") mark.current = null
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      live = false
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [keep])

  const record = useCallback(
    (location: ReaderLocation) => {
      const previous = mark.current
      // foliate also relocates without moving (a touch snaps the page).
      if (previous?.cfi === location.cfi) return
      const next = location.time
        ? {
            at: Date.now(),
            minutesLeft: location.time.total,
            cfi: location.cfi,
          }
        : null
      mark.current = next
      if (!location.turned || !previous || !next) return
      const sample = pageSample(previous, next)
      if (!sample) return
      const all = addSample(samples.current, sample)
      keep(all)
      saveSpeedSamples(all).catch((error: unknown) =>
        console.error("saving the reading speed failed", error)
      )
    },
    [keep]
  )

  return { ratio, record }
}
