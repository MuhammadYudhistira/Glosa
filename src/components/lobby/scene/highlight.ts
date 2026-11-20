import * as THREE from "three"
import type { HotspotId } from "./layout"
import {
  RING_INNER,
  RING_OUTER,
  RING_SPOTS,
  RING_STRONG_SCALE,
} from "./ring-spots"

/** The accent colour (styles.css: --color-mint). */
const RING_COLOR = new THREE.Color("#2fe0b8")
/** Just above the floor, so the ring never fights the floor's own surface. */
const RING_Y = 0.03
/** Every usable place's ring: thin, still, quiet (spec 3G §3.4). */
const DIM_OPACITY = 0.4
const STRONG_OPACITY = 1

/** Rings of the band in the scene's horizontal plane; radial loops: inner edge, middle, outer edge. */
const SEGMENTS = 48

/**
 * A flat ring facing up, soft at both edges: the vertex alpha is 0 on the
 * inner and the outer loop and 1 on the middle one, so the band fades out
 * without a texture (no canvas needed, cheap on phones).
 */
export function ringGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.RingGeometry(RING_INNER, RING_OUTER, SEGMENTS, 2)
  // RingGeometry stands in the XY plane facing +Z: lay it on the floor.
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.getAttribute("position")
  const middle = (RING_INNER + RING_OUTER) / 2
  const half = (RING_OUTER - RING_INNER) / 2
  const colours = new Float32Array(position.count * 4)
  for (let i = 0; i < position.count; i++) {
    const radius = Math.hypot(position.getX(i), position.getZ(i))
    const alpha = Math.max(0, 1 - Math.abs(radius - middle) / half)
    colours.set([RING_COLOR.r, RING_COLOR.g, RING_COLOR.b, alpha], i * 4)
  }
  // Four components: three.js reads the fourth as per-vertex alpha.
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 4))
  return geometry
}

const ringMaterial = (opacity: number) =>
  new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    // Draw over the floor's own surface, under nothing that stands on it.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })

export type Highlight = {
  /** Brightens one place's ring (null: none); true when that changed anything. */
  set: (id: HotspotId | null) => boolean
  current: () => HotspotId | null
  dispose: () => void
}

/**
 * The glow rings on the floor (spec 3G §3.4): a dim ring in front of every
 * usable place, always there and never animated, and a brighter, slightly
 * wider one for the place that is picked or hovered. Two draw calls in all:
 * one instanced mesh for the dim rings and one mesh for the bright ring, both
 * sharing one geometry; no post-processing pass. Built in the "normal" mode
 * only; the still image has dots instead.
 */
export function buildHighlight(scene: THREE.Scene): Highlight {
  const geometry = ringGeometry()
  const dimMaterial = ringMaterial(DIM_OPACITY)
  const strongMaterial = ringMaterial(STRONG_OPACITY)

  const dim = new THREE.InstancedMesh(geometry, dimMaterial, RING_SPOTS.length)
  dim.name = "place-rings"
  dim.renderOrder = 10
  dim.frustumCulled = false
  const matrix = new THREE.Matrix4()
  RING_SPOTS.forEach(({ at }, i) => {
    dim.setMatrixAt(i, matrix.makeTranslation(at[0], RING_Y, at[1]))
  })
  dim.instanceMatrix.needsUpdate = true

  const strong = new THREE.Mesh(geometry, strongMaterial)
  strong.name = "place-ring-strong"
  strong.renderOrder = 11
  strong.frustumCulled = false
  strong.visible = false
  strong.scale.setScalar(RING_STRONG_SCALE)

  scene.add(dim, strong)

  const spots = new Map(RING_SPOTS.map(({ id, at }) => [id, at] as const))
  let lit: HotspotId | null = null
  return {
    set(id) {
      if (id === lit) return false
      lit = id
      const at = id ? spots.get(id) : undefined
      if (at) strong.position.set(at[0], RING_Y + 0.005, at[1])
      strong.visible = at !== undefined
      return true
    },
    current: () => lit,
    dispose() {
      scene.remove(dim, strong)
      dim.dispose()
      geometry.dispose()
      dimMaterial.dispose()
      strongMaterial.dispose()
    },
  }
}
