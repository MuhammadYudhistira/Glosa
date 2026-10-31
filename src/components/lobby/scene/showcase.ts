import * as THREE from "three"
import type { Kit } from "./kit"
import {
  SHOWCASE,
  SHOWCASE_SHELVES,
  SHOWCASE_SIZE,
  type ShowcaseBook,
  showcaseSlots,
} from "./layout"

const BODY = "#5a3820"
const TRIM = "#c98d55"
const COVER = { width: 0.42, height: 0.6, depth: 0.05 } as const

export type Showcase = {
  /** Shows these books, the newest first; the same list again does nothing. */
  set: (books: ReadonlyArray<ShowcaseBook>) => void
  dispose: () => void
}

/**
 * The display cabinet of finished books (spec Tahap 3 §4.5). Covers load as
 * textures from their signed URLs, which Storage sends with CORS headers; a
 * book without one, a cover that fails and every cover offline keep a
 * coloured face. onChange asks the stage to draw again.
 */
export function buildShowcase(kit: Kit, onChange: () => void): Showcase {
  const [cx, cz] = SHOWCASE
  const { width, height, depth } = SHOWCASE_SIZE
  const back = cx - depth / 2 + 0.03
  kit.block(0.06, height, width, BODY, back, 0, cz, { r: 0.02 })
  for (const side of [-1, 1]) {
    kit.block(
      depth,
      height,
      0.06,
      BODY,
      cx,
      0,
      cz + side * (width / 2 - 0.03),
      {
        r: 0.02,
      }
    )
  }
  kit.block(depth, SHOWCASE_SHELVES[0], width, BODY, cx, 0, cz, { r: 0.02 })
  for (const shelf of SHOWCASE_SHELVES.slice(1)) {
    kit.block(depth - 0.04, 0.05, width - 0.12, TRIM, cx, shelf - 0.05, cz, {
      r: 0.01,
      cast: false,
    })
  }
  kit.block(depth + 0.08, 0.06, width + 0.08, TRIM, cx, height, cz, {
    r: 0.02,
  })

  const covers = new THREE.Group()
  kit.scene.add(covers)
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin("anonymous")
  const slots = showcaseSlots()
  let shownIds = ""
  let disposed = false

  const clear = () => {
    for (const child of [...covers.children]) {
      if (!(child instanceof THREE.Mesh)) continue
      child.geometry.dispose()
      for (const material of child.material as Array<THREE.MeshStandardMaterial>) {
        material.map?.dispose()
        material.dispose()
      }
      child.removeFromParent()
    }
  }

  return {
    set(books) {
      const ids = books.map((book) => book.id).join(" ")
      if (disposed || ids === shownIds) return
      shownIds = ids
      clear()
      books.slice(0, slots.length).forEach((book, i) => {
        const [x, y, z] = slots[i]
        const face = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(book.hue / 360, 0.45, 0.42),
          roughness: 0.7,
        })
        const edge = new THREE.MeshStandardMaterial({ color: "#efe6d4" })
        // BoxGeometry faces: +X first, which looks into the room.
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(COVER.depth, COVER.height, COVER.width),
          [face, edge, edge, edge, edge, edge]
        )
        mesh.position.set(x, y + COVER.height / 2, z)
        mesh.castShadow = true
        covers.add(mesh)
        if (!book.coverUrl) return
        loader.load(
          book.coverUrl,
          (texture) => {
            // Replaced or disposed while it loaded.
            if (disposed || mesh.parent !== covers) {
              texture.dispose()
              return
            }
            texture.colorSpace = THREE.SRGBColorSpace
            face.map = texture
            face.color.set("#ffffff")
            face.needsUpdate = true
            onChange()
          },
          undefined,
          () => {
            // Offline or refused: the coloured face stays.
          }
        )
      })
      onChange()
    },
    dispose() {
      disposed = true
      clear()
    },
  }
}
