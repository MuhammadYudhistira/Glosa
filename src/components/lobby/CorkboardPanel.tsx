import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HIGHLIGHT_EDGE, HighlightsNotice } from "./highlight-ui"
import type { HighlightsState } from "@/lib/annotations/highlights-client"
import { pinnedHighlights } from "@/lib/annotations/pinned"
import type { ShelfBook } from "@/lib/book-types"
import { cn } from "@/lib/utils"

/** Most notes the corkboard holds. */
export const CORKBOARD_NOTES = 3
/** Highlights asked for, so removed books' ones can be skipped and still fill the board. */
export const CORKBOARD_FETCH = 20

/** "Sorotan": the newest highlights pinned on the corkboard, each with a way into its book (spec 3F §3.2). */
export function CorkboardPanel({
  open,
  onOpenChange,
  state,
  books,
  onRetry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: HighlightsState
  books: ReadonlyArray<ShelfBook>
  onRetry: () => void
}) {
  const shown =
    state.status === "ready"
      ? pinnedHighlights(state.highlights, books, CORKBOARD_NOTES)
      : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Sorotan</DialogTitle>
          <DialogDescription>
            Kalimat yang kamu tandai paling baru.
          </DialogDescription>
        </DialogHeader>
        <HighlightsNotice state={state} onRetry={onRetry} />
        {state.status === "ready" && shown.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Belum ada sorotan. Tandai kalimat yang kamu suka saat membaca; tiga
            yang terbaru tertempel di sini.
          </p>
        )}
        {shown.length > 0 && (
          <ul className="grid gap-3">
            {shown.map(({ highlight, book }) => (
              <li
                key={highlight.id}
                className={cn(
                  "grid gap-2 border-l-4 bg-muted/40 px-3 py-2",
                  HIGHLIGHT_EDGE[highlight.color]
                )}
              >
                <p className="line-clamp-4 text-sm">{highlight.excerpt}</p>
                {highlight.note && (
                  <p className="text-sm text-muted-foreground italic">
                    {highlight.note}
                  </p>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {book.title}
                  </span>
                  <Link
                    to="/read/$bookId"
                    params={{ bookId: book.id }}
                    search={{ cfi: highlight.cfi }}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Buka di buku
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        {shown.length > 0 && (
          <Link
            to="/highlights"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "justify-self-start"
            )}
          >
            Lihat semua
          </Link>
        )}
      </DialogContent>
    </Dialog>
  )
}
