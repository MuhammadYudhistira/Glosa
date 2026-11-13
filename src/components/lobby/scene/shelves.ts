import * as THREE from "three"
import { type Kit, mergeStatic } from "./kit"
import { SHELF, WALL_SECTIONS } from "./layout"
import {
  EMPTY_HUES,
  type GenreHues,
  SECTION_CAPACITY,
  sectionBooks,
} from "./shelf-books"

/** The back of a section: lighter than the bookcase, so a dimmed one shows. */
const SECTION_BACK = "#c08c5e"
const PLATE_FRAME = "#7a5a3a"
const PLATE_FACE = "#efe3cc"
/** How much light an empty section keeps: 60% darker. */
const DIM = 0.4
const LABEL = { width: 0.88, height: 0.2 } as const

/** `hex` with its sRGB channels scaled by `light`, as the eye sees it darker. */
function shade(color: THREE.Color, hex: string, light: number): THREE.Color {
  const { r, g, b } = color
    .set(hex)
    .getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace)
  return color.setRGB(r * light, g * light, b * light, THREE.SRGBColorSpace)
}

export type Shelves = {
  /** Stands each genre's books, newest first; a section without any dims. */
  set: (hues: GenreHues) => void
  /** How many books stand on the shelves now. */
  readonly count: number
  dispose: () => void
}

/**
 * The books on the genre shelves (spec 3F §3.2), on the bookcase room.ts
 * builds: one instanced mesh for every book, coloured by its cover's hue;
 * one plain plate per section above it (its name is the HTML label); a section's back and plate dim while
 * it holds no book.
 */
export function buildShelves(kit: Kit): Shelves {
  const group = new THREE.Group()
  group.name = "shelves"
  kit.scene.add(group)
  const { depth, bottom, top } = SHELF

  const sections = WALL_SECTIONS.map(({ z, width }) => {
    // A back panel between the dividers, just in front of the bookcase's own.
    const back = new THREE.MeshStandardMaterial({
      color: SECTION_BACK,
      roughness: 0.85,
    })
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width - 0.06, top - bottom),
      back
    )
    panel.rotation.y = Math.PI / 2
    panel.position.set(0.052, (top + bottom) / 2, z)
    panel.receiveShadow = true
    panel.userData.animated = true
    group.add(panel)

    // The plain plate on the crown, facing the room.
    const y = top + 0.25
    kit.block(
      0.03,
      LABEL.height + 0.05,
      LABEL.width + 0.05,
      PLATE_FRAME,
      depth + 0.105,
      y - (LABEL.height + 0.05) / 2,
      z,
      { r: 0.012, parent: group, cast: false }
    )
    const face = new THREE.MeshStandardMaterial({
      color: PLATE_FACE,
      roughness: 0.6,
    })
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(LABEL.width, LABEL.height),
      face
    )
    plate.rotation.y = Math.PI / 2
    plate.position.set(depth + 0.122, y, z)
    plate.userData.animated = true
    group.add(plate)
    return { back, face }
  })
  mergeStatic(group)

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({ roughness: 0.7 })
  const books = new THREE.InstancedMesh(
    geometry,
    material,
    WALL_SECTIONS.length * SECTION_CAPACITY
  )
  books.castShadow = true
  books.receiveShadow = true
  books.count = 0
  group.add(books)

  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const turn = new THREE.Quaternion()
  const color = new THREE.Color()

  function set(hues: GenreHues) {
    let count = 0
    WALL_SECTIONS.forEach((section, i) => {
      const placed = sectionBooks(section, hues[section.genre])
      for (const book of placed) {
        position.set(...book.position)
        scale.set(...book.size)
        books.setMatrixAt(count, matrix.compose(position, turn, scale))
        books.setColorAt(
          count,
          color.setHSL(book.hue / 360, 0.55, 0.48, THREE.SRGBColorSpace)
        )
        count++
      }
      const light = placed.length > 0 ? 1 : DIM
      const { back, face } = sections[i]
      shade(back.color, SECTION_BACK, light)
      shade(face.color, PLATE_FACE, light)
    })
    books.count = count
    books.instanceMatrix.needsUpdate = true
    if (books.instanceColor) books.instanceColor.needsUpdate = true
    // Books that moved must not be culled by a stale bounding sphere.
    books.computeBoundingSphere()
  }

  set(EMPTY_HUES)

  return {
    set,
    get count() {
      return books.count
    },
    dispose() {
      group.removeFromParent()
      books.dispose()
      geometry.dispose()
      material.dispose()
      for (const { back, face } of sections) {
        back.dispose()
        face.dispose()
      }
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose()
      })
    },
  }
}
