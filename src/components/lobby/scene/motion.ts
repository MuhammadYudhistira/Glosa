import { ANDA_RADIUS, type Point2, WALK_BOUNDS, walkBlockers } from "./layout"
import type { Figure, People } from "./people"
import {
  type Box2,
  advance,
  findPath,
  nearestWalkable,
  sameBoxes,
  walkable,
} from "./walk"

/** Walking speed, metres per second. */
const SPEED = 1.4
/** How fast the stride swings, in radians per second. */
const CADENCE = 9
const BOB = 0.03
const SWAY = (4 * Math.PI) / 180

/** Legs and arms swing opposite each other; a knee bends on its back swing. */
function stride(figure: Figure, swing: number) {
  const [left, right] = figure.legs
  left.hip.rotation.x = swing
  right.hip.rotation.x = -swing
  left.knee.rotation.x = Math.max(0, -swing) * 0.8
  right.knee.rotation.x = Math.max(0, swing) * 0.8
  figure.arms[0].rotation.x = -swing * 0.7
  figure.arms[1].rotation.x = swing * 0.7
}

/**
 * The body bobs ±BOB (lowest with the legs apart, highest as they pass) and
 * sways ±4° toward the leg it stands on; `phase` 0 stands still.
 */
function gait(figure: Figure, phase: number | null) {
  figure.body.position.y = phase === null ? 0 : BOB * Math.cos(2 * phase)
  figure.body.rotation.z = phase === null ? 0 : SWAY * Math.sin(phase)
  stride(figure, phase === null ? 0 : Math.sin(phase) * 0.45)
}

export type Motion = {
  /** Poses everything at time t (seconds); dt is the time since the last frame. */
  update: (t: number, dt: number) => void
  /** Sends "Anda" to a spot around the furniture, walking or at once; nowhere when no path leads there. */
  walkTo: (spot: Point2, instant: boolean) => void
  /** Ends a walk under way at its spot (the loop is about to stop). */
  finishWalk: () => void
  /** Whether a walk is under way (the stage keeps drawing until it ends). */
  walking: () => boolean
  /**
   * What else Anda walks around (the placed shop items' footprints). One
   * standing inside a new footprint steps out to the nearest free point; a
   * walk under way finds a new way to its spot.
   */
  setExtraBlockers: (boxes: Array<Box2>) => void
}

/** The study's light animation: Anda walking (spec 3F §3.1); the ring stays still (§3.6). */
export function createMotion(people: People): Motion {
  const figure = people.anda
  const root = figure.root
  let route: Array<Point2> = []
  let leg = 0
  let legProgress = 0
  let extra: Array<Box2> = []
  const blockers = () => [...walkBlockers(), ...extra]

  /** Turns Anda along leg `i` of the route, unless it has no length. */
  function face(i: number) {
    if (i < 0 || i + 1 >= route.length) return
    const a = route[i]
    const b = route[i + 1]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    if (Math.hypot(dx, dz) > 1e-6) root.rotation.y = Math.atan2(dx, dz)
  }

  function arrive() {
    const end = route.at(-1)
    if (end) root.position.set(end[0], 0, end[1])
    route = []
    gait(figure, null)
  }

  function update(t: number, dt: number) {
    if (route.length === 0) return
    const step = advance(route, leg, legProgress, dt * SPEED)
    leg = step.leg
    legProgress = step.progress
    if (step.done) {
      arrive()
      return
    }
    root.position.set(step.at[0], 0, step.at[1])
    face(leg)
    gait(figure, t * CADENCE)
  }

  function walkTo([x, z]: Point2, instant: boolean) {
    const from: Point2 = [root.position.x, root.position.z]
    const blocked = blockers()
    const path = findPath(from, [x, z], WALK_BOUNDS, blocked, ANDA_RADIUS)
    if (path.length === 0) {
      // Standing where furniture now stands (a spot kept from an older
      // layout): no path leads out, so Anda steps straight to the spot.
      if (
        walkable(from, WALK_BOUNDS, blocked, ANDA_RADIUS) ||
        !walkable([x, z], WALK_BOUNDS, blocked, ANDA_RADIUS)
      ) {
        return
      }
      route = [from, [x, z]]
      face(0)
      arrive()
      return
    }
    route = [from, ...path]
    if (instant) {
      face(route.length - 2)
      arrive()
      return
    }
    leg = 0
    legProgress = 0
    face(0)
  }

  function finishWalk() {
    if (route.length === 0) return
    face(route.length - 2)
    arrive()
  }

  function setExtraBlockers(boxes: Array<Box2>) {
    // The same footprints again: leave a walk under way as it is.
    if (sameBoxes(extra, boxes)) return
    extra = boxes
    const blocked = blockers()
    const here: Point2 = [root.position.x, root.position.z]
    const free = nearestWalkable(here, WALK_BOUNDS, blocked, ANDA_RADIUS)
    if (free !== here) root.position.set(free[0], 0, free[1])
    const end = route.at(-1)
    if (end) {
      // The old way may cross the new item: walk on from here.
      route = []
      gait(figure, null)
      walkTo(end, false)
    }
  }

  return {
    update,
    walkTo,
    finishWalk,
    walking: () => route.length > 0,
    setExtraBlockers,
  }
}
