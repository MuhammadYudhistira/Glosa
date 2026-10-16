import type { CSSProperties } from "react"
import type { ShelfBook } from "@/lib/book-types"
import { cn } from "@/lib/utils"

export function coverHue(title: string): number {
  let hue = 0
  for (const char of title) hue = (hue * 31 + (char.codePointAt(0) ?? 0)) % 360
  return hue
}

export function BookCover({
  book,
  className,
}: {
  book: Pick<ShelfBook, "title" | "coverUrl">
  className?: string
}) {
  if (book.coverUrl) {
    return (
      <img
        src={book.coverUrl}
        alt=""
        loading="lazy"
        draggable={false}
        className={cn("book-cover", className)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn("book-cover book-cover-blank", className)}
      style={{ "--cover-hue": coverHue(book.title) } as CSSProperties}
    >
      <span className="font-heading">{book.title}</span>
    </span>
  )
}
