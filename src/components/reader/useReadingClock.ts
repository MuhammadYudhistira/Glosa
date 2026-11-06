import { useCallback, useEffect, useRef } from "react"
import { habitSync, recordReadingTime } from "@/lib/habit/habit-client"
import {
  type ClockPiece,
  type ReadingClock,
  createReadingClock,
} from "@/lib/reading-clock"

/** The clock saves what the page shown has counted this often (spec 3B §3.1). */
export const TICK_MS = 30_000

/**
 * Feeds the reader's events to the reading clock (spec 3B §6.2): pages shown,
 * the tab hidden, panels over the book, the reader left. Separate from the
 * reading speed, which measures pages differently.
 */
export function useReadingClock(
  bookId: string,
  paused: boolean
): { onPage: () => void } {
  const clockRef = useRef<ReadingClock | null>(null)
  clockRef.current ??= createReadingClock()

  const save = useCallback(
    (pieces: Array<ClockPiece>) =>
      recordReadingTime(bookId, pieces).catch((error: unknown) =>
        console.error("saving the reading time failed", error)
      ),
    [bookId]
  )

  useEffect(() => {
    const clock = clockRef.current
    if (!clock) return
    const sync = () => {
      const now = Date.now()
      if (document.visibilityState === "hidden") {
        void save(clock.pause(now)).then(() => habitSync().flush())
      } else if (paused) {
        void save(clock.pause(now))
      } else {
        clock.resume(now)
      }
    }
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [paused, save])

  useEffect(() => {
    const timer = setInterval(() => {
      const clock = clockRef.current
      if (clock) void save(clock.tick(Date.now()))
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [save])

  // Leaving the reader: the page shown counts, and the time goes at once.
  useEffect(
    () => () => {
      const clock = clockRef.current
      if (!clock) return
      void save(clock.pause(Date.now())).then(() => habitSync().flush())
    },
    [save]
  )

  const onPage = useCallback(() => {
    const clock = clockRef.current
    if (clock) void save(clock.show(Date.now()))
  }, [save])

  return { onPage }
}
