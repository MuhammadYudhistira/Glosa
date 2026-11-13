import * as THREE from "three"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SHOP_ITEMS } from "@/lib/shop/catalog"
import { DECOR_BUILDERS, MOTION_MS, animating, buildDecor } from "./decor"
import {
  DECOR_SIZES,
  DECOR_SLOTS,
  PLANT,
  PLANT_POT,
  type Point3,
} from "./layout"
import { MODELS, type ModelKey } from "./model-manifest"
import type { ModelSet } from "./models"
import { SCREEN_RIGHT, SCREEN_UP } from "./projection"

type Rect = { u0: number; u1: number; v0: number; v1: number }

/** Where a box falls on the (isometric) screen, in metres right and up. */
function screenRect({ min, max }: THREE.Box3): Rect {
  const us: Array<number> = []
  const vs: Array<number> = []
  for (const x of [min.x, max.x])
    for (const y of [min.y, max.y])
      for (const z of [min.z, max.z]) {
        const along = (axis: Point3) => axis[0] * x + axis[1] * y + axis[2] * z
        us.push(along(SCREEN_RIGHT))
        vs.push(along(SCREEN_UP))
      }
  return {
    u0: Math.min(...us),
    u1: Math.max(...us),
    v0: Math.min(...vs),
    v1: Math.max(...vs),
  }
}

const overlaps = (a: Rect, b: Rect) =>
  a.u0 < b.u1 && b.u0 < a.u1 && a.v0 < b.v1 && b.v0 < a.v1

const meshes = (root: THREE.Object3D) => {
  let count = 0
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) count++
  })
  return count
}

/** No model files: every item is built by code. */
const noModels: ModelSet = { get: () => null, dispose: () => undefined }

/**
 * A model for every key with a file: a box of odd proportions, off centre,
 * so the fitting has work to do.
 */
const boxModels: ModelSet = {
  get: (key) => {
    if (MODELS[key].file === null) return null
    const group = new THREE.Group()
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 3, 1),
      new THREE.MeshStandardMaterial()
    )
    mesh.position.set(0.4, -1, 0.3)
    group.add(mesh)
    return group
  },
  dispose: () => undefined,
}

/** The item's bounds in its slot's own frame (before the slot's place and turn). */
function localBounds(scene: THREE.Scene, slot: string): THREE.Box3 {
  const group = scene.getObjectByName(`decor-${slot}`)!
  group.updateMatrixWorld(true)
  const inverse = group.matrixWorld.clone().invert()
  const box = new THREE.Box3()
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.computeBoundingBox()
    box.union(
      object.geometry
        .boundingBox!.clone()
        .applyMatrix4(
          new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld)
        )
    )
  })
  return box
}

/** Every object's place, turn and size under a slot, to compare poses. */
function pose(scene: THREE.Scene, slot: string): Array<number> {
  const values: Array<number> = []
  scene.getObjectByName(`decor-${slot}`)!.traverse((object) => {
    values.push(
      ...object.position.toArray(),
      ...object.quaternion.toArray(),
      ...object.scale.toArray()
    )
  })
  return values
}

const emissives = (scene: THREE.Scene) => {
  const levels: Array<number> = []
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const material = object.material as THREE.MeshStandardMaterial
    if (material.emissive.getHex() !== 0) {
      levels.push(material.emissiveIntensity)
    }
  })
  return levels
}

afterEach(() => {
  vi.useRealTimers()
})

describe("lobby decor", () => {
  it("has a builder for every item", () => {
    expect(Object.keys(DECOR_BUILDERS).sort()).toEqual(
      SHOP_ITEMS.map(({ id }) => id).sort()
    )
  })

  it("has a model-manifest entry for every shop item", () => {
    for (const { id } of SHOP_ITEMS) {
      expect(Object.keys(MODELS), id).toContain(`decor_${id}`)
    }
  })

  it("keeps the ids, names and prices of the 18 items", () => {
    expect(SHOP_ITEMS).toHaveLength(18)
    expect(new Set(SHOP_ITEMS.map((item) => item.id)).size).toBe(18)
  })

  it("builds each item in its slot, and asks to draw again", () => {
    for (const { id, slot } of SHOP_ITEMS) {
      const scene = new THREE.Scene()
      const onChange = vi.fn()
      const decor = buildDecor(scene, noModels, onChange)
      decor.set({ [slot]: id })
      expect(meshes(scene), id).toBeGreaterThan(0)
      expect(onChange).toHaveBeenCalledTimes(1)
      decor.dispose()
      expect(meshes(scene), id).toBe(0)
    }
  })

  it.each([
    ["by code", noModels],
    ["from models", boxModels],
  ])("keeps every item inside its slot's size (%s)", (_how, models) => {
    for (const { id, slot } of SHOP_ITEMS) {
      const scene = new THREE.Scene()
      const decor = buildDecor(scene, models, vi.fn())
      decor.set({ [slot]: id })
      const box = localBounds(scene, slot)
      const [w, h, d] = DECOR_SIZES[slot]
      const slack = 1e-3
      expect(box.min.x, id).toBeGreaterThanOrEqual(-w / 2 - slack)
      expect(box.max.x, id).toBeLessThanOrEqual(w / 2 + slack)
      expect(box.max.y - box.min.y, id).toBeLessThanOrEqual(h + slack)
      // Wall items hang flat against the wall, in front of the slot's point.
      const [z0, z1] = slot === "wall" ? [0, d] : [-d / 2, d / 2]
      expect(box.min.z, id).toBeGreaterThanOrEqual(z0 - slack)
      expect(box.max.z, id).toBeLessThanOrEqual(z1 + slack)
      // Floor items stand on the floor; hanging ones hang from their point.
      if (DECOR_SLOTS[slot].at[1] === 0) {
        expect(box.min.y, id).toBeGreaterThanOrEqual(-slack)
      }
      if (slot === "ceiling") expect(box.max.y, id).toBeLessThanOrEqual(slack)
      decor.dispose()
    }
  })

  it("uses the model of every item that has one", () => {
    for (const { id, slot } of SHOP_ITEMS) {
      const key = `decor_${id}` as ModelKey
      const scene = new THREE.Scene()
      const get = vi.spyOn(boxModels, "get")
      const decor = buildDecor(scene, boxModels, vi.fn())
      decor.set({ [slot]: id })
      if (MODELS[key].file === null) {
        expect(get, id).not.toHaveBeenCalled()
      } else {
        expect(get, id).toHaveBeenCalledWith(key)
      }
      get.mockRestore()
      decor.dispose()
    }
  })

  it.each([
    ["by code", noModels],
    ["from models", boxModels],
  ])(
    "keeps every lamp clear of the grown plant on screen (%s)",
    (_how, models) => {
      // The pot, and the full-grown plant above it (plant.ts: leaves and
      // flowers reach about 0.45 m out and 2.8 m up at its scale).
      const [px, pz] = PLANT
      const pot = PLANT_POT.width / 2
      const plant = [
        screenRect(
          new THREE.Box3(
            new THREE.Vector3(px - pot, 0, pz - pot),
            new THREE.Vector3(px + pot, PLANT_POT.height, pz + pot)
          )
        ),
        screenRect(
          new THREE.Box3(
            new THREE.Vector3(px - 0.45, PLANT_POT.height, pz - 0.45),
            new THREE.Vector3(px + 0.45, 2.8, pz + 0.45)
          )
        ),
      ]
      for (const { id, slot } of SHOP_ITEMS.filter((i) => i.slot === "lamp")) {
        const scene = new THREE.Scene()
        const decor = buildDecor(scene, models, vi.fn())
        decor.set({ [slot]: id })
        const lamp = screenRect(
          new THREE.Box3().setFromObject(scene.getObjectByName("decor-lamp")!)
        )
        for (const part of plant) expect(overlaps(lamp, part), id).toBe(false)
        decor.dispose()
      }
    }
  )

  it("rebuilds only the slots that changed", () => {
    const scene = new THREE.Scene()
    const onChange = vi.fn()
    const decor = buildDecor(scene, noModels, onChange)
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
    const decor = buildDecor(scene, noModels, vi.fn())
    decor.set({ rug: "rug_gold" })
    expect(meshes(scene)).toBe(0)
  })

  it("frees every geometry and material it made", () => {
    const scene = new THREE.Scene()
    const decor = buildDecor(scene, noModels, vi.fn())
    decor.set({ rug: "rug_pattern", lamp: "lamp_arc" })
    const geometries: Array<THREE.BufferGeometry> = []
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) geometries.push(object.geometry)
    })
    const disposed = geometries.map((geometry) => vi.spyOn(geometry, "dispose"))
    decor.set({})
    for (const spy of disposed) expect(spy).toHaveBeenCalled()
  })

  it("lights the lamps with the rig, items placed later too", () => {
    const scene = new THREE.Scene()
    const decor = buildDecor(scene, noModels, vi.fn())
    decor.set({ lamp: "lamp_floor" })
    decor.setLamps(0)
    expect(emissives(scene).length).toBeGreaterThan(0)
    expect(emissives(scene).every((level) => level === 0)).toBe(true)
    decor.setLamps(1)
    const lit = emissives(scene)
    expect(lit.every((level) => level > 0)).toBe(true)
    decor.setLamps(0.5)
    decor.set({ lamp: "lamp_floor", ceiling: "ceiling_lights" })
    const half = emissives(scene)
    expect(half.length).toBeGreaterThan(lit.length)
    expect(half.every((level) => level > 0)).toBe(true)
    expect(Math.max(...half)).toBeLessThan(Math.max(...lit))
  })
})

describe("decor motion (spec 3F §3.6)", () => {
  it("moves only in the 4 seconds after an item appears", () => {
    expect(MOTION_MS).toBe(4000)
    expect(animating(null, 1000)).toBe(false)
    expect(animating(1000, 1000)).toBe(true)
    expect(animating(1000, 4999)).toBe(true)
    expect(animating(1000, 5000)).toBe(false)
    expect(animating(1000, 999)).toBe(false)
  })

  it.each(["pet_bird", "pet_aquarium", "ceiling_books", "ceiling_globe"])(
    "plays %s once when it is placed, then rests where it started",
    (id) => {
      vi.useFakeTimers()
      const { slot } = SHOP_ITEMS.find((item) => item.id === id)!
      const scene = new THREE.Scene()
      const onChange = vi.fn()
      const decor = buildDecor(scene, noModels, onChange, () => true)
      decor.set({})
      decor.set({ [slot]: id })
      expect(onChange).toHaveBeenCalledTimes(1)
      const rest = pose(scene, slot)
      // The stage's frames pose it; decor asks for none of its own.
      expect(vi.getTimerCount()).toBe(0)
      vi.advanceTimersByTime(1500)
      expect(decor.update()).toBe(true)
      expect(pose(scene, slot)).not.toEqual(rest)
      vi.advanceTimersByTime(MOTION_MS)
      expect(decor.update()).toBe(false)
      expect(pose(scene, slot)).toEqual(rest)
      expect(decor.update()).toBe(false)
      expect(onChange).toHaveBeenCalledTimes(1)
      decor.dispose()
    }
  )

  it("rests at once when the stage stops moving mid-motion", () => {
    vi.useFakeTimers()
    const scene = new THREE.Scene()
    const decor = buildDecor(scene, noModels, vi.fn(), () => true)
    decor.set({})
    decor.set({ pet: "pet_bird" })
    const rest = pose(scene, "pet")
    vi.advanceTimersByTime(1500)
    decor.update()
    decor.rest()
    expect(pose(scene, "pet")).toEqual(rest)
    expect(decor.update()).toBe(false)
    decor.dispose()
  })

  it("keeps an item still that was there when the lobby loaded", () => {
    vi.useFakeTimers()
    const scene = new THREE.Scene()
    const onChange = vi.fn()
    const decor = buildDecor(scene, noModels, onChange, () => true)
    decor.set({ pet: "pet_bird" })
    const rest = pose(scene, "pet")
    vi.advanceTimersByTime(1500)
    expect(decor.update()).toBe(false)
    expect(pose(scene, "pet")).toEqual(rest)
    expect(onChange).toHaveBeenCalledTimes(1)
    decor.dispose()
  })

  it("keeps every item still where the lobby does not move", () => {
    vi.useFakeTimers()
    const scene = new THREE.Scene()
    const onChange = vi.fn()
    const decor = buildDecor(scene, noModels, onChange, () => false)
    decor.set({})
    decor.set({ pet: "pet_bird" })
    const rest = pose(scene, "pet")
    vi.advanceTimersByTime(1500)
    expect(decor.update()).toBe(false)
    expect(pose(scene, "pet")).toEqual(rest)
    expect(onChange).toHaveBeenCalledTimes(1)
    decor.dispose()
  })
})
