import * as THREE from "three"
import type { Kit } from "./kit"
import {
  ADMIN_DESK,
  ATRIUM,
  CARD_CATALOG,
  LOUNGES,
  type Point2,
  type Point3,
  READING_TABLE,
  TOWER,
  TROLLEY,
  ZONES,
} from "./layout"
import { BOOK_COLORS } from "./shelves"

const WOOD = "#c98d55"

export type Seat = { at: Point2; facing: number }
export type Furnishings = {
  /** The page that turns in each open book on the reading table. */
  pagePivots: Array<THREE.Group>
  /** The hanging art globes, which turn slowly. */
  arts: Array<THREE.Mesh>
  /** Where lounge visitors sit. */
  loungeSeats: Array<Seat>
}

const LAMP_POSTS: ReadonlyArray<Point2> = [
  [11.2, 9.6],
  [10.8, 3.2],
  [16.5, 9.5],
  [27.5, 13.5],
  [2.2, 12.5],
]
/** [x, z, scale] */
const PLANTS: ReadonlyArray<Point3> = [
  [16.2, 3.2, 1.3],
  [28.6, 5, 1.2],
  [2.4, 22, 1.1],
  [27.8, 24.5, 1.2],
  [10.8, 22.5, 1],
  [2.4, 31.5, 1.2],
  [32, 20, 1.2],
]

function light(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: "#fff6e0" })
}

/** A tower's body and top; its cubbies are shelf faces (layout.ts). */
function towerBody(kit: Kit, [x, z]: Point2) {
  const { width, height } = TOWER
  kit.block(width, height, width, "#6b4426", x, 0, z)
  kit.block(width + 0.12, 0.14, width + 0.12, "#b9824c", x, height, z)
}

function lampPost(
  kit: Kit,
  x: number,
  z: number,
  base: number,
  height: number
) {
  kit.mesh(
    new THREE.CylinderGeometry(0.02, 0.02, height, 8),
    "#b9935a",
    x,
    base + height / 2,
    z
  )
  kit.mesh(
    new THREE.SphereGeometry(0.22, 20, 16),
    light(),
    x,
    base + height + 0.18,
    z,
    { cast: false }
  )
}

function lampSmall(kit: Kit, x: number, z: number, y: number) {
  kit.mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8),
    "#3a2a22",
    x,
    y + 0.15,
    z
  )
  kit.mesh(new THREE.SphereGeometry(0.1, 14, 10), light(), x, y + 0.36, z, {
    cast: false,
  })
}

function plant(kit: Kit, [x, z, s]: Point3) {
  kit.mesh(
    new THREE.CylinderGeometry(0.32 * s, 0.26 * s, 0.6 * s, 20),
    "#e7e1d8",
    x,
    0.3 * s,
    z
  )
  kit.mesh(
    new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 1.4 * s, 8),
    "#6b4a2e",
    x,
    1.2 * s,
    z
  )
  const leaves = [
    [0, 2, 0, 0.5],
    [0.3, 1.75, 0.15, 0.36],
    [-0.28, 1.8, -0.1, 0.38],
  ] as const
  for (const [dx, dy, dz, r] of leaves) {
    kit.mesh(
      new THREE.SphereGeometry(r * s, 16, 12),
      "#4f7f4f",
      x + dx * s,
      dy * s,
      z + dz * s
    )
  }
}

function displayTable(
  kit: Kit,
  x: number,
  z: number,
  width = 2.6,
  depth = 1.4
) {
  kit.block(width, 0.85, depth, WOOD, x, 0, z, { r: 0.05 })
  const glowSide = new THREE.MeshStandardMaterial({
    color: "#5a3a22",
    emissive: "#ffffff",
    emissiveMap: kit.glow,
    emissiveIntensity: 0.9,
  })
  for (let i = 0; i < Math.floor(width / 0.8); i++) {
    kit.mesh(
      new THREE.PlaneGeometry(0.62, 0.55),
      glowSide,
      x - width / 2 + 0.45 + i * 0.82,
      0.45,
      z + depth / 2 + 0.01,
      { cast: false }
    )
  }
  const covers = ["#3d5a80", "#ee6c4d", "#f4efe6", "#7a9e7e"]
  for (let i = 0; i < 6; i++) {
    kit.block(
      0.32,
      0.03,
      0.42,
      kit.pick(covers),
      x - width / 2 + 0.3 + i * 0.42,
      0.85,
      z + (i % 2 === 1 ? 0.2 : -0.2),
      { r: 0.01 }
    )
  }
  lampPost(kit, x + width / 2 - 0.3, z - depth / 2 + 0.3, 0.85, 0.5)
}

/** An open book whose right-hand page can turn. Returns the page's pivot. */
function openBook(kit: Kit, x: number, y: number, z: number): THREE.Group {
  const base = new THREE.Group()
  base.position.set(x, y, z)
  kit.scene.add(base)
  kit.block(0.22, 0.012, 0.3, "#f7f2e6", -0.11, 0, 0, {
    parent: base,
    r: 0.004,
  })
  kit.block(0.22, 0.012, 0.3, "#ece3cf", 0.11, 0, 0, {
    parent: base,
    r: 0.004,
  })
  const pivot = new THREE.Group()
  base.add(pivot)
  kit.block(0.22, 0.006, 0.29, "#fffaf0", 0.11, 0.013, 0, {
    parent: pivot,
    r: 0.003,
  })
  return pivot
}

/** The long reading table with lamps and chairs. Returns its turning pages. */
function readingTable(kit: Kit): Array<THREE.Group> {
  const [cx, cz] = READING_TABLE
  kit.block(6, 0.08, 1.5, "#d9a66b", cx, 0.76, cz, { r: 0.03 })
  for (const dx of [-2.7, 2.7]) {
    for (const dz of [-0.55, 0.55]) {
      kit.block(0.08, 0.76, 0.08, "#3a2a22", cx + dx, 0, cz + dz, { r: 0.02 })
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = cx - 2.1 + i * 1.4
    lampSmall(kit, x, cz, 0.84)
    for (const side of [-1, 1]) {
      const chairZ = cz + side * 1.1
      kit.block(0.46, 0.08, 0.46, "#efe3cf", x + 0.35, 0.44, chairZ, {
        r: 0.03,
      })
      kit.block(0.46, 0.5, 0.06, "#efe3cf", x + 0.35, 0.52, cz + side * 1.33, {
        r: 0.03,
      })
      for (const lx of [-0.18, 0.18]) {
        for (const lz of [-0.18, 0.18]) {
          kit.block(
            0.03,
            0.44,
            0.03,
            "#3a2a22",
            x + 0.35 + lx,
            0,
            chairZ + lz,
            {
              r: 0.01,
            }
          )
        }
      }
    }
  }
  return [
    openBook(kit, cx - 1.1, 0.85, cz - 0.3),
    openBook(kit, cx + 1.7, 0.85, cz + 0.3),
  ]
}

function adminDesk(kit: Kit) {
  const [cx, cz] = ADMIN_DESK
  kit.block(3.2, 1.0, 1.0, "#e9e3da", cx, 0, cz, { r: 0.12 })
  kit.block(
    3.0,
    0.05,
    0.05,
    new THREE.MeshBasicMaterial({ color: "#ffd9a0" }),
    cx,
    0.15,
    cz + 0.52,
    { cast: false }
  )
  kit.block(3.3, 0.06, 1.1, WOOD, cx, 1.0, cz, { r: 0.03 })
  const screen = new THREE.MeshStandardMaterial({
    color: "#20242a",
    emissive: "#4a86d6",
    emissiveIntensity: 0.8,
  })
  const monitor = kit.block(
    0.6,
    0.38,
    0.05,
    screen,
    cx + 0.6,
    1.24,
    cz - 0.15,
    { r: 0.02 }
  )
  monitor.rotation.y = 0.35
  kit.block(0.06, 0.2, 0.06, "#3a3a40", cx + 0.6, 1.06, cz - 0.2, { r: 0.01 })
  lampSmall(kit, cx - 1.2, cz - 0.2, 1.06)
}

function trolley(kit: Kit) {
  const [cx, cz] = TROLLEY
  kit.block(1.1, 0.06, 0.6, "#9aa0a6", cx, 0.35, cz, { r: 0.02 })
  kit.block(1.1, 0.06, 0.6, "#9aa0a6", cx, 0.85, cz, { r: 0.02 })
  for (const dx of [-0.5, 0.5]) {
    for (const dz of [-0.25, 0.25]) {
      kit.block(0.03, 0.85, 0.03, "#7a8086", cx + dx, 0.08, cz + dz, {
        r: 0.01,
      })
      kit.mesh(
        new THREE.SphereGeometry(0.06, 10, 8),
        "#222222",
        cx + dx,
        0.06,
        cz + dz
      )
    }
  }
  for (let i = 0; i < 9; i++) {
    const height = 0.26 + kit.rand() * 0.08
    kit.block(
      0.07,
      height,
      0.2,
      kit.pick(BOOK_COLORS),
      cx - 0.45 + i * 0.1,
      0.91,
      cz,
      { r: 0.006 }
    )
  }
}

function hangingArt(
  kit: Kit,
  [x, y, z]: Point3,
  radius: number,
  colors: ReadonlyArray<string>
): THREE.Mesh {
  const top = ATRIUM.height + 2
  kit.mesh(
    new THREE.CylinderGeometry(0.01, 0.01, top - y, 4),
    "#c9c4bd",
    x,
    (top + y) / 2,
    z,
    { cast: false }
  )
  const texture = kit.canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = colors[0]
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = kit.pick(colors)
      g.lineWidth = 6 + kit.rand() * 18
      g.beginPath()
      g.moveTo(kit.rand() * w, kit.rand() * h)
      g.bezierCurveTo(
        kit.rand() * w,
        kit.rand() * h,
        kit.rand() * w,
        kit.rand() * h,
        kit.rand() * w,
        kit.rand() * h
      )
      g.stroke()
    }
  })
  return kit.mesh(
    new THREE.SphereGeometry(radius, 32, 24),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5 }),
    x,
    y,
    z
  )
}

const shade = (hex: string, factor: number) =>
  `#${new THREE.Color(hex).multiplyScalar(factor).getHexString()}`

function sofa(kit: Kit, x: number, z: number, facing: number, color: string) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = facing
  kit.scene.add(group)
  kit.block(2.3, 0.4, 0.95, shade(color, 0.85), 0, 0, 0, {
    parent: group,
    r: 0.1,
  })
  kit.block(2.1, 0.14, 0.75, shade(color, 1.15), 0, 0.4, 0.06, {
    parent: group,
    r: 0.07,
  })
  kit.block(2.3, 0.62, 0.24, color, 0, 0.34, -0.36, { parent: group, r: 0.1 })
  for (const dx of [-1.06, 1.06]) {
    kit.block(0.2, 0.36, 0.95, color, dx, 0.34, 0, { parent: group, r: 0.08 })
  }
}

/** A rug, two facing sofas, a round table and a lamp. Returns its two seats. */
function lounge(kit: Kit, [cx, cz]: Point2, color: string): Array<Seat> {
  kit.block(5.4, 0.02, 4.2, "#7a4a32", cx, 0, cz, { r: 0.01, cast: false })
  sofa(kit, cx, cz - 1.45, 0, color)
  sofa(kit, cx, cz + 1.45, Math.PI, color)
  kit.mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 32), WOOD, cx, 0.42, cz)
  kit.mesh(
    new THREE.CylinderGeometry(0.06, 0.12, 0.4, 12),
    "#3a2a22",
    cx,
    0.2,
    cz
  )
  for (let i = 0; i < 3; i++) {
    kit.block(
      0.3,
      0.05,
      0.22,
      kit.pick(BOOK_COLORS),
      cx - 0.15 + i * 0.05,
      0.45 + i * 0.05,
      cz,
      { r: 0.01 }
    )
  }
  lampPost(kit, cx + 2.4, cz - 1.6, 0, 2.2)
  return [
    { at: [cx - 0.5, cz - 1.45], facing: 0 },
    { at: [cx + 0.6, cz + 1.45], facing: Math.PI },
  ]
}

/** A low cabinet of small drawers with brass pulls: the card catalogue (spec 2 §6.4). */
function cardCatalog(kit: Kit) {
  const [cx, cz] = CARD_CATALOG
  kit.block(0.7, 1.25, 1.5, "#7a4a2a", cx, 0, cz, { r: 0.04 })
  kit.block(0.8, 0.06, 1.6, WOOD, cx, 1.25, cz, { r: 0.02 })
  const front = cx + 0.36
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      const y = 0.14 + row * 0.27
      const z = cz - 0.54 + column * 0.36
      kit.block(0.03, 0.22, 0.31, "#b9824c", front, y, z, {
        r: 0.01,
        cast: false,
      })
      kit.block(0.03, 0.03, 0.1, "#d9b26a", front + 0.02, y + 0.09, z, {
        r: 0.01,
        cast: false,
      })
    }
  }
}

/** Towers, desks, the trolley, the card catalogue, decorations and the lounges (spec 1D §4). */
export function buildFurniture(kit: Kit): Furnishings {
  for (const { at } of ZONES) towerBody(kit, at)
  const pagePivots = readingTable(kit)
  adminDesk(kit)
  trolley(kit)
  cardCatalog(kit)
  displayTable(kit, 22, 5.5)
  displayTable(kit, 26.5, 9.5, 2.2, 1.2)
  displayTable(kit, 9.5, 11.6, 2.2, 1.2)
  for (const [x, z] of LAMP_POSTS) lampPost(kit, x, z, 0, 2.6)
  for (const spot of PLANTS) plant(kit, spot)
  const loungeSeats = LOUNGES.flatMap(({ at, color }) => lounge(kit, at, color))
  const arts = [
    hangingArt(kit, [14.5, 10.6, 9], 1.1, [
      "#f6e7d0",
      "#2f6fb0",
      "#e94f37",
      "#f2c14e",
      "#3a3a3a",
    ]),
    hangingArt(kit, [22, 11.4, 4.5], 1.4, [
      "#fbe3e8",
      "#d1495b",
      "#edae49",
      "#00798c",
      "#30638e",
    ]),
    hangingArt(kit, [11.5, 12.2, 17], 0.8, [
      "#e8f1f2",
      "#13293d",
      "#006494",
      "#e94f37",
    ]),
  ]
  return { pagePivots, arts, loungeSeats }
}
