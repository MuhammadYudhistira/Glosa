import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { createKit } from "./kit"
import { WALL_SECTIONS } from "./layout"
import { buildShelves } from "./shelves"

describe("buildShelves", () => {
  it("draws the genre plates plain: no texture on any plate material", () => {
    const scene = new THREE.Scene()
    const shelves = buildShelves(createKit(scene))
    const group = scene.getObjectByName("shelves")!
    const plates: Array<THREE.Mesh> = []
    group.traverse((object) => {
      // Plates and back panels are the animated, non-instanced meshes.
      if (
        object instanceof THREE.Mesh &&
        !(object instanceof THREE.InstancedMesh) &&
        object.userData.animated &&
        object.geometry instanceof THREE.PlaneGeometry &&
        object.geometry.parameters.height === 0.2
      )
        plates.push(object)
    })
    expect(plates.length).toBeGreaterThan(0)
    for (const plate of plates) {
      const material = plate.material as THREE.MeshStandardMaterial
      expect(material.map).toBeNull()
      // Each plate (with its 5 cm frame) fits its section, apart from the next.
      expect(
        (plate.geometry as THREE.PlaneGeometry).parameters.width + 0.05
      ).toBeLessThan(WALL_SECTIONS[0].width)
    }
    shelves.dispose()
  })
})
