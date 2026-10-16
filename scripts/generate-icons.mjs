// Generates the favicon, PWA icons and the in-app logo mark from the brand logo.
// Usage: node scripts/generate-icons.mjs [source.png]
// The source is the full logo (icon + "Glosa" wordmark on a cream background);
// only the rounded-square icon above the wordmark is used.
import { mkdirSync, writeFileSync } from "node:fs"
import sharp from "sharp"

const SOURCE = process.argv[2] ?? "docs/brand/glosa-logo.png"
const ICON_BG = [25, 53, 49] // the icon's dark green
const DARK = 120 // luminance below this counts as part of the icon
const NEAR_BG = 200 // luminance above this, connected to the edge, is background

const { data, info } = await sharp(SOURCE)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info
const lum = (x, y) => {
  const i = (y * W + x) * 3
  return (data[i] + data[i + 1] + data[i + 2]) / 3
}

// Bounding box of the icon: dark pixels above the wordmark (top 65%).
let [x0, y0, x1, y1] = [W, H, 0, 0]
for (let y = 0; y < Math.round(H * 0.65); y++) {
  for (let x = 0; x < W; x++) {
    if (lum(x, y) < DARK) {
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
  }
}
const pad = 2
const left = x0 - pad
const top = y0 - pad
const size = Math.max(x1 - x0, y1 - y0) + 1 + pad * 2

// Crop into RGBA and make the cream corners transparent by flood-filling
// background-coloured pixels from the crop's border.
const rgba = Buffer.alloc(size * size * 4)
const background = new Uint8Array(size * size)
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const s = ((top + y) * W + (left + x)) * 3
    const d = (y * size + x) * 4
    rgba[d] = data[s]
    rgba[d + 1] = data[s + 1]
    rgba[d + 2] = data[s + 2]
    rgba[d + 3] = 255
  }
}
const l = (x, y) => {
  const d = (y * size + x) * 4
  return (rgba[d] + rgba[d + 1] + rgba[d + 2]) / 3
}
const stack = []
for (let i = 0; i < size; i++)
  stack.push([i, 0], [i, size - 1], [0, i], [size - 1, i])
while (stack.length > 0) {
  const [x, y] = stack.pop()
  if (x < 0 || y < 0 || x >= size || y >= size) continue
  const k = y * size + x
  if (background[k] || l(x, y) < NEAR_BG) continue
  background[k] = 1
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
}
const bgLum = 250
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const k = y * size + x
    const d = k * 4
    if (background[k]) {
      rgba[d + 3] = 0
      continue
    }
    const touchesBackground =
      (x > 0 && background[k - 1]) ||
      (x < size - 1 && background[k + 1]) ||
      (y > 0 && background[k - size]) ||
      (y < size - 1 && background[k + size])
    const v = l(x, y)
    if (touchesBackground && v > DARK) {
      // Anti-aliased edge: turn the cream blend into partial transparency.
      const alpha = Math.max(0, Math.min(1, (bgLum - v) / (bgLum - 45)))
      rgba[d] = ICON_BG[0]
      rgba[d + 1] = ICON_BG[1]
      rgba[d + 2] = ICON_BG[2]
      rgba[d + 3] = Math.round(alpha * 255)
    }
  }
}
const icon = () =>
  sharp(rgba, { raw: { width: size, height: size, channels: 4 } })
const iconPng = await icon().png().toBuffer()

mkdirSync("public/icons", { recursive: true })
const resize = (px) =>
  sharp(iconPng)
    .resize(px, px, { kernel: "lanczos3" })
    .png({ compressionLevel: 9, palette: true, quality: 90 })

await resize(512).toFile("public/icons/icon-512.png")
await resize(192).toFile("public/icons/icon-192.png")
await resize(96).toFile("public/logo-mark.png")

// Opaque full-bleed variants (maskable PWA icon, Apple touch icon): the icon
// at ~80% on its own dark green, so any platform mask stays inside the art.
const fullBleed = async (px, file) => {
  const inner = Math.round(px * 0.8)
  const art = await sharp(iconPng)
    .resize(inner, inner, { kernel: "lanczos3" })
    .png()
    .toBuffer()
  await sharp({
    create: {
      width: px,
      height: px,
      channels: 4,
      background: { r: ICON_BG[0], g: ICON_BG[1], b: ICON_BG[2], alpha: 1 },
    },
  })
    .composite([{ input: art, gravity: "center" }])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(file)
}
await fullBleed(512, "public/icons/maskable-512.png")
await fullBleed(180, "public/apple-touch-icon.png")

// favicon.ico holding PNG-encoded 16, 32 and 48 px images.
const sizes = [16, 32, 48]
const pngs = await Promise.all(sizes.map((px) => resize(px).toBuffer()))
const header = Buffer.alloc(6 + sizes.length * 16)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
sizes.forEach((px, i) => {
  const e = 6 + i * 16
  header.writeUInt8(px, e)
  header.writeUInt8(px, e + 1)
  header.writeUInt8(0, e + 2)
  header.writeUInt8(0, e + 3)
  header.writeUInt16LE(1, e + 4)
  header.writeUInt16LE(32, e + 6)
  header.writeUInt32LE(pngs[i].length, e + 8)
  header.writeUInt32LE(offset, e + 12)
  offset += pngs[i].length
})
writeFileSync("public/favicon.ico", Buffer.concat([header, ...pngs]))

console.log(`icon crop ${size}px at (${left}, ${top}) from ${SOURCE}`)
