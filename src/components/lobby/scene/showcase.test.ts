import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createKit } from "./kit"
import { showcaseSlots } from "./layout"
import type { ModelSet } from "./models"
import { buildShowcase } from "./showcase"

const NO_MODELS: ModelSet = { get: () => null, dispose: () => undefined }

function setup() {
  const scene = new THREE.Scene()
  const onChange = vi.fn()
  const showcase = buildShowcase(createKit(scene), NO_MODELS, onChange)
  // The covers' group: the last thing the cabinet added to the scene.
  const covers = scene.children[scene.children.length - 1] as THREE.Group
  const first = () => covers.children[0] as THREE.Mesh
  const opacity = () =>
    (first().material as Array<THREE.MeshStandardMaterial>)[4].opacity
  return { showcase, first, opacity, onChange }
}

const books = [
  { id: "b", coverUrl: null, hue: 10 },
  { id: "a", coverUrl: null, hue: 200 },
]

describe("the newest finished book arrives (spec 3F §4A.2)", () => {
  it("slides into the first slot and fades in over one second", () => {
    const { showcase, first, opacity, onChange } = setup()
    showcase.set(books)
    const home = first().position.clone()
    expect(home.z).toBeCloseTo(showcaseSlots()[0][2])
    showcase.arrive()
    expect(first().position.z).toBeCloseTo(home.z + 0.3)
    expect(opacity()).toBe(0)
    onChange.mockClear()
    expect(showcase.update(0.5)).toBe(true)
    expect(onChange).toHaveBeenCalled()
    expect(first().position.z).toBeGreaterThan(home.z)
    expect(first().position.z).toBeLessThan(home.z + 0.3)
    expect(showcase.update(0.6)).toBe(false)
    expect(first().position.toArray()).toEqual(home.toArray())
    expect(opacity()).toBe(1)
    const face = (first().material as Array<THREE.MeshStandardMaterial>)[4]
    expect(face.transparent).toBe(false)
  })

  it("is in place at once on rest, and nothing arrives in an empty cabinet", () => {
    const { showcase, first, opacity } = setup()
    showcase.arrive()
    expect(showcase.update(0.1)).toBe(false)
    showcase.set(books)
    const home = first().position.clone()
    showcase.arrive()
    showcase.rest()
    expect(first().position.toArray()).toEqual(home.toArray())
    expect(opacity()).toBe(1)
  })
})
