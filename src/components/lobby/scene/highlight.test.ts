import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { buildHighlight, ringGeometry } from "./highlight"
import { HOTSPOT_SPOTS } from "./layout"
import {
  RING_INNER,
  RING_OUTER,
  RING_SPOTS,
  RING_STRONG_SCALE,
  ringOf,
} from "./ring-spots"

const FLOOR = 0.05

function rings(scene: THREE.Scene) {
  return {
    dim: scene.getObjectByName("place-rings") as THREE.InstancedMesh,
    strong: scene.getObjectByName("place-ring-strong") as THREE.Mesh,
  }
}

describe("ringGeometry", () => {
  const geometry = ringGeometry()
  const position = geometry.getAttribute("position")
  const colour = geometry.getAttribute("color")

  it("lies flat on the floor, facing up", () => {
    for (let i = 0; i < position.count; i++) {
      expect(position.getY(i)).toBeCloseTo(0)
    }
    const normal = geometry.getAttribute("normal")
    expect(normal.getY(0)).toBeCloseTo(1)
  })

  it("spans the ring's band, no further", () => {
    const radii = Array.from({ length: position.count }, (_, i) =>
      Math.hypot(position.getX(i), position.getZ(i))
    )
    expect(Math.min(...radii)).toBeCloseTo(RING_INNER)
    expect(Math.max(...radii)).toBeCloseTo(RING_OUTER)
  })

  it("is soft: clear at both edges, full in the middle (alpha per vertex)", () => {
    expect(colour.itemSize).toBe(4)
    const middle = (RING_INNER + RING_OUTER) / 2
    let faded = 0
    let full = 0
    for (let i = 0; i < position.count; i++) {
      const radius = Math.hypot(position.getX(i), position.getZ(i))
      const alpha = colour.getW(i)
      if (Math.abs(radius - middle) < 1e-6) {
        expect(alpha).toBeCloseTo(1)
        full++
      } else {
        expect(alpha).toBeCloseTo(0)
        faded++
      }
    }
    expect(full).toBeGreaterThan(0)
    expect(faded).toBeGreaterThan(0)
  })
})

describe("buildHighlight", () => {
  it("adds two objects only: all dim rings in one instanced mesh, and one bright ring", () => {
    const scene = new THREE.Scene()
    buildHighlight(scene)
    const { dim, strong } = rings(scene)
    expect(scene.children).toHaveLength(2)
    expect(dim).toBeInstanceOf(THREE.InstancedMesh)
    expect(strong).toBeInstanceOf(THREE.Mesh)
    // One shared geometry, so one set of vertices for every ring.
    expect(strong.geometry).toBe(dim.geometry)
  })

  it("puts a dim ring on the floor at each place's ring spot, from the start", () => {
    const scene = new THREE.Scene()
    buildHighlight(scene)
    const { dim } = rings(scene)
    expect(dim.count).toBe(HOTSPOT_SPOTS.length)
    const matrix = new THREE.Matrix4()
    const at = new THREE.Vector3()
    RING_SPOTS.forEach((spot, i) => {
      dim.getMatrixAt(i, matrix)
      at.setFromMatrixPosition(matrix)
      expect(at.x, spot.id).toBeCloseTo(spot.at[0])
      expect(at.z, spot.id).toBeCloseTo(spot.at[1])
      expect(at.y, spot.id).toBeGreaterThan(0)
      expect(at.y, spot.id).toBeLessThan(FLOOR)
    })
  })

  it("keeps the dim rings dimmer than the bright one, and neither writes depth", () => {
    const scene = new THREE.Scene()
    buildHighlight(scene)
    const { dim, strong } = rings(scene)
    const dimMaterial = dim.material as THREE.MeshBasicMaterial
    const strongMaterial = strong.material as THREE.MeshBasicMaterial
    expect(dimMaterial.opacity).toBeLessThan(strongMaterial.opacity)
    expect(dimMaterial.transparent && strongMaterial.transparent).toBe(true)
    expect(dimMaterial.depthWrite || strongMaterial.depthWrite).toBe(false)
    expect(dimMaterial.vertexColors && strongMaterial.vertexColors).toBe(true)
  })

  it("shows the bright ring at one place at a time, and nowhere by default", () => {
    const scene = new THREE.Scene()
    const highlight = buildHighlight(scene)
    const { strong } = rings(scene)
    expect(strong.visible).toBe(false)
    for (const id of ["troli", "pintu", "fiksi_sastra"] as const) {
      highlight.set(id)
      expect(strong.visible, id).toBe(true)
      expect(strong.position.x, id).toBeCloseTo(ringOf(id)[0])
      expect(strong.position.z, id).toBeCloseTo(ringOf(id)[1])
      expect(strong.position.y, id).toBeLessThan(FLOOR)
      expect(strong.scale.x).toBeCloseTo(RING_STRONG_SCALE)
    }
    highlight.set(null)
    expect(strong.visible).toBe(false)
  })

  it("reports a change only when the place changes (so one frame, no more)", () => {
    const highlight = buildHighlight(new THREE.Scene())
    expect(highlight.set(null)).toBe(false)
    expect(highlight.set("katalog")).toBe(true)
    expect(highlight.set("katalog")).toBe(false)
    expect(highlight.current()).toBe("katalog")
    expect(highlight.set("pintu")).toBe(true)
    expect(highlight.set(null)).toBe(true)
    expect(highlight.current()).toBeNull()
  })

  it("leaves nothing in the scene once disposed", () => {
    const scene = new THREE.Scene()
    buildHighlight(scene).dispose()
    expect(scene.children).toHaveLength(0)
  })
})
