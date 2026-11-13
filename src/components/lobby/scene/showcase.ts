import * as THREE from "three"
import { type Kit, mergeStatic } from "./kit"
import {
  SHOWCASE,
  SHOWCASE_SHELVES,
  SHOWCASE_SIZE,
  SHOWCASE_TURN,
  type ShowcaseBook,
  showcaseSlots,
} from "./layout"
import { type ModelSet, fitTo } from "./models"

const BODY = "#6a4228"
const TRIM = "#b98552"
const COVER = { width: 0.42, height: 0.6, depth: 0.05 } as const

export type Showcase = {
  /** Shows these books, the newest first; the same list again does nothing. */
  set: (books: ReadonlyArray<ShowcaseBook>) => void
  dispose: () => void
}

/** The cabinet's body in code: rounded wood, two glazed doors, brass knobs. */
function cabinetBody(kit: Kit, parent: THREE.Object3D) {
  const { width, height, depth } = SHOWCASE_SIZE
  const front = depth / 2
  kit.block(width, height - 0.1, 0.05, "#4e3222", 0, 0.1, -front + 0.025, {
    r: 0.015,
    parent,
  })
  for (const side of [-1, 1]) {
    kit.block(0.07, height, depth, BODY, side * (width / 2 - 0.035), 0, 0, {
      r: 0.025,
      parent,
    })
  }
  kit.block(width, SHOWCASE_SHELVES[0], depth, BODY, 0, 0, 0, {
    r: 0.025,
    parent,
  })
  for (const shelf of SHOWCASE_SHELVES.slice(1)) {
    kit.block(width - 0.12, 0.04, depth - 0.06, TRIM, 0, shelf - 0.04, -0.02, {
      r: 0.012,
      parent,
    })
  }
  kit.block(width + 0.1, 0.1, depth + 0.08, BODY, 0, height - 0.04, 0.01, {
    r: 0.03,
    parent,
  })
  kit.block(width + 0.16, 0.04, depth + 0.12, TRIM, 0, height + 0.06, 0.01, {
    r: 0.015,
    parent,
  })
  // Two glazed doors: thin frames, a faint pane and brass knobs.
  const frame = kit.mat(TRIM, { roughness: 0.55 })
  const doorWidth = (width - 0.14) / 2
  const doorBottom = SHOWCASE_SHELVES[0] + 0.02
  const doorHeight = height - 0.06 - doorBottom
  for (const side of [-1, 1]) {
    const x = side * (doorWidth / 2 + 0.005)
    for (const dx of [-1, 1]) {
      kit.block(
        0.04,
        doorHeight,
        0.03,
        frame,
        x + (dx * (doorWidth - 0.04)) / 2,
        doorBottom,
        front + 0.01,
        { r: 0.01, parent }
      )
    }
    for (const y of [doorBottom, doorBottom + doorHeight - 0.04]) {
      kit.block(doorWidth, 0.04, 0.03, frame, x, y, front + 0.01, {
        r: 0.01,
        parent,
      })
    }
    kit.mesh(
      new THREE.SphereGeometry(0.022, 12, 8),
      kit.mat("#d9b26a", { metalness: 0.6, roughness: 0.3 }),
      side * 0.05,
      doorBottom + doorHeight * 0.48,
      front + 0.04,
      { parent }
    )
  }
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.16, doorHeight - 0.06),
    new THREE.MeshStandardMaterial({
      color: "#e4f0ff",
      transparent: true,
      opacity: 0.12,
      roughness: 0.05,
      metalness: 0.2,
      depthWrite: false,
    })
  )
  pane.position.set(0, doorBottom + doorHeight / 2, front + 0.012)
  pane.renderOrder = 2
  pane.userData.animated = true
  parent.add(pane)
}

/**
 * The display cabinet of finished books (spec Tahap 3 §4.5): the
 * `glassCabinet` model when there is one, else built in code. Covers load as
 * textures from their signed URLs, which Storage sends with CORS headers; a
 * book without one, a cover that fails and every cover offline keep a
 * coloured face. onChange asks the stage to draw again.
 */
export function buildShowcase(
  kit: Kit,
  models: ModelSet,
  onChange: () => void
): Showcase {
  const [cx, cz] = SHOWCASE
  // Built facing +Z in its own group, then turned like the cover slots.
  const body = new THREE.Group()
  body.position.set(cx, 0, cz)
  body.rotation.y = SHOWCASE_TURN
  kit.scene.add(body)
  const model = models.get("glassCabinet")
  if (model) {
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
    body.add(fitTo(model, SHOWCASE_SIZE.height))
  } else {
    cabinetBody(kit, body)
  }
  mergeStatic(body)

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
        // BoxGeometry faces: +Z is the fifth, which looks out of the cabinet.
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(COVER.width, COVER.height, COVER.depth),
          [edge, edge, edge, edge, face, edge]
        )
        mesh.position.set(x, y + COVER.height / 2, z)
        mesh.rotation.y = SHOWCASE_TURN
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
