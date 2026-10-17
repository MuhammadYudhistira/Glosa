import * as THREE from "three"
import type { Furnishings } from "./furniture"
import { ATRIUM, GLASS, type Point2, WALKER_ROUTES } from "./layout"
import type { Figure, People } from "./people"
import type { Skyline } from "./skyline"

const ANDA_WALK_SECONDS = 0.9

type Segment = { from: Point2; to: Point2; walk: number; pause: number }
type Route = { segments: Array<Segment>; total: number }

function routeOf(
  points: ReadonlyArray<readonly [number, number, number]>,
  speed: number
): Route {
  const segments = points.map(([x, z, pause], i): Segment => {
    const [nx, nz] = points[(i + 1) % points.length]
    return {
      from: [x, z],
      to: [nx, nz],
      walk: Math.hypot(nx - x, nz - z) / speed,
      pause,
    }
  })
  return {
    segments,
    total: segments.reduce((sum, { walk, pause }) => sum + walk + pause, 0),
  }
}

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

/** Walks the route, pausing and looking around at its corners. */
function placeWalker(walker: Figure, route: Route, t: number) {
  let time = t % route.total
  for (const { from, to, walk, pause } of route.segments) {
    if (time > pause + walk) {
      time -= pause + walk
      continue
    }
    const moving = time > pause
    const f = moving ? (time - pause) / walk : 0
    walker.root.position.set(
      from[0] + (to[0] - from[0]) * f,
      0,
      from[1] + (to[1] - from[1]) * f
    )
    walker.root.rotation.y = Math.atan2(to[0] - from[0], to[1] - from[1])
    stride(walker, moving ? Math.sin(t * 6.5) * 0.42 : 0)
    walker.head.rotation.y = moving ? 0 : Math.sin(t * 0.8) * 0.5
    return
  }
}

export type Motion = {
  /** Poses everything at time t (seconds); dt is the time since the last frame. */
  update: (t: number, dt: number) => void
  /** Sends "Anda" to a spot, walking or at once. */
  walkTo: (spot: Point2, instant: boolean) => void
  /** Ends a walk under way at its spot (the loop is about to stop). */
  finishWalk: () => void
  /** Shows a share of the walkers (the low tier shows half). */
  showWalkers: (share: number) => void
}

/** The lobby's light animation (spec 1D §4). */
export function createMotion(
  people: People,
  furniture: Furnishings,
  skyline: Skyline
): Motion {
  const routes = WALKER_ROUTES.map(({ points, speed }) =>
    routeOf(points, speed)
  )
  const from = new THREE.Vector3()
  const to = new THREE.Vector3()
  let progress = 1
  let shown = people.walkers.length

  function update(t: number, dt: number) {
    people.walkers.forEach((walker, i) => {
      if (i < shown) placeWalker(walker, routes[i], t)
    })
    for (const sitter of people.sitters) {
      sitter.head.rotation.x = Math.sin(t * 0.6 + sitter.phase) * 0.12 + 0.15
      sitter.head.rotation.y = Math.sin(t * 0.3 + sitter.phase) * 0.25
    }
    // Every seven seconds each reader turns a page.
    const cycle = (t % 7) / 7
    furniture.pagePivots.forEach((pivot, i) => {
      const k = (cycle + i * 0.45) % 1
      pivot.rotation.z =
        k < 0.6 ? 0 : k < 0.8 ? ((k - 0.6) / 0.2) * Math.PI : Math.PI
      pivot.visible = k < 0.82
    })
    people.librarian.arms[0].rotation.x = -1.2 + Math.sin(t * 14) * 0.06
    people.librarian.arms[1].rotation.x = -1.2 + Math.cos(t * 14) * 0.06
    furniture.arts.forEach((art, i) => {
      art.rotation.y = t * (0.08 + i * 0.03)
    })
    for (const cloud of skyline.clouds) {
      cloud.group.position.x += dt * cloud.speed
      if (cloud.group.position.x > ATRIUM.size + 2) {
        cloud.group.position.x = GLASS.x0 - 3
      }
    }
    for (const bird of skyline.birds) {
      bird.group.position.x -= dt * bird.speed
      if (bird.group.position.x < GLASS.x0 - 2) {
        bird.group.position.x = ATRIUM.size + 1
      }
      const flap = Math.sin(t * 9 + bird.phase) * 0.8
      bird.left.rotation.x = flap
      bird.right.rotation.x = -flap
    }
    for (const beacon of skyline.beacons) {
      beacon.mesh.visible = (t * 0.8 + beacon.phase) % 1 < 0.45
    }
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

  function showWalkers(share: number) {
    shown = Math.ceil(people.walkers.length * share)
    people.walkers.forEach((walker, i) => {
      walker.root.visible = i < shown
    })
  }

  return { update, walkTo, finishWalk, showWalkers }
}
