import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"

export type MeshOptions = {
  cast?: boolean
  receive?: boolean
  parent?: THREE.Object3D
}
export type BlockOptions = MeshOptions & { r?: number }
type Paint = THREE.Material | string

/** Shared helpers for building the lobby, with one seeded random sequence. */
export type Kit = {
  scene: THREE.Scene
  rand: () => number
  pick: <T>(list: ReadonlyArray<T>) => T
  /** One MeshStandardMaterial per colour and options, shared. */
  mat: (
    color: string,
    extra?: THREE.MeshStandardMaterialParameters
  ) => THREE.MeshStandardMaterial
  mesh: (
    geometry: THREE.BufferGeometry,
    paint: Paint,
    x: number,
    y: number,
    z: number,
    options?: MeshOptions
  ) => THREE.Mesh
  /** A rounded box standing on y. */
  block: (
    width: number,
    height: number,
    depth: number,
    paint: Paint,
    x: number,
    y: number,
    z: number,
    options?: BlockOptions
  ) => THREE.Mesh
  canvasTexture: (
    width: number,
    height: number,
    draw: (g: CanvasRenderingContext2D, width: number, height: number) => void,
    repeat?: readonly [number, number]
  ) => THREE.CanvasTexture
  /** The warm glow behind every cubby. */
  glow: THREE.CanvasTexture
}

export function createKit(scene: THREE.Scene, seed = 7): Kit {
  let state = seed
  const rand = () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646
  const pick = <T>(list: ReadonlyArray<T>): T =>
    list[Math.floor(rand() * list.length)]

  const materials = new Map<string, THREE.MeshStandardMaterial>()
  const mat = (
    color: string,
    extra: THREE.MeshStandardMaterialParameters = {}
  ) => {
    const key = color + JSON.stringify(extra)
    let material = materials.get(key)
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.75,
        ...extra,
      })
      materials.set(key, material)
    }
    return material
  }

  const mesh = (
    geometry: THREE.BufferGeometry,
    paint: Paint,
    x: number,
    y: number,
    z: number,
    options: MeshOptions = {}
  ) => {
    const object = new THREE.Mesh(
      geometry,
      typeof paint === "string" ? mat(paint) : paint
    )
    object.position.set(x, y, z)
    object.castShadow = options.cast ?? true
    object.receiveShadow = options.receive ?? true
    const parent = options.parent ?? scene
    parent.add(object)
    return object
  }

  const block = (
    width: number,
    height: number,
    depth: number,
    paint: Paint,
    x: number,
    y: number,
    z: number,
    options: BlockOptions = {}
  ) => {
    const radius = Math.min(
      options.r ?? 0.04,
      width / 2.01,
      height / 2.01,
      depth / 2.01
    )
    return mesh(
      new RoundedBoxGeometry(width, height, depth, 2, radius),
      paint,
      x,
      y + height / 2,
      z,
      options
    )
  }

  const canvasTexture = (
    width: number,
    height: number,
    draw: (g: CanvasRenderingContext2D, width: number, height: number) => void,
    repeat?: readonly [number, number]
  ) => {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const g = canvas.getContext("2d")
    if (g) draw(g, width, height)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    if (repeat) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(repeat[0], repeat[1])
    }
    return texture
  }

  const glow = canvasTexture(128, 128, (g) => {
    const gradient = g.createRadialGradient(64, 54, 6, 64, 64, 84)
    gradient.addColorStop(0, "#ffe2a8")
    gradient.addColorStop(0.5, "#e8913f")
    gradient.addColorStop(1, "#3a1e0c")
    g.fillStyle = gradient
    g.fillRect(0, 0, 128, 128)
  })

  return { scene, rand, pick, mat, mesh, block, canvasTexture, glow }
}

/**
 * Merges the static meshes under `root` into one mesh per material and
 * shadow setting (spec 3F §5.3), in `root`'s own space. Meshes marked
 * `userData.animated`, or with several materials, stay as they are.
 */
export function mergeStatic(root: THREE.Object3D): void {
  root.updateMatrixWorld(true)
  const inverse = root.matrixWorld.clone().invert()
  const groups = new Map<
    string,
    {
      material: THREE.Material
      cast: boolean
      receive: boolean
      parts: Array<THREE.Mesh>
    }
  >()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object === root) return
    if (object.userData.animated || Array.isArray(object.material)) return
    if (object instanceof THREE.InstancedMesh) return
    const { attributes } = object.geometry
    if (!attributes.position || !attributes.normal || !attributes.uv) return
    for (let up = object.parent; up && up !== root; up = up.parent) {
      if (up.userData.animated) return
    }
    const material = object.material as THREE.Material
    const key = `${material.uuid}:${object.castShadow}:${object.receiveShadow}`
    let group = groups.get(key)
    if (!group) {
      group = {
        material,
        cast: object.castShadow,
        receive: object.receiveShadow,
        parts: [],
      }
      groups.set(key, group)
    }
    group.parts.push(object)
  })
  for (const { material, cast, receive, parts } of groups.values()) {
    if (parts.length < 2) continue
    const geometries = parts.map((mesh) => {
      const local = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone()
      for (const name of Object.keys(local.attributes)) {
        if (!["position", "normal", "uv"].includes(name)) {
          local.deleteAttribute(name)
        }
      }
      local.applyMatrix4(
        new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)
      )
      return local
    })
    // Every part was reduced to the same attributes above, so they merge.
    const merged = mergeGeometries(geometries)
    for (const geometry of geometries) geometry.dispose()
    for (const mesh of parts) {
      mesh.removeFromParent()
      mesh.geometry.dispose()
    }
    const mesh = new THREE.Mesh(merged, material)
    mesh.castShadow = cast
    mesh.receiveShadow = receive
    root.add(mesh)
  }
}
