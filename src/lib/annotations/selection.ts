/** The text selected in a section's document, or null when nothing (or only spaces) is. */
export function selectedRange(
  doc: Document
): { range: Range; text: string } | null {
  const selection = doc.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
    return null
  const range = selection.getRangeAt(0)
  const text = range.toString()
  return text.trim() ? { range, text } : null
}

/** The last line of a range: where a selection ends, for its menu. */
export function endRect(range: Range): DOMRect {
  const rects = range.getClientRects()
  return rects.length > 0
    ? rects[rects.length - 1]
    : range.getBoundingClientRect()
}

/** The line of a range under a tap, for a tapped highlight's popup. */
export function rectAt(range: Range, x: number, y: number): DOMRect {
  for (const rect of Array.from(range.getClientRects())) {
    if (x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom)
      return rect
  }
  return range.getBoundingClientRect()
}
