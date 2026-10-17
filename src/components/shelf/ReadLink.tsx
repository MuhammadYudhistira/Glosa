import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import { formatPercent } from "@/lib/progress"

export function ReadLink({
  bookId,
  percentage,
}: {
  bookId: string
  percentage: number
}) {
  return (
    <Link
      to="/read/$bookId"
      params={{ bookId }}
      // Preloading would download the whole EPUB on hover, and the reader would
      // reopen the book when the navigation loads it a second time.
      preload={false}
      className={buttonVariants({ size: "block" })}
    >
      {percentage > 0
        ? `Lanjutkan membaca · ${formatPercent(percentage)}`
        : "Mulai membaca"}
    </Link>
  )
}
