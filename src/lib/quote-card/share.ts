/** The parts of navigator a card uses; any may be missing. */
export type Sharing = Partial<
  Pick<Navigator, "canShare" | "share" | "clipboard">
>
export type ShareResult = "shared" | "cancelled" | "failed"

const MAX_NAME = 40

/** Whether the share sheet can take a PNG (spec kartu kutipan §4: Bagikan shows only then). */
export function canShareFiles(nav: Sharing = navigator): boolean {
  if (!nav.canShare || !nav.share) return false
  try {
    const probe = new File([""], "kartu.png", { type: "image/png" })
    return nav.canShare({ files: [probe] })
  } catch {
    return false
  }
}

/** Whether an image can go to the clipboard (Salin gambar shows only then). */
export function canCopyImage(nav: Sharing = navigator): boolean {
  return (
    "ClipboardItem" in globalThis && typeof nav.clipboard?.write === "function"
  )
}

/**
 * Copies the link for Instagram's Link sticker, then opens the share sheet
 * with the card and its text (spec kartu kutipan §6.5). Nothing is awaited
 * before share(): Safari opens the sheet only within the tap.
 */
export async function shareCard(
  file: File,
  text: string,
  link: string,
  nav: Sharing = navigator
): Promise<ShareResult> {
  try {
    nav.clipboard?.writeText(link).catch(() => undefined)
  } catch {
    // No clipboard: the card goes anyway.
  }
  if (!nav.share) return "failed"
  try {
    await nav.share({ files: [file], text })
    return "shared"
  } catch (error) {
    return (error as { name?: unknown }).name === "AbortError"
      ? "cancelled"
      : "failed"
  }
}

/** Downloads the card. */
export function saveCard(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.rel = "noopener"
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Puts the card on the clipboard; false when the browser refuses. */
export async function copyCard(
  blob: Blob,
  nav: Sharing = navigator
): Promise<boolean> {
  if (!nav.clipboard) return false
  try {
    await nav.clipboard.write([
      new ClipboardItem({ [blob.type || "image/png"]: blob }),
    ])
    return true
  } catch {
    return false
  }
}

/** glosa-{short title}.png, in plain letters. */
export function cardFileName(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_NAME)
    .replace(/-+$/, "")
  return `glosa-${slug || "kutipan"}.png`
}

/** What goes with the card: the book, and where Glosa is. */
export function shareText(title: string, origin: string): string {
  return `Dari ${title}, dibaca di Glosa → ${origin}`
}
