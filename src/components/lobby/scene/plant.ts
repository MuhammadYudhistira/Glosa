import * as THREE from "three"
import type { PlantStage } from "@/lib/reading-habit"
import type { Kit } from "./kit"
import { PLANT, PLANT_POT, PLANT_SHAPES } from "./layout"

const POT = "#b4643c"
const SOIL = "#3b2618"
/** The plant is drawn small and scaled up, so it reads from the camera. */
const SCALE = 2.6

export type Plant = {
  /** Shows the stage; the same stage again does nothing. */
  set: (stage: PlantStage) => void
  dispose: () => void
}

/**
 * The habit plant (spec 3B §4.1): a pot with what the streak grew. It never
 * wilts; a new stage replaces the old one at once (plan 3B, decision 6).
 * onChange asks the stage to draw again.
 */
export function buildPlant(kit: Kit, onChange: () => void): Plant {
  const [x, z] = PLANT
  kit.block(PLANT_POT.width, PLANT_POT.height, PLANT_POT.width, POT, x, 0, z, {
    r: 0.06,
  })
  kit.block(
    PLANT_POT.width - 0.1,
    0.03,
    PLANT_POT.width - 0.1,
    SOIL,
    x,
    PLANT_POT.height,
    z,
    { r: 0.01, cast: false }
  )

  const group = new THREE.Group()
  group.position.set(x, PLANT_POT.height + 0.03, z)
  group.scale.setScalar(SCALE)
  kit.scene.add(group)

  const round = new THREE.SphereGeometry(1, 12, 8)
  const stem = new THREE.CylinderGeometry(0.018, 0.026, 1, 8)
  const paint = {
    seed: new THREE.MeshStandardMaterial({ color: "#7a5230", roughness: 0.9 }),
    stem: new THREE.MeshStandardMaterial({ color: "#4f7a3a", roughness: 0.8 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#5fa04a", roughness: 0.7 }),
    bud: new THREE.MeshStandardMaterial({ color: "#e58fa8", roughness: 0.6 }),
    petal: new THREE.MeshStandardMaterial({ color: "#f6d4e0", roughness: 0.6 }),
    heart: new THREE.MeshStandardMaterial({ color: "#f2c14e", roughness: 0.5 }),
  }
  let shown: PlantStage | null = null

  const blob = (
    material: THREE.Material,
    size: readonly [number, number, number],
    at: readonly [number, number, number],
    turn = 0
  ) => {
    const mesh = new THREE.Mesh(round, material)
    mesh.scale.set(...size)
    mesh.position.set(...at)
    mesh.rotation.y = turn
    mesh.castShadow = true
    group.add(mesh)
  }

  return {
    set(stage) {
      if (stage === shown) return
      shown = stage
      group.clear()
      const shape = PLANT_SHAPES[stage]
      if (shape.stem === 0) {
        blob(paint.seed, [0.05, 0.03, 0.05], [0, 0.01, 0])
        onChange()
        return
      }
      const stalk = new THREE.Mesh(stem, paint.stem)
      stalk.scale.set(1, shape.stem, 1)
      stalk.position.y = shape.stem / 2
      stalk.castShadow = true
      group.add(stalk)
      for (let i = 0; i < shape.leaves; i++) {
        const height = (shape.stem * (i + 1)) / (shape.leaves + 1)
        const angle = i * 2.4
        blob(
          paint.leaf,
          [0.09, 0.022, 0.05],
          [Math.cos(angle) * 0.08, height, Math.sin(angle) * 0.08],
          -angle
        )
      }
      for (let i = 0; i < shape.buds; i++) {
        const angle = (i / shape.buds) * Math.PI * 2
        blob(
          paint.bud,
          [0.03, 0.045, 0.03],
          [Math.cos(angle) * 0.05, shape.stem + 0.02, Math.sin(angle) * 0.05]
        )
      }
      for (let i = 0; i < shape.flowers; i++) {
        const angle = (i / shape.flowers) * Math.PI * 2
        const fx = Math.cos(angle) * 0.08
        const fz = Math.sin(angle) * 0.08
        const fy = shape.stem - 0.03 * i
        blob(paint.heart, [0.022, 0.018, 0.022], [fx, fy, fz])
        for (let petal = 0; petal < 5; petal++) {
          const around = (petal / 5) * Math.PI * 2
          blob(
            paint.petal,
            [0.03, 0.01, 0.018],
            [fx + Math.cos(around) * 0.035, fy, fz + Math.sin(around) * 0.035],
            -around
          )
        }
      }
      onChange()
    },
    dispose() {
      group.clear()
      group.removeFromParent()
      round.dispose()
      stem.dispose()
      for (const material of Object.values(paint)) material.dispose()
    },
  }
}
