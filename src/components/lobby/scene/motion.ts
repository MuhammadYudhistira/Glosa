import {
  ACTIVITY_SECONDS,
  type ActivityId,
  HELD,
  STAND,
  poseAt,
  walkSpeed,
} from "./activities"
import { ANDA_RADIUS, type Point2, WALK_BOUNDS, walkBlockers } from "./layout"
import { type Figure, type People, applyPose } from "./people"
import { RUN_START, type Run, finishRun, stepRun } from "./run"
import {
  type Box2,
  advance,
  findPath,
  nearestWalkable,
  sameBoxes,
  walkable,
} from "./walk"

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

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3)

/**
 * Whether Anda, turned `turn` about Y, holds the working hand (`arms[1]`,
 * on the figure's +X side) away from the camera, which always looks from
 * +X +Z (CAMERA_OFFSET). Then the figure is mirrored for the activity, so
 * the watering can or the reaching arm shows.
 */
export function handAway(turn: number): boolean {
  return Math.cos(turn) - Math.sin(turn) < 0
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
  /**
   * Does an activity once the walk under way ends (spec 3F §4A.1): turns to
   * `facing`, slides into `seat` when it is done sitting, and blends into its
   * pose, which it then keeps. Resolves when the pose is reached, or on
   * skip. A run still under way is resolved first.
   */
  perform: (
    activity: ActivityId,
    facing: Point2,
    seat?: Point2 | null
  ) => Promise<void>
  /** Ends the walk and the activity at once, in the activity's pose; its promise resolves. */
  skip: () => void
  /** Back on the feet where the walk ended, empty-handed (every walk starts so). */
  rest: () => void
  /** Whether a run is on its way or acting (the stage keeps drawing until it ends). */
  acting: () => boolean
}

/** The study's light animation: Anda walking and doing the hotspots' activities (spec 3F §3.1, §4A.1); the ring stays still (§3.6). */
export function createMotion(people: People): Motion {
  const figure = people.anda
  const root = figure.root
  let route: Array<Point2> = []
  let leg = 0
  let legProgress = 0
  let extra: Array<Box2> = []
  const blockers = () => [...walkBlockers(), ...extra]
  /** Metres per second, set once per walk from its length (at most 0.9 s). */
  let speed = walkSpeed(0)

  /** The tap under way: its run, what it does, and the promise to resolve. */
  let run: Run | null = null
  let activity: ActivityId | null = null
  let facing: Point2 = [0, 0]
  let seat: Point2 | null = null
  let resolve: (() => void) | null = null
  /** Where the activity began (the walk's end) and which way Anda faced then; null when standing. */
  let actFrom: { at: Point2; turn: number } | null = null

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

  function walk(t: number, dt: number) {
    if (route.length === 0) return
    const step = advance(route, leg, legProgress, dt * speed)
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

  /** Resolves the run's promise, once. */
  function settle() {
    const done = resolve
    resolve = null
    done?.()
  }

  /** Shows the activity `k` of the way (0: standing where the walk ended, 1: in its pose). */
  function act(k: number) {
    if (activity === null) return
    // A broken time must not leave the joints at NaN.
    const progress = Number.isFinite(k) ? Math.min(1, Math.max(0, k)) : 0
    actFrom ??= {
      at: [root.position.x, root.position.z],
      turn: root.rotation.y,
    }
    const eased = easeOut(progress)
    const [x0, z0] = actFrom.at
    const [x1, z1] = seat ?? actFrom.at
    root.position.set(x0 + (x1 - x0) * eased, 0, z0 + (z1 - z0) * eased)
    // Toward what the activity faces, the short way round, within its first half.
    const dx = facing[0] - x1
    const dz = facing[1] - z1
    if (Math.hypot(dx, dz) > 1e-6) {
      const target = Math.atan2(dx, dz)
      const turn = target - actFrom.turn
      const short = Math.atan2(Math.sin(turn), Math.cos(turn))
      root.rotation.y = actFrom.turn + short * Math.min(1, eased * 2)
      // Unseen at the start: standing, the figure is the same both ways.
      root.scale.x = handAway(target) ? -1 : 1
    }
    applyPose(figure, poseAt(activity, progress))
    const held = HELD[activity]
    for (const [name, thing] of Object.entries(people.held)) {
      thing.visible = name === held
    }
  }

  /** The prop shows only during the activity; the pose stays after. */
  function dropProp() {
    for (const thing of Object.values(people.held)) thing.visible = false
  }

  function update(t: number, dt: number) {
    walk(t, dt)
    if (!run || run.phase === "done") return
    run = stepRun(run, dt, route.length > 0)
    if (run.phase === "walk") return
    act(run.t / ACTIVITY_SECONDS)
    if (run.phase === "done") {
      dropProp()
      settle()
    }
  }

  function rest() {
    for (const thing of Object.values(people.held)) thing.visible = false
    // Up from the chair, back where the walk ended.
    if (actFrom) root.position.set(actFrom.at[0], 0, actFrom.at[1])
    actFrom = null
    root.scale.x = 1
    applyPose(figure, STAND)
  }

  function walkTo([x, z]: Point2, instant: boolean) {
    // Already there, in the activity's pose: the page's walk to the
    // hotspot can come after an activity done at once.
    if (
      actFrom &&
      route.length === 0 &&
      Math.hypot(actFrom.at[0] - x, actFrom.at[1] - z) < 1e-6
    ) {
      return
    }
    rest()
    // A new walk while acting: the activity plays again at its end.
    if (run?.phase === "act") run = RUN_START
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
    let length = 0
    for (let i = 1; i < route.length; i++) {
      length += Math.hypot(
        route[i][0] - route[i - 1][0],
        route[i][1] - route[i - 1][1]
      )
    }
    speed = walkSpeed(length)
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
    // Seated, Anda gets up where the walk ended: that spot must be free.
    const here: Point2 = actFrom?.at ?? [root.position.x, root.position.z]
    const free = nearestWalkable(here, WALK_BOUNDS, blocked, ANDA_RADIUS)
    if (free !== here) {
      rest()
      root.position.set(free[0], 0, free[1])
    }
    const end = route.at(-1)
    if (end) {
      // The old way may cross the new item: walk on from here.
      route = []
      gait(figure, null)
      walkTo(end, false)
    }
  }

  function perform(
    next: ActivityId,
    toward: Point2,
    sitAt: Point2 | null = null
  ): Promise<void> {
    settle()
    rest()
    activity = next
    facing = toward
    seat = sitAt
    run = RUN_START
    return new Promise<void>((done) => {
      resolve = done
    })
  }

  function skip() {
    finishWalk()
    if (run && run.phase !== "done") {
      run = finishRun()
      act(1)
    }
    dropProp()
    settle()
  }

  return {
    update,
    walkTo,
    finishWalk,
    walking: () => route.length > 0,
    setExtraBlockers,
    perform,
    skip,
    rest,
    acting: () => run !== null && run.phase !== "done",
  }
}
