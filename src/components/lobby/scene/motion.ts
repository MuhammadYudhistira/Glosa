import * as THREE from "three"
import type { Point2 } from "./layout"
import type { Figure, People } from "./people"

const ANDA_WALK_SECONDS = 0.9

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

export type Motion = {
  /** Poses everything at time t (seconds); dt is the time since the last frame. */
  update: (t: number, dt: number) => void
  /** Sends "Anda" to a spot, walking (in a straight line for now) or at once. */
  walkTo: (spot: Point2, instant: boolean) => void
  /** Ends a walk under way at its spot (the loop is about to stop). */
  finishWalk: () => void
}

/** The study's light animation: Anda walking and their ring (spec 3F §3.1). */
export function createMotion(people: People): Motion {
  const from = new THREE.Vector3()
  const to = new THREE.Vector3()
  let progress = 1

  function update(t: number, dt: number) {
    if (progress < 1) {
      progress = Math.min(1, progress + dt / ANDA_WALK_SECONDS)
      const eased = 1 - Math.pow(1 - progress, 3)
      people.anda.root.position.lerpVectors(from, to, eased)
      stride(people.anda, progress < 1 ? Math.sin(t * 9) * 0.45 : 0)
    }
    people.ring.material.opacity = 0.55 + Math.sin(t * 2.6) * 0.35
  }

  function walkTo([x, z]: Point2, instant: boolean) {
    const root = people.anda.root
    if (Math.hypot(root.position.x - x, root.position.z - z) < 0.01) return
    to.set(x, 0, z)
    root.rotation.y = Math.atan2(x - root.position.x, z - root.position.z)
    if (instant) {
      root.position.copy(to)
      progress = 1
      stride(people.anda, 0)
      return
    }
    from.copy(root.position)
    progress = 0
  }

  function finishWalk() {
    if (progress >= 1) return
    people.anda.root.position.copy(to)
    progress = 1
    stride(people.anda, 0)
  }

  return { update, walkTo, finishWalk }
}
