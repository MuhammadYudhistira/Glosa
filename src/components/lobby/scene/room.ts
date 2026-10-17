import * as THREE from "three"
import type { Kit } from "./kit"
import { ATRIUM, BOX, GLASS, type Point3, STAIRS } from "./layout"
import { BOOK_COLORS } from "./shelves"

const { size: SIZE, height: HEIGHT } = ATRIUM
const WHITE = "#ddd6cb"

/** Polished wood; it runs on past the open front, so the screen is always full. */
function floor(kit: Kit) {
  const texture = kit.canvasTexture(
    1024,
    1024,
    (g) => {
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 5; j++) {
          const tone = 112 + Math.floor(kit.rand() * 22)
          const x = j * 256 + (i % 2) * 128 - 128
          g.fillStyle = `rgb(${tone + 34},${tone - 8},${tone - 52})`
          g.fillRect(x, i * 64, 256, 64)
          g.fillStyle = "rgba(40,20,8,.35)"
          g.fillRect(x, i * 64, 2, 64)
        }
        g.fillStyle = "rgba(40,20,8,.4)"
        g.fillRect(0, i * 64 + 62, 1024, 2)
      }
    },
    [6, 6]
  )
  kit.mesh(
    new THREE.BoxGeometry(SIZE * 2 + 2, 0.2, SIZE * 2 + 2),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.32,
      metalness: 0.05,
    }),
    SIZE - 1,
    -0.1,
    SIZE - 1,
    { cast: false }
  )
}

/** The shells behind the shelf walls and beside the glass. */
function walls(kit: Kit) {
  kit.block(0.4, HEIGHT, SIZE, "#3a2516", -0.2, 0, SIZE / 2, { r: 0.02 })
  kit.block(GLASS.x0, HEIGHT, 0.4, "#3a2516", GLASS.x0 / 2, 0, -0.2, {
    r: 0.02,
  })
}

function balcony(
  kit: Kit,
  [x0, x1, z0, z1]: readonly [number, number, number, number],
  y: number,
  rail: THREE.Material,
  strip: THREE.Material
) {
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  kit.block(x1 - x0, 0.42, z1 - z0, WHITE, cx, y - 0.42, cz, { r: 0.1 })
  kit.block(x1 - x0, 0.06, z1 - z0, "#b07b4a", cx, y, cz, {
    r: 0.02,
    cast: false,
  })
  // A warm strip of light under each open edge, and a glass railing above it.
  if (z1 < SIZE) {
    kit.block(x1 - x0 - 0.2, 0.05, 0.05, strip, cx, y - 0.45, z1 - 0.06, {
      cast: false,
    })
    kit.mesh(
      new THREE.BoxGeometry(x1 - x0, 1, 0.03),
      rail,
      cx,
      y + 0.5,
      z1 - 0.05,
      { cast: false }
    )
  }
  if (x1 < SIZE) {
    kit.block(0.05, 0.05, z1 - z0 - 0.2, strip, x1 - 0.06, y - 0.45, cz, {
      cast: false,
    })
    kit.mesh(
      new THREE.BoxGeometry(0.03, 1, z1 - z0),
      rail,
      x1 - 0.05,
      y + 0.5,
      cz,
      { cast: false }
    )
  }
}

function balconies(kit: Kit) {
  const rail = new THREE.MeshStandardMaterial({
    color: "#d7f0ff",
    transparent: true,
    opacity: 0.18,
    roughness: 0.1,
    depthWrite: false,
  })
  const strip = new THREE.MeshBasicMaterial({ color: "#ffd9a0" })
  for (const y of [4.6, 9.2]) {
    balcony(kit, [0, 3.2, 10, SIZE], y, rail, strip)
    balcony(kit, [10.5, GLASS.x0 - 0.4, 0, 3.2], y, rail, strip)
  }
}

/** The floating box's body; its cubbies are shelf faces (layout.ts). */
function floatingBox(kit: Kit) {
  const width = BOX.x1 - BOX.x0
  const depth = BOX.z1 - BOX.z0
  const cx = (BOX.x0 + BOX.x1) / 2
  const cz = (BOX.z0 + BOX.z1) / 2
  kit.block(width, BOX.y1 - BOX.y0, depth, "#8a5a33", cx, BOX.y0, cz, {
    r: 0.05,
  })
  kit.block(width + 0.3, 0.3, depth + 0.3, "#c9945f", cx, BOX.y0 - 0.3, cz, {
    r: 0.05,
  })
}

/** Bleacher stairs with LEDs and small shelves. Returns where people sit. */
function stairs(kit: Kit): Array<Point3> {
  const led = new THREE.MeshBasicMaterial({ color: "#fff2d6" })
  const width = STAIRS.x1 - STAIRS.x0
  const middle = (STAIRS.x0 + STAIRS.x1) / 2
  const seats: Array<Point3> = []
  for (let k = 0; k < STAIRS.steps; k++) {
    const front = STAIRS.z1 - k * STAIRS.run
    const top = (k + 1) * STAIRS.rise
    const base = top - STAIRS.rise
    kit.block(width, top, front, WHITE, middle, 0, front / 2, { r: 0.03 })
    kit.block(width - 0.2, 0.03, 0.03, led, middle, top - 0.1, front + 0.01, {
      cast: false,
    })
    if (k % 3 === 1) {
      // A small shelf set into the step.
      const shelfX = 3 + (k % 2) * 3
      kit.block(
        1.6,
        STAIRS.rise - 0.08,
        0.05,
        "#5a3a22",
        shelfX,
        base + 0.02,
        front + 0.02,
        { r: 0.01 }
      )
      for (let i = 0; i < 18; i++) {
        const height = 0.24 + kit.rand() * 0.1
        kit.block(
          0.06,
          height,
          0.18,
          kit.pick(BOOK_COLORS),
          shelfX - 0.7 + i * 0.08,
          base + 0.06,
          front - 0.06,
          { r: 0.005 }
        )
      }
    }
    if (k > 0 && k < STAIRS.steps - 1) {
      for (let s = 0; s < 2; s++) {
        if (kit.rand() < 0.55) {
          seats.push([STAIRS.x0 + 1 + kit.rand() * 6, top, front - 0.45])
        }
      }
    }
  }
  // The steps continue up to the balcony as a white landing.
  kit.block(width, 4.6, 0.6, WHITE, middle, 0, 0.3, { r: 0.03 })
  return seats
}

/** Floor, wall shells, balconies, the floating box and the bleacher stairs. */
export function buildRoom(kit: Kit): { stairSeats: Array<Point3> } {
  floor(kit)
  walls(kit)
  balconies(kit)
  floatingBox(kit)
  return { stairSeats: stairs(kit) }
}
