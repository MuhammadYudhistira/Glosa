import * as THREE from "three"
import {
  BUILDERS,
  type Build,
  DETAILS,
  type Glow,
  fallback,
} from "./furniture-builders"
import { type Kit, mergeStatic } from "./kit"
import { FURNITURE, type Point3 } from "./layout"
import type { ModelKey } from "./model-manifest"
import { fitTo, type ModelSet } from "./models"

export type { Glow } from "./furniture-builders"
export type Furnishings = {
  /** The reading lamp and the desk lamp; empty without point lights. */
  lamps: Array<THREE.PointLight>
  /** The fireplace's light (intensity 0 without point lights). */
  fire: THREE.PointLight
  emissives: Array<Glow>
}

/**
 * Turns before fitting: the notebook lies on its back, a cushion leans back
 * against the armchair at the slope of its backrest.
 */
const PRE_TURN: Partial<Record<ModelKey, (object: THREE.Object3D) => void>> = {
  notebook: (object) => {
    object.rotation.z = Math.PI / 2
  },
  cushion: (object) => {
    object.rotation.x = Math.PI / 3
  },
}

/**
 * A model scaled to the piece's height (fitTo), then stretched on X and Z
 * to its exact footprint: the layout is the source of truth (plan 3F-R1,
 * decision 4); sizes there follow each model's proportions, so the stretch
 * is slight.
 */
function placeModel(
  model: THREE.Object3D,
  key: ModelKey,
  size: Point3
): THREE.Group {
  const turned = new THREE.Group()
  turned.add(model)
  PRE_TURN[key]?.(model)
  const inner = new THREE.Group()
  inner.add(turned)
  fitTo(inner, size[1])
  const box = new THREE.Box3().setFromObject(inner)
  const extent = box.getSize(new THREE.Vector3())
  if (extent.x > 0) inner.scale.x *= size[0] / extent.x
  if (extent.z > 0) inner.scale.z *= size[2] / extent.z
  fitTo(inner, size[1])
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  return inner
}

/**
 * The base furniture (spec 3F §3.1): each piece from its model or its code
 * builder, at its layout size and turn. Point lights only with `withLights`
 * (quality "tinggi").
 */
export function buildFurniture(
  kit: Kit,
  models: ModelSet,
  withLights: boolean
): Furnishings {
  const lamps: Array<THREE.PointLight> = []
  const fire = new THREE.PointLight("#ff9a4a", 0, 9, 1)
  const emissives: Array<Glow> = []
  const glows = new Map<string, THREE.MeshStandardMaterial>()

  for (const piece of FURNITURE) {
    const holder = new THREE.Group()
    holder.name = piece.id
    holder.position.set(piece.at[0], piece.y ?? 0, piece.at[1])
    holder.rotation.y = piece.turn
    kit.scene.add(holder)
    const build: Build = {
      kit,
      group: holder,
      size: piece.size,
      glow(color, max, kind) {
        const key = `${color}:${max}:${kind}`
        let material = glows.get(key)
        if (!material) {
          material = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0,
            roughness: 0.5,
          })
          glows.set(key, material)
          emissives.push({ material, max, kind })
        }
        return material
      },
      light(color, [x, y, z], kind) {
        if (kind === "fire") {
          fire.position.set(x, y, z)
          holder.add(fire)
          return
        }
        if (!withLights) return
        const lamp = new THREE.PointLight(color, 0, 7, 1)
        lamp.position.set(x, y, z)
        holder.add(lamp)
        lamps.push(lamp)
      },
    }
    const model = models.get(piece.model)
    if (model) {
      holder.add(placeModel(model, piece.model, piece.size))
    } else {
      ;(BUILDERS[piece.model] ?? fallback)(build)
      mergeStatic(holder)
    }
    DETAILS[piece.model]?.(build)
  }
  if (!withLights) fire.removeFromParent()
  return { lamps, fire, emissives }
}
