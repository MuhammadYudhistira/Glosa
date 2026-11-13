import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { mergeStatic } from "./kit"

const meshes = (root: THREE.Object3D) =>
  root.children.filter(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh
  )

describe("mergeStatic", () => {
  it("merges static meshes of one material into one, in the root's space", () => {
    const material = new THREE.MeshStandardMaterial()
    const root = new THREE.Group()
    root.position.set(10, 0, 0)
    const holder = new THREE.Group()
    holder.position.set(0, 2, 0)
    root.add(holder)
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    a.position.set(1, 0, 0)
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    b.position.set(-1, 0, 0)
    holder.add(a, b)

    mergeStatic(root)

    expect(holder.children).toHaveLength(0)
    const [merged] = meshes(root)
    expect(meshes(root)).toHaveLength(1)
    expect(merged.material).toBe(material)
    merged.geometry.computeBoundingBox()
    const box = merged.geometry.boundingBox!
    // The holder's lift and each box's offset are baked into the vertices;
    // the root's own position is not (the mesh is the root's child).
    expect(box.min.toArray()).toEqual([-1.5, 1.5, -0.5])
    expect(box.max.toArray()).toEqual([1.5, 2.5, 0.5])
  })

  it("leaves animated meshes and their children as they are", () => {
    const material = new THREE.MeshStandardMaterial()
    const root = new THREE.Group()
    const flame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    flame.userData.animated = true
    const spark = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    flame.add(spark)
    const still = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    root.add(flame, still)

    mergeStatic(root)

    expect(flame.parent).toBe(root)
    expect(spark.parent).toBe(flame)
    expect(flame.userData.animated).toBe(true)
    // One static mesh alone is not worth merging: it stays.
    expect(still.parent).toBe(root)
  })
})
