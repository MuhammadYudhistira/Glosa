import * as THREE from "three"
import type { Seat } from "./furniture"
import type { Kit } from "./kit"
import {
  LIBRARIAN,
  type Point2,
  type Point3,
  READERS,
  WALKER_ROUTES,
} from "./layout"

const SKIN = ["#e8b48e", "#c68e63", "#8a5a3c", "#f0c8a0"]
const HAIR = ["#2b1d16", "#1d1d1d", "#6b4a2b", "#d8d4cf", "#a8742f"]
const SHIRT = [
  "#f2f0ea",
  "#2f3e46",
  "#ee6c4d",
  "#98c1d9",
  "#7a9e7e",
  "#b56576",
  "#e0c068",
  "#3d5a80",
  "#1f1f24",
]
const PANTS = ["#2b2420", "#3d5a80", "#4a4a4a", "#d9cdb8"]

export type Figure = {
  root: THREE.Group
  legs: Array<{ hip: THREE.Group; knee: THREE.Group }>
  arms: Array<THREE.Group>
  head: THREE.Group
}
/** A seated visitor whose head moves; `phase` keeps them out of step. */
export type Sitter = Figure & { phase: number }
export type People = {
  sitters: Array<Sitter>
  librarian: Figure
  walkers: Array<Figure>
  anda: Figure
  /** The mint ring on the floor around "Anda". */
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
}

type Look = {
  shirt?: string
  pants?: string
  skin?: string
  hair?: string
  seated?: boolean
}

/** A jointed figure from simple shapes: hips, knees, shoulders, head (spec 1D §2, decision 8). */
function person(kit: Kit, look: Look = {}): Figure {
  const shirt = look.shirt ?? kit.pick(SHIRT)
  const pants = look.pants ?? kit.pick(PANTS)
  const skin = look.skin ?? kit.pick(SKIN)
  const hair = look.hair ?? kit.pick(HAIR)
  const capsule = (radius: number, length: number) =>
    new THREE.CapsuleGeometry(radius, length, 5, 10)
  const root = new THREE.Group()
  const hipY = look.seated ? 0 : 0.86

  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group()
    hip.position.set(side * 0.09, hipY, 0)
    root.add(hip)
    kit.mesh(capsule(0.075, 0.32), pants, 0, -0.22, 0, { parent: hip })
    const knee = new THREE.Group()
    knee.position.set(0, -0.42, 0)
    hip.add(knee)
    kit.mesh(capsule(0.065, 0.3), pants, 0, -0.2, 0, { parent: knee })
    kit.block(0.11, 0.07, 0.2, "#2b1d16", 0, -0.42, 0.04, {
      parent: knee,
      r: 0.03,
    })
    return { hip, knee }
  })
  kit.mesh(capsule(0.19, 0.3), shirt, 0, hipY + 0.32, 0, { parent: root })
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.25, hipY + 0.5, 0)
    root.add(shoulder)
    kit.mesh(capsule(0.06, 0.4), shirt, 0, -0.25, 0, { parent: shoulder })
    kit.mesh(new THREE.SphereGeometry(0.065, 10, 8), skin, 0, -0.5, 0, {
      parent: shoulder,
    })
    return shoulder
  })
  const head = new THREE.Group()
  head.position.y = hipY + 0.8
  root.add(head)
  kit.mesh(new THREE.SphereGeometry(0.16, 20, 16), skin, 0, 0, 0, {
    parent: head,
  })
  const cap = kit.mesh(
    new THREE.SphereGeometry(0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    hair,
    0,
    0.01,
    -0.01,
    { parent: head }
  )
  cap.rotation.x = -0.25
  if (look.seated) {
    for (const { hip, knee } of legs) {
      hip.rotation.x = -Math.PI / 2
      knee.rotation.x = Math.PI / 2
    }
  }
  kit.scene.add(root)
  return { root, legs, arms, head }
}

/** Someone sitting on a chair or a sofa. */
function seated(kit: Kit, { at: [x, z], facing }: Seat, arms: number): Figure {
  const figure = person(kit, { seated: true })
  figure.root.position.set(x, 0.48, z)
  figure.root.rotation.y = facing
  for (const arm of figure.arms) arm.rotation.x = arms
  return figure
}

/** Everyone in the lobby. motion.ts places the walkers. */
export function buildPeople(
  kit: Kit,
  seats: { stairs: ReadonlyArray<Point3>; lounges: ReadonlyArray<Seat> },
  anda: Point2
): People {
  // Up to 12 people on the stairs, some reading or on their phone.
  const sitters: Array<Sitter> = seats.stairs
    .slice(0, 12)
    .map(([x, y, z], i) => {
      const figure = person(kit, { seated: true })
      figure.root.position.set(x, y + 0.02, z)
      for (const arm of figure.arms) arm.rotation.x = -0.9 - (i % 3) * 0.2
      return { ...figure, phase: i * 0.9 }
    })
  for (const reader of READERS) seated(kit, reader, -1.1)
  for (const lounger of seats.lounges) {
    sitters.push({ ...seated(kit, lounger, -0.8), phase: lounger.at[0] })
  }
  const librarian = person(kit, {
    shirt: "#f2f0ea",
    hair: "#d8d4cf",
    seated: true,
  })
  librarian.root.position.set(LIBRARIAN[0], 0.5, LIBRARIAN[1])
  const walkers = WALKER_ROUTES.map(() => person(kit))

  const member = person(kit, {
    shirt: "#1fa58a",
    hair: "#2b1d16",
    skin: "#c68e63",
  })
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.52, 40),
    new THREE.MeshBasicMaterial({
      color: "#4fd8ff",
      transparent: true,
      opacity: 0.9,
    })
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.02
  member.root.add(ring)
  member.root.position.set(anda[0], 0, anda[1])
  return { sitters, librarian, walkers, anda: member, ring }
}
