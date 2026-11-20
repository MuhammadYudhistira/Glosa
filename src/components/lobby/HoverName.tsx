/** The place's name beside the mouse cursor (spec 3G §3.2). Its button already carries the name for assistive technology. */
export function HoverName({
  name,
  x,
  y,
}: {
  name: string
  /** The cursor, in CSS pixels from the scene's top left. */
  x: number
  y: number
}) {
  return (
    <span
      aria-hidden="true"
      className="lobby-hover-name lobby-overlay"
      style={{ left: x + 14, top: y + 18 }}
    >
      {name}
    </span>
  )
}
