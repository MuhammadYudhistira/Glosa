import * as THREE from "three"
import type { Kit } from "./kit"

/** The small things Anda holds for an activity (spec 3F §4A.1). */
export type Held = "buku" | "kaleng" | "katalog"

const PAPER = "#f6efe0"
const COVER = "#c0623a"
const CAN = "#7fb9a6"
const CATALOGUE = "#3f5d8a"

/**
 * In the hand's frame, which the pose keeps level (applyPose): +Z is ahead
 * of Anda, +Y up. Things lean back toward Anda's eyes, as held to be read.
 * Sizes follow Anda's chunky build (a 0.4 m head), not real life, so they
 * read from the camera's distance.
 */
const READ_TILT = -0.75

/** A book, closed or open, held up to be read. */
function book(kit: Kit): THREE.Object3D {
  const group = new THREE.Group()
  const tilt = new THREE.Group()
  tilt.rotation.x = READ_TILT
  tilt.position.set(-0.08, 0.02, 0.07)
  group.add(tilt)
  kit.block(0.2, 0.035, 0.15, COVER, 0, -0.018, 0, { parent: tilt, r: 0.01 })
  kit.block(0.18, 0.008, 0.13, PAPER, 0, 0.017, 0, { parent: tilt, r: 0.003 })
  return group
}

/** A round watering can with a slanted spout and a handle on top, tipped to pour. */
function wateringCan(kit: Kit): THREE.Object3D {
  const group = new THREE.Group()
  const can = new THREE.Group()
  // Hung from the handle, the spout ahead and dipping.
  can.position.set(0, -0.14, 0.03)
  can.rotation.x = 0.45
  group.add(can)
  const paint = kit.mat(CAN, { roughness: 0.45, metalness: 0.2 })
  kit.mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.13, 20), paint, 0, 0, 0, {
    parent: can,
  })
  const spout = kit.mesh(
    new THREE.CylinderGeometry(0.012, 0.02, 0.2, 10),
    paint,
    0,
    0.03,
    0.14,
    { parent: can }
  )
  spout.rotation.x = 0.95
  const handle = kit.mesh(
    new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI),
    paint,
    0,
    0.065,
    0,
    { parent: can }
  )
  handle.rotation.y = Math.PI / 2
  return group
}

/** The shop's catalogue, held open with both hands: two pages in a shallow V. */
function catalogue(kit: Kit): THREE.Object3D {
  const group = new THREE.Group()
  const tilt = new THREE.Group()
  tilt.rotation.x = READ_TILT
  tilt.position.set(-0.14, 0.03, 0.08)
  group.add(tilt)
  for (const side of [-1, 1]) {
    const page = new THREE.Group()
    page.rotation.z = side * -0.18
    tilt.add(page)
    kit.block(0.14, 0.012, 0.2, CATALOGUE, side * 0.07, -0.006, 0, {
      parent: page,
      r: 0.005,
    })
    kit.block(0.13, 0.005, 0.185, PAPER, side * 0.07, 0.006, 0, {
      parent: page,
      r: 0.002,
    })
  }
  return group
}

/** The activities' small things, hidden; the caller hangs them in Anda's hand. */
export function buildHeld(kit: Kit): Record<Held, THREE.Object3D> {
  const held: Record<Held, THREE.Object3D> = {
    buku: book(kit),
    kaleng: wateringCan(kit),
    katalog: catalogue(kit),
  }
  for (const thing of Object.values(held)) thing.visible = false
  return held
}
