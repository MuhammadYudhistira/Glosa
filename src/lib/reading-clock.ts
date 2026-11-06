import { localDay, nextDayAt } from "./dates"

/** Time read on one local day, in milliseconds. */
export type ClockPiece = { day: string; ms: number }

/** How the clock finds days; the device's local days unless a test says otherwise. */
export type DayFns = {
  dayOf: (ms: number) => string
  nextDayAt: (ms: number) => number
}

/**
 * A page shown for less is a page turned, not read; a page shown longer
 * counts only this long (spec 3B §3.1).
 */
export const PAGE_READ_MS = { min: 5_000, max: 600_000 } as const

export type ReadingClock = {
  /** A new page shows: the page before it is done. */
  show: (at: number) => Array<ClockPiece>
  /** The book is out of sight: a hidden tab, a panel over it, the reader left. */
  pause: (at: number) => Array<ClockPiece>
  /** The book is in sight again: the same page goes on. */
  resume: (at: number) => void
  /** Hands over what the page shown has counted so far (saved every 30 s). */
  tick: (at: number) => Array<ClockPiece>
  /**
   * Activity on the same page (a scroll): the cap restarts from here, so
   * time counts until PAGE_READ_MS.max passes with no activity.
   */
  touch: (at: number) => Array<ClockPiece>
}

const LOCAL_DAYS: DayFns = { dayOf: localDay, nextDayAt }

/**
 * The active reading time of one reader visit (spec 3B §3.1). Pure: the
 * caller passes the time of every event and stores the pieces it gets back.
 */
export function createReadingClock(days: DayFns = LOCAL_DAYS): ReadingClock {
  let shown = false
  let paused = false
  // When the time of the page shown started running; null while it stands.
  let since: number | null = null
  // This page's time in sight, and how much of it was handed over.
  let pageMs = 0
  let countedMs = 0
  // Stretches of this page not handed over yet: kept until the page counts.
  let held: Array<readonly [number, number]> = []
  // How much more time in sight counts before the next activity (the cap).
  let budget: number = PAGE_READ_MS.max

  function stop(at: number) {
    if (since === null) return
    if (at > since) {
      const ms = Math.min(at - since, budget)
      if (ms > 0) held.push([since, since + ms])
      pageMs += ms
      budget -= ms
    }
    since = null
  }

  function run(at: number) {
    if (shown && !paused && since === null) since = at
  }

  /** The held time (already within the cap) once the page counts, split at midnights. */
  function release(): Array<ClockPiece> {
    if (pageMs < PAGE_READ_MS.min) return []
    let left = pageMs - countedMs
    const byDay = new Map<string, number>()
    for (const [from, to] of held) {
      let start = from
      while (left > 0 && start < to) {
        const end = Math.min(to, days.nextDayAt(start), start + left)
        const day = days.dayOf(start)
        byDay.set(day, (byDay.get(day) ?? 0) + end - start)
        left -= end - start
        countedMs += end - start
        start = end
      }
    }
    held = []
    return [...byDay].map(([day, ms]) => ({ day, ms }))
  }

  return {
    show(at) {
      stop(at)
      const pieces = release()
      shown = true
      pageMs = 0
      countedMs = 0
      held = []
      budget = PAGE_READ_MS.max
      run(at)
      return pieces
    },
    pause(at) {
      stop(at)
      paused = true
      return release()
    },
    resume(at) {
      paused = false
      run(at)
    },
    tick(at) {
      if (since !== null) {
        stop(at)
        run(at)
      }
      return release()
    },
    touch(at) {
      if (since !== null) {
        stop(at)
        run(at)
      }
      budget = PAGE_READ_MS.max
      return release()
    },
  }
}
