import type { Point2 } from "./layout"

export type Box2 = { x0: number; x1: number; z0: number; z1: number }

/** Whether two box lists hold the same boxes, edge for edge, in order. */
export function sameBoxes(
  a: ReadonlyArray<Box2>,
  b: ReadonlyArray<Box2>
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (box, i) =>
        box.x0 === b[i].x0 &&
        box.x1 === b[i].x1 &&
        box.z0 === b[i].z0 &&
        box.z1 === b[i].z1
    )
  )
}

const CELL = 0.25

/** Whether a walker of this radius may stand at `p`: inside the bounds, off every box. */
export function walkable(
  [x, z]: Point2,
  bounds: Box2,
  blocked: ReadonlyArray<Box2>,
  radius: number
): boolean {
  if (
    x < bounds.x0 + radius ||
    x > bounds.x1 - radius ||
    z < bounds.z0 + radius ||
    z > bounds.z1 - radius
  ) {
    return false
  }
  return !blocked.some(
    (box) =>
      x > box.x0 - radius &&
      x < box.x1 + radius &&
      z > box.z0 - radius &&
      z < box.z1 + radius
  )
}

/**
 * `p` if a walker may stand there, else the nearest point found on rings
 * 0.25 m apart around it, nearest ring first (for one standing where an item
 * was just placed). `p` itself when nothing within 5 m is free.
 */
export function nearestWalkable(
  p: Point2,
  bounds: Box2,
  blocked: ReadonlyArray<Box2>,
  radius: number
): Point2 {
  if (walkable(p, bounds, blocked, radius)) return p
  for (let ring = 1; ring <= 20; ring++) {
    const distance = ring * CELL
    const steps = ring * 8
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2
      const q: Point2 = [
        p[0] + Math.cos(angle) * distance,
        p[1] + Math.sin(angle) * distance,
      ]
      if (walkable(q, bounds, blocked, radius)) return q
    }
  }
  return p
}

function clear(
  a: Point2,
  b: Point2,
  bounds: Box2,
  blocked: ReadonlyArray<Box2>,
  radius: number
): boolean {
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CELL / 2))
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 1 : i / steps
    const p: Point2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    if (!walkable(p, bounds, blocked, radius)) return false
  }
  return true
}

/**
 * A path from `from` to `to` that never enters furniture: A* on a 0.25 m grid,
 * then straightened. Empty when the target is blocked or cannot be reached;
 * the result leaves out `from` and ends exactly at `to`.
 */
export function findPath(
  from: Point2,
  to: Point2,
  bounds: Box2,
  blocked: ReadonlyArray<Box2>,
  radius: number
): Array<Point2> {
  if (!walkable(to, bounds, blocked, radius)) return []
  if (clear(from, to, bounds, blocked, radius)) return [to]

  const cols = Math.ceil((bounds.x1 - bounds.x0) / CELL) + 1
  const rows = Math.ceil((bounds.z1 - bounds.z0) / CELL) + 1
  const cellOf = (p: Point2): [number, number] => [
    Math.round((p[0] - bounds.x0) / CELL),
    Math.round((p[1] - bounds.z0) / CELL),
  ]
  const pointOf = (c: number, r: number): Point2 => [
    bounds.x0 + c * CELL,
    bounds.z0 + r * CELL,
  ]
  const free = (c: number, r: number) =>
    c >= 0 &&
    r >= 0 &&
    c < cols &&
    r < rows &&
    walkable(pointOf(c, r), bounds, blocked, radius)

  // Free cells around `p` from which the straight leg to `p` is clear, nearest first.
  const anchorsOf = (p: Point2): Array<[number, number]> => {
    const [pc, pr] = cellOf(p)
    const found: Array<{ cell: [number, number]; d: number }> = []
    for (let c = pc - 2; c <= pc + 2; c++) {
      for (let r = pr - 2; r <= pr + 2; r++) {
        if (!free(c, r)) continue
        const cell = pointOf(c, r)
        if (!clear(cell, p, bounds, blocked, radius)) continue
        found.push({
          cell: [c, r],
          d: Math.hypot(cell[0] - p[0], cell[1] - p[1]),
        })
      }
    }
    return found.sort((a, b) => a.d - b.d).map((f) => f.cell)
  }
  const key = (c: number, r: number) => r * cols + c
  const starts = anchorsOf(from)
  const goals = new Set(anchorsOf(to).map(([c, r]) => key(c, r)))
  if (starts.length === 0 || goals.size === 0) return []
  const cost = new Map<number, number>(starts.map(([c, r]) => [key(c, r), 0]))
  const parent = new Map<number, number>()
  const open: Array<[number, number, number]> = starts.map(([c, r]) => [
    0,
    c,
    r,
  ])

  // Several goal cells, so no useful heuristic: plain Dijkstra on a small grid.
  let goal: number | undefined
  while (open.length > 0) {
    open.sort((a, b) => a[0] - b[0])
    const [, c, r] = open.shift()!
    if (goals.has(key(c, r))) {
      goal = key(c, r)
      break
    }
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue
        const nc = c + dc
        const nr = r + dr
        // No cutting corners: a diagonal needs both straight neighbours free.
        if (
          !free(nc, nr) ||
          (dc !== 0 && dr !== 0 && !(free(c + dc, r) && free(c, r + dr)))
        ) {
          continue
        }
        const next = cost.get(key(c, r))! + Math.hypot(dc, dr)
        if (next < (cost.get(key(nc, nr)) ?? Infinity)) {
          cost.set(key(nc, nr), next)
          parent.set(key(nc, nr), key(c, r))
          open.push([next, nc, nr])
        }
      }
    }
  }
  if (goal === undefined) return []

  const cells: Array<Point2> = []
  for (let k: number | undefined = goal; k !== undefined; k = parent.get(k)) {
    cells.push(pointOf(k % cols, Math.floor(k / cols)))
  }
  cells.reverse()
  cells.push(to)

  // String pulling from `from`: jump to the farthest waypoint reachable by a
  // clear leg. Every cell and the final `to` was validated, and each pushed
  // leg is checked, so a failure means no safe path rather than a bad one.
  const path: Array<Point2> = []
  let anchor = from
  let i = 0
  while (i < cells.length) {
    let j = cells.length - 1
    while (j > i && !clear(anchor, cells[j], bounds, blocked, radius)) j--
    if (!clear(anchor, cells[j], bounds, blocked, radius)) return []
    path.push(cells[j])
    anchor = cells[j]
    i = j + 1
  }
  return path
}

/**
 * Moves `distance` further along a route of straight legs, from `progress`
 * metres into leg `leg`. Never past the end: `done` once the last point is
 * reached, and then `at` is that point.
 */
export function advance(
  route: ReadonlyArray<Point2>,
  leg: number,
  progress: number,
  distance: number
): { leg: number; progress: number; at: Point2; done: boolean } {
  let i = leg
  let d = progress + distance
  while (i < route.length - 1) {
    const length = Math.hypot(
      route[i + 1][0] - route[i][0],
      route[i + 1][1] - route[i][1]
    )
    if (d < length) {
      const t = length === 0 ? 1 : d / length
      return {
        leg: i,
        progress: d,
        done: false,
        at: [
          route[i][0] + (route[i + 1][0] - route[i][0]) * t,
          route[i][1] + (route[i + 1][1] - route[i][1]) * t,
        ],
      }
    }
    d -= length
    i++
  }
  return {
    leg: Math.max(0, route.length - 1),
    progress: 0,
    done: true,
    at: route[route.length - 1],
  }
}
