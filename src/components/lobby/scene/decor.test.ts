import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { SHOP_ITEMS } from "@/lib/shop/catalog"
import { DECOR_BUILDERS, buildDecor } from "./decor"

const meshes = (root: THREE.Object3D) => {
  let count = 0
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) count++
  })
  return count
}

describe("lobby decor", () => {
  it("has a builder for every item", () => {
    expect(Object.keys(DECOR_BUILDERS).sort()).toEqual(
      SHOP_ITEMS.map(({ id }) => id).sort()
    )
  })

  it("builds each item in its slot, and asks to draw again", () => {
    for (const { id, slot } of SHOP_ITEMS) {
      const scene = new THREE.Scene()
      const onChange = vi.fn()
      const decor = buildDecor(scene, onChange)
      decor.set({ [slot]: id })
      expect(meshes(scene), id).toBeGreaterThan(0)
      expect(onChange).toHaveBeenCalledTimes(1)
      decor.dispose()
      expect(meshes(scene), id).toBe(0)
    }
  })

  it("rebuilds only the slots that changed", () => {
    const scene = new THREE.Scene()
    const onChange = vi.fn()
    const decor = buildDecor(scene, onChange)
    decor.set({ rug: "rug_woven", pet: "pet_cat" })
    const rug = scene.getObjectByName("decor-rug")?.children[0]
    decor.set({ rug: "rug_woven", pet: "pet_bird" })
    expect(scene.getObjectByName("decor-rug")?.children[0]).toBe(rug)
    decor.set({ rug: "rug_woven", pet: "pet_bird" })
    expect(onChange).toHaveBeenCalledTimes(2)
    decor.set({})
    expect(meshes(scene)).toBe(0)
  })

  it("skips an id it does not know", () => {
    const scene = new THREE.Scene()
    const decor = buildDecor(scene, vi.fn())
    decor.set({ rug: "rug_gold" })
    expect(meshes(scene)).toBe(0)
  })

  it("frees every geometry and material it made", () => {
    const scene = new THREE.Scene()
    const decor = buildDecor(scene, vi.fn())
    decor.set({ rug: "rug_pattern", lamp: "lamp_arc" })
    const geometries: Array<THREE.BufferGeometry> = []
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) geometries.push(object.geometry)
    })
    const disposed = geometries.map((geometry) => vi.spyOn(geometry, "dispose"))
    decor.set({})
    for (const spy of disposed) expect(spy).toHaveBeenCalled()
  })
})
