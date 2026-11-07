import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import type { Kit } from "./kit"
import { ROOM_PARTS } from "./layout"

/**
 * The city behind the window (spec 3F §3.1; Tahap 4 lights it for readers
 * online). The camera looks down along (−1, −1, −1), so through the opening
 * it sees what lies just behind the wall and lower down. The whole city is a
 * shallow diorama inside a box right behind the opening: whatever pokes past
 * the opening is hidden by the wall from the camera's angle, so no mask is
 * needed. Depth d behind the wall shows through the window at x − d and y − d.
 */
const { x0, x1, y0, y1 } = ROOM_PARTS.window
/** The backdrop, deepest; the buildings stand between it and the wall. */
const BACK = 0.75
const SKY = { x0: x0 - BACK - 0.15, x1: x1 - 0.1, y0: y0 - BACK - 0.2, y1: y1 }

export type Skyline = {
  /** 0 by day, 1 at night: the windows of the city and the night sky. */
  setCity: (k: number) => void
}

type SkyPaint = {
  top: string
  middle: string
  bottom: string
  draw?: (g: CanvasRenderingContext2D, w: number, h: number) => void
}

function skyTexture(kit: Kit, paint: SkyPaint): THREE.CanvasTexture {
  return kit.canvasTexture(512, 512, (g, w, h) => {
    const gradient = g.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, paint.top)
    gradient.addColorStop(0.55, paint.middle)
    gradient.addColorStop(1, paint.bottom)
    g.fillStyle = gradient
    g.fillRect(0, 0, w, h)
    paint.draw?.(g, w, h)
  })
}

function cloud(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string
) {
  g.fillStyle = color
  for (const [dx, dy, r] of [
    [0, 0, 26],
    [30, -10, 32],
    [64, 0, 24],
    [32, 10, 26],
  ] as const) {
    g.beginPath()
    g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2)
    g.fill()
  }
}

/** Far towers painted on the backdrop, as one silhouette. */
function farCity(
  kit: Kit,
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  lit: string | null
) {
  let x = -10
  while (x < w) {
    const width = 26 + kit.rand() * 40
    const top = h * (0.5 + kit.rand() * 0.25)
    g.fillStyle = color
    g.beginPath()
    g.roundRect(x, top, width, h - top, [6, 6, 0, 0])
    g.fill()
    if (lit) {
      g.fillStyle = lit
      for (let wy = top + 8; wy < h - 6; wy += 11) {
        for (let wx = x + 5; wx < x + width - 6; wx += 9) {
          if (kit.rand() < 0.3) g.fillRect(wx, wy, 4, 5)
        }
      }
    }
    x += width + 2 + kit.rand() * 8
  }
}

/** Day, dusk and night skies, faded into each other by setCity. */
function skies(kit: Kit, parent: THREE.Object3D): (k: number) => void {
  const seed = kit.rand()
  const day = skyTexture(kit, {
    top: "#7fb6e6",
    middle: "#b9dcf2",
    bottom: "#f3ead6",
    draw: (g, w, h) => {
      const sun = g.createRadialGradient(
        w * 0.78,
        h * 0.18,
        4,
        w * 0.78,
        h * 0.18,
        120
      )
      sun.addColorStop(0, "rgba(255,250,225,1)")
      sun.addColorStop(0.25, "rgba(255,240,200,.6)")
      sun.addColorStop(1, "rgba(255,240,200,0)")
      g.fillStyle = sun
      g.fillRect(0, 0, w, h)
      cloud(g, 60, 110, 1.2, "rgba(255,255,255,.85)")
      cloud(g, 300, 70, 0.9, "rgba(255,255,255,.75)")
      cloud(g, 200 + seed * 40, 190, 0.7, "rgba(255,255,255,.6)")
      farCity(kit, g, w, h, "rgba(140,160,185,.55)", null)
    },
  })
  const dusk = skyTexture(kit, {
    top: "#4b4a86",
    middle: "#e98a6a",
    bottom: "#ffc98a",
    draw: (g, w, h) => {
      const sun = g.createRadialGradient(
        w * 0.3,
        h * 0.62,
        6,
        w * 0.3,
        h * 0.62,
        150
      )
      sun.addColorStop(0, "rgba(255,236,190,1)")
      sun.addColorStop(0.3, "rgba(255,190,120,.6)")
      sun.addColorStop(1, "rgba(255,170,110,0)")
      g.fillStyle = sun
      g.fillRect(0, 0, w, h)
      cloud(g, 330, 120, 1.1, "rgba(255,170,150,.55)")
      cloud(g, 80, 70, 0.8, "rgba(255,190,170,.45)")
      farCity(kit, g, w, h, "rgba(90,60,90,.85)", "rgba(255,210,140,.55)")
    },
  })
  const night = skyTexture(kit, {
    top: "#0d1430",
    middle: "#1d2550",
    bottom: "#3a3466",
    draw: (g, w, h) => {
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(255,250,235,${0.3 + kit.rand() * 0.6})`
        g.fillRect(kit.rand() * w, kit.rand() * h * 0.55, 2, 2)
      }
      const moon = g.createRadialGradient(
        w * 0.72,
        h * 0.2,
        2,
        w * 0.72,
        h * 0.2,
        70
      )
      moon.addColorStop(0, "rgba(255,248,220,1)")
      moon.addColorStop(0.3, "rgba(255,248,220,1)")
      moon.addColorStop(0.36, "rgba(200,210,255,.35)")
      moon.addColorStop(1, "rgba(200,210,255,0)")
      g.fillStyle = moon
      g.fillRect(0, 0, w, h)
      farCity(kit, g, w, h, "#1a1630", "rgba(255,214,150,.9)")
    },
  })
  const geometry = new THREE.PlaneGeometry(SKY.x1 - SKY.x0, SKY.y1 - SKY.y0)
  const layers = [day, dusk, night].map((map, i) => {
    const material = new THREE.MeshBasicMaterial({
      map,
      transparent: i > 0,
      depthWrite: i === 0,
      toneMapped: false,
    })
    const plane = new THREE.Mesh(geometry, material)
    // Later layers sit a hair in front, so they blend over the day sky.
    plane.position.set(
      (SKY.x0 + SKY.x1) / 2,
      (SKY.y0 + SKY.y1) / 2,
      -BACK + 0.01 * i
    )
    plane.renderOrder = i
    parent.add(plane)
    return material
  })
  return (k) => {
    // City 0 is day, 0.45 dusk, 1 night.
    const duskShare = k <= 0.45 ? k / 0.45 : 1
    const nightShare = k <= 0.45 ? 0 : (k - 0.45) / 0.55
    layers[1].opacity = duskShare
    layers[2].opacity = nightShare
    layers[1].visible = duskShare > 0.001
    layers[2].visible = nightShare > 0.001
  }
}

/** A facade with rows of windows; lit windows glow through `emissiveMap`. */
function facade(kit: Kit, base: string): THREE.MeshStandardMaterial {
  const columns = 4
  const rows = 8
  const lit: Array<readonly [number, number]> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      if (kit.rand() < 0.45) lit.push([c, r])
    }
  }
  const draw =
    (glow: boolean) => (g: CanvasRenderingContext2D, w: number, h: number) => {
      g.fillStyle = glow ? "#000000" : base
      g.fillRect(0, 0, w, h)
      const cw = w / columns
      const rh = h / rows
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
          const on = lit.some(([lc, lr]) => lc === c && lr === r)
          if (glow && !on) continue
          g.fillStyle = glow
            ? kit.rand() < 0.8
              ? "#ffd38a"
              : "#bfe0ff"
            : "rgba(40,50,70,.55)"
          g.fillRect(
            c * cw + cw * 0.22,
            r * rh + rh * 0.25,
            cw * 0.56,
            rh * 0.5
          )
        }
      }
    }
  return new THREE.MeshStandardMaterial({
    map: kit.canvasTexture(64, 128, draw(false)),
    emissive: "#ffffff",
    emissiveMap: kit.canvasTexture(64, 128, draw(true)),
    emissiveIntensity: 0,
    roughness: 0.8,
  })
}

/** Rounded towers in two rows between the backdrop and the wall. */
function towers(
  kit: Kit,
  parent: THREE.Object3D
): Array<THREE.MeshStandardMaterial> {
  const tones = ["#c9b8a6", "#a9a3b5", "#d8c3a0", "#9fb0b8", "#b89a8a"]
  const materials = tones.map((tone) => facade(kit, tone))
  const roof = kit.mat("#6b5a55", { roughness: 0.9 })
  const rows: ReadonlyArray<{ d: number; scale: number; top: number }> = [
    { d: 0.6, scale: 0.85, top: y0 + 0.25 },
    { d: 0.36, scale: 1, top: y0 - 0.2 },
  ]
  for (const { d, scale, top } of rows) {
    let x = x0 - d - 0.05
    while (x < x1 - d + 0.05) {
      const width = (0.22 + kit.rand() * 0.22) * scale
      const height = top - (y0 - d - 1.2) + kit.rand() * 0.55 * scale
      const base = y0 - d - 1.2
      const material = kit.pick(materials)
      const geometry = new RoundedBoxGeometry(width, height, 0.14, 2, 0.03)
      const tower = new THREE.Mesh(geometry, material)
      tower.position.set(x + width / 2, base + height / 2, -d)
      parent.add(tower)
      // A flat roof cap, and now and then a water tank or a spire.
      const cap = new THREE.Mesh(
        new RoundedBoxGeometry(width + 0.02, 0.03, 0.16, 2, 0.01),
        roof
      )
      cap.position.set(x + width / 2, base + height + 0.015, -d)
      parent.add(cap)
      if (kit.rand() < 0.35) {
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 0.07, 10),
          roof
        )
        tank.position.set(x + width * 0.3, base + height + 0.065, -d)
        parent.add(tank)
      }
      x += width + 0.02 + kit.rand() * 0.06
    }
  }
  return materials
}

/** The city outside the window, behind the opening (spec 3F §3.1). */
export function buildSkyline(kit: Kit): Skyline {
  const city = new THREE.Group()
  city.name = "city"
  kit.scene.add(city)
  const setSky = skies(kit, city)
  const lights = towers(kit, city)
  return {
    setCity(k) {
      setSky(k)
      for (const material of lights) material.emissiveIntensity = k * 1.6
    },
  }
}
