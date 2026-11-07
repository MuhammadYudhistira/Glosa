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
  paused: boolean,
  /** Gets the milliseconds of every save, for the time per section (plan 3D, decision 6). */
  onCounted?: (ms: number) => void
): { onPage: () => void; onActivity: () => void } {
  const clockRef = useRef<ReadingClock | null>(null)
  clockRef.current ??= createReadingClock()
  const onCountedRef = useRef(onCounted)
  onCountedRef.current = onCounted

  const save = useCallback(
    (pieces: Array<ClockPiece>) => {
      const total = pieces.reduce((sum, piece) => sum + piece.ms, 0)
      if (total > 0) onCountedRef.current?.(total)
      return recordReadingTime(bookId, pieces).catch((error: unknown) =>
        console.error("saving the reading time failed", error)
      )
    },
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

  // A scroll in scrolled flow: the same page goes on (spec 3B §3.1).
  const onActivity = useCallback(() => {
    const clock = clockRef.current
    if (clock) void save(clock.touch(Date.now()))
  }, [save])

  return { onPage, onActivity }
}
