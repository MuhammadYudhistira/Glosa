import * as THREE from "three"
import type { Kit } from "./kit"
import type { Point3 } from "./layout"
import type { ModelKey } from "./model-manifest"

/** What the light rigs drive: `kind` says which rig value scales the glow. */
export type Glow = {
  material: THREE.MeshStandardMaterial
  max: number
  kind: "lamps" | "fire" | "desk"
}

/** What a builder gets for one piece of furniture (spec 3F §5.2). */
export type Build = {
  kit: Kit
  /** The piece's own group: built facing +Z, centred, standing on y = 0. */
  group: THREE.Group
  size: Point3
  glow: (
    color: string,
    max: number,
    kind: Glow["kind"]
  ) => THREE.MeshStandardMaterial
  light: (color: string, at: Point3, kind: "lamp" | "desk" | "fire") => void
  /** Collects an object the room's signals move; it is left out of the merge. */
  mark: (role: "flame" | "flap", object: THREE.Object3D) => void
}

const BRASS = "#c9a24a"
const SOOT = "#2a1c16"

/**
 * A split log lying along X (turned `turn` about Y): bark around, the pale
 * cut wood at both ends. The fireplace and the log basket share it.
 */
function log(
  kit: Kit,
  parent: THREE.Object3D,
  [x, y, z]: Point3,
  turn: number,
  length: number,
  radius: number
) {
  const holder = new THREE.Group()
  holder.position.set(x, y, z)
  holder.rotation.y = turn
  parent.add(holder)
  const body = kit.mesh(
    new THREE.CylinderGeometry(radius, radius * 1.07, length, 12),
    kit.mat("#6b4226", { roughness: 0.95 }),
    0,
    0,
    0,
    { parent: holder }
  )
  body.rotation.z = Math.PI / 2
  for (const end of [-1, 1]) {
    const face = kit.mesh(
      new THREE.CircleGeometry(radius * 0.97, 12),
      kit.mat("#c89a64", { roughness: 0.9 }),
      (end * length) / 2 + end * 0.001,
      0,
      0,
      { parent: holder }
    )
    face.rotation.y = (end * Math.PI) / 2
  }
}

/** Stones of a slightly different tone each, so the surround reads as built. */
const STONES = ["#b9a184", "#c7b293", "#ad957a", "#bfa98c"]

/**
 * The fireplace (code: no pack has one): a stone surround on a hearth, a
 * sooty firebox with logs and flames, and a wooden mantel with candles and
 * books. The flames and candles glow with the rig's `fire` and `lamps`.
 */
function fireplace({ kit, group, size, glow, light, mark }: Build) {
  const [w, h, d] = size
  const parent = group
  const front = d / 2
  // Hearth: a stone slab that runs out into the room.
  kit.block(w + 0.5, 0.1, d + 0.4, "#8f7a66", 0, 0, 0.2, { r: 0.03, parent })
  kit.block(w + 0.36, 0.03, d + 0.3, "#a38c75", 0, 0.1, 0.18, {
    r: 0.012,
    parent,
  })
  const mantelY = h - 0.16
  const pillar = 0.42
  const opening = w - 2 * pillar
  // Pillars of stacked stones, left and right.
  for (const side of [-1, 1]) {
    const x = side * (w / 2 - pillar / 2)
    let y = 0.13
    let i = side < 0 ? 0 : 2
    while (y < mantelY - 0.05) {
      const height = Math.min(0.26 + (i % 3) * 0.04, mantelY - y)
      kit.block(
        pillar - (i % 2) * 0.03,
        height - 0.02,
        d - 0.02 - (i % 2) * 0.02,
        STONES[i % STONES.length],
        x + side * (i % 2) * 0.01,
        y,
        0,
        { r: 0.04, parent }
      )
      y += height
      i += 1
    }
  }
  // The lintel, in three stones over the opening, with a keystone.
  const lintelY = mantelY - 0.36
  ;[-1, 0, 1].forEach((k, i) => {
    kit.block(
      opening / 3 - 0.02,
      0.34,
      d - 0.04,
      STONES[(i + 1) % STONES.length],
      (k * opening) / 3,
      lintelY,
      0,
      { r: 0.04, parent }
    )
  })
  kit.block(0.2, 0.38, 0.08, "#d1bd9f", 0, lintelY - 0.03, front - 0.02, {
    r: 0.04,
    parent,
  })
  // The firebox: soot-dark walls and back, set into the surround.
  const firebox = kit.mat(SOOT, { roughness: 1 })
  kit.block(
    opening + 0.02,
    lintelY - 0.13,
    0.08,
    firebox,
    0,
    0.13,
    -front + 0.06,
    {
      r: 0.02,
      parent,
    }
  )
  for (const side of [-1, 1]) {
    kit.block(
      0.06,
      lintelY - 0.13,
      d - 0.12,
      firebox,
      side * (opening / 2 - 0.02),
      0.13,
      -0.02,
      {
        r: 0.02,
        parent,
      }
    )
  }
  kit.block(opening, 0.02, d - 0.1, "#1a120e", 0, 0.13, 0, { r: 0.01, parent })
  // An iron grate with three logs.
  for (const side of [-1, 1]) {
    kit.block(0.04, 0.12, 0.3, "#2e2a28", side * 0.3, 0.14, 0.02, {
      r: 0.015,
      parent,
    })
  }
  for (const [x, y, turn, length] of [
    [0, 0.3, 0.12, 0.72],
    [-0.08, 0.38, -0.25, 0.6],
    [0.1, 0.42, 0.4, 0.5],
  ] as const) {
    log(kit, parent, [x, y, 0.02], turn, length, 0.07)
  }
  // Embers and flames: layered teardrops, hot at the core.
  const embers = glow("#ff4a12", 1.0, "fire")
  const outer = glow("#ff5e14", 0.85, "fire")
  const inner = glow("#ffa83a", 1.0, "fire")
  const bed = kit.block(opening - 0.16, 0.03, 0.3, embers, 0, 0.15, 0.03, {
    r: 0.012,
    parent,
    cast: false,
  })
  bed.userData.animated = true
  // The flames share one group pivoting at their base, so the fire's
  // strength scales them (spec 3F §3.6).
  const flames = new THREE.Group()
  flames.position.y = 0.32
  parent.add(flames)
  mark("flame", flames)
  for (const [x, height, s, material] of [
    [-0.16, 0.36, 0.1, outer],
    [0.04, 0.46, 0.13, outer],
    [0.2, 0.32, 0.09, outer],
    [-0.08, 0.26, 0.07, inner],
    [0.08, 0.32, 0.08, inner],
  ] as const) {
    const flame = kit.mesh(
      new THREE.SphereGeometry(1, 14, 12),
      material,
      x,
      height / 2,
      0.04 + (material === inner ? 0.05 : 0),
      { parent: flames, cast: false, receive: false }
    )
    flame.scale.set(s, height / 2, s * 0.8)
    flame.userData.animated = true
  }
  light("#ff9a4a", [0, 0.55, front + 0.45], "fire")

  // The mantel: a thick wooden shelf on two small corbels.
  kit.block(w + 0.24, 0.12, d + 0.12, "#6b4428", 0, mantelY, 0.04, {
    r: 0.035,
    parent,
  })
  kit.block(w + 0.14, 0.04, d + 0.04, "#80542f", 0, mantelY + 0.12, 0.03, {
    r: 0.015,
    parent,
  })
  for (const side of [-1, 1]) {
    kit.block(
      0.1,
      0.14,
      0.1,
      "#6b4428",
      side * (w / 2 - 0.15),
      mantelY - 0.14,
      front - 0.02,
      {
        r: 0.03,
        parent,
      }
    )
  }
  const top = mantelY + 0.16
  // Two candles in brass holders, a clock and a small stack of books.
  const wax = kit.mat("#f3e7cf", { roughness: 0.7 })
  // The candles are part of the fire's signal (spec 3F §3.6).
  const flame = glow("#ffc35c", 2.2, "fire")
  for (const [x, height] of [
    [-0.62, 0.2],
    [-0.5, 0.14],
  ] as const) {
    kit.mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.03, 14),
      kit.mat(BRASS, { metalness: 0.5, roughness: 0.4 }),
      x,
      top + 0.015,
      0.02,
      { parent }
    )
    kit.mesh(
      new THREE.CylinderGeometry(0.025, 0.025, height, 12),
      wax,
      x,
      top + 0.03 + height / 2,
      0.02,
      { parent }
    )
    const tip = kit.mesh(
      new THREE.SphereGeometry(1, 10, 8),
      flame,
      x,
      top + 0.06 + height,
      0.02,
      {
        parent,
        cast: false,
      }
    )
    tip.scale.set(0.014, 0.03, 0.014)
    tip.userData.animated = true
  }
  kit.block(0.18, 0.2, 0.09, "#5a3a24", 0.08, top, 0.02, { r: 0.04, parent })
  kit.mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.012, 20).rotateX(Math.PI / 2),
    "#f6efe0",
    0.08,
    top + 0.12,
    0.07,
    { parent }
  )
  for (const [i, color] of ["#3f5d8a", "#c0623a", "#e0b45c"].entries()) {
    kit.block(
      0.28 - i * 0.03,
      0.045,
      0.18,
      color,
      0.58,
      top + i * 0.046,
      0.02,
      {
        r: 0.01,
        parent,
      }
    )
  }
}

/** The laptop (code: none in the pack): aluminium base, keyboard, a lit screen. */
function laptop({ kit, group, size }: Build) {
  const [w, h, d] = size
  const parent = group
  const body = kit.mat("#a7adb5", { metalness: 0.45, roughness: 0.35 })
  kit.block(w, 0.02, d, body, 0, 0, 0, { r: 0.008, parent })
  kit.block(w * 0.86, 0.004, d * 0.42, "#2c2f35", 0, 0.02, -d * 0.12, {
    r: 0.002,
    parent,
    cast: false,
  })
  kit.block(w * 0.3, 0.003, d * 0.22, "#8f959d", 0, 0.02, d * 0.28, {
    r: 0.002,
    parent,
    cast: false,
  })
  // The lid, hinged at the back, tilted back a little.
  const hinge = new THREE.Group()
  hinge.position.set(0, 0.02, -d / 2 + 0.01)
  hinge.rotation.x = -0.28
  parent.add(hinge)
  const lidHeight = h - 0.02
  kit.block(w, lidHeight, 0.012, body, 0, 0, 0, { r: 0.006, parent: hinge })
  const screen = kit.canvasTexture(128, 96, (g, sw, sh) => {
    g.fillStyle = "#f4efe6"
    g.fillRect(0, 0, sw, sh)
    g.fillStyle = "#1f8a70"
    g.fillRect(0, 0, sw, 12)
    g.fillStyle = "#d9cdb8"
    g.fillRect(8, 20, 34, sh - 28)
    g.fillStyle = "#7d8ea3"
    for (let y = 22; y < sh - 10; y += 9)
      g.fillRect(50, y, 40 + ((y * 7) % 30), 3)
  })
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.9, lidHeight * 0.86),
    new THREE.MeshStandardMaterial({
      map: screen,
      emissive: "#ffffff",
      emissiveMap: screen,
      emissiveIntensity: 0.55,
      roughness: 0.3,
    })
  )
  face.position.set(0, lidHeight / 2, 0.0065)
  hinge.add(face)
}

/** A glazed mug of tea on the desk (code: none in the packs). */
function mug({ kit, group, size }: Build) {
  const [w, h] = size
  const parent = group
  const radius = Math.min(size[2], w * 0.72) / 2
  const x = -(w / 2 - radius)
  const glaze = kit.mat("#d9644a", { roughness: 0.35 })
  kit.mesh(
    new THREE.CylinderGeometry(radius, radius * 0.92, h, 18),
    glaze,
    x,
    h / 2,
    0,
    { parent }
  )
  // A cream band, the tea inside, and the handle on the +X side.
  kit.mesh(
    new THREE.CylinderGeometry(radius * 1.01, radius * 1.01, h * 0.22, 18),
    kit.mat("#f3e7cf", { roughness: 0.4 }),
    x,
    h * 0.62,
    0,
    { parent, cast: false }
  )
  const tea = kit.mesh(
    new THREE.CircleGeometry(radius * 0.86, 18),
    kit.mat("#5a3218", { roughness: 0.2 }),
    x,
    h * 0.86,
    0,
    { parent, cast: false }
  )
  tea.rotation.x = -Math.PI / 2
  // A half ring on the side, within the piece's width.
  const reach = w - 2 * radius
  kit.mesh(
    new THREE.TorusGeometry(reach * 0.7, reach * 0.2, 8, 16, Math.PI),
    glaze,
    x + radius * 0.95,
    h * 0.52,
    0,
    { parent }
  ).rotation.z = -Math.PI / 2
}

/** Loose sheets with a few lines of writing, a pen and a pencil on them. */
function papers({ kit, group, size }: Build) {
  const [w, , d] = size
  const parent = group
  const sheet = kit.mat("#f6efe0", { roughness: 0.9 })
  const ink = kit.mat("#7d8ea3", { roughness: 0.9 })
  for (const [dx, dz, turn, y] of [
    [-0.03, 0.01, 0.12, 0],
    [0.02, -0.01, -0.06, 0.004],
  ] as const) {
    const page = new THREE.Group()
    page.position.set(dx, y, dz)
    page.rotation.y = turn
    parent.add(page)
    kit.block(w * 0.6, 0.003, d * 0.92, sheet, 0, 0, 0, {
      r: 0.001,
      parent: page,
      cast: false,
    })
    // Lines of writing on the top sheet only.
    if (y === 0) continue
    for (let row = 0; row < 6; row++) {
      kit.block(
        w * (0.42 - (row % 3) * 0.06),
        0.001,
        0.006,
        ink,
        -w * 0.04,
        0.003,
        -d * 0.34 + row * d * 0.1,
        { r: 0.0005, parent: page, cast: false }
      )
    }
  }
  // A dark pen with a brass clip, and a yellow pencil with its tip.
  const pen = kit.mesh(
    new THREE.CylinderGeometry(0.007, 0.007, d * 0.62, 10),
    kit.mat("#24324a", { roughness: 0.35 }),
    w * 0.36,
    0.012,
    0,
    { parent }
  )
  pen.rotation.x = Math.PI / 2
  kit.block(0.004, 0.004, 0.04, BRASS, w * 0.36, 0.017, -d * 0.22, {
    r: 0.001,
    parent,
    cast: false,
  })
  const pencil = new THREE.Group()
  pencil.position.set(w * 0.26, 0.011, d * 0.06)
  pencil.rotation.y = 0.5
  parent.add(pencil)
  const wood = kit.mesh(
    new THREE.CylinderGeometry(0.006, 0.006, d * 0.5, 6),
    kit.mat("#e0b45c", { roughness: 0.6 }),
    0,
    0,
    0,
    { parent: pencil }
  )
  wood.rotation.x = Math.PI / 2
  const tip = kit.mesh(
    new THREE.ConeGeometry(0.006, 0.02, 6),
    kit.mat("#c89a64", { roughness: 0.8 }),
    0,
    0,
    d * 0.25 + 0.01,
    { parent: pencil, cast: false }
  )
  tip.rotation.x = Math.PI / 2
}

/** A woven basket of firewood beside the hearth (code: none in the packs). */
function logBasket({ kit, group, size }: Build) {
  const [w, h, d] = size
  const parent = group
  const wall = h * 0.5
  // Woven bands of two tones, every other one set in a little.
  const tones = ["#c4935a", "#a87843"]
  const bands = 4
  for (let i = 0; i < bands; i++) {
    const inset = (i % 2) * 0.014
    kit.block(
      w - inset,
      wall / bands,
      d - inset,
      tones[i % 2],
      0,
      (i * wall) / bands,
      0,
      { r: 0.025, parent }
    )
  }
  const rope = kit.mat("#8a5a2e", { roughness: 0.9 })
  kit.block(w + 0.02, 0.03, d + 0.02, rope, 0, wall - 0.01, 0, {
    r: 0.014,
    parent,
  })
  // Rope handles at both ends.
  for (const side of [-1, 1]) {
    const handle = kit.mesh(
      new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI),
      rope,
      side * (w / 2 - 0.01),
      wall,
      0,
      { parent }
    )
    handle.rotation.y = Math.PI / 2
  }
  // Split logs along Z, their cut ends to the room: three below, two on top.
  const radius = 0.06
  const length = d * 0.95
  for (const [x, y, turn] of [
    [-w * 0.26, wall - 0.02, 0.05],
    [0, wall - 0.01, -0.04],
    [w * 0.26, wall - 0.02, 0.03],
    [-w * 0.13, wall + radius * 1.5, -0.06],
    [w * 0.13, wall + radius * 1.45, 0.07],
  ] as const) {
    const top = Math.min(y, h - radius)
    log(kit, parent, [x, top, 0], Math.PI / 2 + turn, length, radius)
  }
}

/**
 * Where each lamp's glow and light sit, as shares of the fitted size: the
 * KayKit table lamp's shade is its top half.
 */
const LAMP_BULB = { y: 0.62, shade: 0.4 } as const

function lampGlow(build: Build, kind: "lamps" | "desk") {
  const { kit, group, size, glow, light } = build
  const [w, h] = size
  // A warm bulb under the shade, and the shade's inside lit through its top.
  const bulb = kit.mesh(
    new THREE.SphereGeometry(w * 0.16, 14, 10),
    glow("#ffe2a8", 2.6, kind),
    0,
    h * LAMP_BULB.y,
    0,
    { parent: group, cast: false }
  )
  bulb.userData.animated = true
  const liner = kit.mesh(
    new THREE.CylinderGeometry(
      w * LAMP_BULB.shade,
      w * LAMP_BULB.shade,
      0.01,
      24
    ),
    glow("#ffd89a", 1.4, kind),
    0,
    h * 0.995,
    0,
    { parent: group, cast: false }
  )
  liner.userData.animated = true
  light("#ffcf8a", [0, h * 0.7, 0], kind === "desk" ? "desk" : "lamp")
}

/** Packing tape and an address label on the parcel box. */
function parcelDetails({ kit, group, size, mark }: Build) {
  const [w, h, d] = size
  const tape = kit.mat("#d9b98a", { roughness: 0.4 })
  kit.block(0.1, 0.006, d + 0.004, tape, 0, h, 0, {
    r: 0.002,
    parent: group,
    cast: false,
  })
  kit.block(0.1, h * 0.35, 0.006, tape, 0, h * 0.65, d / 2, {
    r: 0.002,
    parent: group,
    cast: false,
  })
  kit.block(w * 0.28, 0.004, d * 0.3, "#f6efe0", w * 0.24, h, -d * 0.12, {
    r: 0.002,
    parent: group,
    cast: false,
  })
  // Two flaps hinged on the long sides: open (±1.9 rad) when a book has no
  // genre, closed otherwise (spec 3F §3.6).
  for (const side of [-1, 1] as const) {
    const hinge = new THREE.Group()
    hinge.position.set(0, h, (side * d) / 2)
    hinge.userData.side = side
    group.add(hinge)
    kit.block(w * 0.98, 0.006, d / 2, "#c8a06a", 0, 0, (-side * d) / 4, {
      r: 0.002,
      parent: hinge,
      cast: false,
    })
    mark("flap", hinge)
  }
}

/** A rounded stand-in for a model that is missing. */
export function fallback({ kit, group, size }: Build) {
  kit.block(size[0], size[1], size[2], "#a07850", 0, 0, 0, {
    r: Math.min(size[0], size[1], size[2]) * 0.2,
    parent: group,
  })
}

/** The code builders, by model key (spec 3F §5.2), for pieces without a model. */
export const BUILDERS: Partial<Record<ModelKey, (build: Build) => void>> = {
  fireplace,
  laptop,
  mug,
  papers,
  logBasket,
  // The glass cabinet is the showcase's (showcase.ts): it holds the covers.
  glassCabinet: () => undefined,
}

/** What is added to a piece after its model or builder: glows and labels. */
export const DETAILS: Partial<
  Record<ModelKey, (build: Build, id: string) => void>
> = {
  // The desk lamp follows the vocabulary signal, the reading lamp the clock.
  readingLamp: (build, id) =>
    lampGlow(build, id === "deskLamp" ? "desk" : "lamps"),
  parcelBox: parcelDetails,
}
