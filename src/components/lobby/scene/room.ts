import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import type { HighlightColor } from "@/lib/annotations/types"
import { type Kit, mergeStatic } from "./kit"
import { ROOM, ROOM_PARTS, SHELF, WALL_SECTIONS } from "./layout"
import { fitTo, type ModelSet } from "./models"

const { width: W, depth: D, height: H } = ROOM
const WALL = 0.2
const WOOD_FLOOR = "#b08a5e"
const WALLPAPER = "#d9c2a3"
const TRIM = "#7a5a3a"
const PANEL = "#8f6a45"
const FRAME = "#efe3cc"
const CURTAIN = "#a4493a"
const BRASS = "#c9a24a"
/** The paper of a corkboard note, by the colour of its highlight. */
const NOTE_PAPER: Record<HighlightColor, string> = {
  yellow: "#fff3b0",
  green: "#bfe3d0",
  blue: "#cfe0f5",
  pink: "#f2c6c2",
}

/** [width, height, depth, centre x, base y, centre z] */
type Piece = readonly [number, number, number, number, number, number]

/**
 * One mesh from rounded boxes, textured in world space (`tile` metres per
 * repeat), so walls of any size share one material without stretching.
 */
function slab(
  kit: Kit,
  pieces: ReadonlyArray<Piece>,
  material: THREE.Material,
  tile: number,
  parent: THREE.Object3D,
  r = 0.02
): THREE.Mesh {
  const geometries = pieces.map(([w, h, d, x, y, z]) => {
    const radius = Math.min(r, w / 2.01, h / 2.01, d / 2.01)
    const geometry = new RoundedBoxGeometry(w, h, d, 2, radius)
    geometry.translate(x, y + h / 2, z)
    return geometry
  })
  const merged = mergeGeometries(geometries)
  for (const geometry of geometries) geometry.dispose()
  const position = merged.getAttribute("position")
  const normal = merged.getAttribute("normal")
  const uv = merged.getAttribute("uv")
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i))
    const ny = Math.abs(normal.getY(i))
    const nz = Math.abs(normal.getZ(i))
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    if (ny >= nx && ny >= nz) uv.setXY(i, x / tile, z / tile)
    else if (nx >= nz) uv.setXY(i, z / tile, y / tile)
    else uv.setXY(i, x / tile, y / tile)
  }
  uv.needsUpdate = true
  return kit.mesh(merged, material, 0, 0, 0, { parent })
}

function tiled(texture: THREE.Texture): THREE.Texture {
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** Warm planks with seams and a little grain; one texture tile is 2 × 2 m. */
function floorMaterial(kit: Kit): THREE.MeshStandardMaterial {
  const texture = kit.canvasTexture(1024, 1024, (g) => {
    const rows = 10
    const rowHeight = 1024 / rows
    const base = new THREE.Color(WOOD_FLOOR)
    for (let i = 0; i < rows + 1; i++) {
      let x = -kit.rand() * 400
      while (x < 1024) {
        const length = 420 + kit.rand() * 520
        const tone = base
          .clone()
          .offsetHSL((kit.rand() - 0.5) * 0.012, 0, (kit.rand() - 0.5) * 0.05)
        g.fillStyle = `#${tone.getHexString()}`
        g.fillRect(x, i * rowHeight, length, rowHeight)
        // A few grain lines along the plank.
        g.strokeStyle = "rgba(90,55,25,.12)"
        g.lineWidth = 2
        for (let k = 0; k < 4; k++) {
          const y = i * rowHeight + 8 + kit.rand() * (rowHeight - 16)
          g.beginPath()
          g.moveTo(x + 6, y)
          g.bezierCurveTo(
            x + length * 0.3,
            y + (kit.rand() - 0.5) * 8,
            x + length * 0.7,
            y + (kit.rand() - 0.5) * 8,
            x + length - 6,
            y
          )
          g.stroke()
        }
        g.fillStyle = "rgba(60,35,15,.35)"
        g.fillRect(x, i * rowHeight, 2, rowHeight)
        x += length
      }
      g.fillStyle = "rgba(60,35,15,.4)"
      g.fillRect(0, i * rowHeight + rowHeight - 2, 1024, 2)
    }
  })
  return new THREE.MeshStandardMaterial({
    map: tiled(texture),
    roughness: 0.55,
  })
}

/** Soft wallpaper: faint stripes with small warm sprigs; one tile is 1.2 m. */
function wallpaperMaterial(kit: Kit): THREE.MeshStandardMaterial {
  const texture = kit.canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = WALLPAPER
    g.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 64) {
      g.fillStyle = "rgba(150,110,70,.10)"
      g.fillRect(x, 0, 22, h)
      g.fillStyle = "rgba(255,245,225,.18)"
      g.fillRect(x + 26, 0, 4, h)
    }
    g.fillStyle = "rgba(160,95,60,.22)"
    for (let y = 16; y < h; y += 64) {
      for (let x = 43; x < w; x += 64) {
        const dy = (x / 64) % 2 ? 32 : 0
        g.beginPath()
        g.ellipse(x + 4, y + dy, 3, 6, 0.5, 0, Math.PI * 2)
        g.ellipse(x - 4, y + dy + 4, 3, 6, -0.5, 0, Math.PI * 2)
        g.fill()
      }
    }
  })
  return new THREE.MeshStandardMaterial({
    map: tiled(texture),
    roughness: 0.9,
  })
}

/** Wooden wainscot panels below the chair rail; one tile is 0.8 m wide. */
function panelMaterial(kit: Kit): THREE.MeshStandardMaterial {
  const texture = kit.canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = PANEL
    g.fillRect(0, 0, w, h)
    g.fillStyle = "rgba(255,230,190,.10)"
    g.fillRect(24, 24, w - 48, h - 48)
    g.strokeStyle = "rgba(50,30,15,.35)"
    g.lineWidth = 6
    g.strokeRect(24, 24, w - 48, h - 48)
    g.strokeStyle = "rgba(255,230,190,.25)"
    g.lineWidth = 2
    g.strokeRect(30, 30, w - 60, h - 60)
    g.fillStyle = "rgba(50,30,15,.4)"
    g.fillRect(0, 0, 4, h)
  })
  return new THREE.MeshStandardMaterial({
    map: tiled(texture),
    roughness: 0.7,
  })
}

/** The floor and the plinth it rests on: the diorama's base. */
function floor(kit: Kit, parent: THREE.Object3D) {
  const material = floorMaterial(kit)
  slab(kit, [[W, 0.2, D, W / 2, -0.2, D / 2]], material, 2, parent, 0.03)
  const base = kit.block(
    W + WALL + 0.12,
    0.34,
    D + WALL + 0.12,
    "#4a3222",
    (W - WALL) / 2,
    -0.54,
    (D - WALL) / 2,
    { r: 0.06, parent, cast: false }
  )
  base.receiveShadow = false
  // A thin dark edge where the boards meet the plinth.
  kit.block(
    W + WALL + 0.04,
    0.04,
    D + WALL + 0.04,
    TRIM,
    (W - WALL) / 2,
    -0.22,
    (D - WALL) / 2,
    {
      r: 0.02,
      parent,
      cast: false,
    }
  )
}

/**
 * The two back walls, each one mesh: wallpaper above a panelled wainscot, a
 * skirting board, a chair rail, a crown moulding and a cap on the cut top.
 * The window wall is built around its opening.
 */
function walls(kit: Kit, parent: THREE.Object3D) {
  const { x0, x1, y0, y1 } = ROOM_PARTS.window
  const paper = wallpaperMaterial(kit)
  const panel = panelMaterial(kit)
  const RAIL = 1.0
  // Wall X = 0 runs the full depth; wall Z = 0 also covers the corner and
  // is built around the window opening.
  slab(
    kit,
    [
      [WALL, H - RAIL, D, -WALL / 2, RAIL, D / 2],
      [x0 + WALL, H - RAIL, WALL, (x0 - WALL) / 2, RAIL, -WALL / 2],
      [W - x1, H - RAIL, WALL, (W + x1) / 2, RAIL, -WALL / 2],
      [x1 - x0, H - y1, WALL, (x0 + x1) / 2, y1, -WALL / 2],
    ],
    paper,
    1.2,
    parent,
    0.01
  )
  const wainscot: Array<Piece> = [
    [WALL, RAIL, D, -WALL / 2, 0, D / 2],
    [W + WALL, RAIL, WALL, (W - WALL) / 2, 0, -WALL / 2],
    // Below the window, up to its sill.
    [x1 - x0, y0 - RAIL, WALL, (x0 + x1) / 2, RAIL, -WALL / 2],
  ]
  slab(
    kit,
    wainscot.filter(([, h]) => h > 0),
    panel,
    0.8,
    parent,
    0.01
  )
  const trim = kit.mat(TRIM, { roughness: 0.6 })
  const cap = kit.mat("#5e4430", { roughness: 0.8 })
  // Skirting, chair rail and crown moulding stand a little proud of the wall.
  for (const [y, h, proud] of [
    [0, 0.16, 0.035],
    [RAIL - 0.03, 0.06, 0.03],
    [H - 0.16, 0.12, 0.05],
  ] as const) {
    const along: Array<Piece> = [
      [proud, h, D, proud / 2, y, D / 2],
      [W, h, proud, W / 2, y, proud / 2],
    ]
    // The rail stops at the window.
    const pieces =
      y === RAIL - 0.03
        ? [
            along[0],
            [x0 - 0.15, h, proud, (x0 - 0.15) / 2, y, proud / 2] as Piece,
            [
              W - x1 - 0.15,
              h,
              proud,
              (W + x1 + 0.15) / 2,
              y,
              proud / 2,
            ] as Piece,
          ]
        : along
    slab(kit, pieces, trim, 1, parent, 0.012)
  }
  // The cut top of the walls, a shade darker: it reads as a model's section.
  slab(
    kit,
    [
      [WALL + 0.02, 0.05, D + 0.02, -WALL / 2, H, D / 2],
      [W + WALL + 0.02, 0.05, WALL + 0.02, (W - WALL) / 2, H, -WALL / 2],
    ],
    cap,
    1,
    parent,
    0.01
  )
}

/** Frame, mullions, sill, glass, curtains on a brass rod (spec 3F §3.1). */
function windowFrame(kit: Kit, parent: THREE.Object3D) {
  const { x0, x1, y0, y1 } = ROOM_PARTS.window
  const cx = (x0 + x1) / 2
  const width = x1 - x0
  const height = y1 - y0
  const frame = kit.mat(FRAME, { roughness: 0.55 })
  const T = 0.11
  const pieces: Array<Piece> = [
    // Casing around the opening, proud of the wall.
    [T, height + 2 * T, 0.08, x0 - T / 2, y0 - T, 0.04],
    [T, height + 2 * T, 0.08, x1 + T / 2, y0 - T, 0.04],
    [width + 2 * T + 0.1, T + 0.04, 0.1, cx, y1, 0.05],
    // Reveal: the frame inside the opening.
    [0.06, height, WALL, x0 + 0.03, y0, -WALL / 2],
    [0.06, height, WALL, x1 - 0.03, y0, -WALL / 2],
    [width, 0.06, WALL, cx, y1 - 0.06, -WALL / 2],
    // Mullions and a transom, in the middle of the wall's thickness.
    [0.06, height, 0.06, x0 + width / 3, y0, -0.1],
    [0.06, height, 0.06, x0 + (2 * width) / 3, y0, -0.1],
    [width, 0.06, 0.06, cx, y0 + height * 0.68, -0.1],
  ]
  slab(kit, pieces, frame, 1, parent, 0.015)
  // The sill sticks out into the room, with a shelf bracket under it.
  kit.block(width + 0.4, 0.07, 0.34, FRAME, cx, y0 - 0.07, 0.03, {
    r: 0.025,
    parent,
  })
  kit.block(width + 0.2, 0.08, 0.06, TRIM, cx, y0 - 0.15, 0.03, {
    r: 0.02,
    parent,
  })
  // The glass: a faint warm-cool sheen, drawn after the city behind it.
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      color: "#dcecff",
      transparent: true,
      opacity: 0.1,
      roughness: 0.05,
      metalness: 0.1,
      depthWrite: false,
    })
  )
  glass.position.set(cx, y0 + height / 2, -0.08)
  glass.renderOrder = 2
  parent.add(glass)

  // Brass rod with round finials.
  const rodY = y1 + 0.28
  const rodLength = width + 1.0
  kit.mesh(
    new THREE.CylinderGeometry(0.022, 0.022, rodLength, 10).rotateZ(
      Math.PI / 2
    ),
    kit.mat(BRASS, { metalness: 0.6, roughness: 0.35 }),
    cx,
    rodY,
    0.14,
    { parent }
  )
  for (const side of [-1, 1]) {
    kit.mesh(
      new THREE.SphereGeometry(0.05, 14, 10),
      kit.mat(BRASS, { metalness: 0.6, roughness: 0.35 }),
      cx + side * (rodLength / 2 + 0.03),
      rodY,
      0.14,
      { parent }
    )
  }
  // Curtains: soft folds, gathered tight at the sides of the window, so
  // the fireplace and the cabinet can stand close to it.
  const curtain = kit.mat(CURTAIN, { roughness: 0.95 })
  const fold = curtain.clone()
  fold.color.offsetHSL(0, 0, -0.06)
  const curtainTop = rodY - 0.04
  const curtainBottom = 0.55
  const length = curtainTop - curtainBottom
  for (const side of [-1, 1]) {
    const edge = side < 0 ? x0 - 0.12 : x1 + 0.12
    for (let i = 0; i < 5; i++) {
      const x = edge + side * (i * 0.08 - 0.1)
      const radius = 0.07 + (i % 2) * 0.012
      kit.mesh(
        new THREE.CapsuleGeometry(radius, length - 2 * radius, 4, 10),
        i % 2 ? fold : curtain,
        x,
        curtainBottom + length / 2,
        0.16 + (i % 2) * 0.03,
        { parent }
      )
    }
    // A tie-back band around the gathered folds.
    kit.block(0.4, 0.06, 0.12, "#c98d4a", edge + side * 0.1, 1.45, 0.24, {
      r: 0.03,
      parent,
    })
  }
}

/**
 * The corkboard (spec 3F §3.2): it belongs to the `papan` hotspot, which pins
 * the newest highlights here. A wooden frame, speckled cork and up to three
 * paper notes held by coloured pins.
 */
function corkboard(kit: Kit, parent: THREE.Object3D) {
  const { x, y, size } = ROOM_PARTS.corkboard
  const width = size * 1.25
  const height = size
  const cork = kit.canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = "#c49a6c"
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 1600; i++) {
      g.fillStyle =
        kit.rand() < 0.5 ? "rgba(120,80,45,.35)" : "rgba(230,200,150,.35)"
      g.fillRect(kit.rand() * w, kit.rand() * h, 2, 2)
    }
  })
  kit.block(width + 0.1, height + 0.1, 0.05, TRIM, x, y - 0.05, 0.025, {
    r: 0.025,
    parent,
  })
  kit.block(
    width,
    height,
    0.03,
    new THREE.MeshStandardMaterial({ map: cork, roughness: 1 }),
    x,
    y,
    0.055,
    { r: 0.01, parent }
  )
  // Three papers, one per newest highlight; setNotes shows and colours them.
  const notes: ReadonlyArray<
    readonly [number, number, number, number, string]
  > = [
    [-0.4, 0.68, 0.26, 0.22, "#d2462e"],
    [-0.08, 0.6, 0.22, 0.3, "#3f7fb5"],
    [0.32, 0.66, 0.3, 0.2, "#e0b45c"],
  ]
  const papers = notes.map(([dx, dy, w, h, pin]) => {
    const paper = new THREE.MeshStandardMaterial({ color: NOTE_PAPER.yellow })
    const note = kit.block(w, h, 0.006, paper, x + dx, y + dy, 0.074, {
      r: 0.002,
      parent,
      cast: false,
    })
    note.rotation.z = (kit.rand() - 0.5) * 0.18
    // Left out of the static merge: they change colour and come and go.
    note.userData.animated = true
    const tack = kit.mesh(
      new THREE.SphereGeometry(0.022, 10, 8),
      pin,
      x + dx,
      y + dy + h - 0.035,
      0.085,
      { parent, cast: false }
    )
    tack.userData.animated = true
    // Bare until setNotes says otherwise.
    note.visible = tack.visible = false
    return { note, tack, paper }
  })
  return {
    /** Shows one paper per colour, in the colour of the highlight; the rest of the board stays bare. */
    setNotes(colors: ReadonlyArray<HighlightColor>) {
      papers.forEach(({ note, tack, paper }, i) => {
        const color = colors[i]
        note.visible = tack.visible = color !== undefined
        if (color !== undefined) paper.color.set(NOTE_PAPER[color])
      })
    },
  }
}

/**
 * The bookcase that fills the shelf wall: one section per genre, five shelves
 * each, on a plinth with a crown and a small brass plate per section. The
 * books come from data (shelves, Task 5).
 */
function shelfWall(kit: Kit, parent: THREE.Object3D) {
  const { depth, bottom, top, rows, z0 } = SHELF
  const z1 = z0 + WALL_SECTIONS.reduce((sum, { width }) => sum + width, 0)
  const length = z1 - z0
  const body = kit.mat("#7a5234", { roughness: 0.65 })
  const board = kit.mat("#8f6440", { roughness: 0.6 })
  const back = kit.mat("#4e3423", { roughness: 0.85 })
  const zc = (z0 + z1) / 2
  kit.block(0.04, top, length, back, 0.03, 0, zc, { r: 0.01, parent })
  kit.block(depth, bottom, length, body, depth / 2, 0, zc, { r: 0.02, parent })
  kit.block(
    depth + 0.08,
    0.14,
    length + 0.12,
    body,
    depth / 2 + 0.02,
    top,
    zc,
    {
      r: 0.03,
      parent,
    }
  )
  kit.block(
    depth + 0.12,
    0.05,
    length + 0.18,
    board,
    depth / 2 + 0.04,
    top + 0.14,
    zc,
    {
      r: 0.02,
      parent,
    }
  )
  const step = (top - bottom) / rows
  for (let row = 1; row < rows; row++) {
    kit.block(
      depth - 0.04,
      0.04,
      length - 0.04,
      board,
      depth / 2,
      bottom + row * step - 0.02,
      zc,
      {
        r: 0.012,
        parent,
      }
    )
  }
  for (let i = 0; i <= WALL_SECTIONS.length; i++) {
    const z = z0 + i * WALL_SECTIONS[0].width
    kit.block(
      depth + 0.02,
      top - bottom,
      0.06,
      body,
      depth / 2 + 0.01,
      bottom,
      Math.min(z1 - 0.03, Math.max(z0 + 0.03, z)),
      {
        r: 0.015,
        parent,
      }
    )
  }
  const plate = kit.mat(BRASS, { metalness: 0.5, roughness: 0.4 })
  for (const { z } of WALL_SECTIONS) {
    kit.block(0.02, 0.07, 0.3, plate, depth + 0.07, top + 0.035, z, {
      r: 0.008,
      parent,
      cast: false,
    })
  }
}

/** The panelled door in the shelf wall, from Prototype Bits (code if missing). */
function door(kit: Kit, models: ModelSet, parent: THREE.Object3D) {
  const { z, width, height } = ROOM_PARTS.door
  const model = models.get("door")
  const holder = new THREE.Group()
  if (model) {
    const inner = new THREE.Group()
    inner.add(model)
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
    fitTo(inner, height)
    holder.add(inner)
  } else {
    kit.block(width + 0.2, height + 0.1, 0.08, TRIM, 0, 0, 0, {
      parent: holder,
    })
    kit.block(width, height, 0.06, "#8a5a36", 0, 0, 0.05, { parent: holder })
  }
  // Built facing +Z; the door faces +X, its back against the wall.
  holder.rotation.y = Math.PI / 2
  const box = new THREE.Box3().setFromObject(holder)
  holder.position.set(-box.min.x, 0, z)
  parent.add(holder)
  // A doormat in front of it.
  kit.block(0.6, 0.02, width * 0.85, "#8c5a3c", 0.55, 0, z, {
    r: 0.01,
    parent,
    cast: false,
  })
}

/**
 * The shell of the room: floor, walls, the window (tells the time), the
 * corkboard (for `papan`), the bookcase and the door (`pintu`). Nothing here
 * is for show only (spec 3F §3.6).
 */
export function buildRoom(
  kit: Kit,
  models: ModelSet
): { setNotes: (colors: ReadonlyArray<HighlightColor>) => void } {
  const shell = new THREE.Group()
  shell.name = "room"
  kit.scene.add(shell)
  floor(kit, shell)
  walls(kit, shell)
  windowFrame(kit, shell)
  const board = corkboard(kit, shell)
  shelfWall(kit, shell)
  mergeStatic(shell)
  door(kit, models, shell)
  return board
}
