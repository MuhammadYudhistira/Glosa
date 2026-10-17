import { useEffect, useState } from "react"
import { formatPercent, toPercentage } from "@/lib/progress"
import { cn } from "@/lib/utils"
import type { ReaderLocation } from "./ReaderView"

const SEEK_DELAY_MS = 250

export function ReaderFooter({
  hidden,
  location,
  onSeek,
}: {
  hidden: boolean
  location: ReaderLocation | null
  onSeek: (fraction: number) => void
}) {
  const [draft, setDraft] = useState<number | null>(null)
  const fraction = draft ?? location?.fraction ?? 0

  // Seek once the slider rests, not on every step of a drag.
  useEffect(() => {
    if (draft === null) return
    const timer = setTimeout(() => {
      onSeek(draft)
      setDraft(null)
    }, SEEK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft, onSeek])

  const percent =
    draft !== null || location ? formatPercent(toPercentage(fraction)) : ""
  return (
    <footer
      className={cn(
        "reader-bar reader-bar-bottom",
        hidden && "reader-bar-hidden"
      )}
      inert={hidden}
    >
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={fraction}
          onChange={(event) => setDraft(Number(event.target.value))}
          aria-label="Posisi dalam buku"
          aria-valuetext={percent}
          className="reader-slider flex-1"
        />
        <output
          aria-label="Posisi baca"
          className="w-12 text-right text-xs tabular-nums"
        >
          {percent}
        </output>
      </div>
      <output
        aria-label="Bab saat ini"
        className="block truncate text-xs text-muted-foreground"
      >
        {location?.chapter ?? ""}
      </output>
    </footer>
  )
}
