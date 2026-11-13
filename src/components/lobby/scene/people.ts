import * as THREE from "three"
import type { Kit } from "./kit"
import type { Point2 } from "./layout"

/** Anda's warm palette, in the rounded style of the room's models. */
const LOOK = {
  skin: "#e2a982",
  cheek: "#e98f7a",
  hair: "#4a2e1f",
  sweater: "#d9774b",
  collar: "#f2e3c6",
  trousers: "#5b4636",
  shoes: "#2e2019",
  eyes: "#2a1a12",
} as const

export type Figure = {
  root: THREE.Group
  /** Everything but the ring: it bobs and sways while walking. */
  body: THREE.Group
  legs: Array<{ hip: THREE.Group; knee: THREE.Group }>
  arms: Array<THREE.Group>
  head: THREE.Group
}
export type People = {
  anda: Figure
  /** The mint ring on the floor around "Anda". */
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
}

const capsule = (radius: number, length: number) =>
  new THREE.CapsuleGeometry(radius, length, 6, 14)
const ball = (radius: number) => new THREE.SphereGeometry(radius, 22, 16)

/**
 * "Anda" in the room's rounded style: a round head, a capsule body, short
 * jointed legs and arms (hips, knees, shoulders) for the walk, about 1.55 m
 * tall, facing +Z.
 */
function anda(kit: Kit): Figure {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  const hipY = 0.62

  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group()
    hip.position.set(side * 0.1, hipY, 0)
    body.add(hip)
    kit.mesh(capsule(0.078, 0.2), LOOK.trousers, 0, -0.16, 0, { parent: hip })
    const knee = new THREE.Group()
    knee.position.set(0, -0.32, 0)
    hip.add(knee)
    kit.mesh(capsule(0.07, 0.16), LOOK.trousers, 0, -0.12, 0, {
      parent: knee,
    })
    kit.block(0.13, 0.08, 0.21, LOOK.shoes, 0, -0.3, 0.035, {
      parent: knee,
      r: 0.035,
    })
    return { hip, knee }
  })

  // A round body in a chunky sweater, with a pale collar.
  kit.mesh(capsule(0.22, 0.26), LOOK.sweater, 0, hipY + 0.28, 0, {
    parent: body,
  })
  kit.mesh(
    new THREE.TorusGeometry(0.11, 0.035, 10, 24).rotateX(Math.PI / 2),
    LOOK.collar,
    0,
    hipY + 0.6,
    0,
    { parent: body }
  )

  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.25, hipY + 0.47, 0)
    body.add(shoulder)
    kit.mesh(capsule(0.062, 0.24), LOOK.sweater, 0, -0.17, 0, {
      parent: shoulder,
    })
    kit.mesh(ball(0.06), LOOK.skin, 0, -0.35, 0, { parent: shoulder })
    return shoulder
  })

  const head = new THREE.Group()
  head.position.y = hipY + 0.8
  body.add(head)
  kit.mesh(ball(0.2), LOOK.skin, 0, 0, 0, { parent: head })
  // Hair: a cap over the crown and the back of the head.
  const cap = kit.mesh(
    new THREE.SphereGeometry(0.212, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    LOOK.hair,
    0,
    0.012,
    -0.012,
    { parent: head }
  )
  cap.rotation.x = -0.32
  // Eyes and cheeks, so it is clear which way Anda faces.
  for (const side of [-1, 1]) {
    kit.mesh(ball(0.022), LOOK.eyes, side * 0.072, 0.0, 0.186, {
      parent: head,
      cast: false,
    })
    const cheek = kit.mesh(ball(0.03), LOOK.cheek, side * 0.115, -0.05, 0.155, {
      parent: head,
      cast: false,
    })
    cheek.scale.z = 0.4
  }
  kit.scene.add(root)
  return { root, body, legs, arms, head }
}

/** "Anda", the only person in the study (spec 3F §2, decision 5). */
export function buildPeople(kit: Kit, at: Point2): People {
  const member = anda(kit)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.52, 40),
    new THREE.MeshBasicMaterial({
      color: "#4fd8ff",
      transparent: true,
      opacity: 0.8,
    })
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.02
  member.root.add(ring)
  member.root.position.set(at[0], 0, at[1])
  return { anda: member, ring }
}
