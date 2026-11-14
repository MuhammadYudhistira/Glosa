import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createKit } from "./kit"
import { PLANT_SHAPES } from "./layout"
import { buildPlant } from "./plant"

function setup() {
  const scene = new THREE.Scene()
  const onChange = vi.fn()
  const plant = buildPlant(createKit(scene), onChange)
  // The plant's own group: the last thing it added to the scene.
  const group = scene.children[scene.children.length - 1] as THREE.Group
  /** The plant's meshes by how far grown they are (their x scale against full). */
  const sizes = () => group.children.map((mesh) => mesh.scale.x)
  return { plant, group, sizes, onChange }
}

describe("the plant's moment of growth (spec 3F §4A.2)", () => {
  it("grows the parts the newest stage added from nothing in one second", () => {
    const { plant, sizes, onChange } = setup()
    plant.set("rimbun")
    const full = sizes()
    plant.grow()
    // rimbun adds four leaves to daun's stalk and four leaves.
    const added = PLANT_SHAPES.rimbun.leaves - PLANT_SHAPES.daun.leaves
    expect(sizes().filter((size) => size === 0)).toHaveLength(added)
    onChange.mockClear()
    expect(plant.update(0.5)).toBe(true)
    expect(onChange).toHaveBeenCalled()
    const half = sizes()
    expect(half.filter((size) => size === 0)).toHaveLength(0)
    expect(half.some((size, i) => size < full[i])).toBe(true)
    expect(plant.update(0.6)).toBe(false)
    expect(sizes()).toEqual(full)
    expect(plant.update(0.1)).toBe(false)
  })

  it("grows the stalk too when the seed sprouts", () => {
    const { plant, sizes } = setup()
    plant.set("tunas")
    plant.grow()
    expect(sizes().every((size) => size === 0)).toBe(true)
  })

  it("is full grown at once on rest, or when the stage changes meanwhile", () => {
    const { plant, sizes } = setup()
    plant.set("daun")
    const full = sizes()
    plant.grow()
    plant.rest()
    expect(sizes()).toEqual(full)
    plant.grow()
    plant.set("rimbun")
    expect(sizes().every((size) => size > 0)).toBe(true)
    expect(plant.update(0.1)).toBe(false)
  })
})
