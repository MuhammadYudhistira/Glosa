import { type Measure, fitText } from "./layout"

/**
 * `text` broken at spaces into lines no wider than `maxWidth`; more than
 * `maxLines` lines end the last one with an ellipsis, and a word wider than a
 * line is cut with one.
 */
export function wrapText(
  text: string,
  fontName: string,
  maxWidth: number,
  measure: Measure,
  maxLines: number
): Array<string> {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: Array<string> = []
  let line = ""
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (!line || measure(next, fontName) <= maxWidth) {
      line = next
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`
    return kept.map((item) => fitText(item, fontName, maxWidth, measure))
  }
  return lines.map((item) => fitText(item, fontName, maxWidth, measure))
}
