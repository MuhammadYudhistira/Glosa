import * as THREE from "three"
import type { Kit } from "./kit"
import { ATRIUM, GLASS } from "./layout"

const { size: SIZE, height: HEIGHT } = ATRIUM
const GLASS_WIDTH = GLASS.x1 - GLASS.x0
const GLASS_HEIGHT = GLASS.y1 - GLASS.y0
const GLASS_CENTER = [
  (GLASS.x0 + GLASS.x1) / 2,
  (GLASS.y0 + GLASS.y1) / 2,
] as const
/**
 * The camera looks down, so through real glass it would only see the street.
 * The skyline is painted on a backdrop just behind the glass instead (a
 * diorama), and drawn only where the glass mask marked the stencil buffer.
 */
const SKY = { x0: GLASS.x0 - 4, x1: SIZE + 2, y0: -4, y1: HEIGHT + 1, z: -2.2 }
const OUTSIDE = {
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.EqualStencilFunc,
  stencilZPass: THREE.KeepStencilOp,
} satisfies THREE.MaterialParameters

export type Skyline = {
  clouds: Array<{ group: THREE.Group; speed: number }>
  birds: Array<{
    group: THREE.Group
    left: THREE.Mesh
    right: THREE.Mesh
    speed: number
    phase: number
  }>
  beacons: Array<{ mesh: THREE.Mesh; phase: number }>
}

function glassMask(kit: Kit) {
  const mask = new THREE.Mesh(
    new THREE.PlaneGeometry(GLASS_WIDTH, GLASS_HEIGHT),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
    })
  )
  mask.position.set(GLASS_CENTER[0], GLASS_CENTER[1], -0.05)
  mask.renderOrder = -1
  kit.scene.add(mask)
}

/** The painted city at dusk. Returns its blinking tower-top beacons. */
function backdrop(kit: Kit): Skyline["beacons"] {
  const tops: Array<readonly [number, number]> = []
  const texture = kit.canvasTexture(2048, 2048, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, "#2b3a67")
    sky.addColorStop(0.45, "#6c5b9e")
    sky.addColorStop(0.72, "#e7909a")
    sky.addColorStop(0.88, "#ffc58a")
    g.fillStyle = sky
    g.fillRect(0, 0, w, h)
    const layer = (
      minHeight: number,
      maxHeight: number,
      base: number,
      color: string,
      lit: boolean
    ) => {
      let x = -20
      while (x < w) {
        const width = 60 + kit.rand() * 120
        const height = minHeight + kit.rand() * (maxHeight - minHeight)
        const top = base - height
        g.fillStyle = color
        g.fillRect(x, top, width, h - top)
        if (kit.rand() < 0.3) {
          g.fillRect(x + width * 0.4, top - 40, width * 0.2, 40)
        }
        if (lit) {
          for (let wy = top + 12; wy < h - 10; wy += 22) {
            for (let wx = x + 8; wx < x + width - 10; wx += 16) {
              if (kit.rand() < 0.38) {
                g.fillStyle =
                  kit.rand() < 0.8
                    ? "rgba(255,214,150,.85)"
                    : "rgba(180,220,255,.8)"
                g.fillRect(wx, wy, 8, 11)
              }
            }
          }
          if (height > maxHeight * 0.75) {
            tops.push([x + width / 2, top - (kit.rand() < 0.3 ? 40 : 0)])
          }
        }
        x += width + 6 + kit.rand() * 30
      }
    }
    layer(500, 900, h * 0.92, "#5d4f7d", false)
    layer(700, 1300, h * 0.95, "#3c3557", true)
    layer(400, 1000, h, "#272338", true)
  })
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(SKY.x1 - SKY.x0, SKY.y1 - SKY.y0),
    new THREE.MeshBasicMaterial({ map: texture, ...OUTSIDE })
  )
  plane.position.set((SKY.x0 + SKY.x1) / 2, (SKY.y0 + SKY.y1) / 2, SKY.z)
  kit.scene.add(plane)

  const red = new THREE.MeshBasicMaterial({ color: "#ff3b3b", ...OUTSIDE })
  return tops.slice(0, 7).map(([px, py], i) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), red)
    mesh.position.set(
      SKY.x0 + (px / 2048) * (SKY.x1 - SKY.x0),
      SKY.y1 - (py / 2048) * (SKY.y1 - SKY.y0),
      SKY.z + 0.05
    )
    kit.scene.add(mesh)
    return { mesh, phase: i * 0.37 }
  })
}

function clouds(kit: Kit): Skyline["clouds"] {
  const material = new THREE.MeshStandardMaterial({
    color: "#fff4f0",
    emissive: "#ffd9d0",
    emissiveIntensity: 0.55,
    roughness: 1,
    ...OUTSIDE,
  })
  const puffs = [
    [0, 0, 0.7],
    [0.8, -0.1, 0.5],
    [-0.8, -0.12, 0.5],
    [0.3, 0.38, 0.5],
  ] as const
  return Array.from({ length: 5 }, (_, i) => {
    const group = new THREE.Group()
    for (const [dx, dy, radius] of puffs) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 18, 12),
        material
      )
      puff.position.set(dx, dy, 0)
      group.add(puff)
    }
    group.scale.set(1 + (i % 3) * 0.4, 0.55, 0.2)
    group.position.set(GLASS.x0 + i * 3.5, 8.5 + (i % 3) * 1.4, -1.6)
    kit.scene.add(group)
    return { group, speed: 0.25 + (i % 3) * 0.08 }
  })
}

function birds(kit: Kit): Skyline["birds"] {
  const material = new THREE.MeshBasicMaterial({
    color: "#2a2433",
    side: THREE.DoubleSide,
    ...OUTSIDE,
  })
  const wing = new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 0.34, 0, 0, 0.17, 0.08, 0], 3)
  )
  return Array.from({ length: 4 }, (_, i) => {
    const group = new THREE.Group()
    const left = new THREE.Mesh(wing, material)
    const right = new THREE.Mesh(wing, material)
    right.rotation.y = Math.PI
    group.add(left, right)
    group.position.set(SIZE - i * 0.7, 9.5 + (i % 2) * 0.4 - i * 0.2, -0.9)
    kit.scene.add(group)
    return { group, left, right, speed: 1.1 + i * 0.1, phase: i * 1.3 }
  })
}

/** Mullions, transoms and a faint pane. */
function frame(kit: Kit) {
  for (let x = GLASS.x0; x <= GLASS.x1 + 0.01; x += 2.6) {
    kit.block(
      0.14,
      HEIGHT,
      0.22,
      "#d8d2c8",
      Math.min(x, GLASS.x1 - 0.07),
      0,
      -0.05
    )
  }
  for (const y of [0, 4.5, 9, HEIGHT - 0.25]) {
    kit.block(GLASS_WIDTH, 0.22, 0.24, "#d8d2c8", GLASS_CENTER[0], y, -0.05)
  }
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(GLASS_WIDTH, GLASS_HEIGHT),
    new THREE.MeshBasicMaterial({
      color: "#bcd6ff",
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    })
  )
  pane.position.set(GLASS_CENTER[0], GLASS_CENTER[1], 0.02)
  kit.scene.add(pane)
}

/** The glass curtain wall and the city behind it (spec 1D §2, decision 4). */
export function buildSkyline(kit: Kit): Skyline {
  glassMask(kit)
  const beacons = backdrop(kit)
  const skyline: Skyline = { clouds: clouds(kit), birds: birds(kit), beacons }
  frame(kit)
  return skyline
}
