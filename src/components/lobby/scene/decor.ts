import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { SLOT_IDS, type SlotId } from "@/lib/shop/catalog"
import type { Placements } from "@/lib/shop/types"
import { DECOR_SIZES, DECOR_SLOTS } from "./layout"
import type { ModelKey } from "./model-manifest"
import { type ModelSet, fitTo } from "./models"

/**
 * What a builder draws with: shapes in the slot's group (or a part of it),
 * in its own paint. Floor items stand on y = 0; wall items are centred on
 * y = 0 and stand out from the wall along +Z; ceiling items hang below y = 0.
 */
export type Part = {
  /** The group this part draws in. */
  root: THREE.Object3D
  /** A rounded box standing on y, centred on x and z. */
  box: (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    r?: number
  ) => THREE.Mesh
  /** A cylinder standing on y. */
  rod: (
    radius: number,
    h: number,
    color: string,
    x: number,
    y: number,
    z: number,
    top?: number
  ) => THREE.Mesh
  ball: (
    radius: number,
    color: string,
    x: number,
    y: number,
    z: number
  ) => THREE.Mesh
  /** A flat disc lying on y. */
  disc: (
    radius: number,
    color: string,
    x: number,
    y: number,
    z: number
  ) => THREE.Mesh
  /** Any geometry, centred on x, y, z, in a paint or a material of its own. */
  mesh: (
    geometry: THREE.BufferGeometry,
    paint: string | THREE.Material,
    x: number,
    y: number,
    z: number
  ) => THREE.Mesh
  /** A paint that lights up with the room's lamps: `max` at night. */
  glow: (color: string, max?: number) => THREE.Material
  /** Adds a mesh built by hand; it is freed with the slot, material included. */
  add: (object: THREE.Mesh) => void
  /** A part of its own at x, y, z, to place or move as one. */
  child: (x: number, y: number, z: number) => Part
  /**
   * The item's model, if it has one: scaled to `height`, kept inside the
   * slot's size and set on this part's origin (standing, centred on a wall
   * or hanging, by the slot). `spread`: a rug, as wide as the slot allows
   * and `height` thick. Null without a model: the builder draws it by code.
   */
  model: (key: ModelKey, height: number, spread?: boolean) => boolean
  /**
   * A motion for the seconds after the item appears (spec 3F §3.6): `pose`
   * gets the seconds since then; pose(0) is the item at rest.
   */
  move: (pose: (t: number) => void) => void
}

/** How long an item moves after it appears in its slot, in milliseconds. */
export const MOTION_MS = 4000

/**
 * Whether an item that appeared at `since` (null: it was there when the
 * lobby loaded) still moves at `now`. No decorative motion otherwise (spec
 * 3F §3.6; plan 3F-R1, decision 10): only as an answer to the member's act.
 */
export function animating(since: number | null, now: number): boolean {
  if (since === null) return false
  const elapsed = now - since
  return elapsed >= 0 && elapsed < MOTION_MS
}

/** 0 to 1 over the motion, slow at both ends. */
const ease = (t: number) =>
  0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t / 4)))
/** Rises and falls back to 0 over the motion. */
const swell = (t: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t / 4)))

const WOOD = "#8a5a36"
const WOOD_LIGHT = "#b07a48"
const DARK = "#4a3426"
const BRASS = "#c9a24a"
const CREAM = "#f3e2c0"
const TERRACOTTA = "#c2643c"
const MUSTARD = "#e0b45c"
const SAGE = "#8fae7e"
const BERRY = "#8c2f39"
const TEAL = "#3f7f86"
const BULB = "#ffe2a8"

const brassMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: BRASS,
    metalness: 0.55,
    roughness: 0.4,
  })

/** A ring standing up, facing +Z (rotate it to lay it down). */
const ring = (radius: number, tube: number, arc = Math.PI * 2) =>
  new THREE.TorusGeometry(radius, tube, 8, 40, arc)

/** A lamp's glowing bulb under a shade, and the shade's lit inside. */
function shadeGlow(p: Part, radius: number, y: number, bulb = 0.06) {
  p.ball(bulb, BULB, 0, y - 0.04, 0).material = p.glow(BULB, 2.4)
  const liner = p.mesh(
    new THREE.CylinderGeometry(radius, radius, 0.01, 24),
    p.glow("#ffd89a", 1.3),
    0,
    y,
    0
  )
  liner.castShadow = false
}

/** A thin dark cord from one point to another. */
function cord(
  p: Part,
  [ax, ay, az]: readonly [number, number, number],
  [bx, by, bz]: readonly [number, number, number]
) {
  const direction = new THREE.Vector3(bx - ax, by - ay, bz - az)
  const line = p.mesh(
    new THREE.CylinderGeometry(0.004, 0.004, direction.length(), 6),
    DARK,
    (ax + bx) / 2,
    (ay + by) / 2,
    (az + bz) / 2
  )
  line.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  )
}

/** An open book in flight: two covers like wings, pages between them. */
function flyingBook(p: Part, color: string, x: number, y: number, z: number) {
  const book = p.child(x, y, z)
  book.box(0.06, 0.045, 0.2, CREAM, 0, -0.015, 0, 0.012)
  const wings: Array<THREE.Object3D> = []
  for (const side of [-1, 1]) {
    const hinge = book.child(0, 0, 0)
    hinge.box(0.15, 0.014, 0.21, color, side * 0.075, 0, 0, 0.006)
    hinge.root.rotation.z = side * 0.35
    wings.push(hinge.root)
  }
  book.move((t) => {
    wings.forEach((wing, i) => {
      const side = i === 0 ? -1 : 1
      wing.rotation.z = side * (0.35 + 0.35 * Math.sin(Math.PI * 4 * t))
    })
  })
  return book
}

/** One builder per shop item (spec 3C §4); the ids match the catalogue. */
export const DECOR_BUILDERS: Record<string, (part: Part) => void> = {
  rug_woven: (p) => {
    if (p.model("decor_rug_woven", 0.03, true)) return
    p.box(3.0, 0.02, 2.0, "#c8a77a", 0, 0, 0, 0.01)
    for (let i = -3; i <= 3; i++) {
      p.box(2.8, 0.025, 0.07, "#a07c52", 0, 0, i * 0.26, 0.01)
    }
  },
  rug_round: (p) => {
    if (p.model("decor_rug_round", 0.03, true)) return
    const rings: Array<readonly [number, string, number]> = [
      [1.0, TEAL, 0.01],
      [0.78, CREAM, 0.015],
      [0.4, TEAL, 0.02],
    ]
    for (const [radius, color, y] of rings) {
      p.disc(radius, color, 0, y, 0).scale.x = 1.5
    }
  },
  rug_pattern: (p) => {
    if (p.model("decor_rug_pattern", 0.03, true)) return
    p.box(3.0, 0.015, 2.0, BERRY, 0, 0, 0, 0.01)
    p.box(2.6, 0.02, 1.6, MUSTARD, 0, 0, 0, 0.01)
    p.box(2.3, 0.025, 1.3, BERRY, 0, 0, 0, 0.01)
    p.disc(0.35, TEAL, 0, 0.026, 0)
  },
  lamp_floor: (p) => {
    if (p.model("decor_lamp_floor", 1.5)) {
      // The KayKit standing lamp's shade is its top fifth.
      shadeGlow(p, 0.17, 1.49, 0.07)
      return
    }
    p.rod(0.2, 0.05, DARK, 0, 0, 0, 0.17)
    p.rod(0.025, 1.15, DARK, 0, 0.05, 0)
    p.rod(0.25, 0.3, CREAM, 0, 1.2, 0, 0.17)
    shadeGlow(p, 0.16, 1.49)
  },
  lamp_arc: (p) => {
    // A heavy round foot on one side, the arm bending over to the other.
    p.rod(0.17, 0.06, DARK, 0.25, 0, 0, 0.15)
    p.rod(0.022, 1.36, BRASS, 0.25, 0.06, 0)
    const arm = p.mesh(ring(0.25, 0.022, Math.PI), BRASS, 0, 1.42, 0)
    arm.castShadow = true
    const shade = p.mesh(
      new THREE.SphereGeometry(0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      MUSTARD,
      -0.25,
      1.22,
      0
    )
    shade.scale.y = 0.8
    p.rod(0.02, 0.06, BRASS, -0.25, 1.36, 0)
    p.ball(0.07, BULB, -0.25, 1.2, 0).material = p.glow(BULB, 2.4)
  },
  lamp_lantern: (p) => {
    // It hangs: the lantern's top at 3.3 m, its chain up to 3.9 m.
    p.rod(0.012, 0.6, DARK, 0, 3.3, 0)
    const lantern = p.child(0, 2.8, 0)
    if (lantern.model("decor_lamp_lantern", 0.5)) {
      lantern.ball(0.06, BULB, 0, 0.22, 0).material = p.glow("#ffc35c", 2.6)
      return
    }
    lantern.rod(0.12, 0.05, DARK, 0, 0, 0, 0.14)
    lantern.box(0.24, 0.32, 0.24, BERRY, 0, 0.05, 0, 0.05)
    lantern.ball(0.1, BULB, 0, 0.21, 0).material = p.glow("#ffc35c", 2.6)
    lantern.rod(0.15, 0.08, DARK, 0, 0.37, 0, 0.04)
    lantern.mesh(ring(0.04, 0.008), DARK, 0, 0.47, 0)
  },
  seat_beanbag: (p) => {
    p.ball(0.5, TERRACOTTA, 0, 0.21, 0).scale.set(1, 0.42, 0.95)
    const back = p.ball(0.4, "#d27548", 0, 0.32, -0.2)
    back.scale.set(1.05, 0.58, 0.6)
  },
  seat_armchair: (p) => {
    if (p.model("decor_seat_armchair", 0.9)) return
    const cloth = "#6f8f6a"
    p.box(1.0, 0.42, 0.9, cloth, 0, 0, 0, 0.1)
    p.box(1.0, 0.48, 0.22, "#5f7d5b", 0, 0.42, -0.34, 0.1)
    for (const side of [-1, 1]) {
      p.box(0.2, 0.26, 0.86, "#5f7d5b", side * 0.4, 0.42, 0.02, 0.09)
    }
    p.box(0.62, 0.1, 0.62, CREAM, 0, 0.42, 0.08, 0.05)
  },
  seat_sofa: (p) => {
    if (p.model("decor_seat_sofa", 0.9)) return
    const cloth = "#4c6a8f"
    p.box(2.2, 0.42, 0.95, cloth, 0, 0, 0, 0.1)
    p.box(2.2, 0.48, 0.24, "#41597a", 0, 0.42, -0.355, 0.1)
    for (const side of [-1, 1]) {
      p.box(0.22, 0.26, 0.95, "#41597a", side * 0.99, 0.42, 0, 0.09)
    }
    p.box(0.42, 0.34, 0.14, MUSTARD, -0.55, 0.48, -0.18, 0.06)
    p.box(0.42, 0.34, 0.14, TERRACOTTA, 0.55, 0.48, -0.18, 0.06)
  },
  wall_map: (p) => {
    // 1.2 × 1.0 m: a wooden frame, a sea of parchment, rounded continents.
    p.box(1.2, 1.0, 0.04, WOOD, 0, -0.5, 0.02, 0.02)
    p.box(1.1, 0.9, 0.02, "#e8d9b5", 0, -0.45, 0.045, 0.01)
    const lands: Array<readonly [number, number, number, number]> = [
      [-0.3, 0.12, 0.26, 0.22],
      [-0.22, -0.18, 0.14, 0.26],
      [0.08, 0.1, 0.18, 0.22],
      [0.12, -0.16, 0.16, 0.2],
      [0.36, 0.08, 0.28, 0.2],
      [0.38, -0.26, 0.14, 0.1],
    ]
    for (const [x, y, w, h] of lands) {
      p.box(w, h, 0.012, SAGE, x, y - h / 2, 0.06, 0.04)
    }
    p.ball(0.018, "#d2462e", 0.1, 0.06, 0.07)
    p.ball(0.018, "#d2462e", -0.28, 0.1, 0.07)
  },
  wall_painting: (p) => {
    if (p.model("decor_wall_painting", 0.9)) return
    // 0.75 × 0.9 m: a brass frame round a landscape at dusk.
    const frame = p.box(0.75, 0.9, 0.05, BRASS, 0, -0.45, 0.025, 0.025)
    frame.material = brassMaterial()
    p.box(0.63, 0.78, 0.02, "#f4c27a", 0, -0.39, 0.05, 0.01)
    p.box(0.63, 0.3, 0.025, "#6d8f4e", 0, -0.39, 0.055, 0.01)
    p.box(0.63, 0.12, 0.03, "#4f7a3a", 0, -0.39, 0.06, 0.01)
    p.ball(0.08, TERRACOTTA, 0.15, 0.12, 0.065).scale.z = 0.3
  },
  wall_clock: (p) => {
    // 0.8 m across: a round wooden case, a cream face, brass hands.
    const face = (radius: number, depth: number, color: string, z: number) =>
      p.mesh(
        new THREE.CylinderGeometry(radius, radius, depth, 40).rotateX(
          Math.PI / 2
        ),
        color,
        0,
        0,
        z + depth / 2
      )
    face(0.4, 0.06, WOOD, 0)
    face(0.34, 0.02, CREAM, 0.05)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const long = i % 3 === 0
      const tick = p.box(
        0.018,
        long ? 0.06 : 0.035,
        0.01,
        DARK,
        Math.sin(a) * 0.28,
        Math.cos(a) * 0.28 - (long ? 0.03 : 0.0175),
        0.075,
        0.004
      )
      tick.rotation.z = -a
    }
    const hand = (length: number, width: number, angle: number) => {
      const arm = p.child(0, 0, 0.08)
      arm.box(width, length, 0.008, DARK, 0, 0, 0, 0.004)
      arm.root.rotation.z = -angle
    }
    hand(0.22, 0.025, Math.PI / 3)
    hand(0.15, 0.035, -Math.PI * 0.6)
    p.ball(0.025, BRASS, 0, 0, 0.09).material = brassMaterial()
  },
  pet_cat: (p) => {
    // A ginger cat asleep on a round cushion, 0.35 m high, ears and all.
    p.rod(0.32, 0.08, BERRY, 0, 0, 0, 0.3)
    const fur = "#e3a35b"
    p.ball(0.2, fur, 0, 0.17, 0).scale.set(1, 0.55, 0.8)
    p.ball(0.11, fur, 0.17, 0.2, 0.08)
    for (const dz of [0.02, 0.14]) {
      const ear = p.mesh(new THREE.ConeGeometry(0.035, 0.07, 10), fur, 0, 0, 0)
      ear.position.set(0.19, 0.31, dz)
    }
    const tail = p.mesh(ring(0.2, 0.03, Math.PI * 0.8), "#d18f48", 0, 0.1, 0)
    tail.rotation.set(-Math.PI / 2, 0, Math.PI * 0.35)
  },
  pet_bird: (p) => {
    // A brass cage on a turned wooden foot, 0.7 m, with a blue bird inside.
    const brass = brassMaterial()
    p.rod(0.2, 0.06, WOOD, 0, 0, 0, 0.18)
    p.disc(0.17, "#e8d9b5", 0, 0.061, 0)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      p.rod(0.006, 0.36, BRASS, Math.cos(a) * 0.17, 0.06, Math.sin(a) * 0.17)
    }
    for (const y of [0.06, 0.24, 0.42]) {
      const hoop = p.mesh(ring(0.17, 0.008), brass, 0, y, 0)
      hoop.rotation.x = Math.PI / 2
    }
    for (let i = 0; i < 4; i++) {
      const arch = p.mesh(ring(0.17, 0.007, Math.PI), brass, 0, 0.42, 0)
      arch.rotation.y = (i / 4) * Math.PI
    }
    p.mesh(ring(0.035, 0.008), brass, 0, 0.63, 0)
    // The perch, across the cage under the bird's feet.
    p.mesh(
      new THREE.CylinderGeometry(0.007, 0.007, 0.32, 8).rotateZ(Math.PI / 2),
      DARK,
      0,
      0.215,
      0
    )
    const bird = p.child(0, 0.215, 0)
    bird.ball(0.045, "#4fa3d1", 0, 0.04, 0).scale.set(1.35, 1, 0.9)
    bird.ball(0.032, "#4fa3d1", 0.045, 0.085, 0)
    bird.ball(0.008, DARK, 0.068, 0.095, 0.022)
    const beak = bird.mesh(
      new THREE.ConeGeometry(0.012, 0.03, 8),
      MUSTARD,
      0,
      0,
      0
    )
    beak.position.set(0.085, 0.082, 0)
    beak.rotation.z = -Math.PI / 2
    bird.box(0.06, 0.012, 0.02, "#2e6f96", -0.07, 0.04, 0, 0.005)
    const wings: Array<THREE.Object3D> = []
    for (const side of [-1, 1]) {
      const wing = bird.child(0, 0.06, side * 0.035)
      wing.box(0.07, 0.012, 0.04, "#2e6f96", -0.01, 0, side * 0.02, 0.006)
      wings.push(wing.root)
    }
    p.move((t) => {
      const hop = Math.abs(Math.sin(Math.PI * 1.5 * t))
      bird.root.position.y = 0.215 + hop * 0.08 * swell(t)
      bird.root.rotation.y = 0.8 * Math.sin((Math.PI * t) / 2)
      const flap = Math.abs(Math.sin(Math.PI * 4 * t)) * swell(t)
      wings.forEach((wing, i) => {
        wing.rotation.x = (i === 0 ? 1 : -1) * flap
      })
    })
  },
  pet_aquarium: (p) => {
    // A round fishbowl on a round wooden stand, 0.7 m, two fish swimming.
    p.rod(0.17, 0.24, WOOD_LIGHT, 0, 0, 0, 0.15)
    p.rod(0.2, 0.03, WOOD, 0, 0.24, 0)
    const centre = 0.27 + 0.21
    const water = p.mesh(
      new THREE.SphereGeometry(
        0.19,
        24,
        14,
        0,
        Math.PI * 2,
        0.6,
        Math.PI - 0.6
      ),
      new THREE.MeshStandardMaterial({
        color: "#8fd0e6",
        transparent: true,
        opacity: 0.3,
        roughness: 0.1,
      }),
      0,
      centre,
      0
    )
    water.castShadow = false
    p.disc(0.12, "#e6d3a3", 0, centre - 0.17, 0)
    p.rod(0.012, 0.16, "#4f7a3a", 0.06, centre - 0.17, 0.03)
    p.rod(0.01, 0.12, "#5f8f45", 0.08, centre - 0.17, -0.02)
    const school = p.child(0, centre - 0.02, 0)
    const fishes: ReadonlyArray<readonly [string, number, number]> = [
      ["#f28c38", 0, 0.02],
      ["#f2c14e", Math.PI, -0.05],
    ]
    for (const [color, angle, y] of fishes) {
      const fish = school.child(
        Math.cos(angle) * 0.09,
        y,
        Math.sin(angle) * 0.09
      )
      fish.ball(0.05, color, 0, 0, 0).scale.set(1, 0.75, 0.5)
      // The tail fans out behind the body (-X), the fish swimming round.
      const tail = fish.mesh(
        new THREE.ConeGeometry(0.03, 0.045, 8),
        color,
        -0.065,
        0,
        0
      )
      tail.rotation.z = -Math.PI / 2
      fish.root.rotation.y = Math.PI / 2 - angle
    }
    const glass = p.mesh(
      new THREE.SphereGeometry(
        0.21,
        28,
        16,
        0,
        Math.PI * 2,
        0.45,
        Math.PI - 0.45
      ),
      new THREE.MeshStandardMaterial({
        color: "#dff1f7",
        transparent: true,
        opacity: 0.25,
        roughness: 0.05,
        depthWrite: false,
      }),
      0,
      centre,
      0
    )
    glass.castShadow = false
    glass.renderOrder = 2
    p.move((t) => {
      school.root.rotation.y = Math.PI * 2 * ease(t)
      school.root.position.y =
        centre - 0.02 + 0.025 * Math.sin(Math.PI * t) * swell(t)
    })
  },
  ceiling_lights: (p) => {
    // A brass hoop on three cords, strands of warm bulbs hanging from it.
    p.rod(0.006, 0.12, DARK, 0, -0.12, 0)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      cord(p, [0, -0.12, 0], [Math.cos(a) * 0.32, -0.3, Math.sin(a) * 0.32])
    }
    const hoop = p.mesh(ring(0.32, 0.012), brassMaterial(), 0, -0.3, 0)
    hoop.rotation.x = Math.PI / 2
    const strands = 10
    for (let i = 0; i < strands; i++) {
      const a = (i / strands) * Math.PI * 2
      const length = 0.08 + ((i * 7) % 4) * 0.035
      const x = Math.cos(a) * 0.32
      const z = Math.sin(a) * 0.32
      p.rod(0.003, length, DARK, x, -0.3 - length, z)
      p.ball(0.032, BULB, x, -0.3 - length - 0.025, z).material = p.glow(
        i % 2 ? "#ffd27a" : "#ffb38a",
        2
      )
    }
  },
  ceiling_books: (p) => {
    // A mobile of open books flying in a ring, as if just let out of the
    // shelves: each on its thread from a brass hoop, banked into the turn,
    // so from above none reads as a book lying on the floor.
    p.rod(0.006, 0.1, DARK, 0, -0.1, 0)
    const flock = p.child(0, -0.1, 0)
    const hoop = flock.mesh(ring(0.36, 0.01), brassMaterial(), 0, 0, 0)
    hoop.rotation.x = Math.PI / 2
    const colors = [BERRY, TEAL, MUSTARD, "#4f7a3a", "#8e5ea2", TERRACOTTA]
    colors.forEach((color, i) => {
      const a = (i / colors.length) * Math.PI * 2
      const x = Math.cos(a) * 0.36
      const z = Math.sin(a) * 0.36
      const y = -0.08 - (i % 3) * 0.19
      cord(flock, [x, 0, z], [x, y, z])
      const book = flyingBook(flock, color, x, y, z)
      book.root.rotation.set(i % 2 ? 0.3 : -0.25, -a, 0.45, "YXZ")
    })
    p.move((t) => {
      flock.root.rotation.y = Math.PI * 2 * ease(t)
    })
  },
  ceiling_globe: (p) => {
    // An antique globe, 0.6 m across in its brass meridian, on a short cord.
    p.rod(0.008, 0.1, DARK, 0, -0.1, 0)
    const brass = brassMaterial()
    const tilt = p.child(0, -0.39, 0)
    tilt.root.rotation.z = 0.41
    const meridian = tilt.mesh(ring(0.27, 0.012), brass, 0, 0, 0)
    meridian.castShadow = true
    tilt.ball(0.02, BRASS, 0, 0.27, 0).material = brass
    tilt.ball(0.02, BRASS, 0, -0.27, 0).material = brass
    const spin = tilt.child(0, 0, 0)
    spin.ball(0.23, "#3d7ea6", 0, 0, 0)
    const lands: ReadonlyArray<readonly [number, number, number]> = [
      [0.4, 0.3, 0.11],
      [1.5, -0.2, 0.09],
      [2.6, 0.5, 0.12],
      [3.6, -0.5, 0.08],
      [4.7, 0.1, 0.1],
      [5.6, 0.7, 0.07],
    ]
    for (const [longitude, latitude, size] of lands) {
      const land = spin.ball(size, "#c9b27a", 0, 0, 0)
      land.scale.set(1, 0.7, 0.25)
      const radius = 0.215
      land.position.set(
        Math.cos(latitude) * Math.sin(longitude) * radius,
        Math.sin(latitude) * radius,
        Math.cos(latitude) * Math.cos(longitude) * radius
      )
      // Flat against the sphere: its thin axis (Z) points outward.
      land.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        land.position.clone().normalize()
      )
    }
    p.move((t) => {
      spin.root.rotation.y = Math.PI * 2 * ease(t)
    })
  },
}

export type Decor = {
  /** Shows these items; slots that did not change stay as they are. */
  set: (placed: Placements) => void
  /**
   * Poses the items in their motion, now; true while one still moves. The
   * stage calls it on each of its frames (one loop, not two).
   */
  update: () => boolean
  /** Puts every moving item at rest (the stage stops moving). */
  rest: () => void
  /** The lamps' share of light, 0 by day to 1 at night (RIGS[mood].lamps). */
  setLamps: (k: number) => void
  dispose: () => void
}

/** Frees what a slot's group holds: every geometry, and materials made just for it. */
function clearGroup(group: THREE.Group, shared: Set<THREE.Material>) {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    const materials: Array<THREE.Material> = Array.isArray(object.material)
      ? object.material
      : [object.material]
    for (const material of materials) {
      if (!shared.has(material)) material.dispose()
    }
  })
  group.clear()
}

/**
 * Places a model on its part's origin: `height` high (or, spread, as wide as
 * the slot and `height` thick), shrunk to stay inside the slot's size; on a
 * wall its back touches the wall and its centre is on the origin; under the
 * ceiling it hangs from the origin.
 */
function placeModel(
  model: THREE.Object3D,
  slot: SlotId,
  height: number,
  spread: boolean
): THREE.Group {
  const inner = new THREE.Group()
  inner.add(model)
  fitTo(inner, height)
  const [w, , d] = DECOR_SIZES[slot]
  const extent = new THREE.Box3()
    .setFromObject(inner)
    .getSize(new THREE.Vector3())
  if (spread) {
    const k = Math.min(w / extent.x, d / extent.z)
    inner.scale.x *= k
    inner.scale.z *= k
    // Centred again; its height is unchanged.
    fitTo(inner, height)
  } else {
    const k = Math.min(1, w / extent.x, d / extent.z)
    if (k < 1) fitTo(inner, height * k)
  }
  const box = new THREE.Box3().setFromObject(inner)
  if (slot === "wall") {
    inner.position.z -= box.min.z
    inner.position.y -= (box.max.y - box.min.y) / 2
  } else if (slot === "ceiling") {
    inner.position.y -= box.max.y
  }
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  return inner
}

/**
 * The shop's items in the lobby (spec 3C §6.3, 3F §3.3): from their model
 * where the manifest has one, else by code. Paint of its own, not the kit's
 * shared materials, so changing an item frees what it used (plan 3C,
 * decision 7). onChange asks the stage to draw again; its frames then call
 * `update` while an item moves. `canMove` says whether the lobby moves at all
 * (not in the still image, nor at quality "diam", nor behind a popup).
 */
export function buildDecor(
  scene: THREE.Scene,
  models: ModelSet,
  onChange: () => void,
  canMove: () => boolean = () => false
): Decor {
  const paints = new Map<string, THREE.MeshStandardMaterial>()
  const glows = new Map<THREE.MeshStandardMaterial, number>()
  const shared = new Set<THREE.Material>()
  let lamps = 1
  const paint = (color: string) => {
    let material = paints.get(color)
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: 0.75 })
      paints.set(color, material)
      shared.add(material)
    }
    return material
  }
  const glow = (color: string, max: number) => {
    const key = `${color}*${max}`
    let material = paints.get(key)
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: max * lamps,
        roughness: 0.4,
      })
      paints.set(key, material)
      glows.set(material, max)
      shared.add(material)
    }
    return material
  }

  const groups = new Map<SlotId, THREE.Group>()
  const shown = new Map<SlotId, string>()
  /** Per slot: when its item appeared (null: at rest) and how it moves. */
  const motions = new Map<
    SlotId,
    { since: number | null; poses: Array<(t: number) => void> }
  >()
  for (const slot of SLOT_IDS) {
    const group = new THREE.Group()
    group.name = `decor-${slot}`
    const { at, turn } = DECOR_SLOTS[slot]
    group.position.set(...at)
    group.rotation.y = turn
    scene.add(group)
    groups.set(slot, group)
  }

  const partFor = (
    root: THREE.Object3D,
    slot: SlotId,
    poses: Array<(t: number) => void>
  ): Part => {
    const mesh = (
      geometry: THREE.BufferGeometry,
      look: string | THREE.Material,
      x: number,
      y: number,
      z: number
    ) => {
      const object = new THREE.Mesh(
        geometry,
        typeof look === "string" ? paint(look) : look
      )
      object.position.set(x, y, z)
      object.castShadow = true
      object.receiveShadow = true
      root.add(object)
      return object
    }
    return {
      root,
      mesh,
      box: (w, h, d, color, x, y, z, r = 0.04) =>
        mesh(
          new RoundedBoxGeometry(
            w,
            h,
            d,
            2,
            Math.min(r, w / 2.01, h / 2.01, d / 2.01)
          ),
          color,
          x,
          y + h / 2,
          z
        ),
      rod: (radius, h, color, x, y, z, top = radius) =>
        mesh(
          new THREE.CylinderGeometry(top, radius, h, 20),
          color,
          x,
          y + h / 2,
          z
        ),
      ball: (radius, color, x, y, z) =>
        mesh(new THREE.SphereGeometry(radius, 20, 14), color, x, y, z),
      disc: (radius, color, x, y, z) => {
        const object = mesh(
          new THREE.CircleGeometry(radius, 40),
          color,
          x,
          y,
          z
        )
        object.rotation.x = -Math.PI / 2
        object.castShadow = false
        return object
      },
      glow: (color, max = 1.4) => glow(color, max),
      add: (object) => {
        object.castShadow = true
        root.add(object)
      },
      child: (x, y, z) => {
        const group = new THREE.Group()
        group.position.set(x, y, z)
        root.add(group)
        return partFor(group, slot, poses)
      },
      model: (key, height, spread = false) => {
        const model = models.get(key)
        if (!model) return false
        root.add(placeModel(model, slot, height, spread))
        return true
      },
      move: (pose) => {
        poses.push(pose)
      },
    }
  }

  let loaded = false
  function update(): boolean {
    const now = performance.now()
    let busy = false
    for (const motion of motions.values()) {
      if (motion.since === null) continue
      if (animating(motion.since, now)) {
        const t = (now - motion.since) / 1000
        for (const pose of motion.poses) pose(t)
        busy = true
      } else {
        for (const pose of motion.poses) pose(0)
        motion.since = null
      }
    }
    return busy
  }

  return {
    set(placed) {
      let changed = false
      for (const slot of SLOT_IDS) {
        const next = placed[slot]
        const build =
          next && Object.hasOwn(DECOR_BUILDERS, next)
            ? DECOR_BUILDERS[next]
            : undefined
        const wanted = build ? next : undefined
        if (shown.get(slot) === wanted) continue
        changed = true
        const group = groups.get(slot)
        if (!group) continue
        clearGroup(group, shared)
        motions.delete(slot)
        if (wanted && build) {
          const poses: Array<(t: number) => void> = []
          build(partFor(group, slot, poses))
          shown.set(slot, wanted)
          // Placed or tried on now: it answers with its motion. There when
          // the lobby loaded: it stays still.
          const moves = poses.length > 0 && loaded && canMove()
          motions.set(slot, {
            since: moves ? performance.now() : null,
            poses,
          })
        } else {
          shown.delete(slot)
        }
      }
      loaded = true
      // A new motion is drawn by the stage's frames, which this starts.
      if (changed) onChange()
    },
    update,
    rest() {
      for (const motion of motions.values()) {
        if (motion.since === null) continue
        for (const pose of motion.poses) pose(0)
        motion.since = null
      }
    },
    setLamps(k) {
      lamps = k
      for (const [material, max] of glows) {
        material.emissiveIntensity = max * k
      }
    },
    dispose() {
      motions.clear()
      for (const group of groups.values()) {
        clearGroup(group, shared)
        group.removeFromParent()
      }
      for (const material of paints.values()) material.dispose()
      paints.clear()
      glows.clear()
    },
  }
}
