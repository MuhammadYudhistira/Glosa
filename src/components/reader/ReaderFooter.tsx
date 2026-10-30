import { useEffect, useState } from "react"
import { formatPercent, toPercentage } from "@/lib/progress"
import { formatDuration } from "@/lib/reading-speed"
import { cn } from "@/lib/utils"
import type { ReaderLocation } from "./ReaderView"

const SEEK_DELAY_MS = 250

/** Minutes left at this member's speed (plan 2C, decision 7). */
export type TimeLeft = { chapter: number; book: number }

export function ReaderFooter({
  hidden,
  location,
  timeLeft,
  onSeek,
}: {
  hidden: boolean
  location: ReaderLocation | null
  timeLeft: TimeLeft | null
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

  const chapterLeft = timeLeft ? formatDuration(timeLeft.chapter) : ""
  const bookLeft = timeLeft ? formatDuration(timeLeft.book) : ""
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
      <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <output
          aria-label="Bab saat ini"
          className="block min-w-0 flex-1 truncate"
        >
          {location?.chapter ?? ""}
        </output>
        {chapterLeft && (
          // The book's time needs a wide screen (plan 2C, decision 8).
          <output aria-label="Sisa waktu" className="shrink-0 tabular-nums">
            {chapterLeft} lagi di bab ini
            {bookLeft && (
              <span className="max-lg:hidden"> · {bookLeft} lagi di buku</span>
            )}
          </output>
        )}
      </div>
    </footer>
  )
}
