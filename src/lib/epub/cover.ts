import { COVER_WIDTH, MAX_COVER_BYTES } from "@/lib/upload-rules"

export type Cover = { blob: Blob; type: "image/webp" | "image/jpeg" }

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Shrinks a cover to 400 px wide WebP; JPEG where the browser cannot encode WebP. */
export async function shrinkCover(source: Blob): Promise<Cover | null> {
  const bitmap = await createImageBitmap(source)
  try {
    const scale = Math.min(1, COVER_WIDTH / bitmap.width)
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) return null
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const webp = await toBlob(canvas, "image/webp", 0.82)
    const blob =
      webp?.type === "image/webp"
        ? webp
        : await toBlob(canvas, "image/jpeg", 0.85)
    if (!blob || blob.size > MAX_COVER_BYTES) return null
    return {
      blob,
      type: blob.type === "image/webp" ? "image/webp" : "image/jpeg",
    }
  } finally {
    bitmap.close()
  }
}
