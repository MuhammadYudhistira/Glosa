import { ROOM_SEEN_KEY } from "@/lib/local/keys"
import { PLANT_STAGES, type PlantStage } from "@/lib/reading-habit"
import { FIRE_STRENGTH, type FireLevel, type RoomSignals } from "./room-signals"

/** What the room showed when the member last saw it (spec 3F §4A.2). */
export type RoomSnapshot = RoomSignals & { plant: PlantStage; finished: number }
export type RoomChange = "fire" | "deskLamp" | "parcel" | "plant" | "showcase"

const FIRES: ReadonlyArray<FireLevel> = ["bara", "kecil", "besar"]

/**
 * What the room plays since the last visit, in a fixed order. The first visit
 * on this device plays nothing; a lamp or a lid only when it turns on, the
 * plant only when it grew, the cabinet only for a newly finished book.
 */
export function changesSince(
  prev: RoomSnapshot | null,
  next: RoomSnapshot
): Array<RoomChange> {
  if (prev === null) return []
  const changes: Array<RoomChange> = []
  if (prev.fire !== next.fire) changes.push("fire")
  if (!prev.deskLamp && next.deskLamp) changes.push("deskLamp")
  if (!prev.parcelOpen && next.parcelOpen) changes.push("parcel")
  if (PLANT_STAGES.indexOf(next.plant) > PLANT_STAGES.indexOf(prev.plant)) {
    changes.push("plant")
  }
  if (next.finished > prev.finished) changes.push("showcase")
  return changes
}

const isSnapshot = (value: unknown): value is RoomSnapshot => {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    FIRES.includes(v.fire as FireLevel) &&
    typeof v.deskLamp === "boolean" &&
    typeof v.parcelOpen === "boolean" &&
    PLANT_STAGES.includes(v.plant as PlantStage) &&
    Number.isInteger(v.finished) &&
    (v.finished as number) >= 0
  )
}

export function readRoomSnapshot(): RoomSnapshot | null {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(ROOM_SEEN_KEY) ?? "null"
    )
    return isSnapshot(value) ? value : null
  } catch {
    return null
  }
}

export function rememberRoomSnapshot(snapshot: RoomSnapshot): void {
  try {
    localStorage.setItem(ROOM_SEEN_KEY, JSON.stringify(snapshot))
  } catch {
    // Storage can be off: every visit is then a first visit.
  }
}

/** A moment of change `k` (eased, 0..1) of the way from the last visit's room. */
export type MomentAt = {
  from: RoomSnapshot
  changes: ReadonlyArray<RoomChange>
  k: number
}

/**
 * How lit the fire and the desk lamp are and how open the parcel's lid is,
 * 0..1 (the fire: its FIRE_STRENGTH). During a moment only what changed
 * blends in from the last visit's room; the rest shows the signals as they are.
 */
export function signalLevels(
  signals: RoomSignals,
  moment: MomentAt | null
): { fire: number; desk: number; lid: number } {
  const fire = FIRE_STRENGTH[signals.fire]
  const desk = signals.deskLamp ? 1 : 0
  const lid = signals.parcelOpen ? 1 : 0
  if (!moment) return { fire, desk, lid }
  const { from, changes, k } = moment
  const before = FIRE_STRENGTH[from.fire]
  return {
    fire: changes.includes("fire") ? before + (fire - before) * k : fire,
    desk: changes.includes("deskLamp") ? desk * k : desk,
    lid: changes.includes("parcel") ? lid * k : lid,
  }
}
