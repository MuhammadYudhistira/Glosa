import * as THREE from "three"
import type { Kit } from "./kit"
import type { Point3, ShelfFace } from "./layout"

const CELL_WIDTH = 0.9
const CELL_HEIGHT = 0.72
const DEPTH = 0.42

export const BOOK_COLORS = [
  "#f4efe6",
  "#e9e2d4",
  "#d9cdb8",
  "#3d5a80",
  "#98c1d9",
  "#ee6c4d",
  "#f4a6a0",
  "#7a9e7e",
  "#2f3e46",
  "#c9a35b",
  "#b56576",
  "#ffffff",
] as const

/** One box of an InstancedMesh: centre, size, and turn around the vertical axis. */
export type Instance = {
  position: Point3
  scale: Point3
  rotation: number
  color: string | null
}

const gridOf = (face: ShelfFace) => ({
  cols: Math.round(face.width / CELL_WIDTH),
  rows: Math.round(face.height / CELL_HEIGHT),
})

/** The books and divider boards of one wall of cubbies. Pure: no WebGL. */
export function shelfFaceInstances(
  face: ShelfFace,
  rand: () => number
): { books: Array<Instance>; dividers: Array<Instance> } {
  const { cols, rows } = gridOf(face)
  const cellWidth = face.width / cols
  const cellHeight = face.height / rows
  const [ox, oy, oz] = face.origin
  const [ax, , az] = face.along
  const [nx, , nz] = face.into
  // a: along the wall, b: up, c: into the room.
  const at = (a: number, b: number, c: number): Point3 => [
    ox + ax * a + nx * c,
    oy + b,
    oz + az * a + nz * c,
  ]
  const rotation = Math.atan2(ax, az) - Math.PI / 2

  const dividers: Array<Instance> = []
  for (let c = 0; c <= cols; c++) {
    dividers.push({
      position: at(c * cellWidth, face.height / 2, DEPTH / 2),
      scale: [0.05, face.height, DEPTH],
      rotation,
      color: null,
    })
  }
  for (let r = 0; r <= rows; r++) {
    dividers.push({
      position: at(face.width / 2, r * cellHeight, DEPTH / 2),
      scale: [face.width, 0.05, DEPTH],
      rotation,
      color: null,
    })
  }

  const books: Array<Instance> = []
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (rand() < 0.08) continue
      let a = c * cellWidth + 0.06
      // Some cubbies leave room for a leaning book.
      const end = (c + 1) * cellWidth - (rand() < 0.2 ? 0.25 : 0.08)
      while (a < end) {
        const width = 0.045 + rand() * 0.05
        const height = cellHeight * (0.5 + rand() * 0.32)
        books.push({
          position: at(
            a + width / 2,
            r * cellHeight + 0.025 + height / 2,
            0.19
          ),
          scale: [width, height, 0.26],
          rotation,
          color: BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)],
        })
        a += width + 0.004
      }
    }
  }
  return { books, dividers }
}

/** The glowing back of a wall of cubbies. */
function backPanel(kit: Kit, face: ShelfFace) {
  const { cols, rows } = gridOf(face)
  const texture = kit.glow.clone()
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(cols, rows)
  texture.needsUpdate = true
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(face.width, face.height),
    new THREE.MeshStandardMaterial({
      color: "#6b4426",
      emissive: "#ffffff",
      emissiveMap: texture,
      emissiveIntensity: face.glow,
      roughness: 0.9,
    })
  )
  const [ox, oy, oz] = face.origin
  const [ax, , az] = face.along
  const [nx, , nz] = face.into
  panel.position.set(
    ox + (ax * face.width) / 2 + nx * 0.01,
    oy + face.height / 2,
    oz + (az * face.width) / 2 + nz * 0.01
  )
  panel.lookAt(panel.position.x + nx, panel.position.y, panel.position.z + nz)
  panel.receiveShadow = true
  kit.scene.add(panel)
}

function addInstances(
  scene: THREE.Scene,
  list: ReadonlyArray<Instance>,
  material: THREE.Material
) {
  const instanced = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    material,
    list.length
  )
  const matrix = new THREE.Matrix4()
  const turn = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const color = new THREE.Color()
  list.forEach((item, i) => {
    turn.setFromAxisAngle(up, item.rotation)
    matrix.compose(
      position.set(...item.position),
      turn,
      scale.set(...item.scale)
    )
    instanced.setMatrixAt(i, matrix)
    if (item.color) instanced.setColorAt(i, color.set(item.color))
  })
  instanced.castShadow = false
  instanced.receiveShadow = true
  scene.add(instanced)
}

/**
 * Every wall of cubbies: a glowing back panel each, then all books and all
 * dividers as two InstancedMeshes. Returns how many books there are.
 */
export function buildShelves(
  kit: Kit,
  faces: ReadonlyArray<ShelfFace>
): number {
  const books: Array<Instance> = []
  const dividers: Array<Instance> = []
  for (const face of faces) {
    backPanel(kit, face)
    const parts = shelfFaceInstances(face, kit.rand)
    for (const book of parts.books) books.push(book)
    for (const divider of parts.dividers) dividers.push(divider)
  }
  addInstances(
    kit.scene,
    books,
    new THREE.MeshStandardMaterial({ roughness: 0.65 })
  )
  addInstances(kit.scene, dividers, kit.mat("#a8703f", { roughness: 0.55 }))
  return books.length
}
