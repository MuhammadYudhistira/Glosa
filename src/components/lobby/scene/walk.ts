import type { Point2 } from "./layout"

export type Box2 = { x0: number; x1: number; z0: number; z1: number }

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

  const start = cellOf(from)
  const goal = cellOf(to)
  const key = (c: number, r: number) => r * cols + c
  const cost = new Map<number, number>([[key(...start), 0]])
  const parent = new Map<number, number>()
  const open: Array<[number, number, number]> = [[0, ...start]]
  const heuristic = (c: number, r: number) =>
    Math.hypot(goal[0] - c, goal[1] - r)

  let found = false
  while (open.length > 0) {
    open.sort((a, b) => a[0] - b[0])
    const [, c, r] = open.shift()!
    if (c === goal[0] && r === goal[1]) {
      found = true
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
          open.push([next + heuristic(nc, nr), nc, nr])
        }
      }
    }
  }
  if (!found) return []

  const cells: Array<Point2> = []
  for (
    let k: number | undefined = key(...goal);
    k !== undefined;
    k = parent.get(k)
  ) {
    cells.push(pointOf(k % cols, Math.floor(k / cols)))
  }
  cells.reverse()
  cells[cells.length - 1] = to

  // String pulling: skip every waypoint that can be walked past.
  const path: Array<Point2> = []
  let anchor = from
  let i = 0
  while (i < cells.length) {
    let j = cells.length - 1
    while (j > i && !clear(anchor, cells[j], bounds, blocked, radius)) j--
    path.push(cells[j])
    anchor = cells[j]
    i = j + 1
  }
  return path
}
