import type { HighlightColor } from "@/lib/annotations/types"
import { addDays } from "@/lib/dates"
import type { HabitDay } from "@/lib/habit/types"
import { goalSeconds } from "@/lib/reading-habit"

/** The fireplace's state (spec 3F §3.6): reading days in the last 7 days. */
export type FireLevel = "bara" | "kecil" | "besar"
/** What the room shows about the member's reading (spec 3F §3.6). */
export type RoomSignals = {
  fire: FireLevel
  deskLamp: boolean
  parcelOpen: boolean
}

/** For the still image and before the data arrives. */
export const NEUTRAL_SIGNALS: RoomSignals = {
  fire: "kecil",
  deskLamp: false,
  parcelOpen: false,
}

/** Flame size and glow, 0..1. */
export const FIRE_STRENGTH: Record<FireLevel, number> = {
  bara: 0.25,
  kecil: 0.6,
  besar: 1,
}

/** A reading day is a day whose goal was met (spec 3B §3.2), as for the streak. */
export function fireLevel(
  days: ReadonlyArray<HabitDay>,
  today: string
): FireLevel {
  const from = addDays(today, -6)
  const read = new Set(
    days
      .filter(
        (d) =>
          d.day >= from &&
          d.day <= today &&
          d.seconds >= goalSeconds(d.goalMinutes)
      )
      .map((d) => d.day)
  )
  if (read.size === 0) return "bara"
  return read.size <= 2 ? "kecil" : "besar"
}

export function roomSignals(input: {
  days: ReadonlyArray<HabitDay>
  today: string
  meetingsTotal: number | null
  vocabSeen: number | null
  trolley: number
}): RoomSignals {
  const { meetingsTotal, vocabSeen } = input
  return {
    fire: fireLevel(input.days, input.today),
    deskLamp:
      meetingsTotal !== null && vocabSeen !== null && meetingsTotal > vocabSeen,
    parcelOpen: input.trolley > 0,
  }
}

/** No papers on the corkboard; one constant, so an unset prop is not a change on every render. */
export const NO_NOTES: ReadonlyArray<HighlightColor> = []
