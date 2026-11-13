import { useCallback, useEffect, useState } from "react"
import {
  ANDA_RADIUS,
  ANDA_START,
  type Point2,
  WALK_BOUNDS,
  walkBlockers,
} from "./scene/layout"
import { walkable } from "./scene/walk"

const ANDA_KEY = "glosa:lobby-anda"

const isSpot = (value: unknown): value is Point2 =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((n) => typeof n === "number" && Number.isFinite(n))

/**
 * A spot Anda can stand on in today's room. One saved under an older layout
 * (the 1D atrium) may lie outside it or inside the furniture.
 */
const standable = (spot: Point2) =>
  walkable(spot, WALK_BOUNDS, walkBlockers(), ANDA_RADIUS)

/**
 * Where "Anda" stands. Kept for the session, so a return to the lobby finds
 * them where they were (spec 1D §5.1). Read after mount, so the server render
 * stays the same.
 */
export function useAndaSpot(): [Point2, (spot: Point2) => void] {
  const [spot, setSpot] = useState<Point2>(ANDA_START)

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        sessionStorage.getItem(ANDA_KEY) ?? "null"
      )
      if (isSpot(saved) && standable(saved)) setSpot(saved)
    } catch {
      // A broken or unreadable value: start at the entrance.
    }
  }, [])

  const move = useCallback((next: Point2) => {
    setSpot(next)
    try {
      sessionStorage.setItem(ANDA_KEY, JSON.stringify(next))
    } catch {
      // Storage can be off (private windows); the spot then lasts this visit.
    }
  }, [])

  return [spot, move]
}
