import * as THREE from "three"
import { type Kit, mergeStatic } from "./kit"
import { FURNITURE, type Point3 } from "./layout"
import type { ModelKey } from "./model-manifest"
import { fitTo, type ModelSet } from "./models"

/** What the light rigs drive: `kind` says which rig value scales the glow. */
export type Glow = {
  material: THREE.MeshStandardMaterial
  max: number
  kind: "lamps" | "fire"
}
export type Furnishings = {
  /** The reading lamp and the desk lamp; empty without point lights. */
  lamps: Array<THREE.PointLight>
  /** The fireplace's light (intensity 0 without point lights). */
  fire: THREE.PointLight
  /** Window light is the skyline's; kept for the rigs' shape. */
  windowGlow: Array<THREE.Mesh>
  emissives: Array<Glow>
}

const BRASS = "#c9a24a"
const SOOT = "#2a1c16"

type Build = {
  kit: Kit
  /** The piece's own group: built facing +Z, centred, standing on y = 0. */
  group: THREE.Group
  size: Point3
  glow: (
    color: string,
    max: number,
    kind: Glow["kind"]
  ) => THREE.MeshStandardMaterial
  light: (color: string, at: Point3, kind: "lamp" | "fire") => void
}

/** Stones of a slightly different tone each, so the surround reads as built. */
const STONES = ["#b9a184", "#c7b293", "#ad957a", "#bfa98c"]

/**
 * The fireplace (code: no pack has one): a stone surround on a hearth, a
 * sooty firebox with logs and flames, and a wooden mantel with candles and
 * books. The flames and candles glow with the rig's `fire` and `lamps`.
 */
function fireplace({ kit, group, size, glow, light }: Build) {
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
  const bark = kit.mat("#6b4226", { roughness: 0.95 })
  const cut = kit.mat("#c89a64", { roughness: 0.9 })
  for (const [x, y, turn, length] of [
    [0, 0.3, 0.12, 0.72],
    [-0.08, 0.38, -0.25, 0.6],
    [0.1, 0.42, 0.4, 0.5],
  ] as const) {
    const log = new THREE.Group()
    log.position.set(x, y, 0.02)
    log.rotation.y = turn
    parent.add(log)
    const body = kit.mesh(
      new THREE.CylinderGeometry(0.07, 0.075, length, 12),
      bark,
      0,
      0,
      0,
      { parent: log }
    )
    body.rotation.z = Math.PI / 2
    for (const end of [-1, 1]) {
      const face = kit.mesh(
        new THREE.CircleGeometry(0.068, 12),
        cut,
        (end * length) / 2 + end * 0.001,
        0,
        0,
        { parent: log }
      )
      face.rotation.y = (end * Math.PI) / 2
    }
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
      0.32 + height / 2,
      0.04 + (material === inner ? 0.05 : 0),
      { parent, cast: false, receive: false }
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
  const flame = glow("#ffc35c", 2.2, "lamps")
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

/** The base furniture's code builders, by model key (spec 3F §5.2). */
const BUILDERS: Partial<Record<ModelKey, (build: Build) => void>> = {
  fireplace,
  laptop,
  // The glass cabinet is the showcase's (showcase.ts): it holds the covers.
  glassCabinet: () => undefined,
}

/** A rounded stand-in for a model that is missing. */
function fallback({ kit, group, size }: Build) {
  kit.block(size[0], size[1], size[2], "#a07850", 0, 0, 0, {
    r: Math.min(size[0], size[1], size[2]) * 0.2,
    parent: group,
  })
}

/** Turns before fitting: the notebook lies on its back. */
const PRE_TURN: Partial<Record<ModelKey, (object: THREE.Object3D) => void>> = {
  notebook: (object) => {
    object.rotation.z = Math.PI / 2
  },
}

/**
 * A model scaled to the piece's height (fitTo), then stretched on X and Z
 * to its exact footprint: the layout is the source of truth (plan 3F-R1,
 * decision 4); sizes there follow each model's proportions, so the stretch
 * is slight.
 */
function placeModel(
  model: THREE.Object3D,
  key: ModelKey,
  size: Point3
): THREE.Group {
  const turned = new THREE.Group()
  turned.add(model)
  PRE_TURN[key]?.(model)
  const inner = new THREE.Group()
  inner.add(turned)
  fitTo(inner, size[1])
  const box = new THREE.Box3().setFromObject(inner)
  const extent = box.getSize(new THREE.Vector3())
  if (extent.x > 0) inner.scale.x *= size[0] / extent.x
  if (extent.z > 0) inner.scale.z *= size[2] / extent.z
  fitTo(inner, size[1])
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  return inner
}

/**
 * Where each lamp's glow and light sit, as shares of the fitted size: the
 * KayKit table lamp's shade is its top half.
 */
const LAMP_BULB = { y: 0.62, shade: 0.4 } as const

function lampGlow(build: Build) {
  const { kit, group, size, glow, light } = build
  const [w, h] = size
  // A warm bulb under the shade, and the shade's inside lit through its top.
  const bulb = kit.mesh(
    new THREE.SphereGeometry(w * 0.16, 14, 10),
    glow("#ffe2a8", 2.6, "lamps"),
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
    glow("#ffd89a", 1.4, "lamps"),
    0,
    h * 0.995,
    0,
    { parent: group, cast: false }
  )
  liner.userData.animated = true
  light("#ffcf8a", [0, h * 0.7, 0], "lamp")
}

/** Packing tape and an address label on the parcel box. */
function parcelDetails({ kit, group, size }: Build) {
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
}

/**
 * The base furniture (spec 3F §3.1): each piece from its model or its code
 * builder, at its layout size and turn. Point lights only with `withLights`
 * (quality "tinggi").
 */
export function buildFurniture(
  kit: Kit,
  models: ModelSet,
  withLights: boolean
): Furnishings {
  const lamps: Array<THREE.PointLight> = []
  const fire = new THREE.PointLight("#ff9a4a", 0, 9, 1)
  const emissives: Array<Glow> = []
  const glows = new Map<string, THREE.MeshStandardMaterial>()

  for (const piece of FURNITURE) {
    const holder = new THREE.Group()
    holder.name = piece.id
    holder.position.set(piece.at[0], piece.y ?? 0, piece.at[1])
    holder.rotation.y = piece.turn
    kit.scene.add(holder)
    const build: Build = {
      kit,
      group: holder,
      size: piece.size,
      glow(color, max, kind) {
        const key = `${color}:${max}:${kind}`
        let material = glows.get(key)
        if (!material) {
          material = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0,
            roughness: 0.5,
          })
          glows.set(key, material)
          emissives.push({ material, max, kind })
        }
        return material
      },
      light(color, [x, y, z], kind) {
        if (kind === "fire") {
          fire.position.set(x, y, z)
          holder.add(fire)
          return
        }
        if (!withLights) return
        const lamp = new THREE.PointLight(color, 0, 7, 1)
        lamp.position.set(x, y, z)
        holder.add(lamp)
        lamps.push(lamp)
      },
    }
    const model = models.get(piece.model)
    if (model) {
      holder.add(placeModel(model, piece.model, piece.size))
    } else {
      ;(BUILDERS[piece.model] ?? fallback)(build)
      mergeStatic(holder)
    }
    if (piece.model === "readingLamp") lampGlow(build)
    if (piece.model === "parcelBox") parcelDetails(build)
  }
  if (!withLights) fire.removeFromParent()
  return { lamps, fire, windowGlow: [], emissives }
}
