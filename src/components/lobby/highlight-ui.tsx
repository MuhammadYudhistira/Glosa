import { Button } from "@/components/ui/button"
import type { HighlightsState } from "@/lib/annotations/highlights-client"
import type { HighlightColor } from "@/lib/annotations/types"

/** The coloured left edge of a highlight, shared by the corkboard and the highlights page. */
export const HIGHLIGHT_EDGE: Record<HighlightColor, string> = {
  yellow: "border-l-[#e8c547]",
  green: "border-l-[#6fae8d]",
  blue: "border-l-[#6f9bd1]",
  pink: "border-l-[#d98a86]",
}

/** What stands in for the highlights while they load, are offline or could not be loaded; nothing once ready. */
export function HighlightsNotice({
  state,
  onRetry,
}: {
  state: HighlightsState
  onRetry: () => void
}) {
  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Memuat sorotan…</p>
  }
  if (state.status === "offline") {
    return (
      <p className="text-sm text-stamp">Sorotan bisa dilihat saat online.</p>
    )
  }
  if (state.status === "failed") {
    return (
      <div className="grid justify-items-start gap-3">
        <p className="text-sm text-stamp">Sorotan belum bisa dimuat.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      </div>
    )
  }
  return null
}
