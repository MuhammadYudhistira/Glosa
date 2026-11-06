import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { SLOT_IDS, type SlotId } from "@/lib/shop/catalog"
import type { Placements } from "@/lib/shop/types"
import type { Kit } from "./kit"
import { DECOR_SLOTS, KIOSK } from "./layout"

/** What a builder draws with: shapes in the slot's group, in its own paint. */
export type Part = {
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
  glow: (color: string) => THREE.Material
  /** Adds a mesh built by hand; it is freed with the slot, material included. */
  add: (object: THREE.Mesh) => void
}

const WOOD = "#8a5a36"
const DARK = "#3b2a1e"
const BRASS = "#c9a24a"

/** One builder per shop item (spec 3C §4); the ids match the catalogue. */
export const DECOR_BUILDERS: Record<string, (part: Part) => void> = {
  rug_woven: (p) => {
    p.box(5.2, 0.02, 3.4, "#c8a77a", 0, 0, 0, 0.01)
    for (let i = -2; i <= 2; i++)
      p.box(5.0, 0.025, 0.08, "#a07c52", 0, 0, i * 0.6, 0.01)
  },
  rug_round: (p) => {
    p.disc(2.4, "#7c9cb5", 0, 0.01, 0)
    p.disc(1.7, "#e6d3b0", 0, 0.015, 0)
    p.disc(0.9, "#7c9cb5", 0, 0.02, 0)
  },
  rug_pattern: (p) => {
    p.box(5.6, 0.02, 3.8, "#8c2f39", 0, 0, 0, 0.01)
    p.box(4.8, 0.025, 3.0, "#e0b45c", 0, 0, 0, 0.01)
    p.box(4.2, 0.03, 2.4, "#8c2f39", 0, 0, 0, 0.01)
    p.disc(0.8, "#1f4e5f", 0, 0.035, 0)
  },
  lamp_floor: (p) => {
    p.disc(0.25, DARK, 0, 0, 0)
    p.rod(0.03, 1.6, DARK, 0, 0, 0)
    p.rod(0.32, 0.4, "#f3e2c0", 0, 1.55, 0, 0.2).material = p.glow("#ffe2a8")
  },
  lamp_arc: (p) => {
    p.disc(0.3, DARK, 0, 0, 0)
    p.rod(0.03, 2.2, BRASS, 0, 0, 0)
    p.box(1.3, 0.05, 0.05, BRASS, 0.65, 2.15, 0, 0.02)
    p.rod(0.06, 0.25, BRASS, 1.3, 1.95, 0, 0.25)
    p.ball(0.12, "#ffe2a8", 1.3, 1.9, 0).material = p.glow("#ffe2a8")
  },
  lamp_lantern: (p) => {
    p.disc(0.25, DARK, 0, 0, 0)
    p.rod(0.03, 2.4, DARK, 0, 0, 0)
    p.box(0.6, 0.04, 0.04, DARK, 0.3, 2.36, 0, 0.01)
    p.rod(0.01, 0.3, DARK, 0.58, 2.06, 0)
    p.box(0.3, 0.42, 0.3, "#d2462e", 0.58, 1.64, 0, 0.08)
    p.ball(0.1, "#ffd27a", 0.58, 1.85, 0).material = p.glow("#ffc35c")
  },
  seat_beanbag: (p) => {
    p.ball(0.55, "#d98c3f", 0, 0.4, 0).scale.set(1, 0.7, 1)
    p.ball(0.4, "#e39c50", 0, 0.75, -0.25).scale.set(1, 0.8, 0.7)
  },
  seat_armchair: (p) => {
    p.box(1.0, 0.45, 0.9, "#5a7d6a", 0, 0, 0, 0.08)
    p.box(1.0, 0.7, 0.2, "#4d6d5c", 0, 0.45, -0.35, 0.08)
    p.box(0.18, 0.3, 0.9, "#4d6d5c", -0.45, 0.45, 0, 0.06)
    p.box(0.18, 0.3, 0.9, "#4d6d5c", 0.45, 0.45, 0, 0.06)
    p.box(0.8, 0.12, 0.7, "#e8dcc4", 0, 0.45, 0.05, 0.05)
  },
  seat_sofa: (p) => {
    p.box(2.4, 0.45, 0.95, "#3f5d8a", 0, 0, 0, 0.08)
    p.box(2.4, 0.65, 0.22, "#35507a", 0, 0.45, -0.37, 0.08)
    p.box(0.22, 0.3, 0.95, "#35507a", -1.1, 0.45, 0, 0.06)
    p.box(0.22, 0.3, 0.95, "#35507a", 1.1, 0.45, 0, 0.06)
    p.box(0.45, 0.38, 0.14, "#e0b45c", -0.6, 0.48, -0.2, 0.06)
    p.box(0.45, 0.38, 0.14, "#d26f5a", 0.6, 0.48, -0.2, 0.06)
  },
  wall_map: (p) => {
    p.box(3.2, 2.0, 0.06, WOOD, 0, 0, 0, 0.02)
    p.box(3.0, 1.8, 0.07, "#cfe3e8", 0, 0.1, 0.01, 0.01)
    p.box(0.9, 0.7, 0.08, "#9cc58b", -0.8, 0.8, 0.02, 0.1)
    p.box(0.7, 0.9, 0.08, "#9cc58b", 0.3, 0.4, 0.02, 0.1)
    p.box(0.8, 0.5, 0.08, "#9cc58b", 1.0, 1.2, 0.02, 0.1)
  },
  wall_painting: (p) => {
    p.box(2.6, 1.9, 0.08, BRASS, 0, 0, 0, 0.03)
    p.box(2.3, 1.6, 0.09, "#f4c27a", 0, 0.15, 0.01, 0.01)
    p.box(2.3, 0.6, 0.1, "#4f7a3a", 0, 0.15, 0.02, 0.01)
    p.ball(0.25, "#e8743b", 0.6, 1.25, 0.06)
  },
  wall_clock: (p) => {
    p.rod(0.9, 0.1, WOOD, 0, 0.9, 0).rotation.x = Math.PI / 2
    p.rod(0.8, 0.11, "#f6efe0", 0, 0.9, 0.01).rotation.x = Math.PI / 2
    p.box(0.06, 0.55, 0.04, DARK, 0, 1.15, 0.08, 0.01)
    p.box(0.4, 0.06, 0.04, DARK, 0.18, 0.9, 0.08, 0.01)
  },
  pet_cat: (p) => {
    p.disc(0.55, "#b5533c", 0, 0.01, 0)
    p.ball(0.32, "#e3a35b", 0, 0.2, 0).scale.set(1, 0.6, 0.8)
    p.ball(0.16, "#e3a35b", 0.3, 0.28, 0.08)
    p.ball(0.05, "#e3a35b", 0.36, 0.42, 0.03)
    p.ball(0.05, "#e3a35b", 0.36, 0.42, 0.14)
    p.rod(0.04, 0.5, "#d18f48", -0.2, 0.08, 0.28).rotation.z = Math.PI / 2
  },
  pet_bird: (p) => {
    p.rod(0.04, 1.3, BRASS, 0, 0, 0)
    p.disc(0.35, BRASS, 0, 1.3, 0)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      p.rod(0.012, 0.6, BRASS, Math.cos(a) * 0.33, 1.3, Math.sin(a) * 0.33)
    }
    p.ball(0.36, BRASS, 0, 1.9, 0).scale.set(1, 0.3, 1)
    p.ball(0.1, "#4fa3d1", 0, 1.5, 0)
    p.ball(0.05, "#f2c14e", 0.08, 1.56, 0)
  },
  pet_aquarium: (p) => {
    p.box(1.4, 0.7, 0.6, WOOD, 0, 0, 0, 0.04)
    const glass = p.box(1.3, 0.7, 0.5, "#9fd6e8", 0, 0.7, 0, 0.02)
    glass.material = new THREE.MeshStandardMaterial({
      color: "#9fd6e8",
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
    })
    p.box(1.25, 0.08, 0.45, "#e6d3a3", 0, 0.7, 0, 0.01)
    p.ball(0.06, "#f28c38", -0.3, 1.05, 0.05).scale.set(1.6, 1, 0.6)
    p.ball(0.05, "#f2c14e", 0.25, 1.15, -0.05).scale.set(1.6, 1, 0.6)
    p.rod(0.02, 0.35, "#4f7a3a", 0.45, 0.78, 0.1)
  },
  ceiling_lights: (p) => {
    for (let i = 0; i < 14; i++) {
      const t = i / 13
      const x = -5 + t * 10
      const y = -Math.sin(t * Math.PI) * 1.2
      p.ball(0.14, "#ffe2a8", x, y, 0).material = p.glow(
        i % 2 ? "#ffd27a" : "#ffb38a"
      )
    }
  },
  ceiling_books: (p) => {
    const colors = [
      "#c0392b",
      "#2e86ab",
      "#f2c14e",
      "#4f7a3a",
      "#8e5ea2",
      "#e8743b",
    ]
    colors.forEach((color, i) => {
      const a = (i / colors.length) * Math.PI * 2
      const book = p.box(
        0.5,
        0.08,
        0.36,
        color,
        Math.cos(a) * 2,
        Math.sin(i * 1.7) * 0.6,
        Math.sin(a) * 2,
        0.02
      )
      book.rotation.set(0.3, a, Math.sin(i) * 0.5)
    })
  },
  ceiling_globe: (p) => {
    p.rod(0.015, 1.5, DARK, 0, 0, 0)
    p.ball(0.9, "#3d7ea6", 0, -0.9, 0)
    p.box(0.6, 0.4, 0.2, "#9cc58b", 0.55, -0.7, 0.4, 0.1)
    p.box(0.5, 0.5, 0.2, "#9cc58b", -0.4, -1.1, 0.6, 0.1)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.03, 8, 48),
      new THREE.MeshStandardMaterial({
        color: BRASS,
        metalness: 0.6,
        roughness: 0.4,
      })
    )
    ring.position.y = -0.9
    ring.rotation.x = Math.PI / 2.4
    p.add(ring)
  },
}

export type Decor = {
  /** Shows these items; slots that did not change stay as they are. */
  set: (placed: Placements) => void
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
 * The shop's items in the lobby (spec 3C §6.3). Paint of its own, not the
 * kit's shared materials, so changing an item frees what it used (plan 3C,
 * decision 7). onChange asks the stage to draw again.
 */
export function buildDecor(scene: THREE.Scene, onChange: () => void): Decor {
  const paints = new Map<string, THREE.MeshStandardMaterial>()
  const shared = new Set<THREE.Material>()
  const paint = (color: string, glow = false) => {
    const key = `${color}${glow ? "*" : ""}`
    let material = paints.get(key)
    if (!material) {
      material = new THREE.MeshStandardMaterial(
        glow
          ? { color, emissive: color, emissiveIntensity: 1.4, roughness: 0.4 }
          : { color, roughness: 0.75 }
      )
      paints.set(key, material)
      shared.add(material)
    }
    return material
  }

  const groups = new Map<SlotId, THREE.Group>()
  const shown = new Map<SlotId, string>()
  for (const slot of SLOT_IDS) {
    const group = new THREE.Group()
    group.name = `decor-${slot}`
    const { at, turn } = DECOR_SLOTS[slot]
    group.position.set(...at)
    group.rotation.y = turn
    scene.add(group)
    groups.set(slot, group)
  }

  const partFor = (group: THREE.Group): Part => {
    const add = (
      geometry: THREE.BufferGeometry,
      color: string,
      x: number,
      y: number,
      z: number
    ) => {
      const mesh = new THREE.Mesh(geometry, paint(color))
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
      return mesh
    }
    return {
      box: (w, h, d, color, x, y, z, r = 0.04) =>
        add(
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
        add(
          new THREE.CylinderGeometry(top, radius, h, 16),
          color,
          x,
          y + h / 2,
          z
        ),
      ball: (radius, color, x, y, z) =>
        add(new THREE.SphereGeometry(radius, 16, 12), color, x, y, z),
      disc: (radius, color, x, y, z) => {
        const mesh = add(new THREE.CircleGeometry(radius, 32), color, x, y, z)
        mesh.rotation.x = -Math.PI / 2
        return mesh
      },
      glow: (color) => paint(color, true),
      add: (object) => {
        object.castShadow = true
        group.add(object)
      },
    }
  }

  return {
    set(placed) {
      let changed = false
      for (const slot of SLOT_IDS) {
        const next = placed[slot]
        const build = next ? DECOR_BUILDERS[next] : undefined
        const wanted = build ? next : undefined
        if (shown.get(slot) === wanted) continue
        changed = true
        const group = groups.get(slot)
        if (!group) continue
        clearGroup(group, shared)
        if (wanted && build) {
          build(partFor(group))
          shown.set(slot, wanted)
        } else {
          shown.delete(slot)
        }
      }
      if (changed) onChange()
    },
    dispose() {
      for (const group of groups.values()) {
        clearGroup(group, shared)
        group.removeFromParent()
      }
      for (const material of paints.values()) material.dispose()
      paints.clear()
    },
  }
}

/** The shop's kiosk (spec 3C §6.2): a small stall with an awning and a coin. */
export function buildKiosk(kit: Kit): void {
  const [x, z] = KIOSK
  kit.block(1.4, 1.0, 0.7, "#8a5a36", x, 0, z, { r: 0.05 })
  kit.block(1.5, 0.06, 0.8, "#c9a24a", x, 1.0, z, { r: 0.02 })
  kit.block(0.06, 1.2, 0.06, "#3b2a1e", x - 0.68, 1.06, z + 0.32)
  kit.block(0.06, 1.2, 0.06, "#3b2a1e", x + 0.68, 1.06, z + 0.32)
  kit.block(1.7, 0.12, 0.9, "#d2462e", x, 2.26, z + 0.05, { r: 0.04 })
  kit.mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.05, 24),
    kit.mat("#f2c14e", { metalness: 0.6, roughness: 0.3 }),
    x,
    1.3,
    z,
    {}
  ).rotation.x = Math.PI / 2
}
