import { coverPalette } from "./themes"

/** The cover is shrunk to this many pixels a side to read its colours. */
const PALETTE_SIZE = 12
/** The decoded cover is kept this wide: a card draws it small. */
const COVER_WIDTH = 200

/** The decoded cover redrawn small, so the full-size bitmap can be closed. */
function shrunk(bitmap: ImageBitmap): HTMLCanvasElement | null {
  const scale = Math.min(1, COVER_WIDTH / bitmap.width)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d")
  if (!context) return null
  context.imageSmoothingQuality = "high"
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

function paletteOf(source: CanvasImageSource): Array<string> | null {
  try {
    const small = document.createElement("canvas")
    small.width = PALETTE_SIZE
    small.height = PALETTE_SIZE
    const context = small.getContext("2d")
    if (!context) return null
    context.drawImage(source, 0, 0, PALETTE_SIZE, PALETTE_SIZE)
    const { data } = context.getImageData(0, 0, PALETTE_SIZE, PALETTE_SIZE)
    return coverPalette(data, PALETTE_SIZE, PALETTE_SIZE)
  } catch {
    return null
  }
}

/** The cover as a small canvas plus its palette; null when it cannot be decoded. */
export async function decodeCover(
  blob: Blob
): Promise<{ image: CanvasImageSource; palette: Array<string> | null } | null> {
  if (!("createImageBitmap" in globalThis)) return null
  const bitmap = await createImageBitmap(blob)
  let small: HTMLCanvasElement | null = null
  try {
    small = shrunk(bitmap)
  } finally {
    bitmap.close()
  }
  return small ? { image: small, palette: paletteOf(small) } : null
}

/** A cover from its signed URL; null when the browser refuses it or there is none. */
export async function fetchCoverBlob(url: string | null): Promise<Blob | null> {
  if (!url) return null
  try {
    const response = await fetch(url)
    return response.ok ? await response.blob() : null
  } catch {
    return null
  }
}
