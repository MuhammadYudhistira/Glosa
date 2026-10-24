import { Overlayer } from "foliate-js/overlayer.js"
import type { HighlightColor } from "./types"

/** The fill of each highlight colour; the overlay draws it see-through. */
export const HIGHLIGHT_FILL: Record<HighlightColor, string> = {
  yellow: "#f5d000",
  green: "#3ccf6e",
  blue: "#4aa3ff",
  pink: "#ff6fae",
}

const SVG = "http://www.w3.org/2000/svg"
const MARK_SIZE = 7

/**
 * foliate's highlight, with a small square right after the last line when the
 * highlight has a note (spec 2 §6.6; plan 2B, decision 12).
 */
export function drawHighlight(
  rects: ArrayLike<DOMRect>,
  options: { color: string; note: boolean }
): SVGElement {
  const fill = Overlayer.highlight(rects, { color: options.color })
  const last = rects.length > 0 ? rects[rects.length - 1] : null
  if (!options.note || !last) return fill
  const group = document.createElementNS(SVG, "g")
  const mark = document.createElementNS(SVG, "rect")
  mark.setAttribute("class", "glosa-note-mark")
  mark.setAttribute("x", String(last.right + 2))
  mark.setAttribute("y", String(last.top))
  mark.setAttribute("width", String(MARK_SIZE))
  mark.setAttribute("height", String(MARK_SIZE))
  mark.setAttribute("rx", "1.5")
  mark.setAttribute("fill", options.color)
  group.append(fill, mark)
  return group
}
