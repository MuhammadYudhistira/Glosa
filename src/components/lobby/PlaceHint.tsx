import { useEffect } from "react"

/** How long the hint stays when nothing is tapped or pointed at (spec 3G §3.4). */
export const PLACE_HINT_MS = 6000

/** The one line that says how to learn a place's name; shown once on a device. */
export function PlaceHint({
  fine,
  onDone,
}: {
  fine: boolean
  onDone: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, PLACE_HINT_MS)
    return () => clearTimeout(timer)
  }, [onDone])
  return (
    <output className="lobby-hint lobby-overlay">
      {fine
        ? "Arahkan kursor ke benda untuk melihat namanya"
        : "Ketuk benda untuk melihat namanya"}
    </output>
  )
}
