import { type CSSProperties, useState } from "react"
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
  // Signed cover URLs expire after an hour (spec §12): a cover that fails to
  // load gets the titled spine instead of a broken image.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (book.coverUrl && book.coverUrl !== failedUrl) {
    const url = book.coverUrl
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        draggable={false}
        onError={() => setFailedUrl(url)}
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
