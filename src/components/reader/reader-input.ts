export type ReaderMove = "left" | "right" | "prev" | "next"
export type TapAction = "left" | "right" | "menu"

/** Taps in the outer 30% turn the page; the middle shows or hides the frame (spec §9). */
export function tapAction(x: number, left: number, width: number): TapAction {
  const position = (x - left) / width
  if (position < 0.3) return "left"
  if (position > 0.7) return "right"
  return "menu"
}

/** Arrow keys follow the page direction (RTL books too); PageUp/PageDown follow reading order. */
export function keyMove(key: string): ReaderMove | null {
  switch (key) {
    case "ArrowLeft":
      return "left"
    case "ArrowRight":
      return "right"
    case "PageUp":
      return "prev"
    case "PageDown":
      return "next"
    default:
      return null
  }
}

/**
 * Keys typed into a field or used inside a dialog never turn pages. Duck-typed:
 * events from the book's iframe carry elements from another window.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null
  return (
    typeof element?.closest === "function" &&
    element.closest(
      "input, select, textarea, [contenteditable], [role='dialog']"
    ) !== null
  )
}
