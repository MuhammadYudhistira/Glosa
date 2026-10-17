import type { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ShelfBook } from "@/lib/book-types"
import { formatLongDate } from "@/lib/dates"
import { formatBytes } from "@/lib/member"
import { formatPercent } from "@/lib/progress"
import { BookCover } from "./BookCover"

/** The description and the facts, shared with the lobby's detail panel (spec 1D §5.2). */
export function BookFacts({
  book,
  percentage,
}: {
  book: ShelfBook
  percentage: number
}) {
  return (
    <>
      {book.description && (
        <p className="max-h-48 overflow-y-auto text-sm leading-relaxed text-muted-foreground">
          {book.description}
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {book.language && (
          <>
            <dt className="text-muted-foreground">Bahasa</dt>
            <dd>{book.language}</dd>
          </>
        )}
        {percentage > 0 && (
          <>
            <dt className="text-muted-foreground">Dibaca</dt>
            <dd>{formatPercent(percentage)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Ukuran</dt>
        <dd>{formatBytes(book.sizeBytes)}</dd>
        <dt className="text-muted-foreground">Ditambahkan</dt>
        <dd>{formatLongDate(new Date(book.createdAt))}</dd>
      </dl>
    </>
  )
}

export function BookDetail({
  book,
  percentage = 0,
  onClose,
  children,
}: {
  book: ShelfBook | null
  percentage?: number
  onClose: () => void
  children?: ReactNode
}) {
  return (
    <Dialog
      open={book !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {book && (
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <div className="flex gap-4">
            <BookCover book={book} className="w-24 shrink-0" />
            <DialogHeader className="text-left">
              <DialogTitle className="font-heading text-xl">
                {book.title}
              </DialogTitle>
              {book.author && (
                <DialogDescription>{book.author}</DialogDescription>
              )}
            </DialogHeader>
          </div>
          <BookFacts book={book} percentage={percentage} />
          {children}
        </DialogContent>
      )}
    </Dialog>
  )
}
